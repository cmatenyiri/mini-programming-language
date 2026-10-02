import type { SyntaxClass } from '../theme/tokens';
import { Lexer } from './lexer';
import { PRIMITIVE_TYPES, type Token, isKeyword } from './tokens';

export interface HighlightSpan {
  from: number;
  to: number;
  cls: SyntaxClass;
}

const CONSTANT_IDENTS: ReadonlySet<string> = new Set(['Some', 'None', 'Ok', 'Err']);
const PUNCT: ReadonlySet<string> = new Set(['(', ')', '{', '}', '[', ']', ',', ';', ':', '.']);

function classify(tokens: Token[], i: number): SyntaxClass | null {
  const t = tokens[i];
  switch (t.kind) {
    case 'comment':
      return 'comment';
    case 'int':
    case 'float':
      return 'number';
    case 'string':
      return 'string';
    case 'true':
    case 'false':
      return 'constant';
    case 'eof':
      return null;
    case 'ident': {
      const text = t.text;
      if (CONSTANT_IDENTS.has(text)) return 'constant';
      if (PRIMITIVE_TYPES.has(text) || text === 'option' || text === 'result') return 'type';
      if (/^[A-Z][A-Z0-9_]+$/.test(text)) return 'constant';
      if (/^[A-Z]/.test(text)) return 'type';
      let j = i + 1;
      while (tokens[j]?.kind === 'comment') j++;
      const next = tokens[j];
      let k = i - 1;
      while (k >= 0 && tokens[k].kind === 'comment') k--;
      const prev = tokens[k];
      if (next?.kind === '(' && next.span.start === t.span.end) return 'function';
      if (prev?.kind === '.') return 'property';
      return 'identifier';
    }
    default:
      if (isKeyword(t.kind)) return 'keyword';
      return PUNCT.has(t.kind) ? 'punctuation' : 'operator';
  }
}

/** Classifies every token of `source` for syntax highlighting, using Lumen's own lexer. */
export function highlight(source: string, offset = 0, out: HighlightSpan[] = []): HighlightSpan[] {
  const { tokens } = Lexer.lex(source, offset);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'template') {
      let cursor = t.span.start;
      for (const part of t.parts ?? []) {
        if (part.kind !== 'expr') continue;
        const open = part.span.start - 2;
        if (open > cursor) out.push({ from: cursor, to: open, cls: 'string' });
        out.push({ from: open, to: part.span.start, cls: 'interpolation' });
        const inner = source.slice(part.span.start - offset, part.span.end - offset);
        highlight(inner, part.span.start, out);
        out.push({ from: part.span.end, to: part.span.end + 1, cls: 'interpolation' });
        cursor = part.span.end + 1;
      }
      if (t.span.end > cursor) out.push({ from: cursor, to: t.span.end, cls: 'string' });
      continue;
    }
    const cls = classify(tokens, i);
    if (cls && t.span.end > t.span.start) out.push({ from: t.span.start, to: t.span.end, cls });
  }
  return out;
}
