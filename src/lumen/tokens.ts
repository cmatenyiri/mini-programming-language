import type { Span } from './diagnostics';

export const KEYWORDS = [
  'let',
  'var',
  'fn',
  'return',
  'if',
  'else',
  'while',
  'for',
  'in',
  'loop',
  'break',
  'continue',
  'match',
  'struct',
  'enum',
  'impl',
  'type',
  'true',
  'false',
  'self',
  'as',
] as const;

export type Keyword = (typeof KEYWORDS)[number];

/** Operators and punctuation, longest first so the lexer can greedily match. */
export const SYMBOLS = [
  '..=',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '->',
  '=>',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '**',
  '..',
  '??',
  '|>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '=',
  '<',
  '>',
  '!',
  '.',
  ',',
  ':',
  ';',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  '?',
  '|',
] as const;

export type SymbolKind = (typeof SYMBOLS)[number];

export type TokenKind =
  Keyword | SymbolKind | 'ident' | 'int' | 'float' | 'string' | 'template' | 'comment' | 'eof';

export type TemplatePart =
  { kind: 'text'; value: string; span: Span } | { kind: 'expr'; span: Span };

export interface Token {
  kind: TokenKind;
  text: string;
  span: Span;
  /** True when at least one line break separates this token from the previous significant token. */
  nlBefore: boolean;
  /** Decoded literal value for numbers and plain strings. */
  value?: number | string;
  /** Pieces of an interpolated string (`"Hello, ${name}!"`). */
  parts?: TemplatePart[];
}

export type TokenCategory =
  | 'keyword'
  | 'identifier'
  | 'type'
  | 'number'
  | 'string'
  | 'operator'
  | 'punctuation'
  | 'comment'
  | 'eof';

const KEYWORD_SET: ReadonlySet<string> = new Set(KEYWORDS);
export const PRIMITIVE_TYPES: ReadonlySet<string> = new Set([
  'int',
  'float',
  'bool',
  'string',
  'void',
]);
const PUNCTUATION: ReadonlySet<string> = new Set([
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  ',',
  ';',
  ':',
  '.',
]);

export const isKeyword = (text: string): text is Keyword => KEYWORD_SET.has(text);

export const isTypeName = (text: string): boolean =>
  PRIMITIVE_TYPES.has(text) || /^[A-Z]/.test(text);

export function tokenCategory(token: Token): TokenCategory {
  switch (token.kind) {
    case 'ident':
      return isTypeName(token.text) ? 'type' : 'identifier';
    case 'int':
    case 'float':
      return 'number';
    case 'string':
    case 'template':
      return 'string';
    case 'comment':
      return 'comment';
    case 'eof':
      return 'eof';
    default:
      if (isKeyword(token.kind)) return 'keyword';
      return PUNCTUATION.has(token.kind) ? 'punctuation' : 'operator';
  }
}

export function describeToken(token: Token): string {
  switch (token.kind) {
    case 'eof':
      return 'end of file';
    case 'ident':
      return `identifier '${token.text}'`;
    case 'int':
    case 'float':
      return `number ${token.text}`;
    case 'string':
    case 'template':
      return 'string literal';
    default:
      return `'${token.text}'`;
  }
}
