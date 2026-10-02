import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SpellcheckRoundedIcon from '@mui/icons-material/SpellcheckRounded';
import { Box, ButtonBase, InputBase, Tooltip, Typography } from '@mui/material';
import { memo, useMemo, useState } from 'react';
import type { SymbolInfo, SymbolKind } from '../../lumen/checker';
import { LineIndex, type Span } from '../../lumen/diagnostics';
import { colors, fonts, syntax } from '../../theme/tokens';
import { Code } from '../Code';
import { EmptyState, PanelToolbar } from './common';
import { scrollArea } from './styles';

const KIND_META: Record<SymbolKind, { badge: string; color: string; label: string }> = {
  function: { badge: 'ƒ', color: syntax.function, label: 'function' },
  method: { badge: 'm', color: syntax.function, label: 'method' },
  variable: { badge: 'x', color: syntax.identifier, label: 'variable' },
  parameter: { badge: 'p', color: syntax.property, label: 'parameter' },
  struct: { badge: 'S', color: syntax.type, label: 'struct' },
  enum: { badge: 'E', color: syntax.constant, label: 'enum' },
  variant: { badge: 'v', color: syntax.constant, label: 'variant' },
  field: { badge: '·', color: syntax.property, label: 'field' },
  'type-alias': { badge: 'T', color: syntax.type, label: 'type alias' },
};

const SECTIONS: { title: string; kinds: SymbolKind[] }[] = [
  { title: 'Types', kinds: ['struct', 'enum', 'type-alias', 'field'] },
  { title: 'Functions', kinds: ['function', 'method', 'parameter'] },
  { title: 'Variables', kinds: ['variable'] },
];

interface Props {
  source: string;
  symbols: SymbolInfo[] | null;
  onJump: (span: Span) => void;
  onHover: (span: Span | null) => void;
}

export const SymbolsPanel = memo(function SymbolsPanel({
  source,
  symbols,
  onJump,
  onHover,
}: Props) {
  const [query, setQuery] = useState('');
  const [inferredOnly, setInferredOnly] = useState(false);
  const index = useMemo(() => new LineIndex(source), [source]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (symbols ?? [])
      .filter((s) => !s.hidden)
      .filter((s) => !inferredOnly || s.inferred)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q))
      .sort((a, b) => a.span.start - b.span.start);
  }, [symbols, query, inferredOnly]);

  const inferredCount = (symbols ?? []).filter((s) => s.inferred && !s.hidden).length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelToolbar
        actions={
          <Tooltip title="Show only symbols whose type was inferred">
            <ButtonBase
              onClick={() => setInferredOnly((v) => !v)}
              sx={{
                fontSize: 11.5,
                fontWeight: 600,
                gap: 0.5,
                px: 1,
                py: 0.4,
                borderRadius: 1.5,
                color: inferredOnly ? colors.amber : colors.textMuted,
                border: `1px solid ${inferredOnly ? `${colors.amber}66` : colors.border}`,
                background: inferredOnly ? `${colors.amber}14` : 'transparent',
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 13 }} />
              Inferred · {inferredCount}
            </ButtonBase>
          </Tooltip>
        }
      >
        <SearchRoundedIcon sx={{ fontSize: 16, color: colors.textFaint }} />
        <InputBase
          placeholder="Filter by name or type…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ fontSize: 12.5, flex: 1, color: colors.text }}
        />
      </PanelToolbar>
      <Box sx={{ ...scrollArea, pb: 2 }} data-testid="symbols">
        {!symbols ? (
          <EmptyState icon={<SpellcheckRoundedIcon />} title="Type checking was skipped">
            The type checker runs once the code is free of syntax errors. Fix them to see every
            inferred type here.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState icon={<SpellcheckRoundedIcon />} title="No symbols">
            Declare variables, functions or types and the checker will list them with their types.
          </EmptyState>
        ) : (
          SECTIONS.map((section) => {
            const items = visible.filter((s) => section.kinds.includes(s.kind));
            if (!items.length) return null;
            return (
              <Box key={section.title}>
                <Typography
                  sx={{
                    px: 2,
                    pt: 1.5,
                    pb: 0.5,
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: colors.textFaint,
                  }}
                >
                  {section.title} · {items.length}
                </Typography>
                {items.map((s, i) => (
                  <SymbolRow
                    key={`${s.name}-${s.span.start}-${i}`}
                    symbol={s}
                    line={index.position(s.span.start).line}
                    onJump={onJump}
                    onHover={onHover}
                  />
                ))}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
});

function SymbolRow({
  symbol,
  line,
  onJump,
  onHover,
}: {
  symbol: SymbolInfo;
  line: number;
  onJump: (span: Span) => void;
  onHover: (span: Span | null) => void;
}) {
  const meta = KIND_META[symbol.kind];
  const indent =
    Math.min(symbol.depth, 4) +
    (symbol.kind === 'field' || symbol.kind === 'parameter' || symbol.kind === 'method' ? 1 : 0);
  const typeCode =
    symbol.kind === 'function' || symbol.kind === 'method'
      ? symbol.type.replace(/^[\w]+/, '')
      : symbol.type;
  return (
    <ButtonBase
      onClick={() => onJump(symbol.span)}
      onMouseEnter={() => onHover(symbol.span)}
      onMouseLeave={() => onHover(null)}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 2 + indent * 1.5,
        pr: 2,
        py: 0.6,
        textAlign: 'left',
        '&:hover': { background: 'rgba(255,255,255,0.03)' },
      }}
    >
      <Tooltip title={meta.label} placement="left">
        <Box
          sx={{
            width: 18,
            height: 18,
            flexShrink: 0,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            fontFamily: fonts.mono,
            fontSize: 11,
            fontWeight: 700,
            color: meta.color,
            background: `${meta.color}16`,
            border: `1px solid ${meta.color}33`,
          }}
        >
          {meta.badge}
        </Box>
      </Tooltip>
      <Box
        sx={{
          minWidth: 0,
          flex: 1,
          display: 'flex',
          alignItems: 'baseline',
          overflow: 'hidden',
        }}
      >
        <Typography
          sx={{
            fontFamily: fonts.mono,
            fontSize: 12.5,
            fontWeight: 600,
            color: symbol.mutable ? colors.amberSoft : colors.text,
            whiteSpace: 'nowrap',
          }}
        >
          {symbol.owner && symbol.kind === 'method' ? `${symbol.owner}.` : ''}
          {symbol.name}
        </Typography>
        <Box
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
        >
          {symbol.kind === 'struct' || symbol.kind === 'enum' ? (
            <Code
              inline
              code={typeCode.replace(/^[\w]+(<[^>]*>)?\s*/, '')}
              fontSize={11.5}
              sx={{ opacity: 0.8, ml: 1 }}
            />
          ) : (
            <>
              <Box
                component="span"
                sx={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 12 }}
              >
                {symbol.kind === 'function' ||
                symbol.kind === 'method' ||
                symbol.kind === 'type-alias'
                  ? ''
                  : ': '}
                {symbol.kind === 'type-alias' ? '= ' : ''}
              </Box>
              <Code inline code={typeCode} fontSize={12} />
            </>
          )}
        </Box>
      </Box>
      {symbol.inferred && (
        <Tooltip title="Inferred by the type checker — no annotation was written">
          <AutoAwesomeRoundedIcon sx={{ fontSize: 13, color: colors.amber, flexShrink: 0 }} />
        </Tooltip>
      )}
      {symbol.kind === 'parameter' && symbol.owner && (
        <Typography
          sx={{ fontFamily: fonts.mono, fontSize: 10.5, color: colors.textFaint, flexShrink: 0 }}
        >
          {symbol.owner === 'lambda' ? 'λ' : `in ${symbol.owner}`}
        </Typography>
      )}
      {symbol.mutable && (
        <Typography
          sx={{ fontFamily: fonts.mono, fontSize: 10, color: colors.amberSoft, flexShrink: 0 }}
        >
          var
        </Typography>
      )}
      <Typography
        sx={{
          fontFamily: fonts.mono,
          fontSize: 11,
          color: colors.textFaint,
          minWidth: 28,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {line}
      </Typography>
    </ButtonBase>
  );
}
