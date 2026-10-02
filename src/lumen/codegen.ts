/**
 * The Lumen code generator: compiles a type-checked AST into JavaScript.
 *
 * Lumen is expression-oriented (`if`, `match` and blocks produce values) while JavaScript
 * separates statements from expressions, so the generator *lowers* such constructs into
 * statements that assign to temporaries. Results flow through a "sink" that says what to do
 * with a value: discard it, assign it to a variable, or return it from the function.
 *
 * Every Lumen function compiles to one JavaScript function, so recursion uses one native
 * stack frame per call. Runtime checks (integer overflow, bounds, division by zero…) call
 * into the runtime library with a *site id* that maps back to the source span.
 */
import type * as A from './ast';
import type { TypeRegistry } from './checker';
import type { Span } from './diagnostics';
import { type Type, prune, typeToString } from './types';

export interface CompiledProgram {
  /** Body of a JavaScript function that takes the runtime as its only parameter, `rt`. */
  code: string;
  spans: Span[];
  types: Type[];
  /** Display names of compiled functions, used for stack traces. */
  names: string[];
  /** Generated variable name → original Lumen name and declaration site. */
  bindings: Record<string, { name: string; span: Span }>;
}

type Sink = { kind: 'discard' } | { kind: 'assign'; target: string } | { kind: 'return' };

const DISCARD: Sink = { kind: 'discard' };
const RETURN: Sink = { kind: 'return' };

const SIMPLE = /^(\$t\d+|-?\d+(\.\d+)?(e[+-]?\d+)?|"(?:[^"\\]|\\.)*"|true|false|undefined)$/;

class Scope {
  readonly names = new Map<string, string>();
  readonly parent: Scope | null;
  constructor(parent: Scope | null) {
    this.parent = parent;
  }
  lookup(name: string): string | undefined {
    return this.names.get(name) ?? this.parent?.lookup(name);
  }
}

const isPrimType = (t: Type | undefined) => !!t && prune(t).kind === 'prim';

/** Names that cannot be used for generated bindings as-is. */
const RESERVED: ReadonlySet<string> = new Set(
  (
    'break case catch class const continue debugger default delete do else enum export extends false ' +
    'finally for function if import in instanceof let new null return super switch this throw true try ' +
    'typeof var void while with yield await static implements interface package private protected public ' +
    'arguments eval undefined NaN Infinity globalThis rt'
  ).split(' '),
);

/** Wraps an expression in parentheses unless it already is fully parenthesized. */
function paren(code: string): string {
  if (code.startsWith('(') && code.endsWith(')')) {
    let depth = 0;
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
      if (depth === 0 && i < code.length - 1) return `(${code})`;
    }
    return code;
  }
  return `(${code})`;
}

export class Codegen {
  private out: string[] = [];
  private level = 0;
  private scope = new Scope(null);
  private readonly counters = new Map<string, number>();
  private temps = 0;
  private labels = 0;
  private readonly spans: Span[] = [];
  private readonly spanIds = new Map<string, number>();
  private readonly types: Type[] = [];
  private readonly typeIds = new Map<string, number>();
  private readonly names: string[] = [];
  private readonly bindings: Record<string, { name: string; span: Span }> = {};
  private readonly methods = new Map<string, string>();

  private readonly registry: TypeRegistry;

  private constructor(registry: TypeRegistry) {
    this.registry = registry;
  }

  static generate(program: A.Program, registry: TypeRegistry): CompiledProgram {
    return new Codegen(registry).run(program);
  }

  private run(program: A.Program): CompiledProgram {
    this.emit('"use strict";');
    // Method names are reserved up front so calls can reference them from anywhere;
    // their bodies are emitted where the impl block appears (JS hoists them).
    for (const s of program.body) {
      if (s.kind !== 'ImplDecl') continue;
      for (const m of s.methods)
        this.methods.set(`${s.typeName}.${m.name}`, this.fresh(`${s.typeName}_${m.name}`));
    }
    this.genStatements(program.body, DISCARD);
    return {
      code: this.out.join('\n'),
      spans: this.spans,
      types: this.types,
      names: this.names,
      bindings: this.bindings,
    };
  }

  /* ─────────────────────────── emission helpers ─────────────────────────── */

  private emit(line: string) {
    this.out.push(line ? '  '.repeat(this.level) + line : '');
  }

  private block(open: string, body: () => void, close = '}') {
    this.emit(open);
    this.level++;
    body();
    this.level--;
    this.emit(close);
  }

  private capture<T>(fn: () => T): { value: T; lines: string[] } {
    const saved = this.out;
    this.out = [];
    try {
      const value = fn();
      return { value, lines: this.out };
    } finally {
      this.out = saved;
    }
  }

  private temp(): string {
    return `$t${++this.temps}`;
  }

  /** A unique JavaScript name. The first use keeps the Lumen name when that is safe. */
  private fresh(name: string): string {
    const n = (this.counters.get(name) ?? 0) + 1;
    this.counters.set(name, n);
    return n === 1 && !RESERVED.has(name) ? name : `${name}$${n}`;
  }

  private withScope<T>(fn: () => T): T {
    const saved = this.scope;
    this.scope = new Scope(saved);
    try {
      return fn();
    } finally {
      this.scope = saved;
    }
  }

  private declare(name: string, span: Span): string {
    const js = this.fresh(name);
    this.scope.names.set(name, js);
    this.bindings[js] = { name, span };
    return js;
  }

  private site(span: Span): number {
    const key = `${span.start}:${span.end}`;
    let id = this.spanIds.get(key);
    if (id === undefined) {
      id = this.spans.length;
      this.spans.push(span);
      this.spanIds.set(key, id);
    }
    return id;
  }

  private typeId(t: Type | undefined): number {
    if (!t) return -1;
    const key = typeToString(t);
    let id = this.typeIds.get(key);
    if (id === undefined) {
      id = this.types.length;
      this.types.push(t);
      this.typeIds.set(key, id);
    }
    return id;
  }

  private nameId(name: string): number {
    this.names.push(name);
    return this.names.length - 1;
  }

  /** Applies a sink to an already computed JavaScript expression. */
  private sinkValue(value: string, sink: Sink) {
    switch (sink.kind) {
      case 'discard':
        if (!SIMPLE.test(value) && !/^\$?[\w$]+$/.test(value)) this.emit(`${value};`);
        break;
      case 'assign':
        this.emit(`${sink.target} = ${value};`);
        break;
      case 'return':
        this.emit(`return rt.ret(${value});`);
        break;
    }
  }

  /**
   * Generates a list of expressions that must be evaluated left to right. If a later
   * expression needs statements, earlier results are stored in temporaries first.
   */
  private genList(exprs: A.Expr[]): string[] {
    const parts = exprs.map((e) => this.capture(() => this.genExpr(e)));
    let last = -1;
    parts.forEach((p, i) => {
      if (p.lines.length) last = i;
    });
    return parts.map((p, i) => {
      this.out.push(...p.lines);
      if (i < last && !SIMPLE.test(p.value)) {
        const t = this.temp();
        this.emit(`const ${t} = ${p.value};`);
        return t;
      }
      return p.value;
    });
  }

  /* ─────────────────────────── statements ─────────────────────────── */

  /** Emits a statement list; a tail expression (no `;`) goes into `sink`. */
  private genStatements(stmts: A.Stmt[], sink: Sink): boolean {
    // Functions are hoisted: their names are visible in the whole block.
    const fnNames = new Map<A.FnDecl, string>();
    for (const s of stmts)
      if (s.kind === 'FnDecl') fnNames.set(s, this.declare(s.name, s.nameSpan));
    let hasTail = false;
    stmts.forEach((stmt, i) => {
      const isTail =
        sink.kind !== 'discard' && i === stmts.length - 1 && stmt.kind === 'ExprStmt' && !stmt.semi;
      if (isTail) {
        hasTail = true;
        this.genInto(stmt.expr, sink);
      } else if (stmt.kind === 'FnDecl') {
        this.genFunctionDecl(stmt, fnNames.get(stmt)!, stmt.name);
      } else if (stmt.kind === 'ImplDecl') {
        for (const m of stmt.methods) {
          this.emit(`// ${stmt.typeName}.${m.name}`);
          this.genFunctionDecl(
            m,
            this.methods.get(`${stmt.typeName}.${m.name}`)!,
            `${stmt.typeName}.${m.name}`,
          );
        }
      } else {
        this.genStmt(stmt);
      }
    });
    return hasTail;
  }

  private genBlock(block: A.Block, sink: Sink): boolean {
    return this.withScope(() => this.genStatements(block.stmts, sink));
  }

  private genStmt(stmt: A.Stmt) {
    switch (stmt.kind) {
      case 'Let':
        return this.genLet(stmt);
      case 'Assign':
        return this.genAssign(stmt);
      case 'ExprStmt':
        return this.genInto(stmt.expr, DISCARD);
      case 'Return':
        if (stmt.value) this.genInto(stmt.value, RETURN);
        else this.emit('return rt.ret(undefined);');
        return;
      case 'Break':
        return this.emit('break;');
      case 'Continue':
        return this.emit('continue;');
      case 'While':
        return this.genWhile(stmt);
      case 'For':
        return this.genFor(stmt);
      case 'Loop':
        return this.block('while (true) {', () => this.genBlock(stmt.body, DISCARD));
      case 'FnDecl':
      case 'ImplDecl':
      case 'StructDecl':
      case 'EnumDecl':
      case 'TypeAlias':
        return;
    }
  }

  private genLet(stmt: A.LetStmt) {
    const p = stmt.pattern;
    const keyword = stmt.mutable ? 'let' : 'const';
    if (p.kind === 'BindingPattern') {
      const init = stmt.init;
      if (
        init.kind === 'If' ||
        init.kind === 'IfLet' ||
        init.kind === 'Match' ||
        init.kind === 'Block'
      ) {
        // Lower to statements that assign the new variable directly.
        const target = this.fresh(p.name);
        this.emit(`let ${target};`);
        this.genInto(init, { kind: 'assign', target });
        this.scope.names.set(p.name, target);
        this.bindings[target] = { name: p.name, span: p.span };
        return;
      }
      const value = this.genExpr(init);
      const js = this.declare(p.name, p.span);
      this.emit(`${keyword} ${js} = ${value};`);
      return;
    }
    const value = this.genExpr(stmt.init);
    if (p.kind === 'WildcardPattern') {
      this.sinkValue(value, DISCARD);
      return;
    }
    const t = this.temp();
    this.emit(`const ${t} = ${value};`);
    for (const line of this.patternBindings(p, t, keyword)) this.emit(line);
  }

  private genAssign(stmt: A.AssignStmt) {
    const target = stmt.target;
    const site = this.site(stmt.span);
    const combine = (current: string, value: string) => {
      if (stmt.op === '=') return value;
      return this.arith(
        stmt.op.slice(0, -1) as A.BinaryOp,
        current,
        value,
        stmt.operandKind ?? 'other',
        site,
      );
    };
    if (target.kind === 'Ident') {
      const js = this.scope.lookup(target.name) ?? target.name;
      const value = this.genExpr(stmt.value);
      this.emit(`${js} = ${combine(js, value)};`);
      return;
    }
    if (target.kind === 'Member') {
      const [obj, value] = this.genList([target.object, stmt.value]);
      if (stmt.op === '=') {
        this.emit(`${obj}.fields.${target.name} = ${value};`);
      } else {
        const o = this.temp();
        this.emit(`const ${o} = ${obj};`);
        this.emit(`${o}.fields.${target.name} = ${combine(`${o}.fields.${target.name}`, value)};`);
      }
      return;
    }
    const [container, index, value] = this.genList([target.object, target.index, stmt.value]);
    const indexSite = this.site(target.index.span);
    if (target.container === 'map') {
      if (stmt.op === '=') {
        this.emit(`${container}.set(${index}, ${value});`);
      } else {
        const c = this.temp();
        const k = this.temp();
        this.emit(`const ${c} = ${container}, ${k} = ${index};`);
        const current = `rt.mget(${c}, ${k}, ${indexSite}, ${this.typeId(target.index.ty)})`;
        this.emit(`${c}.set(${k}, ${combine(current, value)});`);
      }
      return;
    }
    if (stmt.op === '=') {
      this.emit(`rt.setIdx(${container}, ${index}, ${value}, ${indexSite});`);
    } else {
      const c = this.temp();
      const k = this.temp();
      this.emit(`const ${c} = ${container}, ${k} = ${index};`);
      this.emit(
        `rt.setIdx(${c}, ${k}, ${combine(`rt.idx(${c}, ${k}, ${indexSite})`, value)}, ${indexSite});`,
      );
    }
  }

  private genWhile(stmt: A.WhileStmt) {
    const cond = this.capture(() => this.genExpr(stmt.cond));
    if (!cond.lines.length) {
      this.block(`while ${paren(cond.value)} {`, () => this.genBlock(stmt.body, DISCARD));
      return;
    }
    this.block('while (true) {', () => {
      this.out.push(...cond.lines.map((l) => `  ${l}`));
      this.emit(`if (!(${cond.value})) break;`);
      this.genBlock(stmt.body, DISCARD);
    });
  }

  private genFor(stmt: A.ForStmt) {
    const p = stmt.pattern;
    if (stmt.iterKind === 'range' && stmt.iterable.kind === 'Range') {
      const r = stmt.iterable;
      const [start, end] = this.genList([r.start, r.end]);
      const endTemp = this.temp();
      this.withScope(() => {
        const v = p.kind === 'BindingPattern' ? this.declare(p.name, p.span) : this.temp();
        this.block(
          `for (let ${v} = ${start}, ${endTemp} = ${end}; ${v} ${r.inclusive ? '<=' : '<'} ${endTemp}; ${v}++) {`,
          () => this.genBlock(stmt.body, DISCARD),
        );
      });
      return;
    }
    const iterable = this.genExpr(stmt.iterable);
    this.withScope(() => {
      if (p.kind === 'BindingPattern') {
        const v = this.declare(p.name, p.span);
        this.block(`for (const ${v} of rt.iter(${iterable})) {`, () =>
          this.genBlock(stmt.body, DISCARD),
        );
        return;
      }
      const item = this.temp();
      this.block(`for (const ${item} of rt.iter(${iterable})) {`, () => {
        for (const line of this.patternBindings(p, item, 'const')) this.emit(line);
        this.genBlock(stmt.body, DISCARD);
      });
    });
  }

  /* ─────────────────────────── functions ─────────────────────────── */

  private genFunctionDecl(decl: A.FnDecl, jsName: string, displayName: string) {
    this.withScope(() => {
      const params = [
        '$site',
        ...decl.params.map((p) => this.declare(p.isSelf ? 'self' : p.name, p.span)),
      ];
      this.block(`function ${jsName}(${params.join(', ')}) {`, () =>
        this.genFunctionBody(decl.body, displayName),
      );
    });
  }

  private genFunctionBody(body: A.Expr, displayName: string) {
    this.emit(`rt.enter(${this.nameId(displayName)}, $site);`);
    if (body.kind === 'Block') this.genBlock(body, RETURN);
    else this.genInto(body, RETURN);
    // Reached only when the body falls through without returning a value.
    if (!this.endsWithReturn()) this.emit('rt.leave();');
  }

  private endsWithReturn(): boolean {
    const last = this.out[this.out.length - 1]?.trim() ?? '';
    return last.startsWith('return ');
  }

  private genLambda(e: A.Lambda): string {
    const { lines } = this.capture(() =>
      this.withScope(() => {
        const params = ['$site', ...e.params.map((p) => this.declare(p.name, p.span))];
        this.block(`(${params.join(', ')}) => {`, () => this.genFunctionBody(e.body, 'lambda'));
      }),
    );
    // Re-indent the lambda so it reads naturally where it is used.
    const indent = '  '.repeat(this.level);
    const text = lines
      .map((l, i) => (i === 0 ? l.trimStart() : l.startsWith(indent) ? l.slice(indent.length) : l))
      .join('\n' + indent);
    return `(${text})`;
  }

  /* ─────────────────────────── expressions into sinks ─────────────────────────── */

  /** Generates an expression whose value goes into `sink` (lowering control flow). */
  private genInto(e: A.Expr, sink: Sink) {
    switch (e.kind) {
      case 'If':
      case 'IfLet':
        return this.genIfInto(e, sink);
      case 'Match':
        return this.genMatchInto(e, sink);
      case 'Block':
        if (e.stmts.length === 0) return this.sinkValue('undefined', sink);
        this.block('{', () => this.genBlock(e, sink));
        return;
      default:
        this.sinkValue(this.genExpr(e), sink);
    }
  }

  private genBranchInto(branch: A.Block | A.If | A.IfLet, sink: Sink) {
    if (branch.kind === 'Block') this.genBlock(branch, sink);
    else this.genIfInto(branch, sink);
  }

  private genIfInto(e: A.If | A.IfLet, sink: Sink) {
    if (e.kind === 'If') {
      const cond = this.genExpr(e.cond);
      this.emit(`if ${paren(cond)} {`);
      this.level++;
      this.genBlock(e.then, sink);
    } else {
      const subject = this.temp();
      this.emit(`const ${subject} = ${this.genExpr(e.value)};`);
      const test = this.patternTest(e.pattern, subject);
      this.emit(`if (${test || 'true'}) {`);
      this.level++;
      this.withScope(() => {
        for (const line of this.patternBindings(e.pattern, subject, 'const')) this.emit(line);
        this.genBlock(e.then, sink);
      });
    }
    this.level--;
    if (e.else) {
      this.emit('} else {');
      this.level++;
      this.genBranchInto(e.else, sink);
      this.level--;
    }
    this.emit('}');
  }

  private genMatchInto(e: A.Match, sink: Sink) {
    const subject = this.temp();
    this.emit(`const ${subject} = ${this.genExpr(e.subject)};`);
    const label = `$match${++this.labels}`;
    this.block(`${label}: {`, () => {
      for (const arm of e.arms) {
        const test = this.patternTest(arm.pattern, subject);
        this.block(`if (${test || 'true'}) {`, () =>
          this.withScope(() => {
            for (const line of this.patternBindings(arm.pattern, subject, 'const')) this.emit(line);
            const body = () => {
              this.genInto(arm.body, sink);
              if (!this.endsWithReturn()) this.emit(`break ${label};`);
            };
            if (arm.guard) {
              const guard = this.genExpr(arm.guard);
              this.block(`if ${paren(guard)} {`, body);
            } else {
              body();
            }
          }),
        );
      }
      this.emit(`rt.fail("No match arm matched the value", ${this.site(e.span)});`);
    });
  }

  /* ─────────────────────────── patterns ─────────────────────────── */

  /** A JavaScript condition that is true when `subject` matches the pattern ('' = always). */
  private patternTest(p: A.Pattern, subject: string): string {
    switch (p.kind) {
      case 'WildcardPattern':
      case 'BindingPattern':
        return '';
      case 'LiteralPattern':
        return `${subject} === ${JSON.stringify(p.value)}`;
      case 'RangePattern':
        return `${subject} >= ${p.start} && ${subject} ${p.inclusive ? '<=' : '<'} ${p.end}`;
      case 'TuplePattern':
        return p.elems
          .map((el, i) => this.patternTest(el, `${subject}.items[${i}]`))
          .filter(Boolean)
          .join(' && ');
      case 'VariantPattern': {
        const parts = [`${subject}.variant === ${JSON.stringify(p.variant)}`];
        p.args.forEach((a, i) => {
          const t = this.patternTest(a, `${subject}.values[${i}]`);
          if (t) parts.push(t);
        });
        return parts.join(' && ');
      }
      case 'OrPattern': {
        const alts = p.alternatives.map((alt) => this.patternTest(alt, subject));
        if (alts.some((a) => a === '')) return '';
        return `(${alts.map((a) => `(${a})`).join(' || ')})`;
      }
    }
  }

  /** Declarations binding the pattern's names to parts of `subject`. */
  private patternBindings(p: A.Pattern, subject: string, keyword: 'const' | 'let'): string[] {
    switch (p.kind) {
      case 'BindingPattern':
        return [`${keyword} ${this.declare(p.name, p.span)} = ${subject};`];
      case 'TuplePattern':
        return p.elems.flatMap((el, i) =>
          this.patternBindings(el, `${subject}.items[${i}]`, keyword),
        );
      case 'VariantPattern':
        return p.args.flatMap((a, i) =>
          this.patternBindings(a, `${subject}.values[${i}]`, keyword),
        );
      default:
        return [];
    }
  }

  /* ─────────────────────────── expressions ─────────────────────────── */

  private genExpr(e: A.Expr): string {
    switch (e.kind) {
      case 'IntLit':
      case 'FloatLit':
        return e.value < 0 || Object.is(e.value, -0) ? `(${e.value})` : String(e.value);
      case 'StringLit':
        return JSON.stringify(e.value);
      case 'BoolLit':
        return String(e.value);
      case 'TemplateLit':
        return this.genTemplate(e);
      case 'Ident':
        return this.scope.lookup(e.name) ?? `rt.b.${e.name}`;
      case 'SelfExpr':
        return this.scope.lookup('self') ?? 'undefined';
      case 'ArrayLit':
        return `[${this.genList(e.elements).join(', ')}]`;
      case 'MapLit': {
        const flat = this.genList(e.entries.flatMap((en) => [en.key, en.value]));
        const pairs: string[] = [];
        for (let i = 0; i < flat.length; i += 2) pairs.push(`[${flat[i]}, ${flat[i + 1]}]`);
        return `new Map([${pairs.join(', ')}])`;
      }
      case 'TupleLit':
        return `new rt.T([${this.genList(e.elements).join(', ')}])`;
      case 'StructLit':
        return this.genStruct(e);
      case 'Unary': {
        const v = this.genExpr(e.operand);
        return e.op === '!' ? `!${v}` : `(-${v})`;
      }
      case 'Binary':
        return this.genBinary(e);
      case 'Range': {
        const [s, end] = this.genList([e.start, e.end]);
        return `rt.range(${s}, ${end}, ${e.inclusive}, ${this.site(e.span)})`;
      }
      case 'Cast': {
        const v = this.genExpr(e.expr);
        return e.conversion === 'float->int' ? `rt.f2i(${v}, ${this.site(e.span)})` : v;
      }
      case 'Call':
        return this.genCall(e);
      case 'Member':
        return this.genMember(e);
      case 'Index': {
        const [obj, idx] = this.genList([e.object, e.index]);
        const site = this.site(e.index.span);
        if (e.container === 'map')
          return `rt.mget(${obj}, ${idx}, ${site}, ${this.typeId(e.index.ty)})`;
        if (e.container === 'string') return `rt.sidx(${obj}, ${idx}, ${site})`;
        return `rt.idx(${obj}, ${idx}, ${site})`;
      }
      case 'Try': {
        const t = this.temp();
        this.emit(`const ${t} = ${this.genExpr(e.expr)};`);
        this.emit(`if (rt.isFailure(${t})) return rt.ret(${t});`);
        return `${t}.values[0]`;
      }
      case 'Pipe':
        return this.genExpr(e.desugared!);
      case 'Lambda':
        return this.genLambda(e);
      case 'If':
        return this.genIfExpr(e);
      case 'IfLet':
      case 'Match':
      case 'Block': {
        const t = this.temp();
        this.emit(`let ${t};`);
        this.genInto(e, { kind: 'assign', target: t });
        return t;
      }
    }
  }

  private genIfExpr(e: A.If): string {
    const single = (b: A.Block | A.If | A.IfLet | undefined) =>
      b?.kind === 'Block' &&
      b.stmts.length === 1 &&
      b.stmts[0].kind === 'ExprStmt' &&
      !b.stmts[0].semi
        ? b.stmts[0].expr
        : undefined;
    const thenExpr = single(e.then);
    const elseExpr = single(e.else);
    if (thenExpr && elseExpr) {
      const cond = this.capture(() => this.genExpr(e.cond));
      const a = this.capture(() => this.genExpr(thenExpr));
      const b = this.capture(() => this.genExpr(elseExpr));
      if (!a.lines.length && !b.lines.length) {
        this.out.push(...cond.lines);
        return `(${cond.value} ? ${a.value} : ${b.value})`;
      }
    }
    const t = this.temp();
    this.emit(`let ${t};`);
    this.genIfInto(e, { kind: 'assign', target: t });
    return t;
  }

  private genTemplate(e: A.TemplateLit): string {
    const exprs = e.parts.filter((p): p is A.Expr => typeof p !== 'string');
    const values = this.genList(exprs);
    let k = 0;
    const pieces = e.parts.map((part) => {
      if (typeof part === 'string') return JSON.stringify(part);
      const v = values[k++];
      const t = part.ty ? prune(part.ty) : undefined;
      return t?.kind === 'prim' && t.name === 'string'
        ? v
        : `rt.fmt(${v}, ${this.typeId(part.ty)})`;
    });
    if (pieces.length === 0) return '""';
    return pieces.length === 1 ? pieces[0] : `(${pieces.join(' + ')})`;
  }

  private genStruct(e: A.StructLit): string {
    const declared =
      this.registry.structs.get(e.name)?.fields.map((f) => f.name) ?? e.fields.map((f) => f.name);
    const sameOrder = e.fields.every((f, i) => f.name === declared[i]);
    let values = this.genList(e.fields.map((f) => f.value));
    if (!sameOrder) {
      // Evaluate in source order, but store fields in declaration order.
      values = values.map((v) => {
        if (SIMPLE.test(v)) return v;
        const t = this.temp();
        this.emit(`const ${t} = ${v};`);
        return t;
      });
    }
    const byName = new Map(e.fields.map((f, i) => [f.name, values[i]]));
    const props = declared.filter((n) => byName.has(n)).map((n) => `${n}: ${byName.get(n)}`);
    return `new rt.S(${JSON.stringify(e.name)}, { ${props.join(', ')} })`;
  }

  private arith(op: A.BinaryOp, l: string, r: string, kind: string, site: number): string {
    if (kind === 'int') {
      const fn = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod', '**': 'pow' }[
        op as string
      ];
      if (fn) return `rt.${fn}(${l}, ${r}, ${site})`;
    }
    return `(${l} ${op} ${r})`;
  }

  private genBinary(e: A.Binary): string {
    const op = e.op;
    if (op === '&&' || op === '||' || op === '??') return this.genShortCircuit(e);
    const [l, r] = this.genList([e.left, e.right]);
    switch (op) {
      case '==':
        return isPrimType(e.left.ty) ? `(${l} === ${r})` : `rt.eq(${l}, ${r})`;
      case '!=':
        return isPrimType(e.left.ty) ? `(${l} !== ${r})` : `!rt.eq(${l}, ${r})`;
      case '<':
      case '<=':
      case '>':
      case '>=':
        return `(${l} ${op} ${r})`;
      default:
        return this.arith(op, l, r, e.operandKind ?? 'other', this.site(e.span));
    }
  }

  private genShortCircuit(e: A.Binary): string {
    const l = this.genExpr(e.left);
    const r = this.capture(() => this.genExpr(e.right));
    if (e.op !== '??' && !r.lines.length) return `(${l} ${e.op} ${r.value})`;
    const t = this.temp();
    if (e.op === '??') {
      if (!r.lines.length) {
        this.emit(`let ${t};`);
        return `((${t} = ${l}).variant === "Some" ? ${t}.values[0] : ${r.value})`;
      }
      this.emit(`let ${t} = ${l};`);
      this.block(
        `if (${t}.variant === "Some") {`,
        () => this.emit(`${t} = ${t}.values[0];`),
        '} else {',
      );
      this.level++;
      this.out.push(...r.lines.map((line) => `  ${line}`));
      this.emit(`${t} = ${r.value};`);
      this.level--;
      this.emit('}');
      return t;
    }
    this.emit(`let ${t} = ${l};`);
    this.block(`if (${e.op === '&&' ? t : `!${t}`}) {`, () => {
      this.out.push(...r.lines.map((line) => `  ${line}`));
      this.emit(`${t} = ${r.value};`);
    });
    return t;
  }

  private genMember(e: A.Member): string {
    if (e.access === 'variant') {
      const enumName = JSON.stringify(e.enumName);
      const variant = JSON.stringify(e.name);
      const t = e.ty ? prune(e.ty) : undefined;
      return t?.kind === 'fn'
        ? `rt.ctor(${enumName}, ${variant})`
        : `new rt.E(${enumName}, ${variant}, [])`;
    }
    const obj = this.genExpr(e.object);
    if (e.access === 'tuple') return `${obj}.items[${e.name}]`;
    return `${obj}.fields.${e.name}`;
  }

  private genCall(e: A.Call): string {
    const target = e.target ?? { kind: 'value' as const };
    const site = this.site(e.span);
    const callee = e.callee;

    if (target.kind === 'value') {
      if (callee.kind === 'Ident' && !this.scope.lookup(callee.name)) {
        // Prelude builtins with compile-time knowledge.
        switch (callee.name) {
          case 'print': {
            const args = this.genList(e.args);
            return `rt.print([${args.join(', ')}], [${e.args.map((a) => this.typeId(a.ty)).join(', ')}])`;
          }
          case 'str': {
            const [v] = this.genList(e.args);
            return `rt.fmt(${v}, ${this.typeId(e.args[0]?.ty)})`;
          }
          case 'type_of': {
            const [v] = this.genList(e.args);
            const text = JSON.stringify(e.args[0]?.ty ? typeToString(e.args[0].ty) : 'unknown');
            return SIMPLE.test(v) || /^[\w$]+$/.test(v) ? text : `(${v}, ${text})`;
          }
        }
      }
      const [fn, ...args] = this.genList([callee, ...e.args]);
      return `${fn}(${[site, ...args].join(', ')})`;
    }

    const member = callee as A.Member;
    switch (target.kind) {
      case 'variant':
        return `new rt.E(${JSON.stringify(target.enumName)}, ${JSON.stringify(target.variant)}, [${this.genList(e.args).join(', ')}])`;
      case 'static': {
        const fn = this.methods.get(`${target.typeName}.${member.name}`);
        return `${fn}(${[site, ...this.genList(e.args)].join(', ')})`;
      }
      case 'method': {
        const fn = this.methods.get(`${target.typeName}.${member.name}`);
        const [recv, ...args] = this.genList([member.object, ...e.args]);
        return `${fn}(${[site, recv, ...args].join(', ')})`;
      }
      case 'builtin-method': {
        const [recv, ...args] = this.genList([member.object, ...e.args]);
        return `rt.M.${target.receiver}.${target.name}(${recv}, [${args.join(', ')}], ${site}, ${this.typeId(member.object.ty)})`;
      }
    }
  }
}
