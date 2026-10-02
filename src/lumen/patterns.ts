/**
 * Exhaustiveness and reachability analysis for `match`, based on Maranget's
 * "Warnings for pattern matching" usefulness algorithm.
 */
import type { Pattern } from './ast';
import type { Type } from './types';

/** A simplified pattern: wildcard, constructor (variant, tuple, bool) or opaque literal. */
export type SimplePattern =
  | { k: 'any' }
  | { k: 'ctor'; name: string; args: SimplePattern[] }
  | { k: 'lit'; key: string }
  | { k: 'or'; alts: SimplePattern[] };

export interface Constructor {
  name: string;
  /** How the constructor is displayed in a "missing pattern" witness. */
  display: (args: string[]) => string;
  fields: Type[];
}

/** Returns the complete list of constructors for a type, or `null` when it has infinitely many values. */
export type ConstructorsOf = (type: Type) => Constructor[] | null;

const ANY: SimplePattern = { k: 'any' };

export function simplify(p: Pattern): SimplePattern {
  switch (p.kind) {
    case 'WildcardPattern':
    case 'BindingPattern':
      return ANY;
    case 'LiteralPattern':
      if (p.litKind === 'bool') return { k: 'ctor', name: String(p.value), args: [] };
      return { k: 'lit', key: `${p.litKind}:${String(p.value)}` };
    case 'RangePattern':
      return { k: 'lit', key: `range:${p.start}:${p.end}:${p.inclusive}` };
    case 'TuplePattern':
      return { k: 'ctor', name: '()', args: p.elems.map(simplify) };
    case 'VariantPattern':
      return { k: 'ctor', name: p.variant, args: p.args.map(simplify) };
    case 'OrPattern':
      return { k: 'or', alts: p.alternatives.map(simplify) };
  }
}

type Row = SimplePattern[];

/** Expands or-patterns in the first column into separate rows. */
function expandFirst(rows: Row[]): Row[] {
  const out: Row[] = [];
  for (const row of rows) {
    const head = row[0];
    if (head.k === 'or') {
      out.push(...expandFirst(head.alts.map((alt) => [alt, ...row.slice(1)])));
    } else {
      out.push(row);
    }
  }
  return out;
}

function specialize(rows: Row[], ctor: string, arity: number): Row[] {
  const out: Row[] = [];
  for (const row of expandFirst(rows)) {
    const head = row[0];
    if (head.k === 'any') {
      out.push([...Array<SimplePattern>(arity).fill(ANY), ...row.slice(1)]);
    } else if (head.k === 'ctor' && head.name === ctor) {
      const args = head.args.slice(0, arity);
      while (args.length < arity) args.push(ANY);
      out.push([...args, ...row.slice(1)]);
    }
  }
  return out;
}

function specializeLiteral(rows: Row[], key: string): Row[] {
  const out: Row[] = [];
  for (const row of expandFirst(rows)) {
    const head = row[0];
    if (head.k === 'any' || (head.k === 'lit' && head.key === key)) out.push(row.slice(1));
  }
  return out;
}

function defaultMatrix(rows: Row[]): Row[] {
  return expandFirst(rows)
    .filter((row) => row[0].k === 'any')
    .map((row) => row.slice(1));
}

function usedConstructors(rows: Row[]): Set<string> {
  const used = new Set<string>();
  for (const row of expandFirst(rows)) if (row[0].k === 'ctor') used.add(row[0].name);
  return used;
}

/**
 * Finds a value not matched by any row. Returns a witness (one display string per
 * column), or `null` if the rows are exhaustive.
 */
export function findMissing(
  rows: Row[],
  types: Type[],
  ctorsOf: ConstructorsOf,
  depth = 0,
): string[] | null {
  if (types.length === 0) return rows.length > 0 ? null : [];
  if (depth > 32) return null;
  const [head, ...rest] = types;
  const ctors = ctorsOf(head);
  if (ctors) {
    const used = usedConstructors(rows);
    if (ctors.every((c) => used.has(c.name))) {
      for (const ctor of ctors) {
        const witness = findMissing(
          specialize(rows, ctor.name, ctor.fields.length),
          [...ctor.fields, ...rest],
          ctorsOf,
          depth + 1,
        );
        if (witness) {
          const args = witness.slice(0, ctor.fields.length);
          return [ctor.display(args), ...witness.slice(ctor.fields.length)];
        }
      }
      return null;
    }
    const witness = findMissing(defaultMatrix(rows), rest, ctorsOf, depth + 1);
    if (!witness) return null;
    const missing = ctors.find((c) => !used.has(c.name))!;
    return [missing.display(missing.fields.map(() => '_')), ...witness];
  }
  const witness = findMissing(defaultMatrix(rows), rest, ctorsOf, depth + 1);
  return witness ? ['_', ...witness] : null;
}

/** True if `row` matches some value that none of `rows` match. */
export function isUseful(
  rows: Row[],
  row: Row,
  types: Type[],
  ctorsOf: ConstructorsOf,
  depth = 0,
): boolean {
  if (types.length === 0) return rows.length === 0;
  if (depth > 32) return true;
  const [head, ...restTypes] = types;
  const [q, ...restRow] = row;
  if (q.k === 'or') {
    return q.alts.some((alt) => isUseful(rows, [alt, ...restRow], types, ctorsOf, depth + 1));
  }
  if (q.k === 'lit') {
    return isUseful(specializeLiteral(rows, q.key), restRow, restTypes, ctorsOf, depth + 1);
  }
  const ctors = ctorsOf(head);
  if (q.k === 'ctor') {
    const fields = ctors?.find((c) => c.name === q.name)?.fields ?? q.args.map(() => head);
    return isUseful(
      specialize(rows, q.name, fields.length),
      [...q.args, ...restRow],
      [...fields, ...restTypes],
      ctorsOf,
      depth + 1,
    );
  }
  // Wildcard
  if (ctors) {
    const used = usedConstructors(rows);
    if (ctors.every((c) => used.has(c.name))) {
      return ctors.some((c) =>
        isUseful(
          specialize(rows, c.name, c.fields.length),
          [...c.fields.map(() => ANY), ...restRow],
          [...c.fields, ...restTypes],
          ctorsOf,
          depth + 1,
        ),
      );
    }
  }
  return isUseful(defaultMatrix(rows), restRow, restTypes, ctorsOf, depth + 1);
}
