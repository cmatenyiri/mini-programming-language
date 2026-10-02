import {
  type Constraint,
  type TFn,
  type Type,
  BOOL,
  FLOAT,
  INT,
  NEVER,
  NUMERIC,
  ORDERED,
  STRING,
  VOID,
  arrayOf,
  fnOf,
  freshVar,
  optionOf,
  resultOf,
  tupleOf,
} from './types';

/** A signature that is instantiated with fresh type variables every time it is used. */
export interface Signature {
  fn: TFn;
  /** Extra constraints on types appearing in the signature. */
  requires?: [Type, Constraint][];
  /** Pairs of types that must unify (e.g. the element type of `flatten`). */
  equals?: [Type, Type][];
}

export interface BuiltinFunction {
  name: string;
  signature: string;
  doc: string;
  /** Builds a fresh signature. `undefined` means the checker validates calls specially. */
  type?: () => Signature;
  special?: 'print' | 'assert';
}

export interface BuiltinValue {
  name: string;
  signature: string;
  doc: string;
  type: () => Type;
}

const sig = (fn: TFn, requires?: [Type, Constraint][]): Signature => ({ fn, requires });

const floatFn = (name: string, doc: string): BuiltinFunction => ({
  name,
  signature: `${name}(x: float) -> float`,
  doc,
  type: () => sig(fnOf([FLOAT], FLOAT)),
});

export const BUILTIN_FUNCTIONS: BuiltinFunction[] = [
  {
    name: 'print',
    signature: 'print(values...)',
    doc: 'Writes the given values to the output, separated by spaces, followed by a newline.',
    special: 'print',
  },
  {
    name: 'str',
    signature: 'str<T>(value: T) -> string',
    doc: 'Converts any value to its string representation.',
    type: () => sig(fnOf([freshVar()], STRING)),
  },
  {
    name: 'type_of',
    signature: 'type_of<T>(value: T) -> string',
    doc: 'Returns the static type of an expression as a string, as inferred by the type checker.',
    type: () => sig(fnOf([freshVar()], STRING)),
  },
  {
    name: 'assert',
    signature: 'assert(condition: bool, message?: string)',
    doc: 'Stops the program with an error if the condition is false.',
    special: 'assert',
  },
  {
    name: 'panic',
    signature: 'panic(message: string) -> never',
    doc: 'Immediately stops the program with an error message.',
    type: () => sig(fnOf([STRING], NEVER)),
  },
  {
    name: 'abs',
    signature: 'abs<N: number>(x: N) -> N',
    doc: 'Absolute value of an int or float.',
    type: () => {
      const n = freshVar(NUMERIC);
      return sig(fnOf([n], n));
    },
  },
  {
    name: 'min',
    signature: 'min<T: comparable>(a: T, b: T) -> T',
    doc: 'The smaller of two values.',
    type: () => {
      const t = freshVar(ORDERED);
      return sig(fnOf([t, t], t));
    },
  },
  {
    name: 'max',
    signature: 'max<T: comparable>(a: T, b: T) -> T',
    doc: 'The larger of two values.',
    type: () => {
      const t = freshVar(ORDERED);
      return sig(fnOf([t, t], t));
    },
  },
  floatFn('sqrt', 'Square root.'),
  floatFn('sin', 'Sine (radians).'),
  floatFn('cos', 'Cosine (radians).'),
  floatFn('tan', 'Tangent (radians).'),
  floatFn('ln', 'Natural logarithm.'),
  floatFn('exp', 'e raised to the power x.'),
  {
    name: 'atan2',
    signature: 'atan2(y: float, x: float) -> float',
    doc: 'Angle of the point (x, y) in radians.',
    type: () => sig(fnOf([FLOAT, FLOAT], FLOAT)),
  },
  {
    name: 'floor',
    signature: 'floor(x: float) -> int',
    doc: 'Largest int less than or equal to x.',
    type: () => sig(fnOf([FLOAT], INT)),
  },
  {
    name: 'ceil',
    signature: 'ceil(x: float) -> int',
    doc: 'Smallest int greater than or equal to x.',
    type: () => sig(fnOf([FLOAT], INT)),
  },
  {
    name: 'round',
    signature: 'round(x: float) -> int',
    doc: 'Rounds to the nearest int.',
    type: () => sig(fnOf([FLOAT], INT)),
  },
  {
    name: 'random',
    signature: 'random() -> float',
    doc: 'A random float in [0, 1).',
    type: () => sig(fnOf([], FLOAT)),
  },
  {
    name: 'random_int',
    signature: 'random_int(min: int, max: int) -> int',
    doc: 'A random int in [min, max] (inclusive).',
    type: () => sig(fnOf([INT, INT], INT)),
  },
  {
    name: 'parse_int',
    signature: 'parse_int(text: string) -> int?',
    doc: 'Parses an int. Returns None when the text is not a valid integer.',
    type: () => sig(fnOf([STRING], optionOf(INT))),
  },
  {
    name: 'parse_float',
    signature: 'parse_float(text: string) -> float?',
    doc: 'Parses a float. Returns None when the text is not a valid number.',
    type: () => sig(fnOf([STRING], optionOf(FLOAT))),
  },
  {
    name: 'clock',
    signature: 'clock() -> float',
    doc: 'Milliseconds elapsed since the program started.',
    type: () => sig(fnOf([], FLOAT)),
  },
];

export const BUILTIN_VALUES: BuiltinValue[] = [
  { name: 'PI', signature: 'PI: float', doc: 'π ≈ 3.14159', type: () => FLOAT },
  { name: 'E', signature: 'E: float', doc: "Euler's number ≈ 2.71828", type: () => FLOAT },
];

/* ─────────────────────────── methods ─────────────────────────── */

export interface BuiltinMethod {
  name: string;
  signature: string;
  doc: string;
  /** Mutates the receiver in place. */
  mutates?: boolean;
}

export interface MethodTable<R> {
  methods: BuiltinMethod[];
  type: (receiver: R, name: string) => Signature | undefined;
}

const m = (name: string, signature: string, doc: string, mutates = false): BuiltinMethod => ({
  name,
  signature,
  doc,
  mutates,
});

export const UNIVERSAL_METHODS: BuiltinMethod[] = [
  m('to_string', 'to_string() -> string', 'Converts the value to a string.'),
];

export const STRING_METHODS: MethodTable<null> = {
  methods: [
    m('len', 'len() -> int', 'Number of characters.'),
    m('is_empty', 'is_empty() -> bool', 'True when the string has no characters.'),
    m('upper', 'upper() -> string', 'Uppercase copy.'),
    m('lower', 'lower() -> string', 'Lowercase copy.'),
    m('trim', 'trim() -> string', 'Copy without leading and trailing whitespace.'),
    m('contains', 'contains(part: string) -> bool', 'True if `part` occurs in the string.'),
    m(
      'starts_with',
      'starts_with(prefix: string) -> bool',
      'True if the string starts with `prefix`.',
    ),
    m('ends_with', 'ends_with(suffix: string) -> bool', 'True if the string ends with `suffix`.'),
    m('index_of', 'index_of(part: string) -> int?', 'Position of the first occurrence of `part`.'),
    m(
      'replace',
      'replace(from: string, to: string) -> string',
      'Replaces every occurrence of `from`.',
    ),
    m('split', 'split(separator: string) -> [string]', 'Splits the string into parts.'),
    m('chars', 'chars() -> [string]', 'The characters of the string.'),
    m('repeat', 'repeat(times: int) -> string', 'The string repeated `times` times.'),
    m(
      'slice',
      'slice(start: int, end: int) -> string',
      'Characters from `start` up to (not including) `end`.',
    ),
    m(
      'pad_start',
      'pad_start(width: int, fill: string) -> string',
      'Pads the start to reach `width` characters.',
    ),
    m(
      'pad_end',
      'pad_end(width: int, fill: string) -> string',
      'Pads the end to reach `width` characters.',
    ),
    m('reverse', 'reverse() -> string', 'The characters in reverse order.'),
    m('code', 'code() -> int', 'Unicode code point of the first character.'),
  ],
  type: (_r, name) => {
    switch (name) {
      case 'len':
        return sig(fnOf([], INT));
      case 'is_empty':
        return sig(fnOf([], BOOL));
      case 'upper':
      case 'lower':
      case 'trim':
      case 'reverse':
        return sig(fnOf([], STRING));
      case 'contains':
      case 'starts_with':
      case 'ends_with':
        return sig(fnOf([STRING], BOOL));
      case 'index_of':
        return sig(fnOf([STRING], optionOf(INT)));
      case 'replace':
        return sig(fnOf([STRING, STRING], STRING));
      case 'split':
        return sig(fnOf([STRING], arrayOf(STRING)));
      case 'chars':
        return sig(fnOf([], arrayOf(STRING)));
      case 'repeat':
        return sig(fnOf([INT], STRING));
      case 'slice':
        return sig(fnOf([INT, INT], STRING));
      case 'pad_start':
      case 'pad_end':
        return sig(fnOf([INT, STRING], STRING));
      case 'code':
        return sig(fnOf([], INT));
    }
    return undefined;
  },
};

export const ARRAY_METHODS: MethodTable<Type> = {
  methods: [
    m('len', 'len() -> int', 'Number of elements.'),
    m('is_empty', 'is_empty() -> bool', 'True when the array has no elements.'),
    m('push', 'push(item: T)', 'Appends an element to the end.', true),
    m('pop', 'pop() -> T?', 'Removes and returns the last element.', true),
    m('insert', 'insert(index: int, item: T)', 'Inserts an element at `index`.', true),
    m('remove', 'remove(index: int) -> T', 'Removes and returns the element at `index`.', true),
    m('clear', 'clear()', 'Removes all elements.', true),
    m('first', 'first() -> T?', 'The first element, if any.'),
    m('last', 'last() -> T?', 'The last element, if any.'),
    m('get', 'get(index: int) -> T?', 'The element at `index`, or None when out of bounds.'),
    m('contains', 'contains(item: T) -> bool', 'True if an equal element exists.'),
    m('index_of', 'index_of(item: T) -> int?', 'Position of the first equal element.'),
    m('map', 'map<U>(f: fn(T) -> U) -> [U]', 'A new array with `f` applied to every element.'),
    m('filter', 'filter(keep: fn(T) -> bool) -> [T]', 'Elements for which `keep` returns true.'),
    m(
      'reduce',
      'reduce<A>(initial: A, f: fn(A, T) -> A) -> A',
      'Folds the array into a single value.',
    ),
    m('each', 'each(f: fn(T))', 'Calls `f` for every element.'),
    m('find', 'find(pred: fn(T) -> bool) -> T?', 'The first element matching `pred`.'),
    m('any', 'any(pred: fn(T) -> bool) -> bool', 'True if some element matches.'),
    m('all', 'all(pred: fn(T) -> bool) -> bool', 'True if every element matches.'),
    m('count', 'count(pred: fn(T) -> bool) -> int', 'Number of elements matching `pred`.'),
    m('sort', 'sort() -> [T]', 'A sorted copy (T must be int, float or string).'),
    m(
      'sort_by',
      'sort_by<K>(key: fn(T) -> K) -> [T]',
      'A copy sorted by a key (K must be comparable).',
    ),
    m('reverse', 'reverse() -> [T]', 'A reversed copy.'),
    m(
      'slice',
      'slice(start: int, end: int) -> [T]',
      'Elements from `start` up to (not including) `end`.',
    ),
    m('concat', 'concat(other: [T]) -> [T]', 'A new array with the elements of both.'),
    m('take', 'take(n: int) -> [T]', 'The first `n` elements.'),
    m('skip', 'skip(n: int) -> [T]', 'All elements after the first `n`.'),
    m('enumerate', 'enumerate() -> [(int, T)]', 'Pairs every element with its index.'),
    m('zip', 'zip<U>(other: [U]) -> [(T, U)]', 'Pairs elements of both arrays.'),
    m('join', 'join(separator: string) -> string', 'Joins the elements into a string.'),
    m('sum', 'sum() -> T', 'Sum of the elements (T must be a number).'),
    m('min', 'min() -> T?', 'The smallest element.'),
    m('max', 'max() -> T?', 'The largest element.'),
    m('flatten', 'flatten() -> [U]', 'Flattens an array of arrays ([[U]] → [U]).'),
    m('unique', 'unique() -> [T]', 'A copy without duplicate elements.'),
  ],
  type: (elem, name) => {
    switch (name) {
      case 'len':
        return sig(fnOf([], INT));
      case 'is_empty':
        return sig(fnOf([], BOOL));
      case 'push':
        return sig(fnOf([elem], VOID));
      case 'pop':
      case 'first':
      case 'last':
        return sig(fnOf([], optionOf(elem)));
      case 'insert':
        return sig(fnOf([INT, elem], VOID));
      case 'remove':
        return sig(fnOf([INT], elem));
      case 'clear':
        return sig(fnOf([], VOID));
      case 'get':
        return sig(fnOf([INT], optionOf(elem)));
      case 'contains':
        return sig(fnOf([elem], BOOL));
      case 'index_of':
        return sig(fnOf([elem], optionOf(INT)));
      case 'map': {
        const u = freshVar();
        return sig(fnOf([fnOf([elem], u)], arrayOf(u)));
      }
      case 'filter':
        return sig(fnOf([fnOf([elem], BOOL)], arrayOf(elem)));
      case 'reduce': {
        const a = freshVar();
        return sig(fnOf([a, fnOf([a, elem], a)], a));
      }
      case 'each':
        return sig(fnOf([fnOf([elem], VOID)], VOID));
      case 'find':
        return sig(fnOf([fnOf([elem], BOOL)], optionOf(elem)));
      case 'any':
      case 'all':
        return sig(fnOf([fnOf([elem], BOOL)], BOOL));
      case 'count':
        return sig(fnOf([fnOf([elem], BOOL)], INT));
      case 'sort':
        return sig(fnOf([], arrayOf(elem)), [[elem, ORDERED]]);
      case 'sort_by': {
        const k = freshVar(ORDERED);
        return sig(fnOf([fnOf([elem], k)], arrayOf(elem)));
      }
      case 'reverse':
      case 'unique':
        return sig(fnOf([], arrayOf(elem)));
      case 'slice':
        return sig(fnOf([INT, INT], arrayOf(elem)));
      case 'concat':
        return sig(fnOf([arrayOf(elem)], arrayOf(elem)));
      case 'take':
      case 'skip':
        return sig(fnOf([INT], arrayOf(elem)));
      case 'enumerate':
        return sig(fnOf([], arrayOf(tupleOf([INT, elem]))));
      case 'zip': {
        const u = freshVar();
        return sig(fnOf([arrayOf(u)], arrayOf(tupleOf([elem, u]))));
      }
      case 'join':
        return sig(fnOf([STRING], STRING));
      case 'sum':
        return sig(fnOf([], elem), [[elem, NUMERIC]]);
      case 'min':
      case 'max':
        return sig(fnOf([], optionOf(elem)), [[elem, ORDERED]]);
      case 'flatten': {
        const u = freshVar();
        return { fn: fnOf([], arrayOf(u)), equals: [[elem, arrayOf(u)]] };
      }
    }
    return undefined;
  },
};

export const MAP_METHODS: MethodTable<[Type, Type]> = {
  methods: [
    m('len', 'len() -> int', 'Number of entries.'),
    m('is_empty', 'is_empty() -> bool', 'True when the map has no entries.'),
    m('get', 'get(key: K) -> V?', 'The value for `key`, if present.'),
    m('set', 'set(key: K, value: V)', 'Inserts or replaces an entry.', true),
    m('has', 'has(key: K) -> bool', 'True if the map contains `key`.'),
    m('remove', 'remove(key: K) -> V?', 'Removes an entry and returns its value.', true),
    m('keys', 'keys() -> [K]', 'All keys, in insertion order.'),
    m('values', 'values() -> [V]', 'All values, in insertion order.'),
    m('entries', 'entries() -> [(K, V)]', 'All entries as (key, value) tuples.'),
    m('clear', 'clear()', 'Removes all entries.', true),
  ],
  type: ([k, v], name) => {
    switch (name) {
      case 'len':
        return sig(fnOf([], INT));
      case 'is_empty':
        return sig(fnOf([], BOOL));
      case 'get':
        return sig(fnOf([k], optionOf(v)));
      case 'set':
        return sig(fnOf([k, v], VOID));
      case 'has':
        return sig(fnOf([k], BOOL));
      case 'remove':
        return sig(fnOf([k], optionOf(v)));
      case 'keys':
        return sig(fnOf([], arrayOf(k)));
      case 'values':
        return sig(fnOf([], arrayOf(v)));
      case 'entries':
        return sig(fnOf([], arrayOf(tupleOf([k, v]))));
      case 'clear':
        return sig(fnOf([], VOID));
    }
    return undefined;
  },
};

export const OPTION_METHODS: MethodTable<Type> = {
  methods: [
    m('is_some', 'is_some() -> bool', 'True when the option holds a value.'),
    m('is_none', 'is_none() -> bool', 'True when the option is None.'),
    m('unwrap', 'unwrap() -> T', 'The contained value. Stops the program if None.'),
    m('unwrap_or', 'unwrap_or(fallback: T) -> T', 'The contained value, or `fallback` if None.'),
    m(
      'expect',
      'expect(message: string) -> T',
      'The contained value. Stops with `message` if None.',
    ),
    m('map', 'map<U>(f: fn(T) -> U) -> U?', 'Applies `f` to the contained value, if any.'),
  ],
  type: (inner, name) => {
    switch (name) {
      case 'is_some':
      case 'is_none':
        return sig(fnOf([], BOOL));
      case 'unwrap':
        return sig(fnOf([], inner));
      case 'unwrap_or':
        return sig(fnOf([inner], inner));
      case 'expect':
        return sig(fnOf([STRING], inner));
      case 'map': {
        const u = freshVar();
        return sig(fnOf([fnOf([inner], u)], optionOf(u)));
      }
    }
    return undefined;
  },
};

export const RESULT_METHODS: MethodTable<[Type, Type]> = {
  methods: [
    m('is_ok', 'is_ok() -> bool', 'True when the result is Ok.'),
    m('is_err', 'is_err() -> bool', 'True when the result is Err.'),
    m('unwrap', 'unwrap() -> T', 'The Ok value. Stops the program on Err.'),
    m('unwrap_or', 'unwrap_or(fallback: T) -> T', 'The Ok value, or `fallback` on Err.'),
    m('unwrap_err', 'unwrap_err() -> E', 'The Err value. Stops the program on Ok.'),
    m('ok', 'ok() -> T?', 'Converts to an option, discarding the error.'),
    m('map', 'map<U>(f: fn(T) -> U) -> result<U, E>', 'Applies `f` to the Ok value.'),
  ],
  type: ([ok, err], name) => {
    switch (name) {
      case 'is_ok':
      case 'is_err':
        return sig(fnOf([], BOOL));
      case 'unwrap':
        return sig(fnOf([], ok));
      case 'unwrap_or':
        return sig(fnOf([ok], ok));
      case 'unwrap_err':
        return sig(fnOf([], err));
      case 'ok':
        return sig(fnOf([], optionOf(ok)));
      case 'map': {
        const u = freshVar();
        return sig(fnOf([fnOf([ok], u)], resultOf(u, err)));
      }
    }
    return undefined;
  },
};

export const NUMBER_METHODS: MethodTable<Type> = {
  methods: [
    m('abs', 'abs() -> N', 'Absolute value.'),
    m('pow', 'pow(exponent: N) -> N', 'Raises the number to a power.'),
    m('clamp', 'clamp(low: N, high: N) -> N', 'Restricts the number to [low, high].'),
    m('floor', 'floor() -> int', 'Rounds a float down.'),
    m('ceil', 'ceil() -> int', 'Rounds a float up.'),
    m('round', 'round() -> int', 'Rounds a float to the nearest int.'),
    m('sqrt', 'sqrt() -> float', 'Square root of a float.'),
  ],
  type: (n, name) => {
    switch (name) {
      case 'abs':
        return sig(fnOf([], n));
      case 'pow':
        return sig(fnOf([n], n));
      case 'clamp':
        return sig(fnOf([n, n], n));
      case 'floor':
      case 'ceil':
      case 'round':
        return sig(fnOf([], INT), [[n, { label: 'float', allowed: new Set(['float']) }]]);
      case 'sqrt':
        return sig(fnOf([], FLOAT), [[n, { label: 'float', allowed: new Set(['float']) }]]);
    }
    return undefined;
  },
};

/** Builtin enum variants available everywhere. */
export const PRELUDE_VARIANTS = ['Some', 'None', 'Ok', 'Err'] as const;

export const KEYWORD_DOCS: Record<string, string> = {
  let: 'Declares an immutable variable.',
  var: 'Declares a mutable variable.',
  fn: 'Declares a function or lambda.',
  return: 'Returns a value from the current function.',
  if: 'Conditional expression.',
  else: 'Alternative branch of an if.',
  while: 'Loops while a condition is true.',
  for: 'Iterates over a range, array, map or string.',
  in: 'Separates the loop variable from the iterable.',
  loop: 'Loops forever until `break`.',
  break: 'Exits the innermost loop.',
  continue: 'Skips to the next loop iteration.',
  match: 'Pattern matching expression.',
  struct: 'Declares a record type with named fields.',
  enum: 'Declares a type with a fixed set of variants.',
  impl: 'Adds methods to a struct or enum.',
  type: 'Declares a type alias.',
  self: 'The receiver inside a method.',
  as: 'Converts between int and float.',
};
