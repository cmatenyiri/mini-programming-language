import type { SyntaxClass } from '../../theme/tokens';

export interface JsToken {
  text: string;
  cls?: SyntaxClass;
}

const KEYWORDS = new Set([
  'function',
  'const',
  'let',
  'return',
  'if',
  'else',
  'for',
  'of',
  'while',
  'break',
  'continue',
  'new',
  'use strict',
]);
const CONSTANTS = new Set(['true', 'false', 'undefined', 'null']);

const TOKEN =
  /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)|(=>|===|!==|[-+*/%<>=!&|?:]+)|([()[\]{},.;])|(\s+)|(.)/g;

/** A tiny highlighter for the JavaScript produced by the Lumen code generator. */
export function highlightJs(line: string): JsToken[] {
  const out: JsToken[] = [];
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    const [text, comment, string, number, ident, operator, punct] = m;
    if (comment) out.push({ text, cls: 'comment' });
    else if (string) out.push({ text, cls: string === '"use strict"' ? 'comment' : 'string' });
    else if (number) out.push({ text, cls: 'number' });
    else if (ident) {
      const next = line[TOKEN.lastIndex];
      if (KEYWORDS.has(ident)) out.push({ text, cls: 'keyword' });
      else if (CONSTANTS.has(ident)) out.push({ text, cls: 'constant' });
      else if (ident === 'rt') out.push({ text, cls: 'type' });
      else if (next === '(') out.push({ text, cls: 'function' });
      else if (line[m.index - 1] === '.') out.push({ text, cls: 'property' });
      else if (ident.startsWith('$')) out.push({ text, cls: 'comment' });
      else out.push({ text, cls: 'identifier' });
    } else if (operator) out.push({ text, cls: 'operator' });
    else if (punct) out.push({ text, cls: 'punctuation' });
    else out.push({ text });
  }
  return out;
}
