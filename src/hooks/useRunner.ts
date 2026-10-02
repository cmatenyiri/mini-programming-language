import { useCallback, useEffect, useRef, useState } from 'react';
import type { Diagnostic, Span } from '../lumen/diagnostics';
import type { RuntimeFailure } from '../lumen/index';
import type { RunStats } from '../lumen/runtime';
import type { WorkerRequest, WorkerResponse } from '../lumen/worker';

export type RunStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'runtime-error'
  | 'compile-error'
  | 'stopped'
  | 'timeout'
  | 'crashed';

export interface OutputLine {
  id: number;
  kind: 'out' | 'error' | 'trace' | 'info';
  text: string;
  span?: Span;
  line?: number;
}

export interface RunSummary {
  status: RunStatus;
  durationMs: number;
  stats?: RunStats;
  error?: RuntimeFailure;
  diagnostics?: Diagnostic[];
  truncated?: boolean;
}

const MAX_KEPT_LINES = 20_000;
export const RUN_TIMEOUT_MS = 15_000;

let lineId = 0;
const mk = (
  kind: OutputLine['kind'],
  text: string,
  extra: Partial<OutputLine> = {},
): OutputLine => ({
  id: ++lineId,
  kind,
  text,
  ...extra,
});

/** Runs Lumen programs in a Web Worker so that long or infinite loops never freeze the UI. */
export function useRunner() {
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);
  const timeoutRef = useRef<number | undefined>(undefined);
  const startRef = useRef(0);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const append = useCallback((items: OutputLine[]) => {
    setLines((prev) => {
      const next = prev.concat(items);
      return next.length > MAX_KEPT_LINES ? next.slice(next.length - MAX_KEPT_LINES) : next;
    });
  }, []);

  const kill = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    window.clearTimeout(timeoutRef.current);
  }, []);

  const finish = useCallback((next: RunSummary) => {
    window.clearTimeout(timeoutRef.current);
    setStatus(next.status);
    setSummary(next);
    setStartedAt(null);
  }, []);

  const run = useCallback(
    (source: string) => {
      kill();
      const id = ++runIdRef.current;
      const worker = new Worker(new URL('../lumen/worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      startRef.current = performance.now();
      setLines([]);
      setSummary(null);
      setStatus('running');
      setStartedAt(Date.now());

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.id !== runIdRef.current) return;
        const elapsed = performance.now() - startRef.current;
        switch (msg.type) {
          case 'output':
            append(msg.lines.map((text) => mk('out', text)));
            break;
          case 'compile-error': {
            const n = msg.diagnostics.length;
            append([
              mk(
                'error',
                `Compilation failed with ${n} error${n === 1 ? '' : 's'} — see Problems.`,
              ),
            ]);
            finish({ status: 'compile-error', durationMs: elapsed, diagnostics: msg.diagnostics });
            break;
          }
          case 'done': {
            const { result } = msg;
            const extra: OutputLine[] = [];
            if (msg.outputTruncated) {
              extra.push(
                mk('info', 'Output limit reached (20,000 lines) — the program was stopped.'),
              );
            }
            if (result.error) {
              const err = result.error;
              extra.push(
                mk('error', `Runtime error: ${err.message}`, { span: err.span, line: err.line }),
              );
              for (const frame of err.stack) {
                extra.push(
                  mk('trace', `at ${frame.name} (line ${frame.line})`, {
                    span: frame.span,
                    line: frame.line,
                  }),
                );
              }
            }
            if (extra.length) append(extra);
            finish({
              status: result.ok ? 'success' : 'runtime-error',
              durationMs: result.durationMs,
              stats: result.stats,
              error: result.error,
              truncated: msg.outputTruncated,
            });
            worker.terminate();
            if (workerRef.current === worker) workerRef.current = null;
            break;
          }
          case 'crash':
            append([mk('error', `Internal error: ${msg.message}`)]);
            finish({ status: 'crashed', durationMs: elapsed });
            break;
        }
      };
      worker.onerror = (event) => {
        if (id !== runIdRef.current) return;
        append([mk('error', `Internal error: ${event.message}`)]);
        finish({ status: 'crashed', durationMs: performance.now() - startRef.current });
      };

      timeoutRef.current = window.setTimeout(() => {
        if (id !== runIdRef.current) return;
        kill();
        append([
          mk('info', `Stopped after ${RUN_TIMEOUT_MS / 1000}s — is there an infinite loop?`),
        ]);
        finish({ status: 'timeout', durationMs: RUN_TIMEOUT_MS });
      }, RUN_TIMEOUT_MS);

      const request: WorkerRequest = { type: 'run', id, source };
      worker.postMessage(request);
    },
    [append, finish, kill],
  );

  const stop = useCallback(() => {
    if (!workerRef.current) return;
    runIdRef.current++;
    kill();
    append([mk('info', 'Execution stopped.')]);
    finish({ status: 'stopped', durationMs: performance.now() - startRef.current });
  }, [append, finish, kill]);

  const clear = useCallback(() => {
    setLines([]);
    if (status !== 'running') {
      setSummary(null);
      setStatus('idle');
    }
  }, [status]);

  useEffect(() => kill, [kill]);

  return { run, stop, clear, status, lines, summary, startedAt };
}
