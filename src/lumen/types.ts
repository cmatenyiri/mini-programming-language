/**
 * Lumen's type representation.
 *
 * Inference uses mutable type variables (`TVar`) that are bound during unification,
 * Hindley–Milner style. A type variable may carry a *constraint* — a set of primitive
 * types it is allowed to become (e.g. numbers for `+`).
 */

export type PrimName = 'int' | 'float' | 'bool' | 'string' | 'void';

export interface TPrim {
  kind: 'prim';
  name: PrimName;
}
export interface TArray {
  kind: 'array';
  elem: Type;
}
export interface TMap {
  kind: 'map';
  key: Type;
  value: Type;
}
export interface TTuple {
  kind: 'tuple';
  elems: Type[];
}
export interface TFn {
  kind: 'fn';
  params: Type[];
  ret: Type;
}
/** Structs, enums and the builtin `option` / `result` types. */
export interface TNamed {
  kind: 'named';
  name: string;
  args: Type[];
}
export interface TVar {
  kind: 'var';
  id: number;
  ref?: Type;
  constraint?: Constraint;
}
/** A rigid, user-declared generic parameter (`T` in `fn id<T>(x: T) -> T`). */
export interface TParam {
  kind: 'param';
  name: string;
  id: number;
}
/** The type of expressions that never produce a value (`return`, `panic`, `break`). */
export interface TNever {
  kind: 'never';
}

export type Type = TPrim | TArray | TMap | TTuple | TFn | TNamed | TVar | TParam | TNever;

export interface Constraint {
  /** Human-readable name used in error messages. */
  label: string;
  allowed: ReadonlySet<PrimName>;
}

const constraint = (label: string, ...allowed: PrimName[]): Constraint => ({
  label,
  allowed: new Set(allowed),
});

export const NUMERIC = constraint('a number (int or float)', 'int', 'float');
export const ADDABLE = constraint('int, float or string', 'int', 'float', 'string');
export const ORDERED = constraint(
  'a comparable type (int, float or string)',
  'int',
  'float',
  'string',
);
export const HASHABLE = constraint(
  'a map key type (int, float, string or bool)',
  'int',
  'float',
  'string',
  'bool',
);

export const INT: TPrim = { kind: 'prim', name: 'int' };
export const FLOAT: TPrim = { kind: 'prim', name: 'float' };
export const BOOL: TPrim = { kind: 'prim', name: 'bool' };
export const STRING: TPrim = { kind: 'prim', name: 'string' };
export const VOID: TPrim = { kind: 'prim', name: 'void' };
export const NEVER: TNever = { kind: 'never' };

export const PRIMS: Record<PrimName, TPrim> = {
  int: INT,
  float: FLOAT,
  bool: BOOL,
  string: STRING,
  void: VOID,
};

export const arrayOf = (elem: Type): TArray => ({ kind: 'array', elem });
export const mapOf = (key: Type, value: Type): TMap => ({ kind: 'map', key, value });
export const tupleOf = (elems: Type[]): TTuple => ({ kind: 'tuple', elems });
export const fnOf = (params: Type[], ret: Type): TFn => ({ kind: 'fn', params, ret });
export const named = (name: string, args: Type[] = []): TNamed => ({ kind: 'named', name, args });
export const optionOf = (inner: Type): TNamed => named('option', [inner]);
export const resultOf = (ok: Type, err: Type): TNamed => named('result', [ok, err]);

let nextId = 1;
export const freshVar = (c?: Constraint): TVar => ({ kind: 'var', id: nextId++, constraint: c });
export const freshParam = (name: string): TParam => ({ kind: 'param', name, id: nextId++ });

/** Follows bound type variables to the representative type. */
export function prune(t: Type): Type {
  while (t.kind === 'var' && t.ref) {
    // Path compression keeps chains short.
    if (t.ref.kind === 'var' && t.ref.ref) t.ref = t.ref.ref;
    t = t.ref;
  }
  return t;
}

/** Fully resolves a type, replacing bound variables by what they point to. */
export function resolve(t: Type): Type {
  t = prune(t);
  switch (t.kind) {
    case 'array':
      return arrayOf(resolve(t.elem));
    case 'map':
      return mapOf(resolve(t.key), resolve(t.value));
    case 'tuple':
      return tupleOf(t.elems.map(resolve));
    case 'fn':
      return fnOf(t.params.map(resolve), resolve(t.ret));
    case 'named':
      return t.args.length ? named(t.name, t.args.map(resolve)) : t;
    default:
      return t;
  }
}

export function occurs(v: TVar, t: Type): boolean {
  t = prune(t);
  if (t === v) return true;
  switch (t.kind) {
    case 'array':
      return occurs(v, t.elem);
    case 'map':
      return occurs(v, t.key) || occurs(v, t.value);
    case 'tuple':
      return t.elems.some((e) => occurs(v, e));
    case 'fn':
      return t.params.some((p) => occurs(v, p)) || occurs(v, t.ret);
    case 'named':
      return t.args.some((a) => occurs(v, a));
    default:
      return false;
  }
}

export function hasUnresolved(t: Type): boolean {
  t = prune(t);
  switch (t.kind) {
    case 'var':
      return true;
    case 'array':
      return hasUnresolved(t.elem);
    case 'map':
      return hasUnresolved(t.key) || hasUnresolved(t.value);
    case 'tuple':
      return t.elems.some(hasUnresolved);
    case 'fn':
      return t.params.some(hasUnresolved) || hasUnresolved(t.ret);
    case 'named':
      return t.args.some(hasUnresolved);
    default:
      return false;
  }
}

/** Collects unbound type variables in `t`. */
export function freeVars(t: Type, out: TVar[] = []): TVar[] {
  t = prune(t);
  switch (t.kind) {
    case 'var':
      if (!out.includes(t)) out.push(t);
      break;
    case 'array':
      freeVars(t.elem, out);
      break;
    case 'map':
      freeVars(t.key, out);
      freeVars(t.value, out);
      break;
    case 'tuple':
      t.elems.forEach((e) => freeVars(e, out));
      break;
    case 'fn':
      t.params.forEach((p) => freeVars(p, out));
      freeVars(t.ret, out);
      break;
    case 'named':
      t.args.forEach((a) => freeVars(a, out));
      break;
  }
  return out;
}

/** Replaces generic parameters (by id) with the given types. */
export function substitute(t: Type, map: ReadonlyMap<number, Type>): Type {
  if (map.size === 0) return t;
  t = prune(t);
  switch (t.kind) {
    case 'param':
      return map.get(t.id) ?? t;
    case 'array':
      return arrayOf(substitute(t.elem, map));
    case 'map':
      return mapOf(substitute(t.key, map), substitute(t.value, map));
    case 'tuple':
      return tupleOf(t.elems.map((e) => substitute(e, map)));
    case 'fn':
      return fnOf(
        t.params.map((p) => substitute(p, map)),
        substitute(t.ret, map),
      );
    case 'named':
      return t.args.length
        ? named(
            t.name,
            t.args.map((a) => substitute(a, map)),
          )
        : t;
    default:
      return t;
  }
}

/* ─────────────────────────── printing ─────────────────────────── */

export function typeToString(t: Type, names: Map<number, string> = new Map()): string {
  t = prune(t);
  switch (t.kind) {
    case 'prim':
      return t.name;
    case 'never':
      return 'never';
    case 'param':
      return t.name;
    case 'var': {
      if (t.constraint === NUMERIC) return '{number}';
      let name = names.get(t.id);
      if (!name) {
        name = `?${String.fromCharCode(65 + (names.size % 26))}${names.size >= 26 ? names.size : ''}`;
        names.set(t.id, name);
      }
      return name;
    }
    case 'array':
      return `[${typeToString(t.elem, names)}]`;
    case 'map':
      return `[${typeToString(t.key, names)}: ${typeToString(t.value, names)}]`;
    case 'tuple':
      return `(${t.elems.map((e) => typeToString(e, names)).join(', ')})`;
    case 'fn': {
      const params = t.params.map((p) => typeToString(p, names)).join(', ');
      const ret = prune(t.ret);
      return ret.kind === 'prim' && ret.name === 'void'
        ? `fn(${params})`
        : `fn(${params}) -> ${typeToString(ret, names)}`;
    }
    case 'named': {
      if (t.name === 'option' && t.args.length === 1) {
        const inner = prune(t.args[0]);
        const s = typeToString(inner, names);
        return inner.kind === 'fn' ? `(${s})?` : `${s}?`;
      }
      if (!t.args.length) return t.name;
      return `${t.name}<${t.args.map((a) => typeToString(a, names)).join(', ')}>`;
    }
  }
}

export const isPrim = (t: Type, name: PrimName): boolean => {
  const p = prune(t);
  return p.kind === 'prim' && p.name === name;
};

export const isNever = (t: Type): boolean => prune(t).kind === 'never';
