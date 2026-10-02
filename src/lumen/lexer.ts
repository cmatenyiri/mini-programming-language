import { type Diagnostic, type Span } from './diagnostics';
import { SYMBOLS, isKeyword, type TemplatePart, type Token, type TokenKind } from './tokens';

export interface LexResult {
  /** Every token, including comments, in source order. Always ends with an `eof` token. */
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdentStart = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isIdentPart = (c: string) => isIdentStart(c) || isDigit(c);

const ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '0': '\0',
  '\\': '\\',
  '"': '"',
  "'": "'",
  $: '$',
};

/**
 * Converts Lumen source text into a flat token stream.
 *
 * `offset` lets the parser lex the expressions embedded in string templates while
 * keeping spans relative to the full document.
 */
export class Lexer {
  private pos = 0;
  private readonly tokens: Token[] = [];
  private readonly diagnostics: Diagnostic[] = [];
  private sawNewline = false;
  private readonly src: string;
  private readonly offset: number;

  constructor(src: string, offset = 0) {
    this.src = src;
    this.offset = offset;
  }

  static lex(src: string, offset = 0): LexResult {
    return new Lexer(src, offset).run();
  }

  run(): LexResult {
    while (true) {
      this.skipWhitespace();
      if (this.pos >= this.src.length) break;
      this.next();
    }
    this.push('eof', this.pos, this.pos);
    return { tokens: this.tokens, diagnostics: this.diagnostics };
  }

  private span(start: number, end: number): Span {
    return { start: start + this.offset, end: end + this.offset };
  }

  private error(message: string, start: number, end: number, hint?: string) {
    this.diagnostics.push({
      severity: 'error',
      phase: 'lexer',
      message,
      span: this.span(start, Math.max(end, start + 1)),
      hint,
    });
  }

  private push(kind: TokenKind, start: number, end: number, extra: Partial<Token> = {}): Token {
    const token: Token = {
      kind,
      text: this.src.slice(start, end),
      span: this.span(start, end),
      nlBefore: this.sawNewline,
      ...extra,
    };
    this.tokens.push(token);
    if (kind !== 'comment') this.sawNewline = false;
    return token;
  }

  private skipWhitespace() {
    while (this.pos < this.src.length) {
      const c = this.src[this.pos];
      if (c === '\n') {
        this.sawNewline = true;
        this.pos++;
      } else if (c === ' ' || c === '\t' || c === '\r') {
        this.pos++;
      } else {
        break;
      }
    }
  }

  private next() {
    const start = this.pos;
    const c = this.src[this.pos];
    const n = this.src[this.pos + 1];

    if (c === '/' && n === '/') return this.lineComment(start);
    if (c === '/' && n === '*') return this.blockComment(start);
    if (isDigit(c)) return this.number(start);
    if (isIdentStart(c)) return this.identifier(start);
    if (c === '"') return this.string(start);

    for (const sym of SYMBOLS) {
      if (this.src.startsWith(sym, this.pos)) {
        this.pos += sym.length;
        this.push(sym, start, this.pos);
        return;
      }
    }

    this.pos++;
    if (c === "'") {
      this.error('Unexpected character "\'"', start, this.pos, 'Strings use double quotes: "text"');
    } else {
      this.error(`Unexpected character '${c}'`, start, this.pos);
    }
  }

  private lineComment(start: number) {
    while (this.pos < this.src.length && this.src[this.pos] !== '\n') this.pos++;
    this.push('comment', start, this.pos);
  }

  private blockComment(start: number) {
    this.pos += 2;
    let depth = 1;
    while (this.pos < this.src.length && depth > 0) {
      if (this.src.startsWith('/*', this.pos)) {
        depth++;
        this.pos += 2;
      } else if (this.src.startsWith('*/', this.pos)) {
        depth--;
        this.pos += 2;
      } else {
        if (this.src[this.pos] === '\n') this.sawNewline = true;
        this.pos++;
      }
    }
    if (depth > 0) this.error('Unterminated block comment', start, start + 2);
    this.push('comment', start, this.pos);
  }

  private identifier(start: number) {
    while (this.pos < this.src.length && isIdentPart(this.src[this.pos])) this.pos++;
    const text = this.src.slice(start, this.pos);
    this.push(isKeyword(text) ? text : 'ident', start, this.pos);
  }

  private number(start: number) {
    const src = this.src;
    const prev = this.tokens.at(-1);
    // `pair.0.1` must lex as `pair . 0 . 1`, never as a float.
    const afterDot = prev?.kind === '.' && prev.span.end === this.span(start, start).start;

    if (src[start] === '0' && (src[start + 1] === 'x' || src[start + 1] === 'b')) {
      const radix = src[start + 1] === 'x' ? 16 : 2;
      const valid = radix === 16 ? /[0-9a-fA-F_]/ : /[01_]/;
      this.pos += 2;
      while (this.pos < src.length && valid.test(src[this.pos])) this.pos++;
      const digits = src.slice(start + 2, this.pos).replaceAll('_', '');
      if (!digits) this.error('Expected digits after number prefix', start, this.pos);
      this.push('int', start, this.pos, { value: parseInt(digits || '0', radix) });
      return;
    }

    const digits = () => {
      while (this.pos < src.length && (isDigit(src[this.pos]) || src[this.pos] === '_')) this.pos++;
    };

    digits();
    let isFloat = false;
    if (!afterDot && src[this.pos] === '.' && isDigit(src[this.pos + 1] ?? '')) {
      isFloat = true;
      this.pos++;
      digits();
    }
    if (!afterDot && (src[this.pos] === 'e' || src[this.pos] === 'E')) {
      const save = this.pos;
      this.pos++;
      if (src[this.pos] === '+' || src[this.pos] === '-') this.pos++;
      if (isDigit(src[this.pos] ?? '')) {
        isFloat = true;
        digits();
      } else {
        this.pos = save;
      }
    }

    const text = src.slice(start, this.pos).replaceAll('_', '');
    const value = Number(text);
    if (!isFloat && !Number.isSafeInteger(value)) {
      this.error(
        'Integer literal is too large',
        start,
        this.pos,
        'Lumen ints are 53-bit safe integers',
      );
    }
    this.push(isFloat ? 'float' : 'int', start, this.pos, { value });
  }

  private string(start: number) {
    const src = this.src;
    this.pos++; // opening quote
    const parts: TemplatePart[] = [];
    let buffer = '';
    let textStart = this.pos;
    let terminated = false;

    while (this.pos < src.length) {
      const c = src[this.pos];
      if (c === '"') {
        terminated = true;
        break;
      }
      if (c === '\n') break;
      if (c === '\\') {
        const esc = src[this.pos + 1];
        if (esc !== undefined && esc in ESCAPES) {
          buffer += ESCAPES[esc];
          this.pos += 2;
        } else if (esc === 'u' && src[this.pos + 2] === '{') {
          const close = src.indexOf('}', this.pos + 3);
          const hex = close > 0 ? src.slice(this.pos + 3, close) : '';
          const code = parseInt(hex, 16);
          if (close < 0 || Number.isNaN(code) || code > 0x10ffff) {
            this.error('Invalid unicode escape', this.pos, this.pos + 2, 'Use \\u{1F600}');
            this.pos += 2;
          } else {
            buffer += String.fromCodePoint(code);
            this.pos = close + 1;
          }
        } else {
          this.error(
            `Unknown escape sequence '\\${esc ?? ''}'`,
            this.pos,
            this.pos + 2,
            'Supported escapes: \\n \\t \\r \\0 \\\\ \\" \\$ \\u{...}',
          );
          this.pos += 2;
        }
        continue;
      }
      if (c === '$' && src[this.pos + 1] === '{') {
        parts.push({ kind: 'text', value: buffer, span: this.span(textStart, this.pos) });
        buffer = '';
        const exprStart = this.pos + 2;
        const exprEnd = this.scanInterpolation(exprStart);
        if (exprEnd < 0) {
          this.error('Unterminated interpolation — missing "}"', this.pos, this.pos + 2);
          this.pos = src.length;
          break;
        }
        if (src.slice(exprStart, exprEnd).trim() === '') {
          this.error('Empty interpolation', this.pos, exprEnd + 1);
        }
        parts.push({ kind: 'expr', span: this.span(exprStart, exprEnd) });
        this.pos = exprEnd + 1;
        textStart = this.pos;
        continue;
      }
      buffer += c;
      this.pos++;
    }

    if (!terminated) {
      this.error('Unterminated string literal', start, this.pos, 'Add a closing "');
    } else {
      this.pos++; // closing quote
    }

    if (parts.length === 0) {
      this.push('string', start, this.pos, { value: buffer });
    } else {
      parts.push({
        kind: 'text',
        value: buffer,
        span: this.span(textStart, terminated ? this.pos - 1 : this.pos),
      });
      this.push('template', start, this.pos, { parts });
    }
  }

  /** Returns the index of the `}` closing an interpolation, or -1. Handles nested braces and strings. */
  private scanInterpolation(from: number): number {
    const src = this.src;
    let depth = 0;
    let i = from;
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') return -1;
      if (c === '"') {
        i++;
        while (i < src.length && src[i] !== '"' && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
        i++;
        continue;
      }
      if (c === '{') depth++;
      if (c === '}') {
        if (depth === 0) return i;
        depth--;
      }
      i++;
    }
    return -1;
  }
}
