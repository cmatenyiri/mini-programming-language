import type { Span } from './diagnostics';
import type { Type } from './types';

/* ───────────────────────────── Type syntax ───────────────────────────── */

export type TypeExpr =
  | { kind: 'NamedType'; name: string; args: TypeExpr[]; span: Span }
  | { kind: 'ArrayType'; elem: TypeExpr; span: Span }
  | { kind: 'MapType'; key: TypeExpr; value: TypeExpr; span: Span }
  | { kind: 'TupleType'; elems: TypeExpr[]; span: Span }
  | { kind: 'FnType'; params: TypeExpr[]; ret: TypeExpr; span: Span }
  | { kind: 'OptionalType'; inner: TypeExpr; span: Span };

/* ───────────────────────────── Patterns ───────────────────────────── */

export type Pattern =
  | { kind: 'WildcardPattern'; span: Span }
  | { kind: 'BindingPattern'; name: string; span: Span; ty?: Type }
  | {
      kind: 'LiteralPattern';
      value: number | string | boolean;
      litKind: 'int' | 'float' | 'string' | 'bool';
      span: Span;
    }
  | { kind: 'RangePattern'; start: number; end: number; inclusive: boolean; span: Span }
  | { kind: 'TuplePattern'; elems: Pattern[]; span: Span }
  | {
      kind: 'VariantPattern';
      enumName?: string;
      variant: string;
      args: Pattern[];
      span: Span;
    }
  | { kind: 'OrPattern'; alternatives: Pattern[]; span: Span };

/* ───────────────────────────── Expressions ───────────────────────────── */

interface ExprBase {
  span: Span;
  /** Static type, filled in by the type checker. */
  ty?: Type;
}

export interface IntLit extends ExprBase {
  kind: 'IntLit';
  value: number;
}
export interface FloatLit extends ExprBase {
  kind: 'FloatLit';
  value: number;
}
export interface StringLit extends ExprBase {
  kind: 'StringLit';
  value: string;
}
export interface BoolLit extends ExprBase {
  kind: 'BoolLit';
  value: boolean;
}
export interface TemplateLit extends ExprBase {
  kind: 'TemplateLit';
  parts: (string | Expr)[];
}
export interface Ident extends ExprBase {
  kind: 'Ident';
  name: string;
}
export interface SelfExpr extends ExprBase {
  kind: 'SelfExpr';
}
export interface ArrayLit extends ExprBase {
  kind: 'ArrayLit';
  elements: Expr[];
}
export interface MapLit extends ExprBase {
  kind: 'MapLit';
  entries: { key: Expr; value: Expr }[];
}
export interface TupleLit extends ExprBase {
  kind: 'TupleLit';
  elements: Expr[];
}
export interface StructLit extends ExprBase {
  kind: 'StructLit';
  name: string;
  nameSpan: Span;
  fields: { name: string; value: Expr; span: Span }[];
}
export interface Unary extends ExprBase {
  kind: 'Unary';
  op: '-' | '!';
  operand: Expr;
}

export type BinaryOp =
  '+' | '-' | '*' | '/' | '%' | '**' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||' | '??';

export interface Binary extends ExprBase {
  kind: 'Binary';
  op: BinaryOp;
  left: Expr;
  right: Expr;
  /** Resolved operand type for arithmetic, so the interpreter can pick int or float semantics. */
  operandKind?: 'int' | 'float' | 'string' | 'other';
}
export interface Range extends ExprBase {
  kind: 'Range';
  start: Expr;
  end: Expr;
  inclusive: boolean;
}
export interface Cast extends ExprBase {
  kind: 'Cast';
  expr: Expr;
  target: TypeExpr;
  conversion?: 'int->float' | 'float->int' | 'identity';
}

export type CallTarget =
  /** A value-level call: user function, closure, builtin function or enum variant constructor. */
  | { kind: 'value' }
  /** `recv.method(...)` where `method` is declared in an `impl` block. */
  | { kind: 'method'; typeName: string }
  /** `Type.method(...)` — an `impl` function without `self`. */
  | { kind: 'static'; typeName: string }
  /** `Enum.Variant(...)` */
  | { kind: 'variant'; enumName: string; variant: string }
  /** A builtin method on a builtin type, e.g. `[1, 2].map(...)`. */
  | { kind: 'builtin-method'; receiver: BuiltinReceiver; name: string };

export type BuiltinReceiver = 'string' | 'array' | 'map' | 'option' | 'result' | 'number' | 'any';

export interface Call extends ExprBase {
  kind: 'Call';
  callee: Expr;
  args: Expr[];
  target?: CallTarget;
  /** Static types of arguments — used by builtins that format values (print, str…). */
  argTypes?: Type[];
}
export interface Member extends ExprBase {
  kind: 'Member';
  object: Expr;
  name: string;
  nameSpan: Span;
  access?: 'field' | 'tuple' | 'variant';
  /** For `Enum.Variant` accesses: the enum's real name (aliases resolved). */
  enumName?: string;
}
export interface Index extends ExprBase {
  kind: 'Index';
  object: Expr;
  index: Expr;
  container?: 'array' | 'map' | 'string';
}
export interface Try extends ExprBase {
  kind: 'Try';
  expr: Expr;
}
export interface Pipe extends ExprBase {
  kind: 'Pipe';
  left: Expr;
  right: Expr;
  /** The call the pipe desugars into, built by the checker. */
  desugared?: Call;
}
export interface Param {
  name: string;
  type?: TypeExpr;
  span: Span;
  ty?: Type;
}
export interface Lambda extends ExprBase {
  kind: 'Lambda';
  params: Param[];
  ret?: TypeExpr;
  body: Expr;
}
export interface If extends ExprBase {
  kind: 'If';
  cond: Expr;
  then: Block;
  else?: Block | If | IfLet;
}
export interface IfLet extends ExprBase {
  kind: 'IfLet';
  pattern: Pattern;
  value: Expr;
  then: Block;
  else?: Block | If | IfLet;
}
export interface MatchArm {
  pattern: Pattern;
  guard?: Expr;
  body: Expr;
  span: Span;
}
export interface Match extends ExprBase {
  kind: 'Match';
  subject: Expr;
  arms: MatchArm[];
}
export interface Block extends ExprBase {
  kind: 'Block';
  stmts: Stmt[];
}

export type Expr =
  | IntLit
  | FloatLit
  | StringLit
  | BoolLit
  | TemplateLit
  | Ident
  | SelfExpr
  | ArrayLit
  | MapLit
  | TupleLit
  | StructLit
  | Unary
  | Binary
  | Range
  | Cast
  | Call
  | Member
  | Index
  | Try
  | Pipe
  | Lambda
  | If
  | IfLet
  | Match
  | Block;

/* ───────────────────────────── Statements ───────────────────────────── */

export interface LetStmt {
  kind: 'Let';
  mutable: boolean;
  pattern: Pattern;
  typeAnn?: TypeExpr;
  init: Expr;
  span: Span;
}
export type AssignOp = '=' | '+=' | '-=' | '*=' | '/=' | '%=';
export interface AssignStmt {
  kind: 'Assign';
  op: AssignOp;
  target: Ident | Member | Index;
  value: Expr;
  span: Span;
  operandKind?: 'int' | 'float' | 'string' | 'other';
}
export interface ExprStmt {
  kind: 'ExprStmt';
  expr: Expr;
  /** Whether the statement was terminated by `;` (which discards its value in tail position). */
  semi: boolean;
  span: Span;
}
export interface ReturnStmt {
  kind: 'Return';
  value?: Expr;
  span: Span;
}
export interface BreakStmt {
  kind: 'Break';
  span: Span;
}
export interface ContinueStmt {
  kind: 'Continue';
  span: Span;
}
export interface WhileStmt {
  kind: 'While';
  cond: Expr;
  body: Block;
  span: Span;
}
export interface ForStmt {
  kind: 'For';
  pattern: Pattern;
  iterable: Expr;
  body: Block;
  span: Span;
  iterKind?: 'range' | 'array' | 'map' | 'string';
}
export interface LoopStmt {
  kind: 'Loop';
  body: Block;
  span: Span;
}
export interface FnParam {
  name: string;
  type?: TypeExpr;
  span: Span;
  isSelf: boolean;
}
export interface FnDecl {
  kind: 'FnDecl';
  name: string;
  nameSpan: Span;
  typeParams: { name: string; span: Span }[];
  params: FnParam[];
  ret?: TypeExpr;
  body: Expr;
  span: Span;
}
export interface StructDecl {
  kind: 'StructDecl';
  name: string;
  nameSpan: Span;
  typeParams: { name: string; span: Span }[];
  fields: { name: string; type: TypeExpr; span: Span }[];
  span: Span;
}
export interface EnumDecl {
  kind: 'EnumDecl';
  name: string;
  nameSpan: Span;
  typeParams: { name: string; span: Span }[];
  variants: { name: string; fields: TypeExpr[]; span: Span }[];
  span: Span;
}
export interface ImplDecl {
  kind: 'ImplDecl';
  typeName: string;
  nameSpan: Span;
  methods: FnDecl[];
  span: Span;
}
export interface TypeAliasDecl {
  kind: 'TypeAlias';
  name: string;
  nameSpan: Span;
  typeParams: { name: string; span: Span }[];
  type: TypeExpr;
  span: Span;
}

export type Stmt =
  | LetStmt
  | AssignStmt
  | ExprStmt
  | ReturnStmt
  | BreakStmt
  | ContinueStmt
  | WhileStmt
  | ForStmt
  | LoopStmt
  | FnDecl
  | StructDecl
  | EnumDecl
  | ImplDecl
  | TypeAliasDecl;

export interface Program {
  kind: 'Program';
  body: Stmt[];
  span: Span;
}

export type Node = Program | Stmt | Expr | Pattern | TypeExpr;

export const isExpr = (node: { kind: string }): node is Expr => EXPR_KINDS.has(node.kind);

const EXPR_KINDS: ReadonlySet<string> = new Set([
  'IntLit',
  'FloatLit',
  'StringLit',
  'BoolLit',
  'TemplateLit',
  'Ident',
  'SelfExpr',
  'ArrayLit',
  'MapLit',
  'TupleLit',
  'StructLit',
  'Unary',
  'Binary',
  'Range',
  'Cast',
  'Call',
  'Member',
  'Index',
  'Try',
  'Pipe',
  'Lambda',
  'If',
  'IfLet',
  'Match',
  'Block',
]);
