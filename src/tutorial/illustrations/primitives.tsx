import { Box, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';
import { colors, fonts, syntax } from '../../theme/tokens';

export function Canvas({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 3 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export type ChipTone = keyof typeof syntax | 'success' | 'error' | 'muted' | 'amber';

const toneColor = (tone: ChipTone): string =>
  tone === 'success'
    ? colors.green
    : tone === 'error'
      ? colors.red
      : tone === 'muted'
        ? colors.textMuted
        : tone === 'amber'
          ? colors.amber
          : syntax[tone];

export function Chip({
  children,
  tone = 'identifier',
  label,
  active,
  dim,
  size = 'md',
}: {
  children: ReactNode;
  tone?: ChipTone;
  label?: string;
  active?: boolean;
  dim?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const color = toneColor(tone);
  const fontSize = size === 'lg' ? 17 : size === 'sm' ? 11.5 : 13.5;
  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          fontFamily: fonts.mono,
          fontSize,
          lineHeight: 1,
          px: size === 'sm' ? 0.75 : 1.1,
          py: size === 'sm' ? 0.5 : 0.75,
          borderRadius: 1.5,
          color,
          whiteSpace: 'pre',
          background: `${color}${active ? '30' : '14'}`,
          border: `1px solid ${color}${active ? 'AA' : '3A'}`,
          boxShadow: active ? `0 0 18px -2px ${color}88` : 'none',
          opacity: dim ? 0.35 : 1,
          transition: 'all 220ms ease',
        }}
      >
        {children}
      </Box>
      {label && (
        <Box
          sx={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.12em', color: `${color}CC` }}
        >
          {label}
        </Box>
      )}
    </Box>
  );
}

export function Panel({
  children,
  title,
  sx,
  glow,
}: {
  children: ReactNode;
  title?: ReactNode;
  sx?: SxProps<Theme>;
  glow?: string;
}) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${glow ? `${glow}66` : colors.borderStrong}`,
        background: 'linear-gradient(180deg, rgba(24,28,43,0.92), rgba(15,17,27,0.92))',
        boxShadow: glow
          ? `0 0 0 1px ${glow}22, 0 20px 50px -20px ${glow}66`
          : '0 20px 50px -24px rgba(0,0,0,0.8)',
        overflow: 'hidden',
        transition: 'box-shadow 300ms ease, border-color 300ms ease',
        ...sx,
      }}
    >
      {title && (
        <Box
          sx={{
            px: 1.5,
            py: 0.9,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: `1px solid ${colors.border}`,
            fontFamily: fonts.mono,
            fontSize: 10.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: colors.textMuted,
          }}
        >
          {title}
        </Box>
      )}
      {children}
    </Box>
  );
}

export function WindowDots() {
  return (
    <Box sx={{ display: 'flex', gap: 0.6, mr: 0.5 }}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
        <Box
          key={c}
          sx={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.85 }}
        />
      ))}
    </Box>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
      {children}
    </Box>
  );
}
