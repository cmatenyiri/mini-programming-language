import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { colors, fonts } from '../theme/tokens';
import { Code } from './Code';

/** Inline Lumen code inside prose. */
export function C({ children }: { children: string }) {
  return <Code inline code={children} />;
}

export function Para({ children }: { children: ReactNode }) {
  return (
    <Box component="p" sx={{ m: 0, color: colors.textSoft, lineHeight: 1.65, fontSize: 13.5 }}>
      {children}
    </Box>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Box sx={{ color: colors.textMuted }}>{children}</Box>;
}

export function Points({ items }: { items: ReactNode[] }) {
  return (
    <Box
      component="ul"
      sx={{ m: 0, pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      {items.map((item, i) => (
        <Box component="li" key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline' }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '2px',
              flexShrink: 0,
              transform: 'translateY(-2px) rotate(45deg)',
              background: 'linear-gradient(135deg, #FFD36E, #B66DFF)',
            }}
          />
          <Box>{item}</Box>
        </Box>
      ))}
    </Box>
  );
}

export function RefTable({
  rows,
  head,
}: {
  rows: [ReactNode, ReactNode][];
  head?: [string, string];
}) {
  return (
    <Box
      component="table"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12.5,
        '& td, & th': {
          borderBottom: `1px solid ${colors.border}`,
          py: 0.75,
          pr: 1.5,
          verticalAlign: 'top',
          textAlign: 'left',
        },
        '& th': {
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: '0.12em',
          color: colors.textFaint,
          fontWeight: 600,
        },
        '& td:last-of-type': { color: colors.textMuted },
      }}
    >
      {head && (
        <thead>
          <tr>
            <th>{head[0]}</th>
            <th>{head[1]}</th>
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i}>
            <td style={{ whiteSpace: 'nowrap' }}>{a}</td>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </Box>
  );
}
