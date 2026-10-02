import { AbortRun, type ExecutionResult, analyze, execute } from './index';
import type { Diagnostic } from './diagnostics';

export type WorkerRequest = { type: 'run'; id: number; source: string };

export type WorkerResponse =
  | { type: 'output'; id: number; lines: string[] }
  | { type: 'compile-error'; id: number; diagnostics: Diagnostic[] }
  | { type: 'done'; id: number; result: ExecutionResult; outputTruncated: boolean }
  | { type: 'crash'; id: number; message: string };

const MAX_LINES = 20_000;
const FLUSH_MS = 30;

const post = (message: WorkerResponse) => postMessage(message);

class OutputLimitExceeded extends AbortRun {}

onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, source } = event.data;
  let buffer: string[] = [];
  let lastFlush = performance.now();
  let total = 0;
  const flush = () => {
    if (buffer.length) post({ type: 'output', id, lines: buffer });
    buffer = [];
    lastFlush = performance.now();
  };

  try {
    const analysis = analyze(source);
    if (!analysis.ok) {
      post({
        type: 'compile-error',
        id,
        diagnostics: analysis.diagnostics.filter((d) => d.severity === 'error'),
      });
      return;
    }
    let truncated = false;
    const result = execute(analysis, (line) => {
      total++;
      if (total > MAX_LINES) {
        truncated = true;
        throw new OutputLimitExceeded();
      }
      buffer.push(line);
      if (performance.now() - lastFlush > FLUSH_MS) flush();
    });
    flush();
    post({ type: 'done', id, result, outputTruncated: truncated });
  } catch (err) {
    flush();
    if (err instanceof OutputLimitExceeded) {
      post({
        type: 'done',
        id,
        outputTruncated: true,
        result: { ok: true, stats: { calls: 0, maxDepth: 0 }, durationMs: 0 },
      });
      return;
    }
    post({ type: 'crash', id, message: err instanceof Error ? err.message : String(err) });
  }
};
