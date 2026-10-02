import { Box, type SxProps, type Theme } from '@mui/material';
import { type ReactNode, useMemo } from 'react';
import { highlight } from '../lumen/highlight';
import { colors, fonts, syntax } from '../theme/tokens';

interface Props {
  code: string;
  /** Render as an inline fragment instead of a block. */
  inline?: boolean;
  lineNumbers?: boolean;
  fontSize?: number | string;
  sx?: SxProps<Theme>;
}

function renderHighlighted(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  const spans = highlight(code).sort((a, b) => a.from - b.from);
  spans.forEach((s, i) => {
    if (s.from > cursor) out.push(code.slice(cursor, s.from));
    out.push(
      <span
        key={i}
        style={{
          color: syntax[s.cls],
          fontStyle: s.cls === 'comment' ? 'italic' : undefined,
        }}
      >
        {code.slice(s.from, s.to)}
      </span>,
    );
    cursor = s.to;
  });
  if (cursor < code.length) out.push(code.slice(cursor));
  return out;
}

/** Statically highlighted Lumen code, using the same lexer as the editor. */
export function Code({ code, inline, lineNumbers, fontSize, sx }: Props) {
  const content = useMemo(() => renderHighlighted(code), [code]);

  if (inline) {
    return (
      <Box
        component="code"
        sx={{
          fontFamily: fonts.mono,
          fontSize: fontSize ?? '0.86em',
          color: syntax.identifier,
          ...sx,
        }}
      >
        {content}
      </Box>
    );
  }

  const lineCount = code.split('\n').length;
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.75,
        display: 'flex',
        gap: 2,
        fontFamily: fonts.mono,
        fontSize: fontSize ?? 12.5,
        lineHeight: 1.7,
        color: syntax.identifier,
        background: 'rgba(6, 7, 12, 0.55)',
        border: `1px solid ${colors.border}`,
        borderRadius: 2,
        overflowX: 'auto',
        ...sx,
      }}
    >
      {lineNumbers && (
        <Box
          component="span"
          sx={{ color: colors.textFaint, textAlign: 'right', userSelect: 'none' }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </Box>
      )}
      <Box component="code" sx={{ fontFamily: 'inherit' }}>
        {content}
      </Box>
    </Box>
  );
}
