import { EditorView } from '@codemirror/view';
import { colors, fonts, syntax } from '../theme/tokens';

const tokenStyles = Object.fromEntries(
  Object.entries(syntax).map(([cls, color]) => [
    `.tok-${cls}`,
    {
      color,
      ...(cls === 'comment' ? { fontStyle: 'italic' } : {}),
      ...(cls === 'keyword' ? { fontWeight: '500' } : {}),
    },
  ]),
);

/** The code editor's look, matched to the app theme. */
export const lumenEditorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      color: colors.text,
      backgroundColor: 'transparent',
      fontSize: 'var(--editor-font-size, 14px)',
    },
    '.cm-scroller': {
      fontFamily: fonts.mono,
      lineHeight: '1.7',
      fontVariantLigatures: 'none',
      fontFeatureSettings: '"calt" 0, "liga" 0',
    },
    '.cm-content': { padding: '14px 0 40vh', caretColor: colors.amber },
    '.cm-line': { padding: '0 18px 0 6px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeft: `2px solid ${colors.amber}`, marginLeft: '-1px' },
    '&.cm-focused .cm-cursor': { boxShadow: `0 0 8px ${colors.amber}` },
    '.cm-selectionBackground': { background: 'rgba(255, 181, 71, 0.13) !important' },
    '&.cm-focused .cm-selectionBackground': { background: 'rgba(255, 181, 71, 0.22) !important' },
    '.cm-selectionMatch': { background: 'rgba(76, 214, 255, 0.12)', borderRadius: '3px' },
    '.cm-activeLine': { backgroundColor: 'rgba(148, 160, 255, 0.045)' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: colors.textFaint,
      fontFamily: fonts.mono,
      fontSize: '0.86em',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 18px', minWidth: '46px' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: colors.amber },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(255, 181, 71, 0.16)',
      outline: '1px solid rgba(255, 181, 71, 0.45)',
      borderRadius: '2px',
      color: 'inherit',
    },
    '.cm-nonmatchingBracket': { backgroundColor: 'rgba(255, 92, 122, 0.2)', color: 'inherit' },
    '.cm-lumen-flash': {
      backgroundColor: 'rgba(255, 181, 71, 0.18)',
      boxShadow: '0 0 0 1px rgba(255, 181, 71, 0.55)',
      borderRadius: '3px',
    },

    // Diagnostics
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      textDecoration: `underline wavy ${colors.red}`,
      textDecorationSkipInk: 'none',
      textUnderlineOffset: '3px',
    },
    '.cm-lintRange-warning': {
      backgroundImage: 'none',
      textDecoration: `underline wavy ${colors.yellow}`,
      textDecorationSkipInk: 'none',
      textUnderlineOffset: '3px',
    },
    '.cm-lintRange-info': {
      backgroundImage: 'none',
      textDecoration: `underline dotted ${colors.cyan}`,
      textUnderlineOffset: '3px',
    },
    '.cm-gutter-lint': { width: '14px' },
    '.cm-gutter-lint .cm-gutterElement': { padding: '0 0 0 6px' },
    '.cm-lint-marker': {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      marginTop: '9px',
      content: 'none',
    },
    '.cm-lint-marker-error': { background: colors.red, boxShadow: `0 0 8px ${colors.red}` },
    '.cm-lint-marker-warning': { background: colors.yellow, boxShadow: `0 0 6px ${colors.yellow}` },
    '.cm-lint-marker-info': { background: colors.cyan },
    '.cm-diagnostic': {
      padding: '8px 12px',
      borderLeft: 'none',
      fontFamily: '"Inter Variable", system-ui, sans-serif',
      fontSize: '12.5px',
      maxWidth: '520px',
    },
    '.cm-diagnostic-error': { boxShadow: `inset 3px 0 0 ${colors.red}` },
    '.cm-diagnostic-warning': { boxShadow: `inset 3px 0 0 ${colors.yellow}` },
    '.cm-lumen-diag-phase': {
      fontFamily: fonts.mono,
      fontSize: '10px',
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: colors.textFaint,
      marginBottom: '3px',
    },
    '.cm-lumen-diag-hint': { color: colors.textMuted, marginTop: '4px' },
    '.cm-lumen-diag-hint b': { color: colors.amberSoft, fontWeight: 600 },

    // Tooltips
    '.cm-tooltip': {
      background: 'rgba(24, 28, 43, 0.97)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${colors.borderStrong}`,
      borderRadius: '10px',
      boxShadow: '0 18px 50px -12px rgba(0,0,0,0.8)',
      color: colors.text,
      overflow: 'hidden',
    },
    '.cm-tooltip-arrow:before': { borderTopColor: `${colors.borderStrong} !important` },
    '.cm-tooltip-arrow:after': { borderTopColor: 'rgba(24, 28, 43, 0.97) !important' },
    '.cm-lumen-hover': { padding: '8px 12px', maxWidth: '560px' },
    '.cm-lumen-hover-code': { fontFamily: fonts.mono, fontSize: '12.5px', whiteSpace: 'pre-wrap' },
    '.cm-lumen-hover-doc': {
      marginTop: '6px',
      paddingTop: '6px',
      borderTop: `1px solid ${colors.border}`,
      color: colors.textMuted,
      fontSize: '12px',
      fontFamily: '"Inter Variable", system-ui, sans-serif',
    },

    // Autocomplete
    '.cm-tooltip.cm-tooltip-autocomplete': { padding: '4px' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      fontFamily: fonts.mono,
      fontSize: '12.5px',
      maxHeight: '18em',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
      padding: '3px 8px',
      borderRadius: '6px',
      lineHeight: '1.6',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      background: 'rgba(255, 181, 71, 0.16)',
      color: colors.text,
    },
    '.cm-completionLabel': { color: colors.text },
    '.cm-completionMatchedText': { textDecoration: 'none', color: colors.amber, fontWeight: 700 },
    '.cm-completionDetail': { color: colors.textMuted, fontStyle: 'normal', marginLeft: '12px' },
    '.cm-completionIcon': { opacity: 0.9, width: '1.2em', paddingRight: '0.9em' },
    '.cm-completionIcon-keyword:after': { content: "'⌘'", color: syntax.keyword },
    '.cm-completionIcon-function:after, .cm-completionIcon-method:after': {
      content: "'ƒ'",
      color: syntax.function,
    },
    '.cm-completionIcon-variable:after': { content: "'𝑥'", color: syntax.identifier },
    '.cm-completionIcon-property:after': { content: "'◆'", color: syntax.property },
    '.cm-completionIcon-class:after, .cm-completionIcon-type:after': {
      content: "'T'",
      color: syntax.type,
    },
    '.cm-completionIcon-enum:after': { content: "'∈'", color: syntax.constant },
    '.cm-completionIcon-constant:after': { content: "'π'", color: syntax.constant },
    '.cm-completionInfo': {
      padding: '8px 12px',
      fontSize: '12px',
      maxWidth: '320px',
      fontFamily: '"Inter Variable", system-ui, sans-serif',
      color: colors.textSoft,
    },

    // Search panel
    '.cm-panels': {
      backgroundColor: colors.surface2,
      color: colors.text,
      borderColor: colors.border,
    },
    '.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${colors.border}` },
    '.cm-search': {
      fontFamily: '"Inter Variable", system-ui, sans-serif',
      fontSize: '12px',
      padding: '8px 10px',
    },
    '.cm-search input, .cm-search button, .cm-search label': { fontSize: '12px' },
    '.cm-textfield': {
      background: colors.surface3,
      border: `1px solid ${colors.borderStrong}`,
      borderRadius: '6px',
      color: colors.text,
      padding: '3px 8px',
    },
    '.cm-button': {
      backgroundImage: 'none',
      background: colors.surface3,
      border: `1px solid ${colors.borderStrong}`,
      borderRadius: '6px',
      color: colors.textSoft,
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(76, 214, 255, 0.18)',
      outline: '1px solid rgba(76, 214, 255, 0.4)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(255, 181, 71, 0.3)' },
    '.cm-panel.cm-search [name=close]': { color: colors.textMuted },

    ...tokenStyles,
  },
  { dark: true },
);
