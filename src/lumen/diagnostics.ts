/** A half-open source range `[start, end)` measured in UTF-16 code units. */
export interface Span {
  start: number;
  end: number;
}

export type Phase = 'lexer' | 'parser' | 'checker' | 'runtime';
export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  phase: Phase;
  message: string;
  span: Span;
  hint?: string;
}

export const span = (start: number, end: number): Span => ({ start, end });

export const joinSpans = (a: Span, b: Span): Span => ({
  start: Math.min(a.start, b.start),
  end: Math.max(a.end, b.end),
});

/** Maps offsets to 1-based line/column positions. */
export class LineIndex {
  private readonly lineStarts: number[] = [0];

  constructor(source: string) {
    for (let i = 0; i < source.length; i++) {
      if (source.charCodeAt(i) === 10) this.lineStarts.push(i + 1);
    }
  }

  get lineCount(): number {
    return this.lineStarts.length;
  }

  position(offset: number): { line: number; column: number } {
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - this.lineStarts[lo] + 1 };
  }
}

/** Error thrown inside a phase to abort it with a diagnostic. */
export class LumenError extends Error {
  readonly span: Span;
  readonly phase: Phase;
  readonly hint?: string;

  constructor(phase: Phase, message: string, span: Span, hint?: string) {
    super(message);
    this.phase = phase;
    this.span = span;
    this.hint = hint;
  }

  toDiagnostic(): Diagnostic {
    return {
      severity: 'error',
      phase: this.phase,
      message: this.message,
      span: this.span,
      hint: this.hint,
    };
  }
}
