/**
 * The Lumen runtime library: the helpers that compiled programs call into.
 *
 * Calling convention: every Lumen-callable function value (user functions, lambdas,
 * builtins, variant constructors) takes the call-site id as its first argument, so that
 * runtime errors can point at the exact source location and build a call stack.
 */
import type { TypeRegistry } from './checker';
import type { Span } from './diagnostics';
import { type Type, prune } from './types';
import {
  LEnum,
  LStruct,
  LTuple,
  type MapKey,
  NONE,
  type Value,
  formatValue,
  some,
  valueEquals,
} from './values';

export interface StackFrame {
  name: string;
  span: Span;
}

export class RuntimeError extends Error {
  readonly span: Span;
  frames: StackFrame[] = [];
  constructor(message: string, span: Span) {
    super(message);
    this.span = span;
  }
}

export interface RunStats {
  calls: number;
  maxDepth: number;
}

export type LumenFn = (site: number, ...args: Value[]) => Value;

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const NO_SPAN: Span = { start: 0, end: 0 };

export interface RuntimeOptions {
  spans: Span[];
  types: Type[];
  names: string[];
  registry: TypeRegistry;
  output: (line: string) => void;
  maxDepth?: number;
}

export class Runtime {
  readonly spans: Span[];
  readonly types: Type[];
  readonly names: string[];
  readonly registry: TypeRegistry;
  readonly output: (line: string) => void;
  readonly maxDepth: number;
  readonly stats: RunStats = { calls: 0, maxDepth: 0 };
  readonly started = performance.now();

  // Call stack, kept in parallel arrays for speed.
  depth = 0;
  private readonly frameNames: number[] = [];
  private readonly frameSites: number[] = [];

  // Value constructors used by generated code.
  readonly S = LStruct;
  readonly E = LEnum;
  readonly T = LTuple;
  readonly None = NONE;

  constructor(options: RuntimeOptions) {
    this.spans = options.spans;
    this.types = options.types;
    this.names = options.names;
    this.registry = options.registry;
    this.output = options.output;
    this.maxDepth = options.maxDepth ?? 10_000;
  }

  /* ─────────────────────────── call stack ─────────────────────────── */

  enter(name: number, site: number) {
    const d = this.depth;
    if (d >= this.maxDepth) {
      this.fail(
        `Stack overflow — more than ${this.maxDepth} nested calls (is a base case missing?)`,
        site,
      );
    }
    this.frameNames[d] = name;
    this.frameSites[d] = site;
    this.depth = d + 1;
    this.stats.calls++;
    if (d + 1 > this.stats.maxDepth) this.stats.maxDepth = d + 1;
  }

  ret<V>(value: V): V {
    this.depth--;
    return value;
  }

  leave() {
    this.depth--;
  }

  span(site: number | undefined): Span {
    if (site !== undefined && this.spans[site]) return this.spans[site];
    const top = this.depth > 0 ? this.frameSites[this.depth - 1] : undefined;
    return top !== undefined ? (this.spans[top] ?? NO_SPAN) : NO_SPAN;
  }

  /** The current Lumen call stack, innermost first (collapsing repeated recursion). */
  frames(limit = 8): StackFrame[] {
    const out: StackFrame[] = [];
    for (let d = this.depth - 1; d >= 0 && out.length < limit; d--) {
      out.push({
        name: this.names[this.frameNames[d]] ?? '?',
        span: this.spans[this.frameSites[d]] ?? NO_SPAN,
      });
    }
    return out;
  }

  error(message: string, site?: number): RuntimeError {
    const err = new RuntimeError(message, this.span(site));
    err.frames = this.frames();
    return err;
  }

  fail(message: string, site?: number): never {
    throw this.error(message, site);
  }

  /* ─────────────────────────── integer arithmetic ─────────────────────────── */

  private checked(n: number, op: string, site: number): number {
    if (n > MAX_SAFE || n < -MAX_SAFE)
      this.fail(`Integer overflow: the result of '${op}' does not fit in an int`, site);
    return n;
  }

  add(a: number, b: number, site: number): number {
    return this.checked(a + b, '+', site);
  }
  sub(a: number, b: number, site: number): number {
    return this.checked(a - b, '-', site);
  }
  mul(a: number, b: number, site: number): number {
    return this.checked(a * b, '*', site);
  }
  div(a: number, b: number, site: number): number {
    if (b === 0) this.fail('Division by zero', site);
    return Math.trunc(a / b) + 0;
  }
  mod(a: number, b: number, site: number): number {
    if (b === 0) this.fail('Division by zero (modulo)', site);
    return (a % b) + 0;
  }
  pow(a: number, b: number, site: number): number {
    if (b < 0) this.fail('Negative exponent in int power — convert to float first', site);
    return this.checked(a ** b, '**', site);
  }
  f2i(x: number, site: number): number {
    if (!Number.isFinite(x)) this.fail(`Cannot convert ${x} to int`, site);
    return this.checked(Math.trunc(x) + 0, 'as int', site);
  }

  /* ─────────────────────────── values ─────────────────────────── */

  eq(a: Value, b: Value): boolean {
    return valueEquals(a, b);
  }

  fmt(value: Value, typeId: number): string {
    return formatValue(value, this.types[typeId], this.registry);
  }

  print(args: Value[], typeIds: number[]) {
    let line = '';
    for (let i = 0; i < args.length; i++) {
      if (i) line += ' ';
      line += formatValue(args[i], this.types[typeIds[i]], this.registry);
    }
    this.output(line);
  }

  idx(xs: Value[], i: number, site: number): Value {
    if (i < 0 || i >= xs.length)
      this.fail(`Index ${i} is out of bounds (length ${xs.length})`, site);
    return xs[i];
  }

  sidx(s: string, i: number, site: number): string {
    if (i < 0 || i >= s.length) this.fail(`Index ${i} is out of bounds (length ${s.length})`, site);
    return s[i];
  }

  mget(m: Map<MapKey, Value>, k: MapKey, site: number, keyType: number): Value {
    if (!m.has(k)) {
      this.fail(
        `Key ${formatValue(k, this.types[keyType], this.registry, true)} is not in the map`,
        site,
      );
    }
    return m.get(k);
  }

  setIdx(xs: Value[], i: number, v: Value, site: number) {
    if (i < 0 || i >= xs.length)
      this.fail(`Index ${i} is out of bounds (length ${xs.length})`, site);
    xs[i] = v;
  }

  range(start: number, end: number, inclusive: boolean, site: number): number[] {
    const stop = inclusive ? end + 1 : end;
    const len = Math.max(0, stop - start);
    if (len > 10_000_000) this.fail(`Range is too large to build an array (${len} elements)`, site);
    const out = new Array<number>(len);
    for (let i = 0; i < len; i++) out[i] = start + i;
    return out;
  }

  /** A snapshot to iterate over, so that mutating a collection inside its loop is safe. */
  iter(v: Value): Value[] {
    if (Array.isArray(v)) return v.slice();
    if (v instanceof Map) return [...v].map(([k, x]) => new LTuple([k, x]));
    if (typeof v === 'string') return Array.from(v);
    return [];
  }

  isFailure(v: Value): boolean {
    return !(v instanceof LEnum) || (v.variant !== 'Some' && v.variant !== 'Ok');
  }

  /* ─────────────────────────── builtin functions ─────────────────────────── */

  readonly b: Record<string, LumenFn | Value> = this.makeBuiltins();

  private makeBuiltins(): Record<string, LumenFn | Value> {
    const f = (fn: (site: number, ...args: never[]) => Value): LumenFn => fn as unknown as LumenFn;
    return {
      str: f((_s, v: Value) => formatValue(v, undefined, this.registry)),
      assert: f((s, cond: boolean, msg?: string) => {
        if (!cond)
          this.fail(msg !== undefined ? `Assertion failed: ${msg}` : 'Assertion failed', s);
        return undefined;
      }),
      panic: f((s, msg: string) => this.fail(`panic: ${msg}`, s)),
      abs: f((_s, x: number) => Math.abs(x)),
      min: f((_s, a: number, b: number) => (a <= b ? a : b)),
      max: f((_s, a: number, b: number) => (a >= b ? a : b)),
      sqrt: f((_s, x: number) => Math.sqrt(x)),
      sin: f((_s, x: number) => Math.sin(x)),
      cos: f((_s, x: number) => Math.cos(x)),
      tan: f((_s, x: number) => Math.tan(x)),
      ln: f((_s, x: number) => Math.log(x)),
      exp: f((_s, x: number) => Math.exp(x)),
      atan2: f((_s, y: number, x: number) => Math.atan2(y, x)),
      floor: f((s, x: number) => this.f2i(Math.floor(x), s)),
      ceil: f((s, x: number) => this.f2i(Math.ceil(x), s)),
      round: f((s, x: number) => this.f2i(Math.round(x), s)),
      random: f(() => Math.random()),
      random_int: f((s, lo: number, hi: number) => {
        if (hi < lo) this.fail(`random_int: max (${hi}) is smaller than min (${lo})`, s);
        return lo + Math.floor(Math.random() * (hi - lo + 1));
      }),
      parse_int: f((_s, text: string) => {
        const t = text.trim();
        if (!/^[+-]?\d+$/.test(t)) return NONE;
        const n = Number(t);
        return Number.isSafeInteger(n) ? some(n) : NONE;
      }),
      parse_float: f((_s, text: string) => {
        const t = text.trim();
        const n = Number(t);
        return t !== '' && Number.isFinite(n) ? some(n) : NONE;
      }),
      clock: f(() => performance.now() - this.started),
      Some: f((_s, v: Value) => some(v)),
      Ok: f((_s, v: Value) => new LEnum('result', 'Ok', [v])),
      Err: f((_s, v: Value) => new LEnum('result', 'Err', [v])),
      None: NONE,
      PI: Math.PI,
      E: Math.E,
    };
  }

  /** A variant constructor used as a function value, e.g. `xs.map(Shape.Circle)`. */
  ctor(enumName: string, variant: string): LumenFn {
    return (_site, ...args) => new LEnum(enumName, variant, args);
  }

  /* ─────────────────────────── builtin methods ─────────────────────────── */

  private call(fn: Value, site: number, ...args: Value[]): Value {
    return (fn as unknown as LumenFn)(site, ...args);
  }

  private clampIndex(i: number, len: number): number {
    return Math.max(0, Math.min(len, i));
  }

  private compare = (a: Value, b: Value): number =>
    (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0;

  readonly M = {
    any: {
      to_string: (recv: Value, _a: Value[], _s: number, t: number) => this.fmt(recv, t),
    },
    string: {
      len: (s: string) => s.length,
      is_empty: (s: string) => s.length === 0,
      upper: (s: string) => s.toUpperCase(),
      lower: (s: string) => s.toLowerCase(),
      trim: (s: string) => s.trim(),
      contains: (s: string, a: string[]) => s.includes(a[0]),
      starts_with: (s: string, a: string[]) => s.startsWith(a[0]),
      ends_with: (s: string, a: string[]) => s.endsWith(a[0]),
      index_of: (s: string, a: string[]) => {
        const i = s.indexOf(a[0]);
        return i < 0 ? NONE : some(i);
      },
      replace: (s: string, a: string[]) => s.split(a[0]).join(a[1]),
      split: (s: string, a: string[]) => (a[0] === '' ? Array.from(s) : s.split(a[0])),
      chars: (s: string) => Array.from(s),
      repeat: (s: string, a: number[], site: number) => {
        if (a[0] < 0) this.fail('repeat count must not be negative', site);
        return s.repeat(a[0]);
      },
      slice: (s: string, a: number[]) =>
        s.slice(this.clampIndex(a[0], s.length), this.clampIndex(a[1], s.length)),
      pad_start: (s: string, a: [number, string]) => s.padStart(a[0], a[1]),
      pad_end: (s: string, a: [number, string]) => s.padEnd(a[0], a[1]),
      reverse: (s: string) => Array.from(s).reverse().join(''),
      code: (s: string, _a: Value[], site: number) => {
        if (!s.length) this.fail('code() called on an empty string', site);
        return s.codePointAt(0)!;
      },
    },
    array: {
      len: (xs: Value[]) => xs.length,
      is_empty: (xs: Value[]) => xs.length === 0,
      push: (xs: Value[], a: Value[]) => {
        xs.push(a[0]);
        return undefined;
      },
      pop: (xs: Value[]) => (xs.length ? some(xs.pop()) : NONE),
      insert: (xs: Value[], a: Value[], site: number) => {
        const i = a[0] as number;
        if (i < 0 || i > xs.length)
          this.fail(`Index ${i} is out of bounds for insert (length ${xs.length})`, site);
        xs.splice(i, 0, a[1]);
        return undefined;
      },
      remove: (xs: Value[], a: Value[], site: number) => {
        const i = a[0] as number;
        if (i < 0 || i >= xs.length)
          this.fail(`Index ${i} is out of bounds (length ${xs.length})`, site);
        return xs.splice(i, 1)[0];
      },
      clear: (xs: Value[]) => {
        xs.length = 0;
        return undefined;
      },
      first: (xs: Value[]) => (xs.length ? some(xs[0]) : NONE),
      last: (xs: Value[]) => (xs.length ? some(xs[xs.length - 1]) : NONE),
      get: (xs: Value[], a: Value[]) => {
        const i = a[0] as number;
        return i >= 0 && i < xs.length ? some(xs[i]) : NONE;
      },
      contains: (xs: Value[], a: Value[]) => xs.some((x) => valueEquals(x, a[0])),
      index_of: (xs: Value[], a: Value[]) => {
        const i = xs.findIndex((x) => valueEquals(x, a[0]));
        return i < 0 ? NONE : some(i);
      },
      map: (xs: Value[], a: Value[], site: number) => {
        const out = new Array<Value>(xs.length);
        for (let i = 0; i < xs.length; i++) out[i] = this.call(a[0], site, xs[i]);
        return out;
      },
      filter: (xs: Value[], a: Value[], site: number) => xs.filter((x) => this.call(a[0], site, x)),
      reduce: (xs: Value[], a: Value[], site: number) => {
        let acc = a[0];
        for (const x of xs) acc = this.call(a[1], site, acc, x);
        return acc;
      },
      each: (xs: Value[], a: Value[], site: number) => {
        for (const x of xs) this.call(a[0], site, x);
        return undefined;
      },
      find: (xs: Value[], a: Value[], site: number) => {
        for (const x of xs) if (this.call(a[0], site, x)) return some(x);
        return NONE;
      },
      any: (xs: Value[], a: Value[], site: number) => xs.some((x) => this.call(a[0], site, x)),
      all: (xs: Value[], a: Value[], site: number) => xs.every((x) => this.call(a[0], site, x)),
      count: (xs: Value[], a: Value[], site: number) => {
        let n = 0;
        for (const x of xs) if (this.call(a[0], site, x)) n++;
        return n;
      },
      sort: (xs: Value[]) => xs.slice().sort(this.compare),
      sort_by: (xs: Value[], a: Value[], site: number) => {
        const keyed = xs.map((x) => ({ x, k: this.call(a[0], site, x) }));
        keyed.sort((p, q) => this.compare(p.k, q.k));
        return keyed.map((p) => p.x);
      },
      reverse: (xs: Value[]) => xs.slice().reverse(),
      slice: (xs: Value[], a: number[]) =>
        xs.slice(this.clampIndex(a[0], xs.length), this.clampIndex(a[1], xs.length)),
      concat: (xs: Value[], a: Value[][]) => xs.concat(a[0]),
      take: (xs: Value[], a: number[]) => xs.slice(0, Math.max(0, a[0])),
      skip: (xs: Value[], a: number[]) => xs.slice(Math.max(0, a[0])),
      enumerate: (xs: Value[]) => xs.map((x, i) => new LTuple([i, x])),
      zip: (xs: Value[], a: Value[][]) => {
        const ys = a[0];
        const n = Math.min(xs.length, ys.length);
        const out: Value[] = [];
        for (let i = 0; i < n; i++) out.push(new LTuple([xs[i], ys[i]]));
        return out;
      },
      join: (xs: Value[], a: string[], _site: number, t: number) => {
        const type = this.types[t] ? prune(this.types[t]) : undefined;
        const elem = type?.kind === 'array' ? type.elem : undefined;
        return xs.map((x) => formatValue(x, elem, this.registry)).join(a[0]);
      },
      sum: (xs: Value[], _a: Value[], site: number, t: number) => {
        const type = this.types[t] ? prune(this.types[t]) : undefined;
        const elem = type?.kind === 'array' ? prune(type.elem) : undefined;
        const isFloat = elem?.kind === 'prim' && elem.name === 'float';
        let total = 0;
        for (const x of xs) total += x as number;
        if (!isFloat && !Number.isSafeInteger(total)) this.fail('Integer overflow in sum()', site);
        return total;
      },
      min: (xs: Value[]) =>
        xs.length ? some(xs.reduce((p, q) => (this.compare(q, p) < 0 ? q : p))) : NONE,
      max: (xs: Value[]) =>
        xs.length ? some(xs.reduce((p, q) => (this.compare(q, p) > 0 ? q : p))) : NONE,
      flatten: (xs: Value[]) => (xs as Value[][]).flat(1),
      unique: (xs: Value[]) => {
        const out: Value[] = [];
        const seen = new Set<Value>();
        for (const x of xs) {
          if (typeof x !== 'object') {
            if (seen.has(x)) continue;
            seen.add(x);
            out.push(x);
          } else if (!out.some((y) => valueEquals(x, y))) {
            out.push(x);
          }
        }
        return out;
      },
    },
    map: {
      len: (m: Map<MapKey, Value>) => m.size,
      is_empty: (m: Map<MapKey, Value>) => m.size === 0,
      get: (m: Map<MapKey, Value>, a: Value[]) =>
        m.has(a[0] as MapKey) ? some(m.get(a[0] as MapKey)) : NONE,
      set: (m: Map<MapKey, Value>, a: Value[]) => {
        m.set(a[0] as MapKey, a[1]);
        return undefined;
      },
      has: (m: Map<MapKey, Value>, a: Value[]) => m.has(a[0] as MapKey),
      remove: (m: Map<MapKey, Value>, a: Value[]) => {
        const k = a[0] as MapKey;
        if (!m.has(k)) return NONE;
        const v = m.get(k);
        m.delete(k);
        return some(v);
      },
      keys: (m: Map<MapKey, Value>) => [...m.keys()],
      values: (m: Map<MapKey, Value>) => [...m.values()],
      entries: (m: Map<MapKey, Value>) => [...m].map(([k, v]) => new LTuple([k, v])),
      clear: (m: Map<MapKey, Value>) => {
        m.clear();
        return undefined;
      },
    },
    option: {
      is_some: (o: LEnum) => o.variant === 'Some',
      is_none: (o: LEnum) => o.variant !== 'Some',
      unwrap: (o: LEnum, _a: Value[], site: number) =>
        o.variant === 'Some' ? o.values[0] : this.fail('Called unwrap() on None', site),
      unwrap_or: (o: LEnum, a: Value[]) => (o.variant === 'Some' ? o.values[0] : a[0]),
      expect: (o: LEnum, a: Value[], site: number) =>
        o.variant === 'Some' ? o.values[0] : this.fail(String(a[0]), site),
      map: (o: LEnum, a: Value[], site: number) =>
        o.variant === 'Some' ? some(this.call(a[0], site, o.values[0])) : NONE,
    },
    result: {
      is_ok: (r: LEnum) => r.variant === 'Ok',
      is_err: (r: LEnum) => r.variant !== 'Ok',
      unwrap: (r: LEnum, _a: Value[], site: number, t: number) => {
        if (r.variant === 'Ok') return r.values[0];
        const type = this.types[t] ? prune(this.types[t]) : undefined;
        const errType = type?.kind === 'named' ? type.args[1] : undefined;
        return this.fail(
          `Called unwrap() on Err(${formatValue(r.values[0], errType, this.registry, true)})`,
          site,
        );
      },
      unwrap_or: (r: LEnum, a: Value[]) => (r.variant === 'Ok' ? r.values[0] : a[0]),
      unwrap_err: (r: LEnum, _a: Value[], site: number) =>
        r.variant === 'Ok' ? this.fail('Called unwrap_err() on Ok', site) : r.values[0],
      ok: (r: LEnum) => (r.variant === 'Ok' ? some(r.values[0]) : NONE),
      map: (r: LEnum, a: Value[], site: number) =>
        r.variant === 'Ok' ? new LEnum('result', 'Ok', [this.call(a[0], site, r.values[0])]) : r,
    },
    number: {
      abs: (n: number) => Math.abs(n),
      pow: (n: number, a: number[], site: number, t: number) => {
        const type = this.types[t] ? prune(this.types[t]) : undefined;
        return type?.kind === 'prim' && type.name === 'int' ? this.pow(n, a[0], site) : n ** a[0];
      },
      clamp: (n: number, a: number[]) => Math.min(Math.max(n, a[0]), a[1]),
      floor: (n: number, _a: Value[], site: number) => this.f2i(Math.floor(n), site),
      ceil: (n: number, _a: Value[], site: number) => this.f2i(Math.ceil(n), site),
      round: (n: number, _a: Value[], site: number) => this.f2i(Math.round(n), site),
      sqrt: (n: number) => Math.sqrt(n),
    },
  } as const;
}
