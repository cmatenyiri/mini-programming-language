import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import { Box, ButtonBase, Typography } from '@mui/material';
import { useMemo } from 'react';
import { type Diagnostic, LineIndex, type Phase, type Span } from '../../lumen/diagnostics';
import { colors, fonts } from '../../theme/tokens';
import { EmptyState, PanelToolbar, Pill } from './common';
import { scrollArea } from './styles';

const PHASES: Record<Phase, { label: string; color: string }> = {
  lexer: { label: 'LEXER', color: colors.cyan },
  parser: { label: 'PARSER', color: colors.violet },
  checker: { label: 'TYPES', color: colors.amber },
  runtime: { label: 'RUNTIME', color: colors.pink },
};

interface Props {
  source: string;
  diagnostics: Diagnostic[];
  onJump: (span: Span) => void;
  onHover: (span: Span | null) => void;
}

export function ProblemsPanel({ source, diagnostics, onJump, onHover }: Props) {
  const index = useMemo(() => new LineIndex(source), [source]);
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.length - errors;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelToolbar>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: colors.textSoft }}>
          <Box component="span" sx={{ color: errors ? colors.red : colors.textMuted }}>
            {errors} error{errors === 1 ? '' : 's'}
          </Box>
          <Box component="span" sx={{ color: colors.textFaint }}>
            {' · '}
          </Box>
          <Box component="span" sx={{ color: warnings ? colors.yellow : colors.textMuted }}>
            {warnings} warning{warnings === 1 ? '' : 's'}
          </Box>
        </Typography>
      </PanelToolbar>
      <Box sx={scrollArea} data-testid="problems">
        {diagnostics.length === 0 ? (
          <EmptyState icon={<CheckCircleRoundedIcon />} title="No problems found">
            Your program passes the lexer, the parser and the type checker. Every expression has a
            well-defined type.
          </EmptyState>
        ) : (
          diagnostics.map((d, i) => {
            const pos = index.position(d.span.start);
            const phase = PHASES[d.phase];
            const Icon =
              d.severity === 'error'
                ? ErrorRoundedIcon
                : d.severity === 'warning'
                  ? WarningRoundedIcon
                  : InfoRoundedIcon;
            const color =
              d.severity === 'error'
                ? colors.red
                : d.severity === 'warning'
                  ? colors.yellow
                  : colors.cyan;
            return (
              <ButtonBase
                key={`${d.span.start}-${i}`}
                onClick={() => onJump(d.span)}
                onMouseEnter={() => onHover(d.span)}
                onMouseLeave={() => onHover(null)}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  gap: 1.25,
                  px: 1.75,
                  py: 1.1,
                  borderBottom: `1px solid ${colors.border}`,
                  '&:hover': { background: 'rgba(255,255,255,0.025)' },
                }}
              >
                <Icon sx={{ fontSize: 17, color, mt: '1px' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, color: colors.text, lineHeight: 1.45 }}>
                    {d.message}
                  </Typography>
                  {d.hint && (
                    <Typography
                      sx={{ fontSize: 12, color: colors.textMuted, mt: 0.25, lineHeight: 1.45 }}
                    >
                      <Box component="span" sx={{ color: colors.amberSoft, fontWeight: 600 }}>
                        Hint:{' '}
                      </Box>
                      {d.hint}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <Pill color={phase.color}>{phase.label}</Pill>
                  <Typography
                    sx={{
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      color: colors.textFaint,
                      minWidth: 56,
                      textAlign: 'right',
                    }}
                  >
                    {pos.line}:{pos.column}
                  </Typography>
                </Box>
              </ButtonBase>
            );
          })
        )}
      </Box>
    </Box>
  );
}
