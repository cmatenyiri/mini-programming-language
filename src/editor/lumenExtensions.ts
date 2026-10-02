import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippetCompletion,
} from '@codemirror/autocomplete';
import { indentService, indentUnit } from '@codemirror/language';
import { type Extension, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  hoverTooltip,
} from '@codemirror/view';
import { BUILTIN_FUNCTIONS, BUILTIN_VALUES, KEYWORD_DOCS } from '../lumen/builtins';
import type { Span } from '../lumen/diagnostics';
import { highlight } from '../lumen/highlight';
import type { Analysis } from '../lumen/index';
import { KEYWORDS } from '../lumen/tokens';
import { renderCodeInto } from './renderCode';

/* ─────────────────────────── syntax highlighting ─────────────────────────── */

const markCache = new Map<string, Decoration>();
const mark = (cls: string) => {
  let deco = markCache.get(cls);
  if (!deco) {
    deco = Decoration.mark({ class: `tok-${cls}` });
    markCache.set(cls, deco);
  }
  return deco;
};

function buildHighlights(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const spans = highlight(view.state.doc.toString()).sort((a, b) => a.from - b.from);
  for (const s of spans) builder.add(s.from, s.to, mark(s.cls));
  return builder.finish();
}

/** Syntax highlighting driven by Lumen's own lexer. */
export const lumenHighlighting = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildHighlights(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) this.decorations = buildHighlights(update.view);
    }
  },
  { decorations: (v) => v.decorations },
);

/* ─────────────────────────── external highlight (from panels) ─────────────────────────── */

export const setFlash = StateEffect.define<Span | null>();
const flashMark = Decoration.mark({ class: 'cm-lumen-flash' });

export const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setFlash)) continue;
      const span = effect.value;
      if (!span) return Decoration.none;
      const len = tr.state.doc.length;
      const from = Math.min(span.start, len);
      const to = Math.min(Math.max(span.end, from + 1), len);
      value = from < to ? Decoration.set([flashMark.range(from, to)]) : Decoration.none;
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/* ─────────────────────────── indentation & language data ─────────────────────────── */

const leadingSpaces = (text: string) => /^\s*/.exec(text)![0].replace(/\t/g, '  ').length;

/** Brace-based auto-indentation: indent after an opening bracket, dedent closing ones. */
export const lumenIndent = indentService.of((cx, pos) => {
  const cur = cx.lineAt(pos, 1);
  let prev = cx.lineAt(pos, -1);
  if (prev.from === cur.from) {
    if (cur.from === 0) return 0;
    prev = cx.lineAt(cur.from - 1, -1);
  }
  while (prev.text.trim() === '' && prev.from > 0) prev = cx.lineAt(prev.from - 1, -1);
  const prevText = prev.text.replace(/\/\/.*$/, '').trimEnd();
  let indent = leadingSpaces(prev.text);
  if (/[{[(]$/.test(prevText)) indent += cx.unit;
  if (/^[}\])]/.test(cx.textAfterPos(pos, 1).trimStart())) indent -= cx.unit;
  return Math.max(0, indent);
});

export const lumenLanguageData = [
  indentUnit.of('  '),
  EditorView.contentAttributes.of({
    spellcheck: 'false',
    autocorrect: 'off',
    autocapitalize: 'off',
  }),
];

/* ─────────────────────────── hover tooltips ─────────────────────────── */

export function lumenHover(getAnalysis: () => Analysis | null): Extension {
  return hoverTooltip(
    (_view, pos) => {
      const analysis = getAnalysis();
      const hovers = analysis?.check?.hovers;
      if (!hovers) return null;
      const hit = hovers.find(
        (h) => h.span.start <= pos && pos <= h.span.end && h.span.end > h.span.start,
      );
      if (!hit) return null;
      return {
        pos: hit.span.start,
        end: hit.span.end,
        above: true,
        create: () => {
          const dom = document.createElement('div');
          dom.className = 'cm-lumen-hover';
          const code = document.createElement('div');
          code.className = 'cm-lumen-hover-code';
          renderCodeInto(code, hit.code);
          dom.appendChild(code);
          if (hit.doc) {
            const doc = document.createElement('div');
            doc.className = 'cm-lumen-hover-doc';
            doc.textContent = hit.doc;
            dom.appendChild(doc);
          }
          return { dom };
        },
      };
    },
    { hoverTime: 280 },
  );
}

/* ─────────────────────────── autocompletion ─────────────────────────── */

const SNIPPETS: Completion[] = [
  snippetCompletion('fn ${name}(${params}) -> ${int} {\n\t${}\n}', {
    label: 'fn',
    detail: 'function declaration',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('let ${name} = ${value}', {
    label: 'let',
    detail: 'immutable binding',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('var ${name} = ${value}', {
    label: 'var',
    detail: 'mutable binding',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('for ${item} in ${items} {\n\t${}\n}', {
    label: 'for',
    detail: 'for loop',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('while ${condition} {\n\t${}\n}', {
    label: 'while',
    detail: 'while loop',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('if ${condition} {\n\t${}\n}', {
    label: 'if',
    detail: 'conditional',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('match ${value} {\n\t${pattern} => ${result},\n\t_ => ${fallback},\n}', {
    label: 'match',
    detail: 'pattern match',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('struct ${Name} {\n\t${field}: ${int},\n}', {
    label: 'struct',
    detail: 'struct declaration',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('enum ${Name} {\n\t${Variant},\n}', {
    label: 'enum',
    detail: 'enum declaration',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('impl ${Name} {\n\tfn ${method}(self) {\n\t\t${}\n\t}\n}', {
    label: 'impl',
    detail: 'methods block',
    type: 'keyword',
    boost: 2,
  }),
  snippetCompletion('fn(${x}) => ${x}', { label: 'lambda', detail: 'fn(x) => …', type: 'keyword' }),
  snippetCompletion('print(${})', {
    label: 'print',
    detail: 'print(values...)',
    type: 'function',
    boost: 3,
  }),
];

const SNIPPET_LABELS = new Set(SNIPPETS.map((s) => s.label));

const KEYWORD_COMPLETIONS: Completion[] = KEYWORDS.filter((k) => !SNIPPET_LABELS.has(k)).map(
  (k) => ({
    label: k,
    type: 'keyword',
    info: KEYWORD_DOCS[k],
  }),
);

const TYPE_COMPLETIONS: Completion[] = [
  'int',
  'float',
  'bool',
  'string',
  'void',
  'option',
  'result',
].map((t) => ({
  label: t,
  type: 'type',
  detail: 'builtin type',
}));

const BUILTIN_COMPLETIONS: Completion[] = [
  ...BUILTIN_FUNCTIONS.filter((f) => f.name !== 'print').map((f) => ({
    label: f.name,
    type: 'function',
    detail: f.signature,
    info: f.doc,
  })),
  ...BUILTIN_VALUES.map((v) => ({
    label: v.name,
    type: 'constant',
    detail: v.signature,
    info: v.doc,
  })),
  ...['Some', 'None', 'Ok', 'Err'].map((v) => ({
    label: v,
    type: 'enum',
    detail: 'builtin variant',
  })),
];

export function lumenCompletions(getAnalysis: () => Analysis | null) {
  return (context: CompletionContext): CompletionResult | null => {
    const analysis = getAnalysis();
    const check = analysis?.check;
    const member = context.matchBefore(/[A-Za-z_][\w]*\.\w*$/);
    if (member) {
      const dot = member.text.lastIndexOf('.');
      const objName = member.text.slice(0, dot);
      if (!check) return null;
      let members = /^[A-Z]/.test(objName) ? check.staticMembersOf(objName) : [];
      if (!members.length) {
        const candidates = check.symbols.filter((s) => s.name === objName && s.typeRef);
        const before = candidates.filter((s) => s.span.start <= context.pos);
        const sym = (before.length ? before : candidates).sort(
          (a, b) => b.span.start - a.span.start,
        )[0];
        if (sym?.typeRef) members = check.membersOf(sym.typeRef);
      }
      if (!members.length) return null;
      return {
        from: member.from + dot + 1,
        options: members.map((m) => ({
          label: m.label,
          type: m.kind === 'field' ? 'property' : m.kind === 'variant' ? 'enum' : m.kind,
          detail: m.detail,
          info: m.doc,
          apply: m.kind === 'method' || m.kind === 'function' ? `${m.label}()` : undefined,
          boost: m.kind === 'field' ? 2 : m.kind === 'variant' ? 1 : 0,
        })),
        validFor: /^\w*$/,
      };
    }

    const word = context.matchBefore(/[A-Za-z_]\w*/);
    if (!word && !context.explicit) return null;
    if (word && word.from > 0 && /\d/.test(context.state.sliceDoc(word.from - 1, word.from)))
      return null;

    const seen = new Set<string>();
    const user: Completion[] = [];
    for (const s of check?.symbols ?? []) {
      if (s.hidden || s.kind === 'field' || s.kind === 'method' || seen.has(s.name)) continue;
      seen.add(s.name);
      const type =
        s.kind === 'function'
          ? 'function'
          : s.kind === 'struct'
            ? 'class'
            : s.kind === 'enum'
              ? 'enum'
              : s.kind === 'type-alias'
                ? 'type'
                : 'variable';
      user.push({ label: s.name, type, detail: s.type, boost: 1 });
    }
    return {
      from: word?.from ?? context.pos,
      options: [
        ...user,
        ...SNIPPETS,
        ...KEYWORD_COMPLETIONS,
        ...BUILTIN_COMPLETIONS,
        ...TYPE_COMPLETIONS,
      ],
      validFor: /^\w*$/,
    };
  };
}
