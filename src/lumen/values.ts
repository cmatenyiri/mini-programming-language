import type { TypeRegistry } from './checker';
import { type Type, prune, substitute } from './types';

/* ─────────────────────────── runtime values ─────────────────────────── */

export type MapKey = number | string | boolean;

export class LStruct {
  readonly name: string;
  readonly fields: Record<string, Value>;
  constructor(name: string, fields: Record<string, Value>) {
    this.name = name;
    this.fields = fields;
  }
}

export class LEnum {
  readonly enumName: string;
  readonly variant: string;
  readonly values: Value[];
  constructor(enumName: string, variant: string, values: Value[]) {
    this.enumName = enumName;
    this.variant = variant;
    this.values = values;
  }
}

export class LTuple {
  readonly items: Value[];
  constructor(items: Value[]) {
    this.items = items;
  }
}

/** Compiled Lumen functions take the call-site id first (see runtime.ts). */
export type LumenFunction = (site: number, ...args: Value[]) => Value;

export type Value =
  | number
  | string
  | boolean
  | undefined
  | Value[]
  | Map<MapKey, Value>
  | LStruct
  | LEnum
  | LTuple
  | LumenFunction;

export const NONE = new LEnum('option', 'None', []);
export const some = (v: Value) => new LEnum('option', 'Some', [v]);
export const option = (v: Value | undefined | null): LEnum =>
  v === undefined || v === null ? NONE : some(v);

/* ─────────────────────────── equality ─────────────────────────── */

export function valueEquals(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => valueEquals(x, b[i]));
  }
  if (a instanceof LTuple) {
    return (
      b instanceof LTuple &&
      a.items.length === b.items.length &&
      a.items.every((x, i) => valueEquals(x, b.items[i]))
    );
  }
  if (a instanceof LEnum) {
    return (
      b instanceof LEnum &&
      a.enumName === b.enumName &&
      a.variant === b.variant &&
      a.values.every((x, i) => valueEquals(x, b.values[i]))
    );
  }
  if (a instanceof LStruct) {
    if (!(b instanceof LStruct) || a.name !== b.name) return false;
    return Object.keys(a.fields).every((k) => valueEquals(a.fields[k], b.fields[k]));
  }
  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !valueEquals(v, b.get(k))) return false;
    }
    return true;
  }
  return false;
}

/* ─────────────────────────── formatting ─────────────────────────── */

export function formatFloat(v: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  if (Number.isInteger(v) && Math.abs(v) < 1e21) return v.toFixed(1);
  return String(v);
}

const escapeString = (s: string) =>
  `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;

/**
 * Formats a value for display. The static type (when known) decides details that the
 * runtime representation cannot, e.g. that the float `2` prints as `2.0`.
 */
export function formatValue(
  value: Value,
  type: Type | undefined,
  registry: TypeRegistry | undefined,
  nested = false,
): string {
  const t = type ? prune(type) : undefined;
  switch (typeof value) {
    case 'number':
      if (t?.kind === 'prim') return t.name === 'float' ? formatFloat(value) : String(value);
      return Number.isInteger(value) ? String(value) : formatFloat(value);
    case 'string':
      return nested ? escapeString(value) : value;
    case 'boolean':
      return String(value);
    case 'undefined':
      return 'void';
  }
  if (Array.isArray(value)) {
    const elem = t?.kind === 'array' ? t.elem : undefined;
    return `[${value.map((v) => formatValue(v, elem, registry, true)).join(', ')}]`;
  }
  if (value instanceof Map) {
    if (value.size === 0) return '[:]';
    const key = t?.kind === 'map' ? t.key : undefined;
    const val = t?.kind === 'map' ? t.value : undefined;
    const parts = [...value].map(
      ([k, v]) => `${formatValue(k, key, registry, true)}: ${formatValue(v, val, registry, true)}`,
    );
    return `[${parts.join(', ')}]`;
  }
  if (value instanceof LTuple) {
    const elems = t?.kind === 'tuple' ? t.elems : [];
    return `(${value.items.map((v, i) => formatValue(v, elems[i], registry, true)).join(', ')})`;
  }
  if (value instanceof LStruct) {
    const info = registry?.structs.get(value.name);
    const map = new Map<number, Type>();
    if (info && t?.kind === 'named') info.typeParams.forEach((p, i) => map.set(p.id, t.args[i]));
    const fields = Object.keys(value.fields).map((k) => {
      const ft = info?.fields.find((f) => f.name === k)?.type;
      return `${k}: ${formatValue(value.fields[k], ft ? substitute(ft, map) : undefined, registry, true)}`;
    });
    return fields.length ? `${value.name} { ${fields.join(', ')} }` : `${value.name} {}`;
  }
  if (value instanceof LEnum) {
    if (!value.values.length) return value.variant;
    const info = registry?.enums.get(value.enumName);
    const variant = info?.variants.find((v) => v.name === value.variant);
    const map = new Map<number, Type>();
    if (info && t?.kind === 'named') info.typeParams.forEach((p, i) => map.set(p.id, t.args[i]));
    const args = value.values.map((v, i) => {
      const ft = variant?.fields[i];
      return formatValue(v, ft ? substitute(ft, map) : undefined, registry, true);
    });
    return `${value.variant}(${args.join(', ')})`;
  }
  if (typeof value === 'function') return '<fn>';
  return String(value);
}

export function describeValueKind(value: Value): string {
  if (Array.isArray(value)) return 'array';
  if (value instanceof Map) return 'map';
  if (value instanceof LStruct) return value.name;
  if (value instanceof LEnum) return value.enumName;
  return typeof value;
}
