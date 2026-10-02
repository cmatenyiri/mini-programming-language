import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Program } from '../../lumen/ast';
import type { Span } from '../../lumen/diagnostics';
import { colors, fonts, syntax } from '../../theme/tokens';
import { Code } from '../Code';
import {
  type NodeGroup,
  type TreeNode,
  buildTree,
  collectIds,
  countNodes,
  pathTo,
} from './astTree';
import { EmptyState, PanelToolbar } from './common';
import { scrollArea } from './styles';

const GROUP_COLORS: Record<NodeGroup, string> = {
  decl: colors.amber,
  stmt: colors.violet,
  expr: colors.cyan,
  literal: syntax.number,
  pattern: colors.pink,
  type: colors.green,
  part: colors.textMuted,
};

interface Props {
  program: Program | null;
  typed: boolean;
  cursor: number;
  onJump: (span: Span) => void;
  onHover: (span: Span | null) => void;
}

export const AstPanel = memo(function AstPanel({ program, typed, cursor, onJump, onHover }: Props) {
  const tree = useMemo(() => (program ? buildTree(program as never) : null), [program]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [follow, setFollow] = useState(true);
  const [prevTree, setPrevTree] = useState<TreeNode | null>(null);

  if (tree !== prevTree) {
    setPrevTree(tree);
    if (tree && !prevTree) setExpanded(collectIds(tree, 2));
  }

  const activePath = useMemo(
    () => (tree && follow ? pathTo(tree, cursor) : []),
    [tree, cursor, follow],
  );
  const activeId = activePath.at(-1);

  // While following the cursor, the ancestors of the node under the cursor are kept open.
  const visibleExpanded = useMemo(() => {
    if (!follow || activePath.length < 2) return expanded;
    const next = new Set(expanded);
    activePath.slice(0, -1).forEach((id) => next.add(id));
    return next;
  }, [expanded, activePath, follow]);

  const nodeCount = useMemo(() => (tree ? countNodes(tree) : 0), [tree]);

  const toggle = (id: string) => {
    const open = visibleExpanded.has(id);
    if (open && follow && activePath.slice(0, -1).includes(id)) setFollow(false);
    const next = new Set(visibleExpanded);
    if (open) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelToolbar
        actions={
          <>
            <Tooltip title={follow ? 'Following the cursor' : 'Follow the cursor'}>
              <IconButton
                size="small"
                onClick={() => setFollow((f) => !f)}
                sx={{ color: follow ? colors.amber : undefined }}
              >
                <MyLocationRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Expand all">
              <IconButton size="small" onClick={() => tree && setExpanded(collectIds(tree, 99))}>
                <UnfoldMoreRoundedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Collapse all">
              <IconButton size="small" onClick={() => setExpanded(new Set(tree ? [tree.id] : []))}>
                <UnfoldLessRoundedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </>
        }
      >
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', overflow: 'hidden' }}>
          {(['decl', 'stmt', 'expr', 'pattern', 'type'] as NodeGroup[]).map((g) => (
            <Box
              key={g}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}
            >
              <Box sx={{ width: 7, height: 7, borderRadius: '2px', background: GROUP_COLORS[g] }} />
              <Typography sx={{ fontSize: 11, color: colors.textMuted }}>
                {g === 'decl'
                  ? 'declaration'
                  : g === 'stmt'
                    ? 'statement'
                    : g === 'expr'
                      ? 'expression'
                      : g}
              </Typography>
            </Box>
          ))}
        </Box>
      </PanelToolbar>
      <Box sx={{ ...scrollArea, py: 1 }} data-testid="ast">
        {!tree || !tree.children.length ? (
          <EmptyState icon={<AccountTreeRoundedIcon />} title="The tree is empty">
            The parser arranges tokens into an abstract syntax tree. Write some code to grow one.
          </EmptyState>
        ) : (
          <>
            <Typography sx={{ px: 2, pb: 1, fontSize: 12, color: colors.textMuted }}>
              <b style={{ color: colors.text }}>{nodeCount}</b> nodes.{' '}
              {typed
                ? 'Expressions show the type inferred by the checker.'
                : 'Fix the errors to see inferred types on each node.'}
            </Typography>
            <TreeRow
              node={tree}
              depth={0}
              expanded={visibleExpanded}
              activeId={activeId}
              onToggle={toggle}
              onJump={onJump}
              onHover={onHover}
            />
          </>
        )}
      </Box>
    </Box>
  );
});

interface RowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  activeId?: string;
  onToggle: (id: string) => void;
  onJump: (span: Span) => void;
  onHover: (span: Span | null) => void;
}

function TreeRow({ node, depth, expanded, activeId, onToggle, onJump, onHover }: RowProps) {
  const open = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const color = GROUP_COLORS[node.group];
  const active = node.id === activeId;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <>
      <Box
        ref={ref}
        onClick={() => {
          if (node.span) onJump(node.span);
        }}
        onMouseEnter={() => onHover(node.span ?? null)}
        onMouseLeave={() => onHover(null)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          pl: 1 + depth * 1.6,
          pr: 1.5,
          minHeight: 26,
          cursor: 'pointer',
          position: 'relative',
          fontFamily: fonts.mono,
          fontSize: 12,
          background: active ? 'rgba(255, 181, 71, 0.08)' : 'transparent',
          boxShadow: active ? `inset 2px 0 0 ${colors.amber}` : 'none',
          '&:hover': { background: active ? 'rgba(255, 181, 71, 0.1)' : 'rgba(255,255,255,0.03)' },
          '&::before': depth
            ? {
                content: '""',
                position: 'absolute',
                left: `${(depth - 1) * 12.8 + 17}px`,
                top: 0,
                bottom: 0,
                borderLeft: `1px solid ${colors.border}`,
              }
            : {},
        }}
      >
        <Box
          component="span"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
          sx={{
            width: 18,
            height: 18,
            display: 'grid',
            placeItems: 'center',
            color: colors.textFaint,
            borderRadius: 1,
            visibility: hasChildren ? 'visible' : 'hidden',
            '&:hover': { color: colors.text, background: 'rgba(255,255,255,0.06)' },
          }}
        >
          <ChevronRightRoundedIcon
            sx={{
              fontSize: 16,
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform 120ms',
            }}
          />
        </Box>
        {node.role && node.role !== 'body' && (
          <Box component="span" sx={{ color: colors.textFaint, fontSize: 11 }}>
            {node.role}:
          </Box>
        )}
        <Box component="span" sx={{ color, fontWeight: 600 }}>
          {node.kind}
        </Box>
        {node.summary && (
          <Box
            component="span"
            sx={{
              color: colors.textSoft,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.summary}
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        {node.type && node.type !== 'void' && (
          <Box
            sx={{
              px: 0.75,
              borderRadius: 1,
              border: `1px solid ${colors.border}`,
              background: 'rgba(76, 214, 255, 0.05)',
              maxWidth: '45%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.6,
            }}
          >
            <Code inline code={node.type} fontSize={11} />
          </Box>
        )}
      </Box>
      {open &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            activeId={activeId}
            onToggle={onToggle}
            onJump={onJump}
            onHover={onHover}
          />
        ))}
    </>
  );
}
