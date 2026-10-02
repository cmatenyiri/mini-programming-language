import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { Box } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { Code } from '../../components/Code';
import { colors, fonts, gradients, syntax } from '../../theme/tokens';
import { useTicker } from './anim';
import { Canvas, Caption, Chip, Panel } from './primitives';

/* ─────────────────────────── Variables ─────────────────────────── */

export function VariablesViz() {
  const step = useTicker(6, 800, 1600);
  const count = Math.min(step, 4);
  const rejecting = step === 5;
  return (
    <Canvas>
      <Box
        sx={{
          width: '100%',
          maxWidth: 500,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 2,
        }}
      >
        <Panel
          title={
            <>
              <LockRoundedIcon sx={{ fontSize: 14, color: colors.cyan }} /> let · immutable
            </>
          }
          glow={rejecting ? colors.red : undefined}
        >
          <Box
            sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}
          >
            <Code inline code='let name = "Lumen"' fontSize={12.5} />
            <motion.div
              animate={rejecting ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.45 }}
            >
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderRadius: 2,
                  border: `1px dashed ${colors.cyan}66`,
                  background: `${colors.cyan}0C`,
                  fontFamily: fonts.mono,
                  fontSize: 18,
                  color: syntax.string,
                }}
              >
                "Lumen"
              </Box>
            </motion.div>
            <Box sx={{ minHeight: 40, textAlign: 'center' }}>
              <AnimatePresence>
                {rejecting && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Code inline code='name = "Other"' fontSize={11.5} />
                    <Box sx={{ fontSize: 11, color: colors.red, mt: 0.5 }}>✗ declared with let</Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </Box>
        </Panel>
        <Panel
          title={
            <>
              <EditRoundedIcon sx={{ fontSize: 14, color: colors.amber }} /> var · mutable
            </>
          }
        >
          <Box
            sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}
          >
            <Code inline code="var count = 0" fontSize={12.5} />
            <Box
              sx={{
                position: 'relative',
                width: 96,
                height: 56,
                borderRadius: 2,
                border: `1px dashed ${colors.amber}66`,
                background: `${colors.amber}0C`,
                overflow: 'hidden',
              }}
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={count}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -30, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: fonts.mono,
                    fontSize: 22,
                    color: syntax.number,
                  }}
                >
                  {count}
                </motion.div>
              </AnimatePresence>
            </Box>
            <Box sx={{ minHeight: 40, display: 'grid', placeItems: 'center' }}>
              <Code inline code="count += 1" fontSize={11.5} />
            </Box>
          </Box>
        </Panel>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Panel>
            <Box
              sx={{ p: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}
            >
              {[
                ['int', '42'],
                ['float', '3.14'],
                ['bool', 'true'],
                ['string', '"hi"'],
                ['[int]', '[1, 2]'],
                ['[string: int]', '["a": 1]'],
                ['(int, bool)', '(1, true)'],
                ['int?', 'Some(1)'],
              ].map(([type, value]) => (
                <Box
                  key={type}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1.5,
                    border: `1px solid ${colors.border}`,
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Code inline code={value} fontSize={11.5} />
                  <Box sx={{ fontFamily: fonts.mono, fontSize: 11, color: syntax.type }}>
                    {type}
                  </Box>
                </Box>
              ))}
            </Box>
          </Panel>
        </Box>
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Functions ─────────────────────────── */

export function FunctionsViz() {
  const step = useTicker(4, 900, 1800);
  return (
    <Canvas>
      <Box
        sx={{
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              alignItems: 'flex-end',
              width: 70,
            }}
          >
            {[
              ['a', '3'],
              ['b', '4'],
            ].map(([name, v]) => (
              <motion.div
                key={name}
                animate={{ x: step >= 1 ? 24 : 0, opacity: step >= 1 ? 0 : 1 }}
                transition={{ duration: 0.45 }}
              >
                <Chip tone="number" label={name}>
                  {v}
                </Chip>
              </motion.div>
            ))}
          </Box>
          <Box
            sx={{
              position: 'relative',
              px: 2.5,
              py: 2,
              borderRadius: 3,
              border: '1px solid transparent',
              background: `linear-gradient(${colors.surface2}, ${colors.surface2}) padding-box, ${gradients.lumen} border-box`,
              boxShadow: step === 1 || step === 2 ? `0 0 40px -10px ${colors.orange}` : 'none',
              transition: 'box-shadow 300ms',
              textAlign: 'center',
            }}
          >
            <Code inline code="fn add(a: int, b: int) -> int" fontSize={13} />
            <Box sx={{ mt: 1, fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>
              {step === 2 ? <span style={{ color: colors.amber }}>3 + 4</span> : 'a + b'}
            </Box>
          </Box>
          <Box sx={{ width: 70 }}>
            <AnimatePresence>
              {step >= 3 && (
                <motion.div
                  initial={{ x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Chip tone="success" label="int" active>
                    7
                  </Chip>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Box>

        <Panel title="functions are values" sx={{ width: '100%' }}>
          <Box
            sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}
          >
            <Code inline code="[1, 2, 3].map(fn(x) => x * 10)" fontSize={13} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {[1, 2, 3].map((n, i) => (
                <motion.div
                  key={n}
                  animate={{ scale: step >= 2 ? [1, 1.15, 1] : 1 }}
                  transition={{ delay: i * 0.12, duration: 0.4 }}
                >
                  <Chip tone="number" active={step >= 2}>
                    {step >= 2 ? n * 10 : n}
                  </Chip>
                </motion.div>
              ))}
              <Box sx={{ ml: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>
                : [int]
              </Box>
            </Box>
          </Box>
        </Panel>
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Control flow ─────────────────────────── */

export function ControlFlowViz() {
  const step = useTicker(6, 750, 1500);
  const i = Math.min(step, 4);
  const done = step === 5;
  const even = i % 2 === 0;
  return (
    <Canvas>
      <Box
        sx={{
          width: '100%',
          maxWidth: 520,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2.5,
          alignItems: 'center',
        }}
      >
        <Box
          sx={{ position: 'relative', aspectRatio: '1', maxWidth: 230, width: '100%', mx: 'auto' }}
        >
          <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
            <circle cx="50" cy="50" r="38" fill="none" stroke={colors.border} strokeWidth="2" />
            <motion.circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="url(#loopgrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              animate={{ pathLength: done ? 1 : (i + 1) / 5 }}
              transition={{ duration: 0.5 }}
            />
            <defs>
              <linearGradient id="loopgrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FFD36E" />
                <stop offset="0.5" stopColor="#FF8A5B" />
                <stop offset="1" stopColor="#B66DFF" />
              </linearGradient>
            </defs>
          </svg>
          {[0, 1, 2, 3, 4].map((n) => {
            const angle = (n / 5) * Math.PI * 2 - Math.PI / 2;
            return (
              <Box
                key={n}
                sx={{
                  position: 'absolute',
                  left: `${50 + Math.cos(angle) * 38}%`,
                  top: `${50 + Math.sin(angle) * 38}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Chip tone="number" active={n === i && !done} dim={n > i && !done}>
                  {n}
                </Chip>
              </Box>
            );
          })}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
            }}
          >
            <Box>
              <Code inline code="for i in 0..5" fontSize={12} />
              <Box sx={{ fontFamily: fonts.mono, fontSize: 22, color: colors.text, mt: 0.5 }}>
                {done ? '✓' : `i = ${i}`}
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Panel title="if / else">
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Code inline code="if i % 2 == 0 {" fontSize={12} />
              {[
                ['  "even"', even],
                ['} else {', null],
                ['  "odd"', !even],
                ['}', null],
              ].map(([line, lit], k) => (
                <Box
                  key={k}
                  sx={{
                    borderRadius: 1,
                    px: 0.5,
                    background: lit && !done ? 'rgba(75,227,161,0.12)' : 'transparent',
                    boxShadow: lit && !done ? `inset 2px 0 0 ${colors.green}` : 'none',
                    transition: 'all 200ms',
                  }}
                >
                  <Code inline code={String(line)} fontSize={12} />
                </Box>
              ))}
            </Box>
          </Panel>
          <Panel title="match">
            <Box sx={{ p: 1.5 }}>
              <Code
                code={
                  'match (i % 3, i % 5) {\n  (0, 0) => "FizzBuzz",\n  (0, _) => "Fizz",\n  _ => str(i),\n}'
                }
                fontSize={11.5}
                sx={{
                  px: 0.5,
                  py: 0,
                  border: 'none',
                  background: 'transparent',
                  overflow: 'visible',
                }}
              />
            </Box>
          </Panel>
        </Box>
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Structs & enums ─────────────────────────── */

const SHAPES = [
  { value: 'Shape.Circle(2.0)', arm: 0, result: '12.57' },
  { value: 'Shape.Rect(3.0, 4.0)', arm: 1, result: '12.0' },
];

export function DataViz() {
  const step = useTicker(6, 800, 1200);
  const shape = SHAPES[step < 3 ? 0 : 1];
  const phase = step % 3;
  return (
    <Canvas>
      <Box sx={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Panel title="struct">
            <Box sx={{ p: 1.5 }}>
              <Code
                code={'struct Point {\n  x: float,\n  y: float,\n}'}
                fontSize={11.5}
                sx={{
                  px: 0.5,
                  py: 0,
                  border: 'none',
                  background: 'transparent',
                  overflow: 'visible',
                }}
              />
              <Box
                sx={{
                  mt: 1.25,
                  p: 1,
                  borderRadius: 1.5,
                  border: `1px solid ${syntax.type}44`,
                  background: `${syntax.type}0D`,
                  fontFamily: fonts.mono,
                  fontSize: 12,
                }}
              >
                <Box sx={{ color: syntax.type, fontWeight: 700, mb: 0.5 }}>Point</Box>
                <Box sx={{ color: colors.textSoft }}>
                  x <span style={{ color: syntax.number }}>3.0</span>
                </Box>
                <Box sx={{ color: colors.textSoft }}>
                  y <span style={{ color: syntax.number }}>4.0</span>
                </Box>
              </Box>
            </Box>
          </Panel>
          <Panel title="enum">
            <Box sx={{ p: 1.5 }}>
              <Code
                code={'enum Shape {\n  Circle(float),\n  Rect(float, float),\n}'}
                fontSize={11.5}
                sx={{
                  px: 0.5,
                  py: 0,
                  border: 'none',
                  background: 'transparent',
                  overflow: 'visible',
                }}
              />
              <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Chip tone="constant" size="sm">
                  Circle(r)
                </Chip>
                <Chip tone="constant" size="sm">
                  Rect(w, h)
                </Chip>
              </Box>
            </Box>
          </Panel>
        </Box>

        <Panel title="pattern matching">
          <Box sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={shape.value}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
              >
                <Chip tone="constant" active>
                  {shape.value}
                </Chip>
              </motion.div>
            </AnimatePresence>
            <Box sx={{ color: colors.textFaint, fontFamily: fonts.mono }}>→</Box>
            <Box
              sx={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 0.5 }}
            >
              {['Circle(r) => PI * r * r', 'Rect(w, h) => w * h'].map((arm, k) => {
                const lit = phase >= 1 && k === shape.arm;
                return (
                  <Box
                    key={arm}
                    sx={{
                      px: 1,
                      py: 0.4,
                      borderRadius: 1.5,
                      border: `1px solid ${lit ? `${colors.green}88` : colors.border}`,
                      background: lit ? `${colors.green}12` : 'transparent',
                      transition: 'all 250ms',
                    }}
                  >
                    <Code inline code={arm} fontSize={12} />
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ width: 64, textAlign: 'right' }}>
              <AnimatePresence>
                {phase === 2 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Chip tone="success" active>
                      {shape.result}
                    </Chip>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </Box>
        </Panel>
        <Caption>
          The checker verifies that every variant is handled — forgetting one is a compile error.
        </Caption>
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Collections & pipes ─────────────────────────── */

const PIPE_STAGES = [
  {
    code: '[1, 2, 3, 4, 5, 6]',
    values: [1, 2, 3, 4, 5, 6],
    kept: [true, true, true, true, true, true],
  },
  {
    code: '|> filter(fn(n) => n % 2 == 0)',
    values: [1, 2, 3, 4, 5, 6],
    kept: [false, true, false, true, false, true],
  },
  { code: '|> map(fn(n) => n * n)', values: [4, 16, 36], kept: [true, true, true] },
  { code: '|> sum()', values: [56], kept: [true] },
];

export function PipesViz() {
  const step = useTicker(PIPE_STAGES.length + 1, 1000, 2000);
  return (
    <Canvas>
      <Box
        sx={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 1.25 }}
      >
        {PIPE_STAGES.map((stage, k) => {
          const visible = step >= k;
          const active = step === k;
          return (
            <motion.div
              key={stage.code}
              animate={{ opacity: visible ? 1 : 0.25 }}
              transition={{ duration: 0.3 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: 2.5,
                  border: `1px solid ${active ? `${colors.amber}88` : colors.border}`,
                  background: active ? 'rgba(255,181,71,0.06)' : 'rgba(255,255,255,0.015)',
                  transition: 'all 250ms',
                }}
              >
                <Box
                  sx={{
                    width: { xs: 150, sm: 230 },
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  <Code inline code={stage.code} fontSize={12} />
                </Box>
                <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                  {stage.values.map((v, i) => (
                    <Chip
                      key={`${k}-${i}`}
                      tone={k === 3 ? 'success' : 'number'}
                      size="sm"
                      dim={visible && !stage.kept[i]}
                      active={k === 3 && visible}
                    >
                      {v}
                    </Chip>
                  ))}
                </Box>
              </Box>
            </motion.div>
          );
        })}
        <Caption>
          <b style={{ color: colors.text }}>|&gt;</b> passes the value on the left as the first
          argument of the next call — data flows top to bottom.
        </Caption>
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Options & results ─────────────────────────── */

export function SafetyViz() {
  const step = useTicker(4, 1100, 1400);
  const found = step < 2;
  const showResult = step % 2 === 1;
  return (
    <Canvas>
      <Box sx={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Panel title="no null — just options">
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Code
              inline
              code={`let user = find_user(${found ? 1 : 99})   // string?`}
              fontSize={12.5}
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                justifyContent: 'center',
                minHeight: 64,
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={found ? 'some' : 'none'}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                >
                  <Box
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderRadius: 2,
                      border: `1.5px ${found ? 'solid' : 'dashed'} ${found ? colors.green : colors.textFaint}`,
                      background: found ? `${colors.green}10` : 'transparent',
                      fontFamily: fonts.mono,
                      fontSize: 15,
                      color: found ? colors.text : colors.textMuted,
                    }}
                  >
                    {found ? (
                      <>
                        <span style={{ color: syntax.constant }}>Some</span>(
                        <span style={{ color: syntax.string }}>"ada"</span>)
                      </>
                    ) : (
                      <span style={{ color: syntax.constant }}>None</span>
                    )}
                  </Box>
                </motion.div>
              </AnimatePresence>
              <Box sx={{ fontFamily: fonts.mono, color: colors.textFaint }}>→</Box>
              <Box sx={{ minWidth: 150 }}>
                <Code inline code='user ?? "guest"' fontSize={12.5} />
                <AnimatePresence>
                  {showResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <Box sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <CheckCircleRoundedIcon sx={{ fontSize: 15, color: colors.green }} />
                        <Code inline code={found ? '"ada"' : '"guest"'} fontSize={13} />
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            </Box>
          </Box>
        </Panel>
        <Panel title="errors are values">
          <Box sx={{ p: 1.5 }}>
            <Code
              code={
                'fn total(a: string, b: string) -> result<int, string> {\n  let x = parse(a)?   // returns early on Err\n  let y = parse(b)?\n  Ok(x + y)\n}'
              }
              fontSize={11.5}
              sx={{
                px: 0.5,
                py: 0,
                border: 'none',
                background: 'transparent',
                overflow: 'visible',
              }}
            />
          </Box>
        </Panel>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['T? = Some(T) | None', 'result<T, E> = Ok(T) | Err(E)'].map((t) => (
            <Box
              key={t}
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 99,
                border: `1px solid ${colors.border}`,
                background: gradients.lumenSoft,
              }}
            >
              <Code inline code={t} fontSize={11.5} />
            </Box>
          ))}
        </Box>
      </Box>
    </Canvas>
  );
}
