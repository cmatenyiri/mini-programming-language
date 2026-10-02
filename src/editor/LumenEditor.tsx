import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  toggleComment,
} from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import {
  type Diagnostic as CmDiagnostic,
  lintGutter,
  lintKeymap,
  setDiagnostics,
} from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorSelection, EditorState, Prec } from '@codemirror/state';
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Diagnostic, Span } from '../lumen/diagnostics';
import type { Analysis } from '../lumen/index';
import { lumenEditorTheme } from './editorTheme';
import {
  flashField,
  lumenCompletions,
  lumenHighlighting,
  lumenHover,
  lumenIndent,
  lumenLanguageData,
  setFlash,
} from './lumenExtensions';

export interface CursorInfo {
  pos: number;
  line: number;
  column: number;
  selected: number;
}

export interface LumenEditorHandle {
  getValue(): string;
  setValue(value: string): void;
  flash(span: Span | null): void;
  reveal(span: Span): void;
  focus(): void;
}

interface Props {
  initialValue: string;
  diagnostics: Diagnostic[];
  getAnalysis: () => Analysis | null;
  onChange: (value: string) => void;
  onCursor?: (cursor: CursorInfo) => void;
  onRun: () => void;
  onSave: () => void;
}

const PHASE_LABEL: Record<Diagnostic['phase'], string> = {
  lexer: 'Lexer',
  parser: 'Parser',
  checker: 'Type checker',
  runtime: 'Runtime',
};

function toCmDiagnostics(diags: Diagnostic[], docLength: number): CmDiagnostic[] {
  return diags.map((d) => {
    const from = Math.min(d.span.start, docLength);
    let to = Math.min(Math.max(d.span.end, from), docLength);
    if (to === from && from < docLength) to = from + 1;
    return {
      from,
      to,
      severity: d.severity,
      message: d.message,
      renderMessage: () => {
        const el = document.createElement('div');
        const phase = document.createElement('div');
        phase.className = 'cm-lumen-diag-phase';
        phase.textContent = `${PHASE_LABEL[d.phase]} · ${d.severity}`;
        const msg = document.createElement('div');
        msg.textContent = d.message;
        el.append(phase, msg);
        if (d.hint) {
          const hint = document.createElement('div');
          hint.className = 'cm-lumen-diag-hint';
          const b = document.createElement('b');
          b.textContent = 'Hint: ';
          hint.append(b, document.createTextNode(d.hint));
          el.append(hint);
        }
        return el;
      },
    };
  });
}

export const LumenEditor = forwardRef<LumenEditorHandle, Props>(function LumenEditor(
  { initialValue, diagnostics, getAnalysis, onChange, onCursor, onRun, onSave },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onCursor, onRun, onSave, getAnalysis });

  useEffect(() => {
    callbacks.current = { onChange, onCursor, onRun, onSave, getAnalysis };
  });

  useEffect(() => {
    const host = hostRef.current!;
    const getAnalysisLatest = () => callbacks.current.getAnalysis();
    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        lintGutter(),
        autocompletion({
          override: [lumenCompletions(getAnalysisLatest)],
          icons: true,
          activateOnTypingDelay: 80,
        }),
        lumenHover(getAnalysisLatest),
        lumenHighlighting,
        lumenIndent,
        lumenLanguageData,
        flashField,
        EditorState.languageData.of(() => [
          {
            commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
            closeBrackets: { brackets: ['(', '[', '{', '"'] },
            indentOnInput: /^\s*[}\])]$/,
          },
        ]),
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              preventDefault: true,
              run: () => (callbacks.current.onRun(), true),
            },
            {
              key: 'Shift-Enter',
              preventDefault: true,
              run: () => (callbacks.current.onRun(), true),
            },
            { key: 'Mod-s', preventDefault: true, run: () => (callbacks.current.onSave(), true) },
            { key: 'Mod-/', run: toggleComment },
          ]),
        ),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        lumenEditorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          if (update.docChanged || update.selectionSet) {
            const sel = update.state.selection.main;
            const line = update.state.doc.lineAt(sel.head);
            callbacks.current.onCursor?.({
              pos: sel.head,
              line: line.number,
              column: sel.head - line.from + 1,
              selected: Math.abs(sel.to - sel.from),
            });
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is created once; later value changes go through the imperative handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, toCmDiagnostics(diagnostics, view.state.doc.length)));
  }, [diagnostics]);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => viewRef.current?.state.doc.toString() ?? '',
      setValue(value: string) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: value },
          selection: EditorSelection.cursor(0),
          scrollIntoView: true,
        });
      },
      flash(span: Span | null) {
        viewRef.current?.dispatch({ effects: setFlash.of(span) });
      },
      reveal(span: Span) {
        const view = viewRef.current;
        if (!view) return;
        const len = view.state.doc.length;
        const from = Math.min(span.start, len);
        const to = Math.min(span.end, len);
        view.dispatch({
          selection: EditorSelection.range(from, to),
          effects: [EditorView.scrollIntoView(from, { y: 'center' }), setFlash.of(span)],
        });
        view.focus();
      },
      focus: () => viewRef.current?.focus(),
    }),
    [],
  );

  return (
    <div ref={hostRef} style={{ height: '100%', overflow: 'hidden' }} data-testid="lumen-editor" />
  );
});
