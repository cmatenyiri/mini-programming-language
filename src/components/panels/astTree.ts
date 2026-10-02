import type { Span } from '../../lumen/diagnostics';
import { type Type, typeToString } from '../../lumen/types';

export type NodeGroup = 'stmt' | 'decl' | 'expr' | 'literal' | 'pattern' | 'type' | 'part';

export interface TreeNode {
  id: string;
  kind: string;
  /** Name of the property this node is stored in on its parent (`left`, `body`, …). */
  role?: string;
  summary?: string;
  type?: string;
  group: NodeGroup;
  span?: Span;
  children: TreeNode[];
}

type AnyNode = Record<string, unknown> & { kind?: string; span?: Span; ty?: Type };

const SKIP = new Set([
  'kind',
  'span',
  'nameSpan',
  'ty',
  'target',
  'argTypes',
  'desugared',
  'operandKind',
  'access',
  'container',
  'conversion',
  'iterKind',
  'enumName',
  'semi',
  'mutable',
  'inclusive',
  'op',
  'name',
  'value',
  'litKind',
  'typeParams',
  'isSelf',
  'variant',
  'start',
  'end',
  'typeName',
]);

const PSEUDO_KINDS: Record<string, string> = {
  fields: 'Field',
  entries: 'Entry',
  arms: 'MatchArm',
  params: 'Param',
  variants: 'Variant',
  methods: 'Method',
};

const DECLS = new Set(['FnDecl', 'StructDecl', 'EnumDecl', 'ImplDecl', 'TypeAlias']);
const STMTS = new Set([
  'Let',
  'Assign',
  'ExprStmt',
  'Return',
  'Break',
  'Continue',
  'While',
  'For',
  'Loop',
  'Program',
]);
const LITERALS = new Set(['IntLit', 'FloatLit', 'StringLit', 'BoolLit', 'TemplateLit']);

function groupOf(kind: string): NodeGroup {
  if (DECLS.has(kind)) return 'decl';
  if (STMTS.has(kind)) return 'stmt';
  if (LITERALS.has(kind)) return 'literal';
  if (kind.endsWith('Pattern')) return 'pattern';
  if (kind.endsWith('Type')) return 'type';
  if (Object.values(PSEUDO_KINDS).includes(kind) || kind === 'Text') return 'part';
  return 'expr';
}

const quote = (s: string) => (s.length > 24 ? `"${s.slice(0, 22)}…"` : `"${s}"`);

function summarize(node: AnyNode, kind: string): string | undefined {
  const n = node as Record<string, unknown>;
  switch (kind) {
    case 'IntLit':
    case 'FloatLit':
    case 'BoolLit':
      return String(n.value);
    case 'StringLit':
      return quote(String(n.value));
    case 'Ident':
      return String(n.name);
    case 'Let': {
      const pattern = n.pattern as AnyNode | undefined;
      const name = pattern?.kind === 'BindingPattern' ? String(pattern.name) : 'pattern';
      return n.mutable ? `var ${name}` : name;
    }
    case 'Assign':
    case 'Binary':
    case 'Unary':
      return String(n.op);
    case 'Range':
      return n.inclusive ? '..=' : '..';
    case 'Member':
      return `.${String(n.name)}`;
    case 'FnDecl':
    case 'Method':
    case 'StructDecl':
    case 'EnumDecl':
    case 'TypeAlias':
    case 'Field':
    case 'Param':
    case 'Variant':
    case 'BindingPattern':
    case 'StructLit':
      return String(n.name);
    case 'ImplDecl':
      return String(n.typeName);
    case 'NamedType':
      return String(n.name);
    case 'LiteralPattern':
      return typeof n.value === 'string' ? quote(n.value) : String(n.value);
    case 'RangePattern':
      return `${String(n.start)}${n.inclusive ? '..=' : '..'}${String(n.end)}`;
    case 'VariantPattern':
      return n.enumName ? `${String(n.enumName)}.${String(n.variant)}` : String(n.variant);
    case 'Text':
      return quote(String(n.value));
    case 'Call': {
      const callee = n.callee as AnyNode | undefined;
      if (callee?.kind === 'Ident') return `${String(callee.name)}()`;
      if (callee?.kind === 'Member') return `.${String(callee.name)}()`;
      return undefined;
    }
    default:
      return undefined;
  }
}

const isNodeLike = (v: unknown): v is AnyNode =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function spanOf(node: AnyNode): Span | undefined {
  if (node.span) return node.span;
  const parts = Object.values(node)
    .filter(isNodeLike)
    .map((c) => spanOf(c))
    .filter((s): s is Span => !!s);
  if (!parts.length) return undefined;
  return {
    start: Math.min(...parts.map((p) => p.start)),
    end: Math.max(...parts.map((p) => p.end)),
  };
}

/** Converts the parser's AST into a display tree. */
export function buildTree(
  node: AnyNode,
  id = 'root',
  role?: string,
  kindOverride?: string,
): TreeNode {
  const kind = kindOverride ?? node.kind ?? 'Node';
  const children: TreeNode[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (SKIP.has(key) || value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const childId = `${id}.${key}${i}`;
        if (typeof item === 'string') {
          children.push({
            id: childId,
            kind: 'Text',
            role: key,
            summary: quote(item),
            group: 'part',
            children: [],
          });
        } else if (isNodeLike(item)) {
          const pseudo = item.kind ? undefined : key === 'methods' ? 'Method' : PSEUDO_KINDS[key];
          if (item.kind || pseudo) children.push(buildTree(item, childId, key, pseudo));
        }
      });
    } else if (isNodeLike(value) && (value.kind || value.span)) {
      children.push(buildTree(value, `${id}.${key}`, key));
    }
  }

  let type: string | undefined;
  if (node.ty && typeof node.ty === 'object') {
    try {
      type = typeToString(node.ty);
    } catch {
      type = undefined;
    }
  }

  return {
    id,
    kind,
    role,
    summary: summarize(node, kind),
    type,
    group: groupOf(kind),
    span: spanOf(node),
    children,
  };
}

export function countNodes(tree: TreeNode): number {
  return 1 + tree.children.reduce((n, c) => n + countNodes(c), 0);
}

export function collectIds(
  tree: TreeNode,
  depth: number,
  out = new Set<string>(),
  level = 0,
): Set<string> {
  if (level < depth && tree.children.length) {
    out.add(tree.id);
    for (const c of tree.children) collectIds(c, depth, out, level + 1);
  }
  return out;
}

/** Finds the path of ids to the deepest node containing `offset`. */
export function pathTo(tree: TreeNode, offset: number): string[] {
  const path: string[] = [];
  let node: TreeNode | undefined = tree;
  while (node) {
    path.push(node.id);
    node = node.children.find((c) => c.span && c.span.start <= offset && offset <= c.span.end);
  }
  return path;
}
