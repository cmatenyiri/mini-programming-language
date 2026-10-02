import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { CursorInfo } from '../editor/LumenEditor';
import type { Diagnostic } from '../lumen/diagnostics';
import type { Analysis } from '../lumen/index';
import { colors, fonts } from '../theme/tokens';
import { Code } from './Code';

interface Props {
  analysis: Analysis | null;
  diagnostics: Diagnostic[];
  cursor: CursorInfo;
  savedAt: number | null;
  onProblems: () => void;
}

function Item({
  children,
  tooltip,
  onClick,
}: {
  children: ReactNode;
  tooltip?: string;
  onClick?: () => void;
}) {
  const content = (
    <ButtonBase
      disabled={!onClick}
      onClick={onClick}
      sx={{
        height: '100%',
        px: 1.25,
        gap: 0.6,
        fontSize: 11.5,
        color: colors.textMuted,
        whiteSpace: 'nowrap',
        '&:hover': onClick ? { background: 'rgba(255,255,255,0.04)', color: colors.text } : {},
        '&.Mui-disabled': { color: colors.textMuted },
      }}
    >
      {children}
    </ButtonBase>
  );
  return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content;
}

export function StatusBar({ analysis, diagnostics, cursor, savedAt, onProblems }: Props) {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.length - errors;
  const hover = analysis?.check?.hovers.find(
    (h) => h.span.start <= cursor.pos && cursor.pos <= h.span.end,
  );

  return (
    <Box
      component="footer"
      sx={{
        height: 28,
        display: 'flex',
        alignItems: 'stretch',
        borderTop: `1px solid ${colors.border}`,
        background: 'rgba(8, 9, 15, 0.9)',
        fontFamily: fonts.mono,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <Item tooltip="Errors and warnings" onClick={onProblems}>
        {errors === 0 && warnings === 0 ? (
          <>
            <CheckRoundedIcon sx={{ fontSize: 14, color: colors.green }} />
            <span>No problems</span>
          </>
        ) : (
          <>
            <ErrorRoundedIcon
              sx={{ fontSize: 13, color: errors ? colors.red : colors.textFaint }}
            />
            <span>{errors}</span>
            <WarningRoundedIcon
              sx={{ fontSize: 13, color: warnings ? colors.yellow : colors.textFaint, ml: 0.5 }}
            />
            <span>{warnings}</span>
          </>
        )}
      </Item>
      {hover && (
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            px: 1.25,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Typography
            sx={{ fontSize: 10.5, color: colors.textFaint, mr: 1, letterSpacing: '0.08em' }}
          >
            TYPE
          </Typography>
          <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <Code inline code={hover.code} fontSize={11.5} />
          </Box>
        </Box>
      )}
      <Box sx={{ flex: 1 }} />
      {savedAt && (
        <Item tooltip="Your code is saved in this browser">
          <CloudDoneRoundedIcon sx={{ fontSize: 14 }} />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Saved locally
          </Box>
        </Item>
      )}
      <Item>
        Ln {cursor.line}, Col {cursor.column}
        {cursor.selected > 0 && ` (${cursor.selected} selected)`}
      </Item>
      <Item tooltip="Lumen source file">
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          UTF-8 · Lumen (.lum)
        </Box>
      </Item>
    </Box>
  );
}
