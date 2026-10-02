import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { colors, fonts } from '../../theme/tokens';

export function PanelToolbar({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: 38,
        px: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderBottom: `1px solid ${colors.border}`,
        background: 'rgba(255,255,255,0.012)',
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>
      {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>{actions}</Box>}
    </Box>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1.25,
        p: 3,
        color: colors.textMuted,
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: 3,
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(135deg, rgba(255,211,110,0.10), rgba(182,109,255,0.10))',
          border: `1px solid ${colors.borderStrong}`,
          color: colors.amber,
          '& svg': { fontSize: 26 },
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 600, color: colors.textSoft, fontSize: 14 }}>
        {title}
      </Typography>
      {children && <Box sx={{ fontSize: 12.5, maxWidth: 360, lineHeight: 1.6 }}>{children}</Box>}
    </Box>
  );
}

export function Pill({
  children,
  color = colors.textMuted,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <Box
      component="span"
      sx={{
        fontFamily: fonts.mono,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        px: 0.75,
        py: '1px',
        borderRadius: 1,
        color,
        background: `${color}18`,
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
        lineHeight: 1.6,
      }}
    >
      {children}
    </Box>
  );
}
