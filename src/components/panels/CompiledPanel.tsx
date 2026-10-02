import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import JavascriptRoundedIcon from '@mui/icons-material/JavascriptRounded';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { memo, useMemo } from 'react';
import type { CompiledProgram } from '../../lumen/codegen';
import { colors, fonts, syntax } from '../../theme/tokens';
import { EmptyState, PanelToolbar } from './common';
import { highlightJs } from './jsHighlight';
import { scrollArea } from './styles';

interface Props {
  compiled: CompiledProgram | null;
  codegenMs: number;
  hasErrors: boolean;
}

export const CompiledPanel = memo(function CompiledPanel({
  compiled,
  codegenMs,
  hasErrors,
}: Props) {
  const lines = useMemo(() => (compiled ? compiled.code.split('\n') : []), [compiled]);
  const highlighted = useMemo(() => lines.map(highlightJs), [lines]);
  const size = compiled ? new Blob([compiled.code]).size : 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelToolbar
        actions={
          <Tooltip title="Copy JavaScript">
            <span>
              <IconButton
                size="small"
                disabled={!compiled}
                onClick={() => void navigator.clipboard?.writeText(compiled?.code ?? '')}
              >
                <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        }
      >
        <Typography sx={{ fontSize: 12, color: colors.textMuted, whiteSpace: 'nowrap' }}>
          {compiled ? (
            <>
              <b style={{ color: colors.text }}>{lines.length}</b> lines ·{' '}
              {(size / 1024).toFixed(1)} KB · generated in {codegenMs.toFixed(2)} ms
            </>
          ) : (
            'Generated JavaScript'
          )}
        </Typography>
      </PanelToolbar>
      <Box sx={{ ...scrollArea }} data-testid="compiled">
        {!compiled ? (
          <EmptyState icon={<JavascriptRoundedIcon />} title="Nothing compiled yet">
            {hasErrors
              ? 'The code generator runs once the program type-checks. Fix the errors to see the JavaScript that Lumen produces.'
              : 'Write some code — the compiled JavaScript shows up here.'}
          </EmptyState>
        ) : (
          <>
            <Typography
              sx={{
                px: 2,
                pt: 1.25,
                pb: 0.5,
                fontSize: 12,
                color: colors.textMuted,
                lineHeight: 1.6,
              }}
            >
              Lumen compiles your program to JavaScript, which runs in a background worker. Calls
              into <code style={{ fontFamily: fonts.mono, color: syntax.type }}>rt</code> are the
              runtime library: overflow-checked integer math, bounds checks and call-stack tracking
              for error messages.
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                py: 1,
                fontFamily: fonts.mono,
                fontSize: 12.5,
                lineHeight: 1.65,
                color: syntax.identifier,
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                minWidth: 'fit-content',
              }}
            >
              {highlighted.map((tokens, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'contents',
                    '&:hover > *': { background: 'rgba(255,255,255,0.025)' },
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      color: colors.textFaint,
                      textAlign: 'right',
                      pl: 1.5,
                      pr: 2,
                      userSelect: 'none',
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Box component="span" sx={{ pr: 2, whiteSpace: 'pre' }}>
                    {tokens.map((t, k) =>
                      t.cls ? (
                        <span key={k} style={{ color: syntax[t.cls] }}>
                          {t.text}
                        </span>
                      ) : (
                        t.text
                      ),
                    )}
                    {'\n'}
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
});
