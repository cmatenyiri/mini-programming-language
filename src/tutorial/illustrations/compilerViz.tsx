import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import SpellcheckRoundedIcon from '@mui/icons-material/SpellcheckRounded';
import TokenRoundedIcon from '@mui/icons-material/TokenRounded';
import { Box } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Code } from '../../components/Code';
import { Logo } from '../../components/Logo';
import { colors, fonts, gradients, syntax } from '../../theme/tokens';
import { useTicker } from './anim';
import { Canvas, Caption, Chip, type ChipTone, Panel, WindowDots } from './primitives';

/* ─────────────────────────── Hero ─────────────────────────── */

export function HeroViz() {
  const pills: [string, string][] = [
    ['Statically typed', colors.cyan],
    ['Type inference', colors.amber],
    ['Runs in your browser', colors.violet],
  ];
  return (
    <Canvas>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          width: '100%',
          maxWidth: 460,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: 150,
            height: 150,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: `1px solid ${i === 1 ? colors.violet : colors.amber}`,
              }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 1.35], opacity: [0.55, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, delay: i * 1.05, ease: 'easeOut' }}
            />
          ))}
          <Box
            sx={{
              position: 'absolute',
              inset: 20,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(255,181,71,0.35), rgba(182,109,255,0.08) 60%, transparent 70%)',
              filter: 'blur(8px)',
            }}
          />
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 14 }}
          >
            <Logo size={92} animated />
          </motion.div>
        </Box>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          style={{ width: '100%' }}
        >
          <Panel
            title={
              <>
                <WindowDots /> hello.lum
              </>
            }
          >
            <Code
              code={
                'fn greet(name: string) => "Hello, ${name}!"\n\nlet planets = ["Mercury", "Venus", "Earth"]\nfor p in planets {\n  print(greet(p))\n}'
              }
              fontSize={12.5}
              sx={{ border: 'none', borderRadius: 0, background: 'transparent' }}
            />
          </Panel>
        </motion.div>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {pills.map(([label, color], i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.12 }}
            >
              <Box
                sx={{
                  fontSize: 12,
                  fontWeight: 600,
                  px: 1.5,
                  py: 0.6,
                  borderRadius: 99,
                  color,
                  border: `1px solid ${color}55`,
                  background: `${color}12`,
                }}
              >
                {label}
              </Box>
            </motion.div>
          ))}
        </Box>
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Pipeline overview ─────────────────────────── */

const PIPELINE: {
  label: string;
  icon: ReactNode;
  color: string;
  artifact: ReactNode;
  note: string;
}[] = [
  {
    label: 'Source code',
    icon: <DescriptionRoundedIcon sx={{ fontSize: 18 }} />,
    color: colors.textSoft,
    note: 'text',
    artifact: <Code inline code="print(price * 2)" fontSize={12.5} />,
  },
  {
    label: 'Lexer',
    icon: <TokenRoundedIcon sx={{ fontSize: 18 }} />,
    color: colors.cyan,
    note: 'tokens',
    artifact: (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {(
          [
            ['print', 'function'],
            ['(', 'punctuation'],
            ['price', 'identifier'],
            ['*', 'operator'],
            ['2', 'number'],
            [')', 'punctuation'],
          ] as [string, ChipTone][]
        ).map(([t, tone], i) => (
          <Chip key={i} tone={tone} size="sm">
            {t}
          </Chip>
        ))}
      </Box>
    ),
  },
  {
    label: 'Parser',
    icon: <AccountTreeRoundedIcon sx={{ fontSize: 18 }} />,
    color: colors.violet,
    note: 'syntax tree',
    artifact: (
      <Box
        sx={{ fontFamily: fonts.mono, fontSize: 11.5, color: colors.textSoft, lineHeight: 1.45 }}
      >
        <span style={{ color: colors.cyan }}>Call</span> print
        <br />
        <span style={{ color: colors.textFaint }}>└─ </span>
        <span style={{ color: colors.cyan }}>Binary</span> *
        <span style={{ color: colors.textFaint }}> ─ price, 2</span>
      </Box>
    ),
  },
  {
    label: 'Type checker',
    icon: <SpellcheckRoundedIcon sx={{ fontSize: 18 }} />,
    color: colors.amber,
    note: 'typed tree',
    artifact: (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Code inline code="price * 2 : int" fontSize={12.5} />
        <CheckCircleRoundedIcon sx={{ fontSize: 15, color: colors.green }} />
      </Box>
    ),
  },
  {
    label: 'Code generator',
    icon: <DataObjectRoundedIcon sx={{ fontSize: 18 }} />,
    color: colors.pink,
    note: 'javascript',
    artifact: (
      <Box
        sx={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textSoft, whiteSpace: 'nowrap' }}
      >
        rt.print([rt.mul(price, 2)])
      </Box>
    ),
  },
  {
    label: 'Runtime',
    icon: <BoltRoundedIcon sx={{ fontSize: 18 }} />,
    color: colors.green,
    note: 'output',
    artifact: <Box sx={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.text }}>› 42</Box>,
  },
];

export function PipelineViz() {
  const step = useTicker(PIPELINE.length + 1, 900, 1800);
  return (
    <Canvas>
      <Box sx={{ width: '100%', maxWidth: 470, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {PIPELINE.map((stage, i) => {
          const active = step === i;
          const done = step > i;
          return (
            <Box key={stage.label}>
              {i > 0 && (
                <Box sx={{ height: 18, ml: '21px', position: 'relative' }}>
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: colors.border,
                    }}
                  />
                  <motion.div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: 2,
                      background: gradients.lumen,
                      borderRadius: 2,
                    }}
                    animate={{ height: step >= i ? '100%' : '0%' }}
                    transition={{ duration: 0.3 }}
                  />
                </Box>
              )}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1,
                  pr: 1.5,
                  borderRadius: 2.5,
                  border: `1px solid ${active ? `${stage.color}88` : colors.border}`,
                  background: active ? `${stage.color}12` : 'rgba(255,255,255,0.015)',
                  boxShadow: active ? `0 0 30px -10px ${stage.color}` : 'none',
                  transition: 'all 300ms ease',
                  opacity: done || active ? 1 : 0.55,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    color: stage.color,
                    background: `${stage.color}1C`,
                    border: `1px solid ${stage.color}44`,
                  }}
                >
                  {stage.icon}
                </Box>
                <Box sx={{ width: 104, flexShrink: 0 }}>
                  <Box sx={{ fontSize: 13, fontWeight: 650, color: colors.text }}>
                    {stage.label}
                  </Box>
                  <Box
                    sx={{
                      fontFamily: fonts.mono,
                      fontSize: 10,
                      color: colors.textFaint,
                      letterSpacing: '0.08em',
                    }}
                  >
                    → {stage.note}
                  </Box>
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>{stage.artifact}</Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Lexer ─────────────────────────── */

const LEX_SOURCE = 'let total = price * 2';
const LEX_TOKENS: { text: string; start: number; tone: ChipTone; label: string }[] = [
  { text: 'let', start: 0, tone: 'keyword', label: 'KEYWORD' },
  { text: 'total', start: 4, tone: 'identifier', label: 'IDENT' },
  { text: '=', start: 10, tone: 'operator', label: 'ASSIGN' },
  { text: 'price', start: 12, tone: 'identifier', label: 'IDENT' },
  { text: '*', start: 18, tone: 'operator', label: 'STAR' },
  { text: '2', start: 20, tone: 'number', label: 'INT' },
];

export function LexerViz() {
  const step = useTicker(LEX_TOKENS.length + 1, 650, 2600);
  const current = LEX_TOKENS[Math.min(step, LEX_TOKENS.length - 1)];
  const scanning = step < LEX_TOKENS.length;
  return (
    <Canvas>
      <Box
        sx={{
          width: '100%',
          maxWidth: 500,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3.5,
        }}
      >
        <Panel title="source text" sx={{ width: '100%' }}>
          <Box
            sx={{
              p: 2.5,
              fontFamily: fonts.mono,
              fontSize: 22,
              display: 'flex',
              justifyContent: 'center',
              letterSpacing: '0.02em',
            }}
          >
            {LEX_SOURCE.split('').map((ch, i) => {
              const inCurrent =
                scanning && i >= current.start && i < current.start + current.text.length;
              const consumed = i < (scanning ? current.start : LEX_SOURCE.length);
              return (
                <Box
                  key={i}
                  component="span"
                  sx={{
                    whiteSpace: 'pre',
                    color: inCurrent ? colors.ink : consumed ? colors.textFaint : colors.text,
                    background: inCurrent ? colors.amber : 'transparent',
                    borderRadius: '3px',
                    boxShadow: inCurrent ? `0 0 16px ${colors.amber}` : 'none',
                    transition: 'all 200ms ease',
                  }}
                >
                  {ch}
                </Box>
              );
            })}
          </Box>
        </Panel>

        <Box
          sx={{
            color: colors.textFaint,
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: '0.14em',
          }}
        >
          ↓ TOKEN STREAM ↓
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 1.25,
            flexWrap: 'wrap',
            justifyContent: 'center',
            minHeight: 64,
          }}
        >
          <AnimatePresence>
            {LEX_TOKENS.slice(0, step + (scanning ? 1 : 0)).map((t, i) => (
              <motion.div
                key={`${t.text}-${i}`}
                initial={{ opacity: 0, y: -24, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                <Chip tone={t.tone} label={t.label} size="lg" active={scanning && i === step}>
                  {t.text}
                </Chip>
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>
        <Caption>
          Spaces and comments are skipped — only meaningful tokens move on to the parser.
        </Caption>
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Parser ─────────────────────────── */

interface TreeNodeViz {
  id: string;
  label: string;
  detail?: string;
  x: number;
  y: number;
  color: string;
  parent?: string;
}

const PARSE_TREE: TreeNodeViz[] = [
  { id: 'let', label: 'Let', detail: 'total', x: 50, y: 10, color: colors.violet },
  { id: 'plus', label: 'Binary', detail: '+', x: 50, y: 34, color: colors.cyan, parent: 'let' },
  { id: 'star', label: 'Binary', detail: '*', x: 28, y: 60, color: colors.cyan, parent: 'plus' },
  { id: 'one', label: 'Int', detail: '1', x: 72, y: 60, color: syntax.number, parent: 'plus' },
  {
    id: 'price',
    label: 'Ident',
    detail: 'price',
    x: 13,
    y: 86,
    color: colors.cyan,
    parent: 'star',
  },
  { id: 'two', label: 'Int', detail: '2', x: 43, y: 86, color: syntax.number, parent: 'star' },
];

export function ParserViz() {
  const step = useTicker(PARSE_TREE.length + 1, 550, 2800);
  const byId = new Map(PARSE_TREE.map((n) => [n.id, n]));
  return (
    <Canvas>
      <Box sx={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Code inline code="let total = price * 2 + 1" fontSize={16} />
        </Box>
        <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1.35 / 1' }}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            {PARSE_TREE.filter((n) => n.parent).map((n, i) => {
              const p = byId.get(n.parent!)!;
              return (
                <motion.line
                  key={n.id}
                  x1={p.x}
                  y1={p.y + 5}
                  x2={n.x}
                  y2={n.y - 5}
                  stroke="rgba(148, 160, 255, 0.35)"
                  vectorEffect="non-scaling-stroke"
                  style={{ strokeWidth: 1.5 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: step > i + 1 ? 1 : 0 }}
                  transition={{ duration: 0.35 }}
                />
              );
            })}
          </svg>
          {PARSE_TREE.map((n, i) => (
            <motion.div
              key={n.id}
              style={{
                position: 'absolute',
                left: `${n.x}%`,
                top: `${n.y}%`,
                x: '-50%',
                y: '-50%',
              }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: step > i ? 1 : 0, scale: step > i ? 1 : 0.6 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            >
              <Box
                sx={{
                  px: 1.25,
                  py: 0.6,
                  borderRadius: 2,
                  border: `1px solid ${n.color}66`,
                  background: `linear-gradient(180deg, ${n.color}22, ${n.color}0A)`,
                  boxShadow: step === i + 1 ? `0 0 22px -4px ${n.color}` : 'none',
                  fontFamily: fonts.mono,
                  fontSize: 12.5,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  gap: 0.75,
                  alignItems: 'baseline',
                }}
              >
                <span style={{ color: n.color, fontWeight: 700 }}>{n.label}</span>
                {n.detail && <span style={{ color: colors.text }}>{n.detail}</span>}
              </Box>
            </motion.div>
          ))}
        </Box>
        <Caption>
          <b style={{ color: colors.text }}>*</b> binds tighter than{' '}
          <b style={{ color: colors.text }}>+</b>, so the parser places it deeper in the tree — it
          is evaluated first.
        </Caption>
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Type checker ─────────────────────────── */

const CHECK_LINES: { code: string; type: string; why: string }[] = [
  { code: 'let price = 4.5', type: 'float', why: 'a float literal' },
  { code: 'let qty = 3', type: 'int', why: 'an int literal' },
  { code: 'let total = price * (qty as float)', type: 'float', why: 'float * float → float' },
  { code: 'let label = "Total: ${total}"', type: 'string', why: 'a string template' },
];

export function CheckerViz() {
  const step = useTicker(CHECK_LINES.length + 2, 850, 3000);
  return (
    <Canvas>
      <Box sx={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Panel
          title={
            <>
              <SpellcheckRoundedIcon sx={{ fontSize: 14, color: colors.amber }} /> inferring types
            </>
          }
        >
          <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {CHECK_LINES.map((line, i) => (
              <Box
                key={line.code}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1,
                  py: 0.6,
                  borderRadius: 1.5,
                  background: step === i ? 'rgba(255,181,71,0.08)' : 'transparent',
                  transition: 'background 250ms',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <Code inline code={line.code} fontSize={13} />
                </Box>
                <AnimatePresence>
                  {step >= i && (
                    <motion.div
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <Box
                        sx={{
                          fontSize: 10.5,
                          color: colors.textFaint,
                          display: { xs: 'none', sm: 'block' },
                        }}
                      >
                        {line.why}
                      </Box>
                      <Box
                        sx={{
                          fontFamily: fonts.mono,
                          fontSize: 12,
                          px: 0.9,
                          py: 0.2,
                          borderRadius: 1,
                          color: syntax.type,
                          background: `${syntax.type}18`,
                          border: `1px solid ${syntax.type}44`,
                        }}
                      >
                        {line.type}
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            ))}
          </Box>
        </Panel>

        <AnimatePresence>
          {step >= CHECK_LINES.length && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Panel glow={colors.red}>
                <Box sx={{ p: 1.75, display: 'flex', gap: 1.25 }}>
                  <ErrorRoundedIcon sx={{ color: colors.red, fontSize: 20, mt: 0.2 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Code inline code="let oops = label + 1" fontSize={13} />
                    <Box sx={{ mt: 0.75, fontSize: 13, color: colors.text }}>
                      Cannot apply '+' to string and int
                    </Box>
                    <Box sx={{ mt: 0.25, fontSize: 12, color: colors.textMuted }}>
                      Caught before the program runs — no surprises at runtime.
                    </Box>
                  </Box>
                </Box>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Canvas>
  );
}

/* ─────────────────────────── Code generation & runtime ─────────────────────────── */

const JS_LINES: [string, string][] = [
  ['function', ' square($site, x) {'],
  ['  rt', '.enter(0, $site);'],
  ['  return', ' rt.ret(rt.mul(x, x, 0));'],
  ['}', ''],
  ['rt', '.print([square(1, 7)], [0]);'],
];

export function CodegenViz() {
  const step = useTicker(JS_LINES.length + 2, 600, 2600);
  return (
    <Canvas>
      <Box
        sx={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 1.5 }}
      >
        <Panel
          title={
            <>
              <WindowDots /> square.lum
            </>
          }
        >
          <Code
            code={'fn square(x: int) => x * x\nprint(square(7))'}
            fontSize={13}
            sx={{ border: 'none', borderRadius: 0, background: 'transparent' }}
          />
        </Panel>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            fontFamily: fonts.mono,
            fontSize: 10.5,
            letterSpacing: '0.14em',
            color: colors.pink,
          }}
        >
          <DataObjectRoundedIcon sx={{ fontSize: 15 }} /> COMPILES TO JAVASCRIPT ↓
        </Box>
        <Panel title="generated.js" glow={step < JS_LINES.length ? colors.pink : undefined}>
          <Box
            sx={{
              px: 1.75,
              py: 1.25,
              fontFamily: fonts.mono,
              fontSize: 12.5,
              lineHeight: 1.7,
              minHeight: 126,
            }}
          >
            {JS_LINES.map(([head, rest], i) => (
              <motion.div
                key={i}
                initial={false}
                animate={{ opacity: step >= i ? 1 : 0, x: step >= i ? 0 : -8 }}
                transition={{ duration: 0.25 }}
                style={{ whiteSpace: 'pre' }}
              >
                <span style={{ color: head.trim() === 'rt' ? syntax.type : syntax.keyword }}>
                  {head}
                </span>
                <span style={{ color: colors.textSoft }}>{rest}</span>
              </motion.div>
            ))}
          </Box>
        </Panel>
        <Panel
          title={
            <>
              <BoltRoundedIcon sx={{ fontSize: 14, color: colors.green }} /> web worker · output
            </>
          }
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              fontFamily: fonts.mono,
              fontSize: 14,
              minHeight: 44,
              color: colors.text,
            }}
          >
            <AnimatePresence>
              {step >= JS_LINES.length && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                >
                  49
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Panel>
      </Box>
    </Canvas>
  );
}
