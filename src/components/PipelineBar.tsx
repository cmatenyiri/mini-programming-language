import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import SpellcheckRoundedIcon from '@mui/icons-material/SpellcheckRounded';
import TokenRoundedIcon from '@mui/icons-material/TokenRounded';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { RunStatus, RunSummary } from '../hooks/useRunner';
import type { Analysis } from '../lumen/index';
import { colors, fonts } from '../theme/tokens';
import type { PanelTab } from './InsightPanel';

type StageState = 'ok' | 'warn' | 'error' | 'idle' | 'active' | 'skipped';

interface Stage {
  id: string;
  label: string;
  icon: ReactNode;
  metric: string;
  detail: string;
  state: StageState;
  tab: PanelTab;
  tooltip: string;
}

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 181, 71, 0.6); }
  70% { box-shadow: 0 0 0 7px rgba(255, 181, 71, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 181, 71, 0); }
`;

const flow = keyframes`
  0% { background-position: -60px 0; }
  100% { background-position: 160px 0; }
`;

const STATE_COLOR: Record<StageState, string> = {
  ok: colors.green,
  warn: colors.yellow,
  error: colors.red,
  idle: colors.textFaint,
  active: colors.amber,
  skipped: colors.textFaint,
};

const ms = (n: number) => (n < 1 ? `${n.toFixed(2)} ms` : `${n.toFixed(1)} ms`);

interface Props {
  analysis: Analysis | null;
  runStatus: RunStatus;
  summary: RunSummary | null;
  onSelect: (tab: PanelTab) => void;
}

export function PipelineBar({ analysis, runStatus, summary, onSelect }: Props) {
  const diags = analysis?.diagnostics ?? [];
  const errorsIn = (phase: string) =>
    diags.filter((d) => d.phase === phase && d.severity === 'error').length;
  const warningsIn = (phase: string) =>
    diags.filter((d) => d.phase === phase && d.severity === 'warning').length;
  const lines = analysis ? analysis.source.split('\n').length : 0;
  const significant = analysis
    ? analysis.tokens.filter((t) => t.kind !== 'comment' && t.kind !== 'eof').length
    : 0;

  const lexErrors = errorsIn('lexer');
  const parseErrors = errorsIn('parser');
  const checkErrors = errorsIn('checker');
  const checkWarnings = warningsIn('checker');
  const checked = analysis?.check;
  const compiled = analysis?.compiled;

  const runState: StageState =
    runStatus === 'running'
      ? 'active'
      : runStatus === 'success'
        ? 'ok'
        : runStatus === 'idle'
          ? 'idle'
          : runStatus === 'stopped'
            ? 'warn'
            : 'error';

  const runMetric: Record<RunStatus, string> = {
    idle: 'ready',
    running: 'running…',
    success: 'finished',
    'runtime-error': 'runtime error',
    'compile-error': 'not started',
    stopped: 'stopped',
    timeout: 'timed out',
    crashed: 'crashed',
  };

  const stages: Stage[] = [
    {
      id: 'source',
      label: 'Source',
      icon: <DescriptionRoundedIcon sx={{ fontSize: 15 }} />,
      metric: `${lines} line${lines === 1 ? '' : 's'}`,
      detail: analysis ? `${analysis.source.length} chars` : '',
      state: 'ok',
      tab: 'output',
      tooltip: 'Your program as plain text — a .lum file',
    },
    {
      id: 'lexer',
      label: 'Lexer',
      icon: <TokenRoundedIcon sx={{ fontSize: 15 }} />,
      metric: `${significant} tokens`,
      detail: analysis ? ms(analysis.timings.lex) : '',
      state: lexErrors ? 'error' : 'ok',
      tab: 'tokens',
      tooltip: 'Splits the text into tokens: keywords, names, numbers, operators…',
    },
    {
      id: 'parser',
      label: 'Parser',
      icon: <AccountTreeRoundedIcon sx={{ fontSize: 15 }} />,
      metric: lexErrors ? 'skipped' : `${analysis?.nodeCount ?? 0} nodes`,
      detail: analysis ? ms(analysis.timings.parse) : '',
      state: lexErrors ? 'skipped' : parseErrors ? 'error' : 'ok',
      tab: 'ast',
      tooltip: 'Builds the abstract syntax tree (AST) from the tokens',
    },
    {
      id: 'checker',
      label: 'Type checker',
      icon: <SpellcheckRoundedIcon sx={{ fontSize: 15 }} />,
      metric: checked
        ? `${checked.symbols.filter((sym) => sym.inferred && !sym.hidden).length} inferred`
        : 'skipped',
      detail: checked && analysis ? ms(analysis.timings.check) : '',
      state: !checked ? 'skipped' : checkErrors ? 'error' : checkWarnings ? 'warn' : 'ok',
      tab: 'types',
      tooltip: 'Infers and verifies the type of every expression before running',
    },
    {
      id: 'codegen',
      label: 'Code generator',
      icon: <DataObjectRoundedIcon sx={{ fontSize: 15 }} />,
      metric: compiled ? `${compiled.code.split('\n').length} lines JS` : 'skipped',
      detail: compiled && analysis ? ms(analysis.timings.codegen) : '',
      state: compiled ? 'ok' : 'skipped',
      tab: 'js',
      tooltip: 'Compiles the typed tree to JavaScript',
    },
    {
      id: 'runtime',
      label: 'Runtime',
      icon: <BoltRoundedIcon sx={{ fontSize: 15 }} />,
      metric: runMetric[runStatus],
      detail:
        summary && runStatus !== 'running' && summary.status !== 'compile-error'
          ? ms(summary.durationMs)
          : '',
      state: runState,
      tab: 'output',
      tooltip: 'Runs the compiled program in a background worker',
    },
  ];

  return (
    <Box
      data-testid="pipeline-bar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: { xs: 1, sm: 2 },
        py: 0.75,
        gap: 0,
        borderBottom: `1px solid ${colors.border}`,
        background: 'rgba(9, 10, 17, 0.6)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Typography
        sx={{
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: colors.textFaint,
          mr: 1.5,
          display: { xs: 'none', lg: 'block' },
          whiteSpace: 'nowrap',
        }}
      >
        Pipeline
      </Typography>
      {stages.map((stage, i) => {
        const color = STATE_COLOR[stage.state];
        return (
          <Box key={stage.id} sx={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
            {i > 0 && (
              <Box
                sx={{
                  width: { xs: 14, md: 28 },
                  height: 2,
                  mx: 0.5,
                  borderRadius: 2,
                  background:
                    stage.state === 'skipped'
                      ? colors.border
                      : `linear-gradient(90deg, transparent, ${colors.amber}, transparent) ${colors.borderStrong}`,
                  backgroundSize: '60px 2px',
                  backgroundRepeat: 'no-repeat',
                  animation: runStatus === 'running' ? `${flow} 1.1s linear infinite` : 'none',
                }}
              />
            )}
            <Tooltip title={stage.tooltip}>
              <ButtonBase
                onClick={() => onSelect(stage.tab)}
                data-testid={`stage-${stage.id}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  pl: 0.75,
                  pr: 1.25,
                  py: 0.5,
                  borderRadius: 2,
                  border: `1px solid ${stage.state === 'error' ? `${colors.red}55` : colors.border}`,
                  background:
                    stage.state === 'error'
                      ? 'rgba(255, 92, 122, 0.06)'
                      : 'rgba(255,255,255,0.015)',
                  transition: 'all 150ms ease',
                  '&:hover': {
                    borderColor: colors.borderStrong,
                    background: 'rgba(255,255,255,0.04)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    color: stage.state === 'skipped' ? colors.textFaint : color,
                    background: `${color}1A`,
                    animation:
                      stage.state === 'active' ? `${pulse} 1.4s ease-out infinite` : 'none',
                  }}
                >
                  {stage.icon}
                </Box>
                <Box sx={{ textAlign: 'left', lineHeight: 1.15 }}>
                  <Typography
                    sx={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: colors.textSoft,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {stage.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: fonts.mono,
                      fontSize: 10.5,
                      color: colors.textMuted,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Box
                      component="span"
                      sx={{ color: stage.state === 'error' ? colors.red : undefined }}
                    >
                      {stage.state === 'error' && stage.id !== 'runtime' ? 'errors' : stage.metric}
                    </Box>
                    {stage.detail && (
                      <Box
                        component="span"
                        sx={{ color: colors.textFaint, display: { xs: 'none', md: 'inline' } }}
                      >
                        {' · '}
                        {stage.detail}
                      </Box>
                    )}
                  </Typography>
                </Box>
              </ButtonBase>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}
