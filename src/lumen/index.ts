import type { Program } from './ast';
import { Checker, type CheckResult } from './checker';
import { Codegen, type CompiledProgram } from './codegen';
import { type Diagnostic, LineIndex, type Span } from './diagnostics';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { type RunStats, Runtime, RuntimeError, type StackFrame } from './runtime';
import type { Token } from './tokens';

export interface PhaseTimings {
  lex: number;
  parse: number;
  check: number;
  codegen: number;
}

export interface Analysis {
  source: string;
  tokens: Token[];
  program: Program;
  nodeCount: number;
  check: CheckResult | null;
  /** The generated JavaScript, available when the program has no errors. */
  compiled: CompiledProgram | null;
  diagnostics: Diagnostic[];
  timings: PhaseTimings;
  /** True when there are no errors, so the program can run. */
  ok: boolean;
}

const now = () => performance.now();

/** Runs the compiler: lexer → parser → type checker → code generator. */
export function analyze(source: string): Analysis {
  const t0 = now();
  const lexed = Lexer.lex(source);
  const t1 = now();
  const parsed = Parser.parse(source, lexed.tokens);
  const t2 = now();
  // An unterminated string/comment swallows the rest of the file; errors the parser then
  // reports at the very end are just echoes of the lexer error.
  const parserErrors = lexed.diagnostics.length
    ? parsed.diagnostics.filter((d) => d.span.start < source.length)
    : parsed.diagnostics;
  const syntaxErrors = [...lexed.diagnostics, ...parserErrors];
  const check = syntaxErrors.length === 0 ? Checker.check(parsed.program) : null;
  const t3 = now();
  const diagnostics = [...syntaxErrors, ...(check?.diagnostics ?? [])].sort(
    (a, b) => a.span.start - b.span.start,
  );
  const ok = !diagnostics.some((d) => d.severity === 'error');
  const compiled = ok && check ? Codegen.generate(parsed.program, check.registry) : null;
  const t4 = now();
  return {
    source,
    tokens: lexed.tokens,
    program: parsed.program,
    nodeCount: parsed.nodeCount,
    check,
    compiled,
    diagnostics,
    timings: { lex: t1 - t0, parse: t2 - t1, check: t3 - t2, codegen: t4 - t3 },
    ok,
  };
}

export interface RuntimeFailure {
  message: string;
  span: Span;
  line: number;
  column: number;
  stack: (StackFrame & { line: number })[];
}

export interface ExecutionResult {
  ok: boolean;
  error?: RuntimeFailure;
  stats: RunStats;
  durationMs: number;
}

/** Errors thrown by the output callback (e.g. an output limit) abort the run unchanged. */
export class AbortRun extends Error {}

/** Runs a compiled program. `output` receives every printed line. */
export function execute(analysis: Analysis, output: (line: string) => void): ExecutionResult {
  const compiled = analysis.compiled!;
  const runtime = new Runtime({
    spans: compiled.spans,
    types: compiled.types,
    names: compiled.names,
    registry: analysis.check!.registry,
    output,
  });
  const lines = new LineIndex(analysis.source);
  const start = now();
  const failure = (err: RuntimeError): ExecutionResult => {
    const pos = lines.position(err.span.start);
    return {
      ok: false,
      stats: runtime.stats,
      durationMs: now() - start,
      error: {
        message: err.message,
        span: err.span,
        line: pos.line,
        column: pos.column,
        stack: collapseFrames(err.frames).map((f) => ({
          ...f,
          line: lines.position(f.span.start).line,
        })),
      },
    };
  };
  try {
    const program = new Function('rt', compiled.code) as (rt: Runtime) => void;
    program(runtime);
    return { ok: true, stats: runtime.stats, durationMs: now() - start };
  } catch (err) {
    if (err instanceof AbortRun) throw err;
    if (err instanceof RuntimeError) return failure(err);
    if (err instanceof RangeError && /call stack/i.test(err.message)) {
      return failure(
        runtime.error('Stack overflow — the recursion is too deep (is a base case missing?)'),
      );
    }
    if (err instanceof ReferenceError) {
      // Reading a global before its `let` ran (e.g. a function called too early).
      const js = /'([^']+)'/.exec(err.message)?.[1];
      const binding = js ? compiled.bindings[js] : undefined;
      if (binding) {
        const e = runtime.error(`'${binding.name}' is used before it is initialized`);
        return failure(e);
      }
    }
    throw err;
  }
}

/** Collapses consecutive identical frames (deep recursion) into one. */
function collapseFrames(frames: StackFrame[]): StackFrame[] {
  const out: StackFrame[] = [];
  for (const f of frames) {
    const prev = out[out.length - 1];
    if (prev && prev.name === f.name && prev.span.start === f.span.start) continue;
    out.push(f);
  }
  return out;
}

export { LineIndex };
export type { CompiledProgram, Diagnostic };
