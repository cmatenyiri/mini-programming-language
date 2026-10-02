import type * as A from './ast';
import {
  ARRAY_METHODS,
  BUILTIN_FUNCTIONS,
  BUILTIN_VALUES,
  type BuiltinMethod,
  MAP_METHODS,
  NUMBER_METHODS,
  OPTION_METHODS,
  RESULT_METHODS,
  STRING_METHODS,
  type Signature,
  UNIVERSAL_METHODS,
} from './builtins';
import type { Diagnostic, Span } from './diagnostics';
import { type Constructor, findMissing, isUseful, simplify } from './patterns';
import { didYouMean } from './suggest';
import * as T from './types';

/* ─────────────────────────── public results ─────────────────────────── */

export type SymbolKind =
  | 'function'
  | 'method'
  | 'variable'
  | 'parameter'
  | 'struct'
  | 'enum'
  | 'variant'
  | 'field'
  | 'type-alias';

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  type: string;
  span: Span;
  /** True when the type was inferred rather than written by the programmer. */
  inferred: boolean;
  mutable?: boolean;
  owner?: string;
  depth: number;
  /** The resolved type, for value symbols (used by editor completions). */
  typeRef?: T.Type;
  /** True for symbols that are not shown in the symbol table (e.g. `self`). */
  hidden?: boolean;
}

export interface MemberCompletion {
  label: string;
  kind: 'method' | 'field' | 'variant' | 'function';
  detail: string;
  doc?: string;
}

export interface HoverInfo {
  span: Span;
  code: string;
  doc?: string;
}

export interface StructInfo {
  name: string;
  typeParams: T.TParam[];
  fields: { name: string; type: T.Type }[];
}

export interface VariantInfo {
  name: string;
  fields: T.Type[];
}

export interface EnumInfo {
  name: string;
  typeParams: T.TParam[];
  variants: VariantInfo[];
  builtin: boolean;
}

export interface MethodInfo {
  name: string;
  owner: string;
  decl: A.FnDecl;
  hasSelf: boolean;
  ownerParams: T.TParam[];
  typeParams: T.TParam[];
  params: T.Type[];
  ret: T.Type;
}

export interface TypeRegistry {
  structs: Map<string, StructInfo>;
  enums: Map<string, EnumInfo>;
  impls: Map<string, Map<string, MethodInfo>>;
}

export interface CheckResult {
  diagnostics: Diagnostic[];
  symbols: SymbolInfo[];
  hovers: HoverInfo[];
  registry: TypeRegistry;
  /** Members (fields and methods) available on a value of type `t`. */
  membersOf: (t: T.Type) => MemberCompletion[];
  /** Variants and static functions available as `TypeName.member`. */
  staticMembersOf: (typeName: string) => MemberCompletion[];
}

/* ─────────────────────────── internals ─────────────────────────── */

type VarKind = 'let' | 'var' | 'param' | 'loop' | 'pattern' | 'fn' | 'builtin' | 'variant' | 'self';

interface VarInfo {
  name: string;
  type: T.Type;
  /** Generic parameters to instantiate on every use. */
  typeParams?: T.TParam[];
  /** Builtins produce a fresh signature on every use. */
  builtin?: () => Signature;
  special?: 'print' | 'assert';
  kind: VarKind;
  span?: Span;
  used: boolean;
  reassigned: boolean;
  doc?: string;
  signature?: string;
  fnDecl?: A.FnDecl;
}

interface FnSig {
  typeParams: T.TParam[];
  params: T.Type[];
  ret: T.Type;
}

interface FnContext {
  name: string;
  ret: T.Type;
  /** Declared `-> void`: the body's final expression value is discarded. */
  discardTail: boolean;
}

interface LoopContext {
  sawBreak: boolean;
}

interface AliasInfo {
  decl: A.TypeAliasDecl;
  params: T.TParam[];
  type?: T.Type;
  resolving: boolean;
}

class Scope {
  readonly vars = new Map<string, VarInfo>();
  readonly parent: Scope | null;
  readonly depth: number;

  constructor(parent: Scope | null) {
    this.parent = parent;
    this.depth = parent ? parent.depth + 1 : 0;
  }

  lookup(name: string): VarInfo | undefined {
    return this.vars.get(name) ?? this.parent?.lookup(name);
  }

  names(out = new Set<string>()): string[] {
    for (const k of this.vars.keys()) out.add(k);
    if (this.parent) this.parent.names(out);
    return [...out];
  }
}

const VALUE_HINT: Partial<Record<A.Expr['kind'], true>> = {
  Binary: true,
  Ident: true,
  IntLit: true,
  FloatLit: true,
  StringLit: true,
  BoolLit: true,
  TemplateLit: true,
  Member: true,
  Index: true,
  TupleLit: true,
  ArrayLit: true,
  Range: true,
  Lambda: true,
};

/**
 * The Lumen type checker.
 *
 * Every expression gets a static type. Types of variables, lambda parameters and function
 * return types are inferred by unification when they are not annotated. Struct and enum
 * types are nominal; generic functions and types are instantiated at each use.
 */
export class Checker {
  private readonly diagnostics: Diagnostic[] = [];
  private readonly symbolThunks: (() => SymbolInfo)[] = [];
  private readonly hoverThunks: (() => HoverInfo)[] = [];
  private readonly typedNodes: { ty?: T.Type }[] = [];
  private readonly finalizers: (() => void)[] = [];
  private readonly inferenceChecks: { type: T.Type; span: Span; what: string; hint?: string }[] =
    [];

  private readonly structs = new Map<string, StructInfo>();
  private readonly enums = new Map<string, EnumInfo>();
  private readonly impls = new Map<string, Map<string, MethodInfo>>();
  private readonly aliases = new Map<string, AliasInfo>();
  private readonly fnSigs = new Map<A.FnDecl, FnSig>();

  private readonly prelude = new Scope(null);
  private scope: Scope = new Scope(this.prelude);
  private typeParamScopes: Map<string, T.TParam>[] = [];
  private fnStack: FnContext[] = [];
  private loopStack: LoopContext[] = [];

  static check(program: A.Program): CheckResult {
    return new Checker().run(program);
  }

  private run(program: A.Program): CheckResult {
    this.installPrelude();
    this.declareTypes(program.body);
    this.declareImpls(program.body);
    this.checkStatements(program.body, false, undefined, true);
    this.reportUnused(this.scope);
    return this.finish();
  }

  /* ─────────────────────────── diagnostics ─────────────────────────── */

  private error(message: string, span: Span, hint?: string) {
    const dup = this.diagnostics.some(
      (d) => d.message === message && d.span.start === span.start && d.span.end === span.end,
    );
    if (!dup) this.diagnostics.push({ severity: 'error', phase: 'checker', message, span, hint });
  }

  private warn(message: string, span: Span, hint?: string) {
    this.diagnostics.push({ severity: 'warning', phase: 'checker', message, span, hint });
  }

  private str(t: T.Type): string {
    return T.typeToString(t);
  }

  /** Unifies and reports a mismatch with a helpful hint. */
  private expect(
    expected: T.Type,
    actual: T.Type,
    span: Span,
    message?: (exp: string, act: string) => string,
  ): boolean {
    if (this.unify(expected, actual)) return true;
    const exp = this.str(expected);
    const act = this.str(actual);
    this.error(
      message ? message(exp, act) : `Type mismatch: expected ${exp}, found ${act}`,
      span,
      this.mismatchHint(expected, actual),
    );
    return false;
  }

  private mismatchHint(expected: T.Type, actual: T.Type): string | undefined {
    const e = T.prune(expected);
    const a = T.prune(actual);
    if (T.isPrim(e, 'float') && T.isPrim(a, 'int'))
      return 'Use a float literal like 2.0, or convert with `as float`';
    if (T.isPrim(e, 'int') && T.isPrim(a, 'float'))
      return 'Convert with `as int` (truncates), or use round()/floor()';
    if (T.isPrim(e, 'string') && a.kind === 'prim')
      return 'Convert with str(value), or use interpolation: "${value}"';
    if (e.kind === 'named' && e.name === 'option' && this.unifiesSilently(e.args[0], a)) {
      return 'Wrap the value in Some(...)';
    }
    if (a.kind === 'named' && a.name === 'option' && this.unifiesSilently(a.args[0], e)) {
      return 'This is an option — unwrap it with `?? fallback`, `if let Some(x) = ...` or `match`';
    }
    if (e.kind === 'param' || a.kind === 'param') {
      return 'Generic type parameters stand for any type, so they cannot be mixed with concrete types';
    }
    return undefined;
  }

  /** Tests unification without binding anything permanently. */
  private unifiesSilently(a: T.Type, b: T.Type): boolean {
    const ra = T.resolve(a);
    const rb = T.resolve(b);
    if (T.hasUnresolved(ra) || T.hasUnresolved(rb)) return false;
    return T.typeToString(ra) === T.typeToString(rb);
  }

  /* ─────────────────────────── unification ─────────────────────────── */

  private unify(a: T.Type, b: T.Type): boolean {
    a = T.prune(a);
    b = T.prune(b);
    if (a === b) return true;
    if (a.kind === 'never' || b.kind === 'never') return true;
    if (a.kind === 'var') return this.bindVar(a, b);
    if (b.kind === 'var') return this.bindVar(b, a);
    switch (a.kind) {
      case 'prim':
        return b.kind === 'prim' && a.name === b.name;
      case 'param':
        return b.kind === 'param' && a.id === b.id;
      case 'array':
        return b.kind === 'array' && this.unify(a.elem, b.elem);
      case 'map':
        return b.kind === 'map' && this.unify(a.key, b.key) && this.unify(a.value, b.value);
      case 'tuple':
        return (
          b.kind === 'tuple' &&
          a.elems.length === b.elems.length &&
          a.elems.every((e, i) => this.unify(e, b.elems[i]))
        );
      case 'fn':
        return (
          b.kind === 'fn' &&
          a.params.length === b.params.length &&
          a.params.every((p, i) => this.unify(p, b.params[i])) &&
          this.unify(a.ret, b.ret)
        );
      case 'named':
        return (
          b.kind === 'named' &&
          a.name === b.name &&
          a.args.length === b.args.length &&
          a.args.every((x, i) => this.unify(x, b.args[i]))
        );
    }
    return false;
  }

  private bindVar(v: T.TVar, t: T.Type): boolean {
    if (t.kind === 'var') {
      if (v.constraint) {
        const merged = t.constraint ? this.intersect(v.constraint, t.constraint) : v.constraint;
        if (!merged) return false;
        t.constraint = merged;
      }
      v.ref = t;
      return true;
    }
    if (T.occurs(v, t)) return false;
    if (v.constraint && !(t.kind === 'prim' && v.constraint.allowed.has(t.name))) return false;
    v.ref = t;
    return true;
  }

  private intersect(a: T.Constraint, b: T.Constraint): T.Constraint | null {
    const allowed = new Set([...a.allowed].filter((x) => b.allowed.has(x)));
    if (allowed.size === 0) return null;
    if (allowed.size === a.allowed.size) return a;
    if (allowed.size === b.allowed.size) return b;
    return { label: [...allowed].join(' or '), allowed };
  }

  /** Requires `t` to be one of the primitive types allowed by `c`. */
  private constrain(t: T.Type, c: T.Constraint): boolean {
    const p = T.prune(t);
    if (p.kind === 'never') return true;
    if (p.kind === 'var') {
      const merged = p.constraint ? this.intersect(p.constraint, c) : c;
      if (!merged) return false;
      p.constraint = merged;
      return true;
    }
    return p.kind === 'prim' && c.allowed.has(p.name);
  }

  private applyDefaults(t: T.Type) {
    for (const v of T.freeVars(t)) {
      if (!v.constraint) continue;
      const order: T.PrimName[] = ['int', 'float', 'string', 'bool'];
      const pick = order.find((n) => v.constraint!.allowed.has(n));
      if (pick) v.ref = T.PRIMS[pick];
    }
  }

  private instantiate(params: T.TParam[], t: T.Type): T.Type {
    if (!params.length) return t;
    const map = new Map<number, T.Type>();
    for (const p of params) map.set(p.id, T.freshVar());
    return T.substitute(t, map);
  }

  private applySignature(s: Signature): T.TFn {
    for (const [a, b] of s.equals ?? []) this.unify(a, b);
    return s.fn;
  }

  /* ─────────────────────────── scopes ─────────────────────────── */

  private withScope<R>(fn: () => R): R {
    const saved = this.scope;
    this.scope = new Scope(saved);
    try {
      return fn();
    } finally {
      this.reportUnused(this.scope);
      this.scope = saved;
    }
  }

  private reportUnused(scope: Scope) {
    for (const v of scope.vars.values()) {
      if (!v.span || v.name.startsWith('_')) continue;
      if ((v.kind === 'let' || v.kind === 'var') && !v.used) {
        this.warn(
          `'${v.name}' is declared but never used`,
          v.span,
          `Remove it, or rename it to _${v.name}`,
        );
      } else if (v.kind === 'var' && !v.reassigned) {
        this.warn(`'${v.name}' is never reassigned`, v.span, 'Declare it with let instead of var');
      }
    }
  }

  /** Marks the variable at the root of `a.b[c].d` as mutated (justifies declaring it with var). */
  private markMutated(e: A.Expr) {
    let root = e;
    while (root.kind === 'Member' || root.kind === 'Index') root = root.object;
    if (root.kind === 'Ident') {
      const v = this.scope.lookup(root.name);
      if (v) v.reassigned = true;
    }
  }

  private declare(info: Omit<VarInfo, 'used' | 'reassigned'>): VarInfo {
    const v: VarInfo = { ...info, used: false, reassigned: false };
    this.scope.vars.set(v.name, v);
    return v;
  }

  private lookupTypeParam(name: string): T.TParam | undefined {
    for (let i = this.typeParamScopes.length - 1; i >= 0; i--) {
      const p = this.typeParamScopes[i].get(name);
      if (p) return p;
    }
    return undefined;
  }

  private withTypeParams<R>(params: T.TParam[], fn: () => R): R {
    this.typeParamScopes.push(new Map(params.map((p) => [p.name, p])));
    try {
      return fn();
    } finally {
      this.typeParamScopes.pop();
    }
  }

  /* ─────────────────────────── symbols & hovers ─────────────────────────── */

  private addSymbol(thunk: () => Omit<SymbolInfo, 'depth'>) {
    const depth = this.scope.depth - 1;
    this.symbolThunks.push(() => ({ ...thunk(), depth }));
  }

  private addHover(span: Span, code: () => string, doc?: string) {
    this.hoverThunks.push(() => ({ span, code: code(), doc }));
  }

  private hoverVar(span: Span, v: VarInfo, instType?: T.Type) {
    switch (v.kind) {
      case 'builtin':
        this.addHover(span, () => v.signature ?? v.name, v.doc);
        return;
      case 'fn':
        this.addHover(span, () => this.fnSignature(v.fnDecl!, this.fnSigs.get(v.fnDecl!)!));
        return;
      case 'variant':
        this.addHover(span, () => v.signature ?? v.name, v.doc);
        return;
      default: {
        const label = v.kind === 'let' || v.kind === 'var' ? `${v.kind} ` : '';
        this.addHover(span, () => `${label}${v.name}: ${this.str(T.resolve(instType ?? v.type))}`);
      }
    }
  }

  private fnSignature(decl: A.FnDecl, sig: FnSig, owner?: string): string {
    const names = new Map<number, string>();
    const own = decl.typeParams.map((p) => p.name);
    const tps = own.length ? `<${own.join(', ')}>` : '';
    let i = 0;
    const params = decl.params
      .map((p) =>
        p.isSelf ? 'self' : `${p.name}: ${T.typeToString(T.resolve(sig.params[i++]), names)}`,
      )
      .join(', ');
    const ret = T.resolve(sig.ret);
    const retStr = T.isPrim(ret, 'void') ? '' : ` -> ${T.typeToString(ret, names)}`;
    return `fn ${owner ? `${owner}.` : ''}${decl.name}${tps}(${params})${retStr}`;
  }

  private structSignature(info: StructInfo): string {
    const tps = info.typeParams.length ? `<${info.typeParams.map((p) => p.name).join(', ')}>` : '';
    const fields = info.fields.map((f) => `${f.name}: ${this.str(f.type)}`).join(', ');
    return `struct ${info.name}${tps} { ${fields} }`;
  }

  private enumSignature(info: EnumInfo): string {
    const tps = info.typeParams.length ? `<${info.typeParams.map((p) => p.name).join(', ')}>` : '';
    const variants = info.variants
      .map((v) =>
        v.fields.length ? `${v.name}(${v.fields.map((f) => this.str(f)).join(', ')})` : v.name,
      )
      .join(', ');
    return `enum ${info.name}${tps} { ${variants} }`;
  }

  /* ─────────────────────────── prelude ─────────────────────────── */

  private installPrelude() {
    const scope = this.prelude;
    const add = (v: Omit<VarInfo, 'used' | 'reassigned'>) =>
      scope.vars.set(v.name, { ...v, used: true, reassigned: false });

    for (const f of BUILTIN_FUNCTIONS) {
      add({
        name: f.name,
        kind: 'builtin',
        type: T.freshVar(),
        builtin: f.type,
        special: f.special,
        doc: f.doc,
        signature: f.signature,
      });
    }
    for (const v of BUILTIN_VALUES) {
      add({ name: v.name, kind: 'builtin', type: v.type(), doc: v.doc, signature: v.signature });
    }

    const t = T.freshParam('T');
    const e = T.freshParam('E');
    this.enums.set('option', {
      name: 'option',
      typeParams: [t],
      variants: [
        { name: 'Some', fields: [t] },
        { name: 'None', fields: [] },
      ],
      builtin: true,
    });
    this.enums.set('result', {
      name: 'result',
      typeParams: [t, e],
      variants: [
        { name: 'Ok', fields: [t] },
        { name: 'Err', fields: [e] },
      ],
      builtin: true,
    });
    add({
      name: 'Some',
      kind: 'variant',
      type: T.fnOf([t], T.optionOf(t)),
      typeParams: [t],
      signature: 'Some<T>(value: T) -> T?',
      doc: 'An option that holds a value.',
    });
    add({
      name: 'None',
      kind: 'variant',
      type: T.optionOf(t),
      typeParams: [t],
      signature: 'None: T?',
      doc: 'An option without a value.',
    });
    add({
      name: 'Ok',
      kind: 'variant',
      type: T.fnOf([t], T.resultOf(t, e)),
      typeParams: [t, e],
      signature: 'Ok<T, E>(value: T) -> result<T, E>',
      doc: 'A successful result.',
    });
    add({
      name: 'Err',
      kind: 'variant',
      type: T.fnOf([e], T.resultOf(t, e)),
      typeParams: [t, e],
      signature: 'Err<T, E>(error: E) -> result<T, E>',
      doc: 'A failed result.',
    });
  }

  /* ─────────────────────────── type declarations ─────────────────────────── */

  private declareTypes(body: A.Stmt[]) {
    const pending: (A.StructDecl | A.EnumDecl)[] = [];
    for (const stmt of body) {
      if (stmt.kind !== 'StructDecl' && stmt.kind !== 'EnumDecl' && stmt.kind !== 'TypeAlias')
        continue;
      if (this.isTypeName(stmt.name) || T.PRIMS[stmt.name as T.PrimName]) {
        this.error(`The type '${stmt.name}' is already declared`, stmt.nameSpan);
        continue;
      }
      const params = stmt.typeParams.map((p) => T.freshParam(p.name));
      if (stmt.kind === 'StructDecl') {
        this.structs.set(stmt.name, { name: stmt.name, typeParams: params, fields: [] });
        pending.push(stmt);
      } else if (stmt.kind === 'EnumDecl') {
        this.enums.set(stmt.name, {
          name: stmt.name,
          typeParams: params,
          variants: [],
          builtin: false,
        });
        pending.push(stmt);
      } else {
        this.aliases.set(stmt.name, { decl: stmt, params, resolving: false });
      }
    }

    for (const decl of pending) {
      if (decl.kind === 'StructDecl') {
        const info = this.structs.get(decl.name)!;
        this.withTypeParams(info.typeParams, () => {
          for (const f of decl.fields) {
            if (info.fields.some((x) => x.name === f.name)) {
              this.error(`Duplicate field '${f.name}' in struct ${decl.name}`, f.span);
              continue;
            }
            const type = this.resolveTypeExpr(f.type);
            info.fields.push({ name: f.name, type });
            this.addHover(f.span, () => `${decl.name}.${f.name}: ${this.str(type)}`);
            this.addSymbol(() => ({
              name: f.name,
              kind: 'field',
              type: this.str(type),
              span: f.span,
              inferred: false,
              owner: decl.name,
            }));
          }
        });
        this.addHover(decl.nameSpan, () => this.structSignature(info));
        this.addSymbol(() => ({
          name: decl.name,
          kind: 'struct',
          type: this.structSignature(info).replace(/^struct /, ''),
          span: decl.nameSpan,
          inferred: false,
        }));
      } else {
        const info = this.enums.get(decl.name)!;
        this.withTypeParams(info.typeParams, () => {
          for (const v of decl.variants) {
            if (info.variants.some((x) => x.name === v.name)) {
              this.error(`Duplicate variant '${v.name}' in enum ${decl.name}`, v.span);
              continue;
            }
            const fields = v.fields.map((f) => this.resolveTypeExpr(f));
            info.variants.push({ name: v.name, fields });
            this.addHover(v.span, () =>
              fields.length
                ? `${decl.name}.${v.name}(${fields.map((f) => this.str(f)).join(', ')})`
                : `${decl.name}.${v.name}`,
            );
          }
        });
        if (info.variants.length === 0)
          this.error(`Enum ${decl.name} needs at least one variant`, decl.nameSpan);
        this.addHover(decl.nameSpan, () => this.enumSignature(info));
        this.addSymbol(() => ({
          name: decl.name,
          kind: 'enum',
          type: this.enumSignature(info).replace(/^enum /, ''),
          span: decl.nameSpan,
          inferred: false,
        }));
      }
    }

    for (const [name, alias] of this.aliases) {
      const type = this.resolveAlias(name, alias.decl.nameSpan);
      this.addHover(alias.decl.nameSpan, () => `type ${name} = ${this.str(type)}`);
      this.addSymbol(() => ({
        name,
        kind: 'type-alias',
        type: this.str(type),
        span: alias.decl.nameSpan,
        inferred: false,
      }));
    }
  }

  private resolveAlias(name: string, span: Span): T.Type {
    const alias = this.aliases.get(name)!;
    if (alias.type) return alias.type;
    if (alias.resolving) {
      this.error(
        `Type alias '${name}' refers to itself`,
        span,
        'Use a struct or enum for recursive types',
      );
      return T.freshVar();
    }
    alias.resolving = true;
    alias.type = this.withTypeParams(alias.params, () => this.resolveTypeExpr(alias.decl.type));
    alias.resolving = false;
    return alias.type;
  }

  private isTypeName(name: string): boolean {
    return this.structs.has(name) || this.enums.has(name) || this.aliases.has(name);
  }

  private allTypeNames(): string[] {
    return [
      ...Object.keys(T.PRIMS),
      ...this.structs.keys(),
      ...this.enums.keys(),
      ...this.aliases.keys(),
    ];
  }

  resolveTypeExpr(te: A.TypeExpr): T.Type {
    switch (te.kind) {
      case 'NamedType': {
        const name = te.name;
        const args = te.args.map((a) => this.resolveTypeExpr(a));
        const prim = T.PRIMS[name as T.PrimName];
        if (prim) {
          if (args.length) this.error(`Type ${name} does not take type arguments`, te.span);
          return prim;
        }
        const param = this.lookupTypeParam(name);
        if (param) {
          if (args.length)
            this.error(`Type parameter ${name} does not take type arguments`, te.span);
          return param;
        }
        const generic = this.structs.get(name) ?? this.enums.get(name);
        if (generic) {
          const n = generic.typeParams.length;
          if (args.length === 0 && n > 0)
            return T.named(
              name,
              generic.typeParams.map(() => T.freshVar()),
            );
          if (args.length !== n) {
            this.error(
              `Type ${name} expects ${n} type argument${n === 1 ? '' : 's'}, but got ${args.length}`,
              te.span,
            );
            return T.named(
              name,
              generic.typeParams.map((_, i) => args[i] ?? T.freshVar()),
            );
          }
          return T.named(name, args);
        }
        if (this.aliases.has(name)) {
          const alias = this.aliases.get(name)!;
          const body = this.resolveAlias(name, te.span);
          if (args.length !== alias.params.length && args.length) {
            this.error(`Type alias ${name} expects ${alias.params.length} type arguments`, te.span);
          }
          const map = new Map<number, T.Type>();
          alias.params.forEach((p, i) => map.set(p.id, args[i] ?? T.freshVar()));
          return T.substitute(body, map);
        }
        const lowerPrim = T.PRIMS[name.toLowerCase() as T.PrimName];
        const hint = lowerPrim
          ? `Did you mean '${name.toLowerCase()}'?`
          : name === 'str' || name === 'String'
            ? "Did you mean 'string'?"
            : name === 'Option'
              ? 'Write optional types as T? — e.g. int?'
              : didYouMean(name, this.allTypeNames());
        this.error(`Unknown type '${name}'`, te.span, hint);
        return T.freshVar();
      }
      case 'ArrayType':
        return T.arrayOf(this.resolveTypeExpr(te.elem));
      case 'MapType': {
        const key = this.resolveTypeExpr(te.key);
        if (!this.constrain(key, T.HASHABLE)) {
          this.error(
            `Map keys must be int, float, string or bool — found ${this.str(key)}`,
            te.key.span,
          );
        }
        return T.mapOf(key, this.resolveTypeExpr(te.value));
      }
      case 'TupleType':
        return T.tupleOf(te.elems.map((e) => this.resolveTypeExpr(e)));
      case 'FnType':
        return T.fnOf(
          te.params.map((p) => this.resolveTypeExpr(p)),
          this.resolveTypeExpr(te.ret),
        );
      case 'OptionalType':
        return T.optionOf(this.resolveTypeExpr(te.inner));
    }
  }

  /* ─────────────────────────── impls & functions ─────────────────────────── */

  private declareImpls(body: A.Stmt[]) {
    for (const stmt of body) {
      if (stmt.kind !== 'ImplDecl') continue;
      const owner = this.structs.get(stmt.typeName) ?? this.enums.get(stmt.typeName);
      if (!owner || ('builtin' in owner && owner.builtin)) {
        this.error(
          `Cannot add methods to unknown type '${stmt.typeName}'`,
          stmt.nameSpan,
          didYouMean(stmt.typeName, [...this.structs.keys(), ...this.enums.keys()]),
        );
        continue;
      }
      let methods = this.impls.get(stmt.typeName);
      if (!methods) {
        methods = new Map();
        this.impls.set(stmt.typeName, methods);
      }
      for (const decl of stmt.methods) {
        const own = decl.typeParams.map((p) => T.freshParam(p.name));
        const sig = this.withTypeParams(owner.typeParams, () =>
          this.withTypeParams(own, () => this.buildSignature(decl, own)),
        );
        if (methods.has(decl.name)) {
          this.error(
            `Method '${decl.name}' is already defined for ${stmt.typeName}`,
            decl.nameSpan,
          );
          continue;
        }
        if ('fields' in owner && owner.fields.some((f) => f.name === decl.name)) {
          this.error(
            `'${decl.name}' is both a field and a method of ${stmt.typeName}`,
            decl.nameSpan,
          );
        }
        const hasSelf = decl.params[0]?.isSelf ?? false;
        const info: MethodInfo = {
          name: decl.name,
          owner: stmt.typeName,
          decl,
          hasSelf,
          ownerParams: owner.typeParams,
          typeParams: own,
          params: sig.params,
          ret: sig.ret,
        };
        methods.set(decl.name, info);
        this.fnSigs.set(decl, { ...sig, typeParams: [...owner.typeParams, ...own] });
        this.addHover(decl.nameSpan, () => this.fnSignature(decl, sig, stmt.typeName));
        this.addSymbol(() => ({
          name: decl.name,
          kind: 'method',
          type: this.fnSignature(decl, sig).replace(/^fn /, ''),
          span: decl.nameSpan,
          inferred: !decl.ret,
          owner: stmt.typeName,
        }));
      }
    }
  }

  private buildSignature(decl: A.FnDecl, typeParams: T.TParam[]): FnSig {
    const params = decl.params.filter((p) => !p.isSelf).map((p) => this.resolveTypeExpr(p.type!));
    const ret = decl.ret ? this.resolveTypeExpr(decl.ret) : T.freshVar();
    return { typeParams, params, ret };
  }

  private hoistFunctions(stmts: A.Stmt[]) {
    for (const stmt of stmts) {
      if (stmt.kind !== 'FnDecl') continue;
      const existing = this.scope.vars.get(stmt.name);
      if (existing?.kind === 'fn') {
        this.error(`Function '${stmt.name}' is already declared in this scope`, stmt.nameSpan);
        continue;
      }
      const typeParams = stmt.typeParams.map((p) => T.freshParam(p.name));
      const sig = this.withTypeParams(typeParams, () => this.buildSignature(stmt, typeParams));
      this.fnSigs.set(stmt, sig);
      const v = this.declare({
        name: stmt.name,
        kind: 'fn',
        type: T.fnOf(sig.params, sig.ret),
        typeParams,
        span: stmt.nameSpan,
        fnDecl: stmt,
      });
      v.used = true;
      this.addHover(stmt.nameSpan, () => this.fnSignature(stmt, sig));
      this.addSymbol(() => ({
        name: stmt.name,
        kind: 'function',
        type: this.fnSignature(stmt, sig).replace(/^fn /, ''),
        span: stmt.nameSpan,
        inferred: !stmt.ret,
        typeRef: T.resolve(T.fnOf(sig.params, sig.ret)),
      }));
    }
  }

  private checkFnBody(decl: A.FnDecl, selfType?: T.Type, owner?: string) {
    const sig = this.fnSigs.get(decl);
    if (!sig) return;
    const savedLoops = this.loopStack;
    this.loopStack = [];
    this.withTypeParams(sig.typeParams, () =>
      this.withScope(() => {
        let i = 0;
        for (const p of decl.params) {
          if (p.isSelf) {
            if (selfType) {
              this.declare({ name: 'self', kind: 'self', type: selfType, span: p.span });
              this.addSymbol(() => ({
                name: 'self',
                kind: 'parameter',
                type: this.str(selfType),
                span: p.span,
                inferred: false,
                typeRef: selfType,
                hidden: true,
              }));
            }
            continue;
          }
          const type = sig.params[i++];
          this.declare({ name: p.name, kind: 'param', type, span: p.span });
          this.addHover(p.span, () => `${p.name}: ${this.str(T.resolve(type))}`);
          this.addSymbol(() => ({
            name: p.name,
            kind: 'parameter',
            type: this.str(T.resolve(type)),
            span: p.span,
            inferred: false,
            owner: owner ? `${owner}.${decl.name}` : decl.name,
            typeRef: T.resolve(type),
          }));
        }
        const declaredVoid = !!decl.ret && T.isPrim(sig.ret, 'void');
        const ctxName = owner ? `${owner}.${decl.name}` : decl.name;
        this.fnStack.push({ name: ctxName, ret: sig.ret, discardTail: declaredVoid });
        const bodyType =
          decl.body.kind === 'Block'
            ? this.checkBlockExpr(decl.body, !declaredVoid, declaredVoid ? undefined : sig.ret)
            : this.checkExpr(decl.body, sig.ret);
        this.fnStack.pop();
        if (!declaredVoid) this.checkReturnType(ctxName, sig.ret, bodyType, decl.body, !decl.ret);
      }),
    );
    this.loopStack = savedLoops;
    if (!decl.ret) {
      this.inferenceChecks.push({
        type: sig.ret,
        span: decl.nameSpan,
        what: `the return type of '${decl.name}'`,
        hint: 'Add a return type annotation, e.g. -> int',
      });
    }
  }

  private checkReturnType(
    name: string,
    ret: T.Type,
    bodyType: T.Type,
    body: A.Expr,
    inferred: boolean,
  ) {
    if (inferred && T.isNever(bodyType)) {
      // Every path returns explicitly or diverges. If no `return` fixed the type, the
      // function never returns normally at all.
      const r = T.prune(ret);
      if (r.kind === 'var' && !r.constraint) r.ref = T.NEVER;
      return;
    }
    if (this.unify(ret, bodyType)) return;
    const tail = this.tailExpr(body);
    if (T.isPrim(bodyType, 'void')) {
      const ifWithoutElse = tail?.kind === 'If' || tail?.kind === 'IfLet' ? !tail.else : false;
      this.error(
        `Function '${name}' should return ${this.str(ret)}, but its body can end without returning a value`,
        ifWithoutElse ? tail!.span : this.lastSpan(body),
        ifWithoutElse
          ? 'This if has no else branch — add one, or a return after it'
          : 'Add a return statement, or end the body with an expression',
      );
    } else {
      this.error(
        `Function '${name}' should return ${this.str(ret)}, but its body produces ${this.str(bodyType)}`,
        tail?.span ?? this.lastSpan(body),
        this.mismatchHint(ret, bodyType),
      );
    }
  }

  private tailExpr(body: A.Expr): A.Expr | undefined {
    if (body.kind !== 'Block') return body;
    const last = body.stmts.at(-1);
    return last?.kind === 'ExprStmt' && !last.semi ? last.expr : undefined;
  }

  private lastSpan(body: A.Expr): Span {
    if (body.kind === 'Block')
      return { start: Math.max(body.span.start, body.span.end - 1), end: body.span.end };
    return body.span;
  }

  /* ─────────────────────────── statements ─────────────────────────── */

  /** Checks a statement list; returns the block's type (tail expression, void or never). */
  private checkStatements(
    stmts: A.Stmt[],
    valueContext: boolean,
    expected?: T.Type,
    topLevel = false,
  ): T.Type {
    this.hoistFunctions(stmts);
    let diverged = false;
    let warnedUnreachable = false;
    let result: T.Type = T.VOID;
    stmts.forEach((stmt, i) => {
      if (diverged && !warnedUnreachable && stmt.kind !== 'FnDecl') {
        this.warn(
          'Unreachable code',
          stmt.span,
          'This code can never run because the code above always exits',
        );
        warnedUnreachable = true;
      }
      const isTail =
        valueContext && i === stmts.length - 1 && stmt.kind === 'ExprStmt' && !stmt.semi;
      if (isTail) {
        result = this.checkExpr(stmt.expr, expected);
        if (T.isNever(result)) diverged = true;
        return;
      }
      if (this.checkStmt(stmt, topLevel)) diverged = true;
    });
    if (diverged) return T.NEVER;
    const last = stmts.at(-1);
    const hasTail = valueContext && last?.kind === 'ExprStmt' && !last.semi;
    return hasTail ? result : T.VOID;
  }

  /** Returns true when the statement always diverges (return, break, panic, ...). */
  private checkStmt(stmt: A.Stmt, topLevel: boolean): boolean {
    switch (stmt.kind) {
      case 'Let':
        this.checkLet(stmt);
        return false;
      case 'Assign':
        this.checkAssign(stmt);
        return false;
      case 'ExprStmt': {
        const t = this.checkExpr(stmt.expr, undefined, false);
        if (VALUE_HINT[stmt.expr.kind] && !T.isPrim(t, 'void')) {
          const hint =
            stmt.expr.kind === 'Binary' && stmt.expr.op === '=='
              ? "Did you mean '=' (assignment)?"
              : undefined;
          this.warn('This value is computed but never used', stmt.expr.span, hint);
        }
        return T.isNever(t);
      }
      case 'Return':
        this.checkReturn(stmt);
        return true;
      case 'Break':
      case 'Continue': {
        const loop = this.loopStack.at(-1);
        if (!loop) {
          this.error(`'${stmt.kind.toLowerCase()}' can only be used inside a loop`, stmt.span);
        } else if (stmt.kind === 'Break') {
          loop.sawBreak = true;
        }
        return true;
      }
      case 'While': {
        this.expect(
          T.BOOL,
          this.checkExpr(stmt.cond),
          stmt.cond.span,
          (_e, a) => `While condition must be bool, found ${a}`,
        );
        const loop = this.runLoop(() => this.checkBlockExpr(stmt.body, false));
        return stmt.cond.kind === 'BoolLit' && stmt.cond.value && !loop.sawBreak;
      }
      case 'For':
        this.checkFor(stmt);
        return false;
      case 'Loop': {
        const loop = this.runLoop(() => this.checkBlockExpr(stmt.body, false));
        return !loop.sawBreak;
      }
      case 'FnDecl':
        this.checkFnBody(stmt);
        return false;
      case 'ImplDecl':
        if (!topLevel) {
          this.error('impl blocks must be declared at the top level', stmt.span);
          return false;
        }
        for (const m of stmt.methods) {
          const owner = this.structs.get(stmt.typeName) ?? this.enums.get(stmt.typeName);
          if (!owner) continue;
          const selfType = T.named(stmt.typeName, owner.typeParams);
          this.checkFnBody(m, selfType, stmt.typeName);
        }
        return false;
      case 'StructDecl':
      case 'EnumDecl':
      case 'TypeAlias':
        if (!topLevel) this.error('Types must be declared at the top level', stmt.span);
        return false;
    }
  }

  private runLoop(body: () => void): LoopContext {
    const ctx: LoopContext = { sawBreak: false };
    this.loopStack.push(ctx);
    try {
      body();
    } finally {
      this.loopStack.pop();
    }
    return ctx;
  }

  private checkLet(stmt: A.LetStmt) {
    const annotated = stmt.typeAnn ? this.resolveTypeExpr(stmt.typeAnn) : undefined;
    const initType = this.checkExpr(stmt.init, annotated);
    let type = initType;
    if (annotated) {
      const name =
        stmt.pattern.kind === 'BindingPattern' ? `'${stmt.pattern.name}'` : 'the pattern';
      this.expect(
        annotated,
        initType,
        stmt.init.span,
        (e, a) => `Cannot initialize ${name} of type ${e} with a value of type ${a}`,
      );
      type = annotated;
    } else if (T.isPrim(initType, 'void')) {
      this.error(
        'This expression produces no value (void), so it cannot be stored',
        stmt.init.span,
      );
    }
    this.bindPattern(stmt.pattern, type, stmt.mutable ? 'var' : 'let', false, !annotated, stmt);
  }

  private checkAssign(stmt: A.AssignStmt) {
    const target = stmt.target;
    let targetType: T.Type;
    let targetName = 'this target';
    if (target.kind === 'Ident') {
      targetName = `'${target.name}'`;
      const v = this.scope.lookup(target.name);
      if (!v) {
        this.error(
          `Unknown variable '${target.name}'`,
          target.span,
          didYouMean(target.name, this.scope.names()),
        );
        targetType = T.freshVar();
      } else {
        targetType = v.type;
        if (v.kind !== 'var') {
          const reasons: Partial<Record<VarKind, [string, string | undefined]>> = {
            let: [
              'it was declared with let',
              `Declare it with var to make it mutable: var ${v.name} = ...`,
            ],
            param: [
              'it is a function parameter',
              `Copy it into a mutable variable first: var ${v.name} = ${v.name}`,
            ],
            loop: ['it is a loop variable', undefined],
            pattern: ['it is a pattern binding', undefined],
            fn: ['it is a function', undefined],
            builtin: ['it is a builtin', undefined],
            variant: ['it is an enum variant', undefined],
            self: ['self cannot be reassigned', 'Assign to its fields instead: self.field = value'],
          };
          const [reason, hint] = reasons[v.kind] ?? ['it is immutable', undefined];
          this.error(`Cannot assign to '${v.name}' because ${reason}`, target.span, hint);
        }
        v.reassigned = true;
        this.hoverVar(target.span, v);
      }
      target.ty = targetType;
      this.typedNodes.push(target);
    } else {
      targetType = this.checkExpr(target);
      this.markMutated(target.object);
      if (target.kind === 'Member') {
        targetName = `'${target.name}'`;
        if (target.access === 'tuple')
          this.error(
            'Tuple elements cannot be reassigned',
            target.span,
            'Build a new tuple instead',
          );
        if (target.access === 'variant')
          this.error('Enum variants cannot be assigned to', target.span);
      } else if (target.container === 'string') {
        this.error('Strings are immutable — individual characters cannot be assigned', target.span);
      }
    }

    if (stmt.op === '=') {
      const vt = this.checkExpr(stmt.value, targetType);
      this.expect(
        targetType,
        vt,
        stmt.value.span,
        (e, a) => `Cannot assign a value of type ${a} to ${targetName} of type ${e}`,
      );
      return;
    }
    const constraint = stmt.op === '+=' ? T.ADDABLE : T.NUMERIC;
    const vt = this.checkExpr(stmt.value, targetType);
    if (!this.unify(targetType, vt)) {
      this.error(
        `Cannot apply '${stmt.op}' to ${this.str(targetType)} and ${this.str(vt)}`,
        stmt.span,
        this.mismatchHint(targetType, vt),
      );
    } else if (!this.constrain(targetType, constraint)) {
      this.error(
        `'${stmt.op}' requires ${constraint.label}, found ${this.str(targetType)}`,
        stmt.span,
      );
    }
    this.finalizers.push(() => {
      stmt.operandKind = this.operandKind(targetType);
    });
  }

  private checkReturn(stmt: A.ReturnStmt) {
    const ctx = this.fnStack.at(-1);
    if (!ctx) {
      this.error("'return' can only be used inside a function", stmt.span);
      if (stmt.value) this.checkExpr(stmt.value);
      return;
    }
    if (stmt.value) {
      if (ctx.discardTail) {
        this.checkExpr(stmt.value);
        this.error(
          `Function '${ctx.name}' is declared to return void, so it cannot return a value`,
          stmt.value.span,
        );
        return;
      }
      const vt = this.checkExpr(stmt.value, ctx.ret);
      this.expect(
        ctx.ret,
        vt,
        stmt.value.span,
        (e, a) => `Function '${ctx.name}' should return ${e}, but this returns ${a}`,
      );
    } else if (!this.unify(ctx.ret, T.VOID)) {
      this.error(
        `Function '${ctx.name}' should return ${this.str(ctx.ret)} — this return has no value`,
        stmt.span,
      );
    }
  }

  private checkFor(stmt: A.ForStmt) {
    let elem: T.Type;
    if (stmt.iterable.kind === 'Range') {
      this.checkExpr(stmt.iterable);
      elem = T.INT;
      stmt.iterKind = 'range';
    } else {
      const it = T.prune(this.checkExpr(stmt.iterable));
      if (it.kind === 'array') {
        elem = it.elem;
        stmt.iterKind = 'array';
      } else if (it.kind === 'map') {
        elem = T.tupleOf([it.key, it.value]);
        stmt.iterKind = 'map';
      } else if (T.isPrim(it, 'string')) {
        elem = T.STRING;
        stmt.iterKind = 'string';
      } else {
        elem = T.freshVar();
        if (it.kind === 'var') {
          this.error(
            'Cannot iterate over a value whose type is not known yet',
            stmt.iterable.span,
            'Add a type annotation',
          );
        } else {
          this.error(
            `Cannot iterate over a value of type ${this.str(it)}`,
            stmt.iterable.span,
            T.isPrim(it, 'int')
              ? 'Use a range: for i in 0..n'
              : 'You can iterate over ranges, arrays, maps and strings',
          );
        }
      }
    }
    this.withScope(() => {
      this.bindPattern(stmt.pattern, elem, 'loop', false, true);
      this.runLoop(() => this.checkBlockExpr(stmt.body, false));
    });
  }

  /* ─────────────────────────── patterns ─────────────────────────── */

  private bindPattern(
    p: A.Pattern,
    t: T.Type,
    kind: 'let' | 'var' | 'loop' | 'pattern',
    refutable: boolean,
    inferred: boolean,
    letStmt?: A.LetStmt,
  ) {
    switch (p.kind) {
      case 'WildcardPattern':
        return;
      case 'BindingPattern': {
        const v = this.declare({ name: p.name, kind, type: t, span: p.span });
        p.ty = t;
        this.typedNodes.push(p);
        this.hoverVar(p.span, v);
        this.addSymbol(() => ({
          name: p.name,
          kind: 'variable',
          type: this.str(T.resolve(t)),
          span: p.span,
          inferred,
          mutable: kind === 'var',
          typeRef: T.resolve(t),
        }));
        if (letStmt && inferred) {
          const init = letStmt.init;
          const hint =
            init.kind === 'ArrayLit' && init.elements.length === 0
              ? `Add a type annotation: ${kind} ${p.name}: [int] = []`
              : init.kind === 'MapLit' && init.entries.length === 0
                ? `Add a type annotation: ${kind} ${p.name}: [string: int] = [:]`
                : init.kind === 'Ident' && init.name === 'None'
                  ? `Add a type annotation: ${kind} ${p.name}: int? = None`
                  : `Add a type annotation: ${kind} ${p.name}: <type> = ...`;
          this.inferenceChecks.push({
            type: t,
            span: p.span,
            what: `the type of '${p.name}'`,
            hint,
          });
        }
        return;
      }
      case 'TuplePattern': {
        const pt = T.prune(t);
        let elems: T.Type[];
        if (pt.kind === 'tuple' && pt.elems.length === p.elems.length) {
          elems = pt.elems;
        } else {
          elems = p.elems.map(() => T.freshVar());
          if (!this.unify(t, T.tupleOf(elems))) {
            this.error(
              `Cannot destructure a value of type ${this.str(t)} as a ${p.elems.length}-tuple`,
              p.span,
            );
          }
        }
        p.elems.forEach((e, i) => this.bindPattern(e, elems[i], kind, refutable, inferred));
        return;
      }
      case 'LiteralPattern': {
        if (!refutable) {
          this.error('Literal patterns can only be used in match and if let', p.span);
          return;
        }
        const litType = T.PRIMS[p.litKind];
        this.expect(
          t,
          litType,
          p.span,
          (e, a) => `This pattern is a ${a}, but the value being matched is ${e}`,
        );
        return;
      }
      case 'RangePattern':
        if (!refutable) {
          this.error('Range patterns can only be used in match and if let', p.span);
          return;
        }
        this.expect(
          t,
          T.INT,
          p.span,
          (e) => `Range patterns match ints, but the value being matched is ${e}`,
        );
        if (p.start > p.end) this.warn('This range is empty and will never match', p.span);
        return;
      case 'OrPattern':
        if (!refutable) {
          this.error("'|' patterns can only be used in match", p.span);
          return;
        }
        for (const alt of p.alternatives) {
          if (this.patternBinds(alt)) {
            this.error(
              'Alternatives in a | pattern cannot bind variables',
              alt.span,
              'Use separate match arms',
            );
          }
          this.bindPattern(alt, t, kind, refutable, inferred);
        }
        return;
      case 'VariantPattern':
        if (!refutable) {
          this.error(
            'Enum patterns can only be used in match and if let',
            p.span,
            'Use match or if let to test variants',
          );
          return;
        }
        this.bindVariantPattern(p, t, kind, inferred);
        return;
    }
  }

  private patternBinds(p: A.Pattern): boolean {
    switch (p.kind) {
      case 'BindingPattern':
        return true;
      case 'TuplePattern':
        return p.elems.some((e) => this.patternBinds(e));
      case 'VariantPattern':
        return p.args.some((e) => this.patternBinds(e));
      case 'OrPattern':
        return p.alternatives.some((e) => this.patternBinds(e));
      default:
        return false;
    }
  }

  private findEnumForVariant(
    variant: string,
    t: T.Type,
    span: Span,
    enumName?: string,
  ): EnumInfo | undefined {
    if (enumName) {
      const info = this.enums.get(enumName);
      if (!info) {
        this.error(`Unknown enum '${enumName}'`, span, didYouMean(enumName, this.enums.keys()));
      }
      return info;
    }
    const pt = T.prune(t);
    if (pt.kind === 'named' && this.enums.has(pt.name)) return this.enums.get(pt.name);
    const candidates = [...this.enums.values()].filter((e) =>
      e.variants.some((v) => v.name === variant),
    );
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      this.error(
        `Variant '${variant}' exists in several enums`,
        span,
        `Qualify it, e.g. ${candidates[0].name}.${variant}`,
      );
      return undefined;
    }
    const allVariants = [...this.enums.values()].flatMap((e) => e.variants.map((v) => v.name));
    this.error(`Unknown variant '${variant}'`, span, didYouMean(variant, allVariants));
    return undefined;
  }

  private bindVariantPattern(
    p: Extract<A.Pattern, { kind: 'VariantPattern' }>,
    t: T.Type,
    kind: 'let' | 'var' | 'loop' | 'pattern',
    inferred: boolean,
  ) {
    const info = this.findEnumForVariant(p.variant, t, p.span, p.enumName);
    const bindArgsLoosely = () =>
      p.args.forEach((a) => this.bindPattern(a, T.freshVar(), kind, true, inferred));
    if (!info) return bindArgsLoosely();
    const variant = info.variants.find((v) => v.name === p.variant);
    if (!variant) {
      this.error(
        `Enum ${info.name} has no variant '${p.variant}'`,
        p.span,
        didYouMean(
          p.variant,
          info.variants.map((v) => v.name),
        ),
      );
      return bindArgsLoosely();
    }
    const map = new Map<number, T.Type>();
    const args = info.typeParams.map((tp) => {
      const v = T.freshVar();
      map.set(tp.id, v);
      return v;
    });
    const enumType = T.named(info.name, args);
    this.expect(
      t,
      enumType,
      p.span,
      (e, a) => `This pattern matches ${a}, but the value being matched is ${e}`,
    );
    if (p.args.length !== variant.fields.length) {
      const n = variant.fields.length;
      const example = n ? `${p.variant}(${variant.fields.map(() => '_').join(', ')})` : p.variant;
      this.error(
        `Variant ${p.variant} has ${n} field${n === 1 ? '' : 's'}, but the pattern has ${p.args.length}`,
        p.span,
        `Write ${example}`,
      );
    }
    p.args.forEach((a, i) => {
      const ft = variant.fields[i] ? T.substitute(variant.fields[i], map) : T.freshVar();
      this.bindPattern(a, ft, kind, true, inferred);
    });
    this.addHover(
      p.span,
      () =>
        `${info.name === 'option' || info.name === 'result' ? '' : `${info.name}.`}${p.variant}`,
    );
  }

  private constructorsOf = (type: T.Type): Constructor[] | null => {
    const t = T.prune(type);
    if (T.isPrim(t, 'bool')) {
      return [
        { name: 'true', display: () => 'true', fields: [] },
        { name: 'false', display: () => 'false', fields: [] },
      ];
    }
    if (t.kind === 'tuple') {
      return [{ name: '()', display: (args) => `(${args.join(', ')})`, fields: t.elems }];
    }
    if (t.kind === 'named') {
      const info = this.enums.get(t.name);
      if (!info) return null;
      const map = new Map<number, T.Type>();
      info.typeParams.forEach((p, i) => map.set(p.id, t.args[i] ?? T.freshVar()));
      return info.variants.map((v) => ({
        name: v.name,
        display: (args) => (v.fields.length ? `${v.name}(${args.join(', ')})` : v.name),
        fields: v.fields.map((f) => T.substitute(f, map)),
      }));
    }
    return null;
  };

  /* ─────────────────────────── expressions ─────────────────────────── */

  /**
   * Infers the type of an expression. `expected` guides inference (e.g. lambda parameter
   * types); `valueContext` is false when the value is discarded (statement position).
   */
  checkExpr(e: A.Expr, expected?: T.Type, valueContext = true): T.Type {
    const t = this.inferExpr(e, expected, valueContext);
    e.ty = t;
    this.typedNodes.push(e);
    return t;
  }

  private inferExpr(e: A.Expr, expected: T.Type | undefined, valueContext: boolean): T.Type {
    switch (e.kind) {
      case 'IntLit':
        return T.INT;
      case 'FloatLit':
        return T.FLOAT;
      case 'StringLit':
        return T.STRING;
      case 'BoolLit':
        return T.BOOL;
      case 'TemplateLit':
        for (const part of e.parts) {
          if (typeof part === 'string') continue;
          const pt = this.checkExpr(part);
          if (T.isPrim(pt, 'void')) this.error('Cannot interpolate a void value', part.span);
        }
        return T.STRING;
      case 'Ident':
        return this.checkIdent(e);
      case 'SelfExpr': {
        const v = this.scope.lookup('self');
        if (!v) {
          this.error(
            "'self' can only be used inside methods",
            e.span,
            'Add self as the first parameter of an impl function',
          );
          return T.freshVar();
        }
        v.used = true;
        this.addHover(e.span, () => `self: ${this.str(v.type)}`);
        return v.type;
      }
      case 'ArrayLit':
        return this.checkArrayLit(e, expected);
      case 'MapLit':
        return this.checkMapLit(e, expected);
      case 'TupleLit': {
        const exp = expected ? T.prune(expected) : undefined;
        const expElems =
          exp?.kind === 'tuple' && exp.elems.length === e.elements.length ? exp.elems : undefined;
        return T.tupleOf(e.elements.map((el, i) => this.checkExpr(el, expElems?.[i])));
      }
      case 'StructLit':
        return this.checkStructLit(e);
      case 'Unary':
        return this.checkUnary(e);
      case 'Binary':
        return this.checkBinary(e);
      case 'Range':
        this.expect(
          T.INT,
          this.checkExpr(e.start),
          e.start.span,
          (_x, a) => `Range bounds must be int, found ${a}`,
        );
        this.expect(
          T.INT,
          this.checkExpr(e.end),
          e.end.span,
          (_x, a) => `Range bounds must be int, found ${a}`,
        );
        return T.arrayOf(T.INT);
      case 'Cast':
        return this.checkCast(e);
      case 'Call':
        return this.checkCall(e);
      case 'Member':
        return this.checkMember(e);
      case 'Index':
        return this.checkIndex(e);
      case 'Try':
        return this.checkTry(e);
      case 'Pipe':
        return this.checkPipe(e, expected);
      case 'Lambda':
        return this.checkLambda(e, expected);
      case 'If':
      case 'IfLet':
        return this.checkIf(e, valueContext, expected);
      case 'Match':
        return this.checkMatch(e, valueContext, expected);
      case 'Block':
        return this.checkBlockExpr(e, valueContext, expected);
    }
  }

  private checkBlockExpr(b: A.Block, valueContext: boolean, expected?: T.Type): T.Type {
    const t = this.withScope(() => this.checkStatements(b.stmts, valueContext, expected));
    b.ty = t;
    this.typedNodes.push(b);
    return t;
  }

  private checkIdent(e: A.Ident): T.Type {
    const v = this.scope.lookup(e.name);
    if (!v) {
      if (this.structs.has(e.name)) {
        this.error(
          `'${e.name}' is a type, not a value`,
          e.span,
          `Create a value with ${e.name} { ... }`,
        );
      } else if (this.enums.has(e.name)) {
        const first = this.enums.get(e.name)!.variants[0]?.name ?? 'Variant';
        this.error(
          `'${e.name}' is a type, not a value`,
          e.span,
          `Use one of its variants, e.g. ${e.name}.${first}`,
        );
      } else {
        this.error(`Unknown name '${e.name}'`, e.span, didYouMean(e.name, this.scope.names()));
      }
      return T.freshVar();
    }
    v.used = true;
    if (v.special) {
      this.error(`'${v.name}' can only be called directly`, e.span, `Use it as ${v.name}(...)`);
      return T.freshVar();
    }
    const t = this.instantiateVar(v);
    this.hoverVar(e.span, v, t);
    return t;
  }

  private instantiateVar(v: VarInfo): T.Type {
    if (v.builtin) return this.applySignature(v.builtin());
    return v.typeParams ? this.instantiate(v.typeParams, v.type) : v.type;
  }

  private checkArrayLit(e: A.ArrayLit, expected?: T.Type): T.Type {
    const exp = expected ? T.prune(expected) : undefined;
    const expElem = exp?.kind === 'array' ? exp.elem : undefined;
    const elem: T.Type = T.freshVar();
    for (const el of e.elements) {
      const t = this.checkExpr(el, expElem);
      if (!this.unify(elem, t)) {
        this.error(
          `Array elements must all have the same type: expected ${this.str(elem)}, found ${this.str(t)}`,
          el.span,
          'Use a tuple or an enum to group values of different types',
        );
      }
    }
    return T.arrayOf(elem);
  }

  private checkMapLit(e: A.MapLit, expected?: T.Type): T.Type {
    const exp = expected ? T.prune(expected) : undefined;
    const key: T.Type = T.freshVar(T.HASHABLE);
    const value: T.Type = T.freshVar();
    for (const entry of e.entries) {
      const kt = this.checkExpr(entry.key, exp?.kind === 'map' ? exp.key : undefined);
      if (!this.unify(key, kt)) {
        const p = T.prune(kt);
        if (p.kind !== 'prim' || !T.HASHABLE.allowed.has(p.name)) {
          this.error(
            `Map keys must be int, float, string or bool — found ${this.str(kt)}`,
            entry.key.span,
          );
        } else {
          this.error(
            `All map keys must have the same type: expected ${this.str(key)}, found ${this.str(kt)}`,
            entry.key.span,
          );
        }
      }
      const vt = this.checkExpr(entry.value, exp?.kind === 'map' ? exp.value : undefined);
      if (!this.unify(value, vt)) {
        this.error(
          `All map values must have the same type: expected ${this.str(value)}, found ${this.str(vt)}`,
          entry.value.span,
        );
      }
    }
    return T.mapOf(key, value);
  }

  private checkStructLit(e: A.StructLit): T.Type {
    const info = this.structs.get(e.name);
    if (!info) {
      if (this.enums.has(e.name)) {
        this.error(
          `'${e.name}' is an enum, not a struct`,
          e.nameSpan,
          `Create a variant with ${e.name}.Variant(...)`,
        );
      } else {
        this.error(
          `Unknown struct '${e.name}'`,
          e.nameSpan,
          didYouMean(e.name, this.structs.keys()),
        );
      }
      for (const f of e.fields) this.checkExpr(f.value);
      return T.freshVar();
    }
    const map = new Map<number, T.Type>();
    const args = info.typeParams.map((p) => {
      const v = T.freshVar();
      map.set(p.id, v);
      return v;
    });
    const seen = new Set<string>();
    for (const f of e.fields) {
      const field = info.fields.find((x) => x.name === f.name);
      if (!field) {
        this.error(
          `Struct ${e.name} has no field '${f.name}'`,
          f.span,
          didYouMean(
            f.name,
            info.fields.map((x) => x.name),
          ),
        );
        this.checkExpr(f.value);
        continue;
      }
      if (seen.has(f.name)) this.error(`Field '${f.name}' is specified more than once`, f.span);
      seen.add(f.name);
      const ft = T.substitute(field.type, map);
      const vt = this.checkExpr(f.value, ft);
      this.expect(
        ft,
        vt,
        f.value.span,
        (x, a) => `Field '${f.name}' of ${e.name} expects ${x}, found ${a}`,
      );
      this.addHover(
        { start: f.span.start, end: f.span.start + f.name.length },
        () => `${e.name}.${f.name}: ${this.str(T.resolve(ft))}`,
      );
    }
    const missing = info.fields.filter((f) => !seen.has(f.name)).map((f) => f.name);
    if (missing.length) {
      this.error(
        `Missing field${missing.length > 1 ? 's' : ''} ${missing.map((m) => `'${m}'`).join(', ')} in ${e.name}`,
        e.nameSpan,
        'Every field must be initialized',
      );
    }
    this.addHover(e.nameSpan, () => this.structSignature(info));
    return T.named(e.name, args);
  }

  private checkUnary(e: A.Unary): T.Type {
    const t = this.checkExpr(e.operand);
    if (e.op === '!') {
      this.expect(T.BOOL, t, e.operand.span, (_x, a) => `'!' requires a bool, found ${a}`);
      return T.BOOL;
    }
    if (!this.constrain(t, T.NUMERIC)) {
      this.error(`Cannot negate a value of type ${this.str(t)}`, e.span);
    }
    return t;
  }

  private operandKind(t: T.Type): 'int' | 'float' | 'string' | 'other' {
    const p = T.prune(t);
    if (p.kind === 'prim' && (p.name === 'int' || p.name === 'float' || p.name === 'string'))
      return p.name;
    return 'other';
  }

  private checkBinary(e: A.Binary): T.Type {
    const op = e.op;
    if (op === '&&' || op === '||') {
      this.expect(
        T.BOOL,
        this.checkExpr(e.left),
        e.left.span,
        (_x, a) => `'${op}' requires bool operands, found ${a}`,
      );
      this.expect(
        T.BOOL,
        this.checkExpr(e.right),
        e.right.span,
        (_x, a) => `'${op}' requires bool operands, found ${a}`,
      );
      return T.BOOL;
    }
    if (op === '??') {
      const lt = this.checkExpr(e.left);
      const inner: T.Type = T.freshVar();
      if (!this.unify(lt, T.optionOf(inner))) {
        this.error(
          `'??' needs an option on its left side, found ${this.str(lt)}`,
          e.left.span,
          '?? provides a fallback value for None',
        );
        this.checkExpr(e.right);
        return lt;
      }
      const rt = this.checkExpr(e.right, inner);
      this.expect(
        inner,
        rt,
        e.right.span,
        (x, a) => `The fallback after '??' must be ${x}, found ${a}`,
      );
      return inner;
    }

    const lt = this.checkExpr(e.left);
    const rt = this.checkExpr(e.right, lt);
    this.finalizers.push(() => {
      e.operandKind = this.operandKind(lt);
    });

    if (!this.unify(lt, rt)) {
      const ls = this.str(lt);
      const rs = this.str(rt);
      let hint = this.mismatchHint(lt, rt);
      const isOption = (t: T.Type) => {
        const p = T.prune(t);
        return p.kind === 'named' && p.name === 'option';
      };
      if (isOption(lt) || isOption(rt)) {
        hint = 'One side is an option — unwrap it first with `?? fallback`, `if let` or `match`';
      } else if (op === '+' && (T.isPrim(lt, 'string') || T.isPrim(rt, 'string'))) {
        hint = 'Use interpolation to build strings: "${a}${b}", or convert with str(x)';
      } else if (
        (T.isPrim(lt, 'int') && T.isPrim(rt, 'float')) ||
        (T.isPrim(lt, 'float') && T.isPrim(rt, 'int'))
      ) {
        hint = 'Lumen never converts numbers implicitly — use `as float` or `as int`';
      }
      this.error(`Cannot apply '${op}' to ${ls} and ${rs}`, e.span, hint);
      return op === '==' || op === '!=' || op === '<' || op === '<=' || op === '>' || op === '>='
        ? T.BOOL
        : lt;
    }

    switch (op) {
      case '==':
      case '!=':
        return T.BOOL;
      case '<':
      case '<=':
      case '>':
      case '>=':
        if (!this.constrain(lt, T.ORDERED)) {
          this.error(
            `Cannot compare values of type ${this.str(lt)} with '${op}'`,
            e.span,
            'Only ints, floats and strings are ordered',
          );
        }
        return T.BOOL;
      case '+':
        if (!this.constrain(lt, T.ADDABLE)) {
          this.error(
            `Cannot apply '+' to ${this.str(lt)}`,
            e.span,
            '+ works on ints, floats and strings',
          );
        }
        return lt;
      default:
        if (!this.constrain(lt, T.NUMERIC)) {
          this.error(
            `Cannot apply '${op}' to ${this.str(lt)}`,
            e.span,
            `'${op}' works on ints and floats`,
          );
        }
        return lt;
    }
  }

  private checkCast(e: A.Cast): T.Type {
    const src = this.checkExpr(e.expr);
    const target = this.resolveTypeExpr(e.target);
    const tp = T.prune(target);
    if (!(tp.kind === 'prim' && (tp.name === 'int' || tp.name === 'float'))) {
      this.error(
        `'as' converts between int and float only — cannot convert to ${this.str(target)}`,
        e.target.span,
        T.isPrim(tp, 'string') ? 'Use str(value) to convert to a string' : undefined,
      );
      return target;
    }
    if (!this.constrain(src, T.NUMERIC)) {
      this.error(
        `Cannot convert ${this.str(src)} to ${tp.name}`,
        e.span,
        'Only ints and floats can be converted with as',
      );
    }
    this.finalizers.push(() => {
      const s = this.operandKind(src);
      e.conversion =
        s === tp.name || s === 'other' ? 'identity' : s === 'int' ? 'int->float' : 'float->int';
    });
    return target;
  }

  private checkIndex(e: A.Index): T.Type {
    const ot = T.prune(this.checkExpr(e.object));
    if (ot.kind === 'array') {
      e.container = 'array';
      this.expect(
        T.INT,
        this.checkExpr(e.index),
        e.index.span,
        (_x, a) => `Array indexes must be int, found ${a}`,
      );
      return ot.elem;
    }
    if (ot.kind === 'map') {
      e.container = 'map';
      this.expect(
        ot.key,
        this.checkExpr(e.index, ot.key),
        e.index.span,
        (x, a) => `This map has ${x} keys, found ${a}`,
      );
      return ot.value;
    }
    if (T.isPrim(ot, 'string')) {
      e.container = 'string';
      this.expect(
        T.INT,
        this.checkExpr(e.index),
        e.index.span,
        (_x, a) => `String indexes must be int, found ${a}`,
      );
      return T.STRING;
    }
    this.checkExpr(e.index);
    if (ot.kind === 'var') {
      this.error(
        'Cannot index a value whose type is not known yet',
        e.object.span,
        'Add a type annotation',
      );
    } else if (ot.kind === 'tuple') {
      this.error('Tuples are accessed with .0, .1, ... rather than [ ]', e.span, 'e.g. pair.0');
    } else {
      this.error(`Values of type ${this.str(ot)} cannot be indexed`, e.span);
    }
    return T.freshVar();
  }

  private checkTry(e: A.Try): T.Type {
    const t = T.prune(this.checkExpr(e.expr));
    const ctx = this.fnStack.at(-1);
    if (t.kind === 'named' && (t.name === 'option' || t.name === 'result')) {
      if (!ctx) {
        this.error("'?' can only be used inside a function", e.span);
        return t.args[0];
      }
      const wanted =
        t.name === 'option' ? T.optionOf(T.freshVar()) : T.resultOf(T.freshVar(), t.args[1]);
      if (!this.unify(ctx.ret, wanted)) {
        this.error(
          `'?' on ${t.name === 'option' ? 'an option' : 'a result'} requires '${ctx.name}' to return ${t.name === 'option' ? 'an option' : `a result with error type ${this.str(t.args[1])}`}, but it returns ${this.str(ctx.ret)}`,
          e.span,
          t.name === 'option'
            ? 'Change the return type to T? — or handle None with ?? or match'
            : undefined,
        );
      }
      return t.args[0];
    }
    if (t.kind === 'var') {
      this.error("Cannot use '?' on a value whose type is not known yet", e.span);
    } else {
      this.error(`'?' works on options and results, found ${this.str(t)}`, e.span);
    }
    return T.freshVar();
  }

  private checkPipe(e: A.Pipe, expected?: T.Type): T.Type {
    const right = e.right;
    const isValue = (name: string) => !!this.scope.lookup(name);
    let call: A.Call;
    if (right.kind === 'Call' && right.callee.kind === 'Ident' && !isValue(right.callee.name)) {
      call = {
        kind: 'Call',
        callee: {
          kind: 'Member',
          object: e.left,
          name: right.callee.name,
          nameSpan: right.callee.span,
          span: right.callee.span,
        },
        args: right.args,
        span: e.span,
      };
    } else if (right.kind === 'Call') {
      call = { kind: 'Call', callee: right.callee, args: [e.left, ...right.args], span: e.span };
    } else if (right.kind === 'Ident' && !isValue(right.name)) {
      call = {
        kind: 'Call',
        callee: {
          kind: 'Member',
          object: e.left,
          name: right.name,
          nameSpan: right.span,
          span: right.span,
        },
        args: [],
        span: e.span,
      };
    } else {
      call = { kind: 'Call', callee: right, args: [e.left], span: e.span };
    }
    e.desugared = call;
    return this.checkExpr(call, expected);
  }

  private checkLambda(e: A.Lambda, expected?: T.Type): T.Type {
    const exp = expected ? T.prune(expected) : undefined;
    const expFn = exp?.kind === 'fn' && exp.params.length === e.params.length ? exp : undefined;
    const params = e.params.map((p, i) => {
      if (p.type) return this.resolveTypeExpr(p.type);
      return expFn ? expFn.params[i] : T.freshVar();
    });
    const discardTail = !e.ret && !!expFn && T.isPrim(expFn.ret, 'void');
    const ret: T.Type = e.ret
      ? this.resolveTypeExpr(e.ret)
      : discardTail
        ? T.VOID
        : (expFn?.ret ?? T.freshVar());
    const savedLoops = this.loopStack;
    this.loopStack = [];
    this.withScope(() => {
      e.params.forEach((p, i) => {
        p.ty = params[i];
        this.typedNodes.push(p);
        this.declare({ name: p.name, kind: 'param', type: params[i], span: p.span });
        this.addHover(p.span, () => `${p.name}: ${this.str(T.resolve(params[i]))}`);
        this.addSymbol(() => ({
          name: p.name,
          kind: 'parameter',
          type: this.str(T.resolve(params[i])),
          span: p.span,
          inferred: !p.type,
          owner: 'lambda',
          typeRef: T.resolve(params[i]),
        }));
        if (!p.type) {
          this.inferenceChecks.push({
            type: params[i],
            span: p.span,
            what: `the type of parameter '${p.name}'`,
            hint: `Add a type annotation: fn(${p.name}: int) => ...`,
          });
        }
      });
      this.fnStack.push({ name: 'lambda', ret, discardTail });
      const bodyType =
        e.body.kind === 'Block'
          ? this.checkBlockExpr(e.body, !discardTail, ret)
          : this.checkExpr(e.body, ret, !discardTail);
      this.fnStack.pop();
      if (!discardTail) this.checkReturnType('lambda', ret, bodyType, e.body, !e.ret);
    });
    this.loopStack = savedLoops;
    return T.fnOf(params, ret);
  }

  private checkIf(e: A.If | A.IfLet, valueContext: boolean, expected?: T.Type): T.Type {
    const hasElse = !!e.else;
    const thenType = this.withScope(() => {
      if (e.kind === 'If') {
        const ct = this.checkExpr(e.cond);
        this.expect(T.BOOL, ct, e.cond.span, (_x, a) => `If condition must be bool, found ${a}`);
      } else {
        const vt = this.checkExpr(e.value);
        this.bindPattern(e.pattern, vt, 'pattern', true, true);
      }
      return this.checkBlockExpr(e.then, valueContext && hasElse, expected);
    });
    if (!e.else) return T.VOID;
    const elseType =
      e.else.kind === 'Block'
        ? this.checkBlockExpr(e.else, valueContext, expected)
        : this.checkExpr(e.else, expected, valueContext);
    if (!valueContext) return T.isNever(thenType) && T.isNever(elseType) ? T.NEVER : T.VOID;
    return this.join(
      [
        { type: thenType, span: this.tailExpr(e.then)?.span ?? e.then.span },
        {
          type: elseType,
          span:
            e.else.kind === 'Block' ? (this.tailExpr(e.else)?.span ?? e.else.span) : e.else.span,
        },
      ],
      'Both branches of an if expression must have the same type',
    );
  }

  private join(branches: { type: T.Type; span: Span }[], hint: string): T.Type {
    const live = branches.filter((b) => !T.isNever(b.type));
    if (!live.length) return T.NEVER;
    const result = live[0].type;
    for (const b of live.slice(1)) {
      if (!this.unify(result, b.type)) {
        this.error(
          `Branches have different types: ${this.str(result)} and ${this.str(b.type)}`,
          b.span,
          hint,
        );
      }
    }
    return result;
  }

  private checkMatch(e: A.Match, valueContext: boolean, expected?: T.Type): T.Type {
    const subject = this.checkExpr(e.subject);
    const errorsBefore = this.diagnostics.filter((d) => d.severity === 'error').length;
    const branches: { type: T.Type; span: Span }[] = [];
    for (const arm of e.arms) {
      this.withScope(() => {
        this.bindPattern(arm.pattern, subject, 'pattern', true, true);
        if (arm.guard) {
          this.expect(
            T.BOOL,
            this.checkExpr(arm.guard),
            arm.guard.span,
            (_x, a) => `Match guards must be bool, found ${a}`,
          );
        }
        const t = this.checkExpr(arm.body, expected, valueContext);
        branches.push({ type: t, span: arm.body.span });
      });
    }
    const errorsAfter = this.diagnostics.filter((d) => d.severity === 'error').length;
    if (errorsAfter === errorsBefore) this.checkExhaustive(e, subject);
    if (!valueContext) return branches.every((b) => T.isNever(b.type)) ? T.NEVER : T.VOID;
    return this.join(branches, 'Every arm of a match expression must produce the same type');
  }

  private checkExhaustive(e: A.Match, subject: T.Type) {
    const rows: ReturnType<typeof simplify>[][] = [];
    for (const arm of e.arms) {
      const row = [simplify(arm.pattern)];
      if (!isUseful(rows, row, [subject], this.constructorsOf)) {
        this.warn(
          'Unreachable match arm — earlier arms already cover every value it matches',
          arm.pattern.span,
        );
      }
      if (!arm.guard) rows.push(row);
    }
    const missing = findMissing(rows, [subject], this.constructorsOf);
    if (missing) {
      const kw = { start: e.span.start, end: e.span.start + 5 };
      this.error(
        missing[0] === '_'
          ? 'Non-exhaustive match: some values are not covered'
          : `Non-exhaustive match: '${missing[0]}' is not covered`,
        kw,
        missing[0] === '_'
          ? 'Add a catch-all arm: _ => ...'
          : `Add an arm for ${missing[0]}, or a catch-all '_ =>' arm`,
      );
    }
  }

  /* ─────────────────────────── members & calls ─────────────────────────── */

  /** If `e` names a type (and is not shadowed by a value), returns that type name. */
  private staticTypeName(e: A.Expr): string | undefined {
    if (e.kind !== 'Ident' || this.scope.lookup(e.name)) return undefined;
    if (this.structs.has(e.name) || this.enums.has(e.name)) return e.name;
    if (this.aliases.has(e.name)) {
      const t = T.prune(this.resolveAlias(e.name, e.span));
      if (t.kind === 'named' && (this.structs.has(t.name) || this.enums.has(t.name))) return t.name;
    }
    return undefined;
  }

  private checkMember(e: A.Member): T.Type {
    const staticName = this.staticTypeName(e.object);
    if (staticName) {
      const en = this.enums.get(staticName);
      const variant = en?.variants.find((v) => v.name === e.name);
      if (en && variant) {
        e.access = 'variant';
        e.enumName = en.name;
        const map = new Map<number, T.Type>();
        const args = en.typeParams.map((p) => {
          const v = T.freshVar();
          map.set(p.id, v);
          return v;
        });
        const enumType = T.named(en.name, args);
        this.addHover(
          e.nameSpan,
          () =>
            `${en.name}.${variant.name}${variant.fields.length ? `(${variant.fields.map((f) => this.str(f)).join(', ')})` : ''}`,
        );
        this.addHover(e.object.span, () => this.enumSignature(en));
        if (!variant.fields.length) return enumType;
        return T.fnOf(
          variant.fields.map((f) => T.substitute(f, map)),
          enumType,
        );
      }
      const method = this.impls.get(staticName)?.get(e.name);
      if (method) {
        this.error(
          `'${staticName}.${e.name}' must be called`,
          e.span,
          `Call it: ${staticName}.${e.name}(...)`,
        );
      } else {
        const options = [
          ...(en?.variants.map((v) => v.name) ?? []),
          ...(this.impls.get(staticName)?.keys() ?? []),
        ];
        this.error(
          `'${staticName}' has no variant or function named '${e.name}'`,
          e.nameSpan,
          didYouMean(e.name, options),
        );
      }
      return T.freshVar();
    }

    const ot = T.prune(this.checkExpr(e.object));
    if (ot.kind === 'tuple') {
      const idx = Number(e.name);
      if (Number.isInteger(idx) && idx >= 0 && idx < ot.elems.length) {
        e.access = 'tuple';
        return ot.elems[idx];
      }
      this.error(
        `Tuple ${this.str(ot)} has no element .${e.name}`,
        e.nameSpan,
        `Valid elements: ${ot.elems.map((_, i) => `.${i}`).join(', ')}`,
      );
      return T.freshVar();
    }
    if (ot.kind === 'named') {
      const info = this.structs.get(ot.name);
      const field = info?.fields.find((f) => f.name === e.name);
      if (info && field) {
        e.access = 'field';
        const map = new Map<number, T.Type>();
        info.typeParams.forEach((p, i) => map.set(p.id, ot.args[i]));
        const ft = T.substitute(field.type, map);
        this.addHover(e.nameSpan, () => `${info.name}.${field.name}: ${this.str(T.resolve(ft))}`);
        return ft;
      }
    }
    if (ot.kind === 'var') {
      this.error(
        `Cannot access '.${e.name}' on a value whose type is not known yet`,
        e.nameSpan,
        'Add a type annotation',
      );
      return T.freshVar();
    }
    if (this.findMethod(ot, e.name)) {
      this.error(`'${e.name}' is a method, not a field`, e.nameSpan, `Call it: .${e.name}()`);
      return T.freshVar();
    }
    const fieldNames =
      ot.kind === 'named' ? (this.structs.get(ot.name)?.fields.map((f) => f.name) ?? []) : [];
    this.error(
      `Type ${this.str(ot)} has no field '${e.name}'`,
      e.nameSpan,
      didYouMean(e.name, fieldNames),
    );
    return T.freshVar();
  }

  /** Lists every method callable on values of type `t`. */
  methodsOf(t: T.Type): BuiltinMethod[] {
    const p = T.prune(t);
    const out: BuiltinMethod[] = [];
    if (p.kind === 'named') {
      if (p.name === 'option') out.push(...OPTION_METHODS.methods);
      else if (p.name === 'result') out.push(...RESULT_METHODS.methods);
      for (const mi of this.impls.get(p.name)?.values() ?? []) {
        if (!mi.hasSelf) continue;
        const sig = this.fnSigs.get(mi.decl)!;
        out.push({
          name: mi.name,
          signature: this.fnSignature(mi.decl, sig).replace(/^fn /, ''),
          doc: '',
        });
      }
    } else if (p.kind === 'array') out.push(...ARRAY_METHODS.methods);
    else if (p.kind === 'map') out.push(...MAP_METHODS.methods);
    else if (T.isPrim(p, 'string')) out.push(...STRING_METHODS.methods);
    else if (T.isPrim(p, 'int') || T.isPrim(p, 'float')) out.push(...NUMBER_METHODS.methods);
    out.push(...UNIVERSAL_METHODS);
    return out;
  }

  private findMethod(t: T.Type, name: string): boolean {
    return this.methodsOf(t).some((m) => m.name === name);
  }

  private checkArgs(fn: T.TFn, args: A.Expr[], span: Span, what: string): T.Type {
    if (args.length !== fn.params.length) {
      const n = fn.params.length;
      this.error(
        `${what} expects ${n} argument${n === 1 ? '' : 's'}, but got ${args.length}`,
        span,
      );
      args.forEach((a, i) => this.checkExpr(a, fn.params[i]));
      return fn.ret;
    }
    args.forEach((a, i) => {
      const pt = fn.params[i];
      const at = this.checkExpr(a, pt);
      this.expect(
        pt,
        at,
        a.span,
        (x, y) => `Argument ${i + 1} of ${what} expects ${x}, found ${y}`,
      );
    });
    return fn.ret;
  }

  private checkCall(e: A.Call): T.Type {
    const callee = e.callee;

    if (callee.kind === 'Ident') {
      const v = this.scope.lookup(callee.name);
      if (v?.special) {
        v.used = true;
        this.addHover(callee.span, () => v.signature ?? v.name, v.doc);
        e.target = { kind: 'value' };
        return this.checkSpecial(e, v.special);
      }
    }

    if (callee.kind === 'Member') {
      const staticName = this.staticTypeName(callee.object);
      if (staticName) return this.checkStaticCall(e, callee, staticName);
      const recv = this.checkExpr(callee.object);
      return this.checkMethodCall(e, callee, recv);
    }

    e.target = { kind: 'value' };
    const ct = T.prune(this.checkExpr(callee));
    const what = callee.kind === 'Ident' ? `'${callee.name}'` : 'this function';
    if (ct.kind === 'fn') return this.checkArgs(ct, e.args, e.span, what);
    if (ct.kind === 'var') {
      const ret: T.Type = T.freshVar();
      const fnT = T.fnOf(
        e.args.map((a) => this.checkExpr(a)),
        ret,
      );
      this.unify(ct, fnT);
      return ret;
    }
    if (ct.kind !== 'never') {
      this.error(`${what} is not a function — it has type ${this.str(ct)}`, callee.span);
    }
    e.args.forEach((a) => this.checkExpr(a));
    return T.freshVar();
  }

  private checkSpecial(e: A.Call, special: 'print' | 'assert'): T.Type {
    if (special === 'print') {
      for (const a of e.args) {
        const t = this.checkExpr(a);
        if (T.isPrim(t, 'void')) this.error('Cannot print a void value', a.span);
      }
      return T.VOID;
    }
    if (e.args.length < 1 || e.args.length > 2) {
      this.error('assert expects a condition and an optional message', e.span);
    }
    if (e.args[0])
      this.expect(
        T.BOOL,
        this.checkExpr(e.args[0]),
        e.args[0].span,
        (_x, a) => `assert expects a bool condition, found ${a}`,
      );
    if (e.args[1])
      this.expect(
        T.STRING,
        this.checkExpr(e.args[1]),
        e.args[1].span,
        (_x, a) => `assert expects a string message, found ${a}`,
      );
    for (const a of e.args.slice(2)) this.checkExpr(a);
    return T.VOID;
  }

  private checkStaticCall(e: A.Call, callee: A.Member, typeName: string): T.Type {
    const en = this.enums.get(typeName);
    const variant = en?.variants.find((v) => v.name === callee.name);
    if (en && variant) {
      e.target = { kind: 'variant', enumName: en.name, variant: variant.name };
      const map = new Map<number, T.Type>();
      const args = en.typeParams.map((p) => {
        const v = T.freshVar();
        map.set(p.id, v);
        return v;
      });
      this.addHover(
        callee.nameSpan,
        () => `${en.name}.${variant.name}(${variant.fields.map((f) => this.str(f)).join(', ')})`,
      );
      this.addHover(callee.object.span, () => this.enumSignature(en));
      if (!variant.fields.length) {
        this.error(
          `Variant ${typeName}.${variant.name} has no fields`,
          e.span,
          `Use it without parentheses: ${typeName}.${variant.name}`,
        );
        return T.named(en.name, args);
      }
      const fn = T.fnOf(
        variant.fields.map((f) => T.substitute(f, map)),
        T.named(en.name, args),
      );
      return this.checkArgs(fn, e.args, e.span, `${typeName}.${variant.name}`);
    }
    const method = this.impls.get(typeName)?.get(callee.name);
    if (method) {
      if (method.hasSelf) {
        this.error(
          `'${callee.name}' is a method — call it on a value`,
          callee.nameSpan,
          `e.g. value.${callee.name}(...)`,
        );
      }
      e.target = { kind: 'static', typeName };
      const fn = this.instantiateMethod(method);
      this.addHover(callee.nameSpan, () =>
        this.fnSignature(method.decl, this.fnSigs.get(method.decl)!, typeName),
      );
      const info = this.structs.get(typeName);
      if (info) this.addHover(callee.object.span, () => this.structSignature(info));
      return this.checkArgs(fn, e.args, e.span, `${typeName}.${callee.name}`);
    }
    const options = [
      ...(en?.variants.map((v) => v.name) ?? []),
      ...(this.impls.get(typeName)?.keys() ?? []),
    ];
    this.error(
      `'${typeName}' has no variant or function named '${callee.name}'`,
      callee.nameSpan,
      didYouMean(callee.name, options),
    );
    e.args.forEach((a) => this.checkExpr(a));
    return T.freshVar();
  }

  private instantiateMethod(mi: MethodInfo, recvArgs?: T.Type[]): T.TFn {
    const map = new Map<number, T.Type>();
    mi.ownerParams.forEach((p, i) => map.set(p.id, recvArgs?.[i] ?? T.freshVar()));
    mi.typeParams.forEach((p) => map.set(p.id, T.freshVar()));
    return T.substitute(T.fnOf(mi.params, mi.ret), map) as T.TFn;
  }

  private checkMethodCall(e: A.Call, callee: A.Member, recvType: T.Type): T.Type {
    const r = T.prune(recvType);
    const name = callee.name;
    const what = `.${name}()`;

    if (r.kind === 'named') {
      const mi = this.impls.get(r.name)?.get(name);
      if (mi) {
        if (!mi.hasSelf) {
          this.error(
            `'${name}' is a static function of ${r.name}`,
            callee.nameSpan,
            `Call it as ${r.name}.${name}(...)`,
          );
        }
        e.target = { kind: 'method', typeName: r.name };
        this.markMutated(callee.object);
        this.addHover(callee.nameSpan, () =>
          this.fnSignature(mi.decl, this.fnSigs.get(mi.decl)!, r.name),
        );
        return this.checkArgs(
          this.instantiateMethod(mi, r.args),
          e.args,
          e.span,
          `${r.name}${what}`,
        );
      }
      const info = this.structs.get(r.name);
      const field = info?.fields.find((f) => f.name === name);
      if (info && field) {
        // Calling a struct field that holds a function.
        e.target = { kind: 'value' };
        const ft = T.prune(this.checkExpr(callee));
        if (ft.kind === 'fn') return this.checkArgs(ft, e.args, e.span, `'${name}'`);
        this.error(
          `Field '${name}' of ${r.name} is not a function — it has type ${this.str(ft)}`,
          callee.nameSpan,
        );
        return T.freshVar();
      }
    }

    const builtin = this.builtinMethod(r, name);
    if (builtin) {
      e.target = { kind: 'builtin-method', receiver: builtin.receiver, name };
      if (builtin.doc.mutates) this.markMutated(callee.object);
      const s = builtin.sig;
      const fn = this.applySignature(s);
      const ret = this.checkArgs(fn, e.args, e.span, what);
      for (const [t, c] of s.requires ?? []) {
        if (!this.constrain(t, c)) {
          this.error(
            `${what} requires ${c.label}, but this is ${this.str(recvType)}`,
            callee.nameSpan,
          );
        }
      }
      const doc = builtin.doc;
      this.addHover(callee.nameSpan, () => `${this.receiverLabel(r)}.${doc.signature}`, doc.doc);
      return ret;
    }

    e.args.forEach((a) => this.checkExpr(a));
    if (r.kind === 'var') {
      this.error(
        `Cannot call ${what} on a value whose type is not known yet`,
        callee.nameSpan,
        'Add a type annotation',
      );
      return T.freshVar();
    }
    if (r.kind === 'never') return T.freshVar();
    const available = this.methodsOf(r).map((m) => m.name);
    this.error(
      `Type ${this.str(r)} has no method '${name}'`,
      callee.nameSpan,
      didYouMean(name, available),
    );
    return T.freshVar();
  }

  private receiverLabel(r: T.Type): string {
    if (r.kind === 'array') return '[T]';
    if (r.kind === 'map') return '[K: V]';
    if (r.kind === 'named' && r.name === 'option') return 'T?';
    if (r.kind === 'named' && r.name === 'result') return 'result<T, E>';
    return this.str(r);
  }

  private builtinMethod(
    r: T.Type,
    name: string,
  ): { receiver: A.BuiltinReceiver; sig: Signature; doc: BuiltinMethod } | undefined {
    const find = (list: BuiltinMethod[]) => list.find((m) => m.name === name);
    let res:
      | { receiver: A.BuiltinReceiver; sig: Signature | undefined; doc: BuiltinMethod | undefined }
      | undefined;
    if (r.kind === 'array')
      res = {
        receiver: 'array',
        sig: ARRAY_METHODS.type(r.elem, name),
        doc: find(ARRAY_METHODS.methods),
      };
    else if (r.kind === 'map')
      res = {
        receiver: 'map',
        sig: MAP_METHODS.type([r.key, r.value], name),
        doc: find(MAP_METHODS.methods),
      };
    else if (T.isPrim(r, 'string'))
      res = {
        receiver: 'string',
        sig: STRING_METHODS.type(null, name),
        doc: find(STRING_METHODS.methods),
      };
    else if (T.isPrim(r, 'int') || T.isPrim(r, 'float'))
      res = {
        receiver: 'number',
        sig: NUMBER_METHODS.type(r, name),
        doc: find(NUMBER_METHODS.methods),
      };
    else if (r.kind === 'named' && r.name === 'option')
      res = {
        receiver: 'option',
        sig: OPTION_METHODS.type(r.args[0], name),
        doc: find(OPTION_METHODS.methods),
      };
    else if (r.kind === 'named' && r.name === 'result')
      res = {
        receiver: 'result',
        sig: RESULT_METHODS.type([r.args[0], r.args[1]], name),
        doc: find(RESULT_METHODS.methods),
      };
    if (res?.sig && res.doc) return { receiver: res.receiver, sig: res.sig, doc: res.doc };
    if (name === 'to_string' && r.kind !== 'var') {
      return { receiver: 'any', sig: { fn: T.fnOf([], T.STRING) }, doc: UNIVERSAL_METHODS[0] };
    }
    return undefined;
  }

  /* ─────────────────────────── finish ─────────────────────────── */

  private finish(): CheckResult {
    for (const node of this.typedNodes) if (node.ty) this.applyDefaults(node.ty);
    for (const c of this.inferenceChecks) this.applyDefaults(c.type);

    const hasErrors = this.diagnostics.some((d) => d.severity === 'error');
    if (!hasErrors) {
      const reported = new Set<number>();
      for (const c of this.inferenceChecks) {
        const free = T.freeVars(c.type);
        if (!free.length || free.some((v) => reported.has(v.id))) continue;
        free.forEach((v) => reported.add(v.id));
        this.error(`Cannot infer ${c.what}`, c.span, c.hint);
      }
    }

    for (const node of this.typedNodes) if (node.ty) node.ty = T.resolve(node.ty);
    for (const f of this.finalizers) f();

    const symbols = this.symbolThunks.map((s) => s());
    const hovers = this.hoverThunks.map((h) => h());
    hovers.sort((a, b) => a.span.end - a.span.start - (b.span.end - b.span.start));

    this.diagnostics.sort((a, b) => a.span.start - b.span.start);
    return {
      diagnostics: this.diagnostics,
      symbols,
      hovers,
      registry: { structs: this.structs, enums: this.enums, impls: this.impls },
      membersOf: (t) => this.memberCompletions(t),
      staticMembersOf: (name) => this.staticMemberCompletions(name),
    };
  }

  private memberCompletions(t: T.Type): MemberCompletion[] {
    const p = T.prune(t);
    const out: MemberCompletion[] = [];
    if (p.kind === 'named') {
      const info = this.structs.get(p.name);
      for (const f of info?.fields ?? []) {
        out.push({ label: f.name, kind: 'field', detail: this.str(f.type) });
      }
    }
    if (p.kind === 'tuple') {
      p.elems.forEach((e, i) => out.push({ label: String(i), kind: 'field', detail: this.str(e) }));
    }
    for (const m of this.methodsOf(p)) {
      out.push({ label: m.name, kind: 'method', detail: m.signature, doc: m.doc || undefined });
    }
    return out;
  }

  private staticMemberCompletions(typeName: string): MemberCompletion[] {
    const out: MemberCompletion[] = [];
    const en = this.enums.get(typeName);
    for (const v of en?.variants ?? []) {
      out.push({
        label: v.name,
        kind: 'variant',
        detail: v.fields.length
          ? `${v.name}(${v.fields.map((f) => this.str(f)).join(', ')})`
          : v.name,
      });
    }
    for (const m of this.impls.get(typeName)?.values() ?? []) {
      if (m.hasSelf) continue;
      out.push({
        label: m.name,
        kind: 'function',
        detail: this.fnSignature(m.decl, this.fnSigs.get(m.decl)!).replace(/^fn /, ''),
      });
    }
    return out;
  }
}
