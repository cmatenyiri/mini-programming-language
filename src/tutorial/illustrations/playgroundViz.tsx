import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import { Logo } from '../../components/Logo';
import { colors, fonts, gradients, syntax } from '../../theme/tokens';
import { useTicker } from './anim';
import { Canvas } from './primitives';

const CALLOUTS: { n: number; label: string; x: number; y: number; side: 'left' | 'right' }[] = [
  { n: 1, label: 'Examples', x: 31, y: 7, side: 'right' },
  { n: 2, label: 'Run · Ctrl/⌘ Enter', x: 86, y: 7, side: 'left' },
  { n: 3, label: 'Compiler pipeline', x: 50, y: 18, side: 'right' },
  { n: 4, label: 'Editor with live types', x: 40, y: 62, side: 'right' },
  { n: 5, label: 'Output · Problems · Tokens · AST · Types · JS', x: 78, y: 40, side: 'left' },
];

const CODE_LINES: [string, string][] = [
  ['let', 'keyword'],
  ['fn', 'keyword'],
  ['match', 'keyword'],
  ['for', 'keyword'],
  ['print', 'function'],
  ['struct', 'keyword'],
  ['let', 'keyword'],
];

export function PlaygroundViz() {
  const active = useTicker(CALLOUTS.length, 1400, 1400);
  return (
    <Canvas>
      <Box sx={{ position: 'relative', width: '100%', maxWidth: 560, aspectRatio: '1.45 / 1' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 3,
            border: `1px solid ${colors.borderStrong}`,
            background: colors.bg,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 30px 80px -30px rgba(0,0,0,0.9)',
          }}
        >
          {/* header */}
          <Box
            sx={{
              height: '13%',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <Logo size={16} />
            <Box
              sx={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 12,
                background: gradients.lumen,
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Lumen
            </Box>
            <Box
              sx={{ ml: 1, width: 48, height: 8, borderRadius: 1, background: colors.surface4 }}
            />
            <Box sx={{ flex: 1 }} />
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{ width: 10, height: 10, borderRadius: 0.75, background: colors.surface4 }}
              />
            ))}
            <Box sx={{ width: 40, height: 16, borderRadius: 1, background: gradients.lumen }} />
          </Box>
          {/* pipeline */}
          <Box
            sx={{
              height: '10%',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            {[colors.textSoft, colors.cyan, colors.violet, colors.amber, colors.green].map(
              (c, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {i > 0 && (
                    <Box sx={{ width: 10, height: 1.5, background: colors.borderStrong }} />
                  )}
                  <Box
                    sx={{
                      width: 44,
                      height: 12,
                      borderRadius: 1,
                      border: `1px solid ${c}55`,
                      background: `${c}14`,
                    }}
                  />
                </Box>
              ),
            )}
          </Box>
          {/* body */}
          <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <Box
              sx={{
                flex: 56,
                borderRight: `1px solid ${colors.border}`,
                p: 1.25,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.9,
              }}
            >
              {CODE_LINES.map(([kw, cls], i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    gap: 0.75,
                    alignItems: 'center',
                    pl: i % 3 === 2 ? 1.5 : 0,
                  }}
                >
                  <Box
                    sx={{ fontFamily: fonts.mono, fontSize: 8, color: colors.textFaint, width: 8 }}
                  >
                    {i + 1}
                  </Box>
                  <Box
                    sx={{ fontFamily: fonts.mono, fontSize: 9, color: syntax[cls as 'keyword'] }}
                  >
                    {kw}
                  </Box>
                  <Box
                    sx={{
                      height: 6,
                      width: `${30 + ((i * 37) % 45)}%`,
                      borderRadius: 1,
                      background: `${[syntax.identifier, syntax.type, syntax.string][i % 3]}33`,
                    }}
                  />
                </Box>
              ))}
              <Box
                sx={{
                  mt: 0.5,
                  ml: 4,
                  alignSelf: 'flex-start',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  fontFamily: fonts.mono,
                  fontSize: 8.5,
                  color: colors.text,
                  border: `1px solid ${colors.borderStrong}`,
                  background: colors.surface4,
                }}
              >
                let total: <span style={{ color: syntax.type }}>int</span>
              </Box>
            </Box>
            <Box sx={{ flex: 44, display: 'flex', flexDirection: 'column' }}>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  px: 1,
                  py: 0.75,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                {['Output', 'Problems', 'Tokens', 'AST', 'Types', 'JS'].map((t, i) => (
                  <Box
                    key={t}
                    sx={{
                      fontSize: 7.5,
                      fontWeight: 600,
                      color: i === 0 ? colors.text : colors.textFaint,
                      borderBottom: i === 0 ? `1.5px solid ${colors.orange}` : 'none',
                      pb: 0.25,
                    }}
                  >
                    {t}
                  </Box>
                ))}
              </Box>
              <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {[70, 52, 84, 40].map((w, i) => (
                  <Box
                    key={i}
                    sx={{
                      height: 6,
                      width: `${w}%`,
                      borderRadius: 1,
                      background: `${colors.text}22`,
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
          {/* status bar */}
          <Box
            sx={{ height: '6%', borderTop: `1px solid ${colors.border}`, background: colors.ink }}
          />
        </Box>

        {CALLOUTS.map((c, i) => (
          <Box
            key={c.n}
            sx={{
              position: 'absolute',
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: 0,
              height: 0,
              zIndex: i === active ? 2 : 1,
            }}
          >
            <motion.div
              style={{ position: 'absolute', left: -11, top: -11 }}
              animate={{ scale: i === active ? 1.12 : 1 }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.ink,
                  background: i === active ? gradients.lumen : colors.textSoft,
                  boxShadow:
                    i === active
                      ? `0 0 0 4px ${colors.amber}33, 0 0 20px ${colors.orange}`
                      : '0 2px 8px rgba(0,0,0,0.6)',
                  transition: 'all 250ms',
                }}
              >
                {c.n}
              </Box>
            </motion.div>
            <Box
              sx={{
                position: 'absolute',
                top: -13,
                [c.side === 'right' ? 'left' : 'right']: 18,
                px: 1,
                py: 0.4,
                borderRadius: 1.5,
                fontSize: 11.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                color: colors.text,
                background: 'rgba(24,28,43,0.96)',
                border: `1px solid ${colors.amber}88`,
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.9)',
                opacity: i === active ? 1 : 0,
                transform:
                  i === active ? 'translateX(0)' : `translateX(${c.side === 'right' ? -6 : 6}px)`,
                transition: 'opacity 250ms, transform 250ms',
                pointerEvents: 'none',
              }}
            >
              {c.label}
            </Box>
          </Box>
        ))}
      </Box>
    </Canvas>
  );
}
