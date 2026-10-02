import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import SpellcheckRoundedIcon from '@mui/icons-material/SpellcheckRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import JavascriptRoundedIcon from '@mui/icons-material/JavascriptRounded';
import TokenRoundedIcon from '@mui/icons-material/TokenRounded';
import { Box, Tab, Tabs } from '@mui/material';
import type { ReactElement } from 'react';
import type { OutputLine, RunStatus, RunSummary } from '../hooks/useRunner';
import type { Diagnostic, Span } from '../lumen/diagnostics';
import type { Analysis } from '../lumen/index';
import { colors, fonts } from '../theme/tokens';
import { AstPanel } from './panels/AstPanel';
import { OutputPanel } from './panels/OutputPanel';
import { ProblemsPanel } from './panels/ProblemsPanel';
import { SymbolsPanel } from './panels/SymbolsPanel';
import { TokensPanel } from './panels/TokensPanel';
import { CompiledPanel } from './panels/CompiledPanel';

export type PanelTab = 'output' | 'problems' | 'tokens' | 'ast' | 'types' | 'js';

interface Props {
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  analysis: Analysis | null;
  diagnostics: Diagnostic[];
  cursor: number;
  run: {
    lines: OutputLine[];
    status: RunStatus;
    summary: RunSummary | null;
    startedAt: number | null;
    clear: () => void;
  };
  onJump: (span: Span) => void;
  onHover: (span: Span | null) => void;
}

function Count({ n, color }: { n: number; color: string }) {
  if (!n) return null;
  return (
    <Box
      component="span"
      sx={{
        ml: 0.75,
        minWidth: 18,
        height: 18,
        px: 0.5,
        borderRadius: 9,
        fontFamily: fonts.mono,
        fontSize: 10.5,
        fontWeight: 700,
        display: 'inline-grid',
        placeItems: 'center',
        color: '#120A0A',
        background: color,
      }}
    >
      {n > 99 ? '99+' : n}
    </Box>
  );
}

export function InsightPanel({
  tab,
  onTab,
  analysis,
  diagnostics,
  cursor,
  run,
  onJump,
  onHover,
}: Props) {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.length - errors;

  const tabs: { value: PanelTab; label: ReactElement | string; icon: ReactElement }[] = [
    { value: 'output', label: 'Output', icon: <TerminalRoundedIcon sx={{ fontSize: 16 }} /> },
    {
      value: 'problems',
      label: (
        <span>
          Problems
          <Count n={errors || warnings} color={errors ? colors.red : colors.yellow} />
        </span>
      ),
      icon: <ReportProblemRoundedIcon sx={{ fontSize: 16 }} />,
    },
    { value: 'tokens', label: 'Tokens', icon: <TokenRoundedIcon sx={{ fontSize: 16 }} /> },
    { value: 'ast', label: 'AST', icon: <AccountTreeRoundedIcon sx={{ fontSize: 16 }} /> },
    { value: 'types', label: 'Types', icon: <SpellcheckRoundedIcon sx={{ fontSize: 16 }} /> },
    { value: 'js', label: 'JS', icon: <JavascriptRoundedIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Tabs
        value={tab}
        onChange={(_e, v: PanelTab) => onTab(v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{ borderBottom: `1px solid ${colors.border}`, px: 1, flexShrink: 0 }}
      >
        {tabs.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            icon={t.icon}
            iconPosition="start"
            data-testid={`tab-${t.value}`}
            sx={{ gap: 0.25, '& .MuiTab-icon': { mr: 0.75 } }}
          />
        ))}
      </Tabs>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {tab === 'output' && (
          <OutputPanel
            lines={run.lines}
            status={run.status}
            summary={run.summary}
            startedAt={run.startedAt}
            onClear={run.clear}
            onJump={onJump}
          />
        )}
        {tab === 'problems' && (
          <ProblemsPanel
            source={analysis?.source ?? ''}
            diagnostics={diagnostics}
            onJump={onJump}
            onHover={onHover}
          />
        )}
        {tab === 'tokens' && (
          <TokensPanel
            source={analysis?.source ?? ''}
            tokens={analysis?.tokens ?? []}
            onJump={onJump}
            onHover={onHover}
          />
        )}
        {tab === 'ast' && (
          <AstPanel
            program={analysis?.program ?? null}
            typed={!!analysis?.check}
            cursor={cursor}
            onJump={onJump}
            onHover={onHover}
          />
        )}
        {tab === 'types' && (
          <SymbolsPanel
            source={analysis?.source ?? ''}
            symbols={analysis?.check?.symbols ?? null}
            onJump={onJump}
            onHover={onHover}
          />
        )}
        {tab === 'js' && (
          <CompiledPanel
            compiled={analysis?.compiled ?? null}
            codegenMs={analysis?.timings.codegen ?? 0}
            hasErrors={!!analysis && !analysis.ok}
          />
        )}
      </Box>
    </Box>
  );
}
