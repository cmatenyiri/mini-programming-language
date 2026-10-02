import TokenRoundedIcon from '@mui/icons-material/TokenRounded';
import { Box, ButtonBase, FormControlLabel, Switch, Tooltip, Typography } from '@mui/material';
import { memo, useMemo, useState } from 'react';
import { LineIndex, type Span } from '../../lumen/diagnostics';
import { type Token, type TokenCategory, tokenCategory } from '../../lumen/tokens';
import { colors, fonts, syntax } from '../../theme/tokens';
import { EmptyState, PanelToolbar } from './common';
import { scrollArea } from './styles';

const CATEGORY_COLORS: Record<TokenCategory, string> = {
  keyword: syntax.keyword,
  identifier: syntax.identifier,
  type: syntax.type,
  number: syntax.number,
  string: syntax.string,
  operator: syntax.operator,
  punctuation: syntax.punctuation,
  comment: syntax.comment,
  eof: colors.textFaint,
};

const CATEGORY_ORDER: TokenCategory[] = [
  'keyword',
  'identifier',
  'type',
  'number',
  'string',
  'operator',
  'punctuation',
  'comment',
];

interface Props {
  source: string;
  tokens: Token[];
  onJump: (span: Span) => void;
  onHover: (span: Span | null) => void;
}

interface Row {
  line: number;
  tokens: { token: Token; category: TokenCategory; index: number }[];
}

export const TokensPanel = memo(function TokensPanel({ source, tokens, onJump, onHover }: Props) {
  const [hidden, setHidden] = useState<Set<TokenCategory>>(() => new Set());
  const [showComments, setShowComments] = useState(false);

  const { rows, counts } = useMemo(() => {
    const index = new LineIndex(source);
    const counts = new Map<TokenCategory, number>();
    const byLine = new Map<number, Row>();
    tokens.forEach((token, i) => {
      if (token.kind === 'eof') return;
      const category = tokenCategory(token);
      counts.set(category, (counts.get(category) ?? 0) + 1);
      const line = index.position(token.span.start).line;
      let row = byLine.get(line);
      if (!row) {
        row = { line, tokens: [] };
        byLine.set(line, row);
      }
      row.tokens.push({ token, category, index: i });
    });
    return { rows: [...byLine.values()], counts };
  }, [source, tokens]);

  const visible = (c: TokenCategory) => !hidden.has(c) && (showComments || c !== 'comment');
  const toggle = (c: TokenCategory) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const total = tokens.length - 1;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelToolbar
        actions={
          <FormControlLabel
            sx={{
              mr: 0,
              '& .MuiFormControlLabel-label': { fontSize: 11.5, color: colors.textMuted },
            }}
            control={
              <Switch
                size="small"
                checked={showComments}
                onChange={(e) => setShowComments(e.target.checked)}
              />
            }
            label="Comments"
          />
        }
      >
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.75 }}>
          {CATEGORY_ORDER.filter((c) => counts.get(c)).map((c) => (
            <ButtonBase
              key={c}
              onClick={() => toggle(c)}
              sx={{
                fontFamily: fonts.mono,
                fontSize: 10.5,
                px: 0.9,
                py: 0.3,
                borderRadius: 1.5,
                gap: 0.6,
                whiteSpace: 'nowrap',
                color: hidden.has(c) ? colors.textFaint : CATEGORY_COLORS[c],
                border: `1px solid ${hidden.has(c) ? colors.border : `${CATEGORY_COLORS[c]}40`}`,
                background: hidden.has(c) ? 'transparent' : `${CATEGORY_COLORS[c]}10`,
                textDecoration: hidden.has(c) ? 'line-through' : 'none',
              }}
            >
              {c}
              <Box component="span" sx={{ opacity: 0.6 }}>
                {counts.get(c)}
              </Box>
            </ButtonBase>
          ))}
        </Box>
      </PanelToolbar>
      <Box sx={{ ...scrollArea, py: 1 }} data-testid="tokens">
        {total <= 0 ? (
          <EmptyState icon={<TokenRoundedIcon />} title="No tokens yet">
            Start typing — the lexer turns your text into a stream of tokens as you go.
          </EmptyState>
        ) : (
          <>
            <Typography sx={{ px: 2, pb: 1, fontSize: 12, color: colors.textMuted }}>
              The lexer read <b style={{ color: colors.text }}>{source.length}</b> characters and
              produced <b style={{ color: colors.text }}>{total - (counts.get('comment') ?? 0)}</b>{' '}
              tokens
              {counts.get('comment') ? ` (plus ${counts.get('comment')} comments)` : ''}. Hover a
              token to find it in the code.
            </Typography>
            {rows.map((row) => {
              const shown = row.tokens.filter((t) => visible(t.category));
              if (!shown.length) return null;
              return (
                <Box
                  key={row.line}
                  sx={{ display: 'flex', gap: 1.25, px: 1.5, py: 0.4, alignItems: 'flex-start' }}
                >
                  <Typography
                    sx={{
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      color: colors.textFaint,
                      minWidth: 26,
                      textAlign: 'right',
                      pt: '3px',
                    }}
                  >
                    {row.line}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {shown.map(({ token, category, index }) => (
                      <TokenChip
                        key={index}
                        token={token}
                        category={category}
                        onJump={onJump}
                        onHover={onHover}
                      />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </Box>
    </Box>
  );
});

function TokenChip({
  token,
  category,
  onJump,
  onHover,
}: {
  token: Token;
  category: TokenCategory;
  onJump: (span: Span) => void;
  onHover: (span: Span | null) => void;
}) {
  const color = CATEGORY_COLORS[category];
  const text = token.text.length > 28 ? `${token.text.slice(0, 26)}…` : token.text;
  const kind =
    category === 'keyword'
      ? 'KW'
      : category === 'identifier' || category === 'type'
        ? 'ID'
        : category === 'operator'
          ? 'OP'
          : category === 'punctuation'
            ? 'P'
            : token.kind === 'template'
              ? 'STR${}'
              : token.kind.toUpperCase();
  return (
    <Tooltip
      enterDelay={500}
      title={
        <Box sx={{ fontFamily: fonts.mono, fontSize: 11 }}>
          <div>
            <b>{category}</b> · {token.kind === 'ident' ? 'identifier' : token.kind}
          </div>
          {token.value !== undefined && typeof token.value === 'number' && (
            <div>value = {token.value}</div>
          )}
          <div style={{ color: colors.textMuted }}>
            offset {token.span.start}–{token.span.end}
          </div>
        </Box>
      }
    >
      <ButtonBase
        onClick={() => onJump(token.span)}
        onMouseEnter={() => onHover(token.span)}
        onMouseLeave={() => onHover(null)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.6,
          fontFamily: fonts.mono,
          fontSize: 12,
          lineHeight: 1,
          pl: 0.6,
          pr: 0.8,
          py: 0.45,
          borderRadius: 1.25,
          color,
          background: `${color}12`,
          border: `1px solid ${color}30`,
          whiteSpace: 'pre',
          transition: 'transform 100ms ease, background 100ms ease',
          '&:hover': { background: `${color}26`, transform: 'translateY(-1px)' },
        }}
      >
        <Box
          component="span"
          sx={{ fontSize: 8.5, letterSpacing: '0.06em', opacity: 0.55, fontWeight: 700 }}
        >
          {kind}
        </Box>
        {text}
      </ButtonBase>
    </Tooltip>
  );
}
