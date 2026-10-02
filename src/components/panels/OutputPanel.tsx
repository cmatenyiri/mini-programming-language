import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import TimerOffRoundedIcon from '@mui/icons-material/TimerOffRounded';
import { Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { OutputLine, RunStatus, RunSummary } from '../../hooks/useRunner';
import type { Span } from '../../lumen/diagnostics';
import { colors, fonts } from '../../theme/tokens';
import { MOD_KEY } from '../../platform';
import { EmptyState, PanelToolbar } from './common';
import { scrollArea } from './styles';

interface Props {
  lines: OutputLine[];
  status: RunStatus;
  summary: RunSummary | null;
  startedAt: number | null;
  onClear: () => void;
  onJump: (span: Span) => void;
}

function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, now - startedAt);
}

const fmtMs = (ms: number) =>
  ms < 1000 ? `${ms.toFixed(ms < 10 ? 1 : 0)} ms` : `${(ms / 1000).toFixed(2)} s`;
const fmtCount = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);

function StatusLine({
  status,
  summary,
  elapsed,
}: {
  status: RunStatus;
  summary: RunSummary | null;
  elapsed: number;
}) {
  let icon: ReactNode;
  let text: ReactNode;
  let color: string = colors.textMuted;
  switch (status) {
    case 'running':
      icon = <CircularProgress size={13} thickness={6} sx={{ color: colors.amber }} />;
      text = `Running… ${fmtMs(elapsed)}`;
      color = colors.amber;
      break;
    case 'success':
      icon = <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />;
      color = colors.green;
      text = (
        <>
          Finished in {fmtMs(summary?.durationMs ?? 0)}
          {summary?.stats && (
            <Box component="span" sx={{ color: colors.textFaint, ml: 1 }}>
              {fmtCount(summary.stats.calls)} function calls · max call depth{' '}
              {summary.stats.maxDepth}
            </Box>
          )}
        </>
      );
      break;
    case 'runtime-error':
      icon = <ErrorRoundedIcon sx={{ fontSize: 16 }} />;
      color = colors.red;
      text = `Runtime error after ${fmtMs(summary?.durationMs ?? 0)}`;
      break;
    case 'compile-error':
      icon = <ErrorRoundedIcon sx={{ fontSize: 16 }} />;
      color = colors.red;
      text = 'Did not run — fix the errors first';
      break;
    case 'stopped':
      icon = <PauseCircleRoundedIcon sx={{ fontSize: 16 }} />;
      color = colors.yellow;
      text = 'Stopped';
      break;
    case 'timeout':
      icon = <TimerOffRoundedIcon sx={{ fontSize: 16 }} />;
      color = colors.yellow;
      text = 'Timed out';
      break;
    case 'crashed':
      icon = <ErrorRoundedIcon sx={{ fontSize: 16 }} />;
      color = colors.red;
      text = 'Internal error';
      break;
    default:
      icon = <TerminalRoundedIcon sx={{ fontSize: 16 }} />;
      text = 'Console';
  }
  return (
    <Box
      data-testid="run-status"
      data-status={status}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        color,
        fontSize: 12,
        fontWeight: 600,
        minWidth: 0,
      }}
    >
      {icon}
      <Box
        component="span"
        sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {text}
      </Box>
    </Box>
  );
}

export function OutputPanel({ lines, status, summary, startedAt, onClear, onJump }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const elapsed = useElapsed(startedAt);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const copy = () => {
    void navigator.clipboard?.writeText(lines.map((l) => l.text).join('\n'));
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelToolbar
        actions={
          <>
            <Tooltip title="Copy output">
              <span>
                <IconButton size="small" onClick={copy} disabled={!lines.length}>
                  <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Clear console">
              <span>
                <IconButton
                  size="small"
                  onClick={onClear}
                  disabled={!lines.length}
                  data-testid="clear-output"
                >
                  <DeleteSweepRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </span>
            </Tooltip>
          </>
        }
      >
        <StatusLine status={status} summary={summary} elapsed={elapsed} />
      </PanelToolbar>
      <Box
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        data-testid="output"
        sx={{ ...scrollArea, fontFamily: fonts.mono, fontSize: 13, lineHeight: 1.65, py: 1 }}
      >
        {lines.length === 0 && status !== 'running' ? (
          <EmptyState icon={<TerminalRoundedIcon />} title="Nothing printed yet">
            Press <b>Run</b> or <kbd>{MOD_KEY}</kbd> <kbd>Enter</kbd> to execute your program.
            Everything you <code>print</code> shows up here.
          </EmptyState>
        ) : (
          lines.map((line) => <OutputRow key={line.id} line={line} onJump={onJump} />)
        )}
      </Box>
    </Box>
  );
}

function OutputRow({ line, onJump }: { line: OutputLine; onJump: (span: Span) => void }) {
  const base = {
    px: 2,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    minHeight: '1.65em',
  } as const;
  if (line.kind === 'out') {
    return (
      <Box
        sx={{ ...base, color: colors.text, '&:hover': { background: 'rgba(255,255,255,0.02)' } }}
      >
        {line.text}
      </Box>
    );
  }
  const color =
    line.kind === 'error' ? colors.red : line.kind === 'trace' ? colors.textMuted : colors.yellow;
  return (
    <Box
      sx={{
        ...base,
        color,
        pl: line.kind === 'trace' ? 5 : 2,
        my: line.kind === 'error' ? 0.5 : 0,
        py: line.kind === 'error' ? 0.5 : 0,
        background: line.kind === 'error' ? 'rgba(255, 92, 122, 0.07)' : 'transparent',
        boxShadow: line.kind === 'error' ? `inset 3px 0 0 ${colors.red}` : 'none',
        display: 'flex',
        gap: 1.5,
        alignItems: 'baseline',
      }}
    >
      <Box component="span" sx={{ flex: 1 }}>
        {line.text}
      </Box>
      {line.span && (line.kind === 'error' || line.kind === 'trace') && (
        <Typography
          component="button"
          onClick={() => onJump(line.span!)}
          sx={{
            all: 'unset',
            cursor: 'pointer',
            fontFamily: fonts.mono,
            fontSize: 11.5,
            color: colors.textMuted,
            textDecoration: 'underline dotted',
            '&:hover': { color: colors.amber },
          }}
        >
          line {line.line}
        </Typography>
      )}
    </Box>
  );
}
