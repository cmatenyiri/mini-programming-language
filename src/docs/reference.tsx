import type { ReactNode } from 'react';
import { Code } from '../components/Code';
import { C, Para as P, RefTable as Table } from '../components/Prose';
import {
  ARRAY_METHODS,
  BUILTIN_FUNCTIONS,
  type BuiltinMethod,
  MAP_METHODS,
  NUMBER_METHODS,
  OPTION_METHODS,
  RESULT_METHODS,
  STRING_METHODS,
} from '../lumen/builtins';

export interface DocSection {
  id: string;
  title: string;
  summary: string;
  /** Plain text used for searching. */
  keywords: string;
  content: ReactNode;
  example?: string;
}

const methodRows = (methods: BuiltinMethod[], receiver: string): [ReactNode, ReactNode][] =>
  methods.map((m) => [
    <Code key={m.name} inline code={`${receiver}.${m.signature}`} fontSize={12} />,
    m.doc,
  ]);

const methodWords = (methods: BuiltinMethod[]) =>
  methods.map((m) => `${m.name} ${m.doc}`).join(' ');

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'architecture',
    title: 'How Lumen works',
    summary: 'The compiler pipeline, stage by stage',
    keywords:
      'compiler pipeline lexer tokenizer token parser ast syntax tree recursive descent pratt type checker inference unification hindley milner code generator javascript runtime worker',
    content: (
      <>
        <P>
          Lumen is a compiled language. Each time you edit, your program goes through the same
          stages as in a production compiler — all of them running in your browser.
        </P>
        <Table
          head={['STAGE', 'WHAT IT DOES']}
          rows={[
            [
              'Lexer',
              'Turns characters into tokens. Also powers the editor’s syntax highlighting.',
            ],
            [
              'Parser',
              'A recursive-descent parser with Pratt operator precedence builds the abstract syntax tree (AST), recovering from errors to report several at once.',
            ],
            [
              'Type checker',
              'Infers every type with unification (Hindley–Milner style), checks generics, exhaustive matches and more.',
            ],
            [
              'Code generator',
              'Lowers the typed AST to JavaScript: expression-oriented constructs become statements, every Lumen function becomes a JavaScript function.',
            ],
            [
              'Runtime',
              'Runs the generated code in a Web Worker with a small runtime library: checked integer math, bounds checks and readable call stacks.',
            ],
          ]}
        />
        <P>Inspect each stage with the Tokens, AST, Types and JS tabs next to the editor.</P>
      </>
    ),
  },
  {
    id: 'basics',
    title: 'Basics',
    summary: 'Comments, variables and literals',
    keywords:
      'comment let var variable mutable immutable literal int float string bool interpolation escape hex binary',
    content: (
      <>
        <P>
          Statements are separated by new lines. Comments use <C>// line</C> or <C>/* block */</C>.
          Bindings declared with <C>let</C> cannot be reassigned; <C>var</C> bindings can.
        </P>
        <Code
          code={
            'let answer = 42            // int\nlet big = 1_000_000        // underscores for readability\nlet mask = 0xFF            // hex, and 0b1010 for binary\nlet pi = 3.14159           // float\nlet ok = true              // bool\nvar name = "Lumen"         // string\nname = "Lumen 2"\nprint("Hi ${name}, 2 + 2 = ${2 + 2}")\nprint("escapes: \\t tab, \\" quote, \\u{2728}")'
          }
        />
      </>
    ),
    example:
      'let answer = 42\nlet big = 1_000_000\nlet mask = 0xFF\nvar name = "Lumen"\nname = "Lumen 2"\nprint("Hi ${name}, 2 + 2 = ${2 + 2}")\nprint(answer, big, mask, "escapes: \\t tab \\u{2728}")\n',
  },
  {
    id: 'operators',
    title: 'Operators',
    summary: 'Arithmetic, comparison, logic, ranges, pipes and casts',
    keywords:
      'operator precedence arithmetic + - * / % ** comparison == != < > logical && || ! ?? pipe |> range .. ..= as cast compound += -=',
    content: (
      <>
        <P>
          Arithmetic works on <C>int</C> and <C>float</C>, but both sides must have the same type —
          use <C>as</C> to convert. Integer division truncates. <C>+</C> also joins strings.
        </P>
        <Table
          head={['OPERATOR', 'MEANING (LOWEST PRECEDENCE FIRST)']}
          rows={[
            [<C key="a">{'a |> f(b)'}</C>, 'Pipe: calls f(a, b) — or a.f(b) for methods'],
            [<C key="b">{'opt ?? fallback'}</C>, 'The option’s value, or the fallback for None'],
            [<C key="c">{'a || b   a && b'}</C>, 'Logical or / and (short-circuit)'],
            [<C key="d">{'== != < <= > >='}</C>, 'Comparison (== compares structurally)'],
            [<C key="e">{'0..n   0..=n'}</C>, 'Exclusive / inclusive range of ints'],
            [<C key="f">{'+ - * / %'}</C>, 'Arithmetic'],
            [<C key="g">{'x as float'}</C>, 'Convert between int and float'],
            [<C key="h">{'-x   !b'}</C>, 'Negation, logical not'],
            [<C key="i">{'a ** b'}</C>, 'Power (right-associative)'],
            [<C key="j">{'f(x)  xs[i]  p.x  opt?'}</C>, 'Call, index, field access, early return'],
          ]}
        />
        <P>
          Compound assignments: <C>+= -= *= /= %=</C>.
        </P>
      </>
    ),
    example:
      'let a = 7\nlet b = 2\nprint(a / b, a % b, a ** b, a as float / b as float)\nprint(1..=5, "a" + "b", [1, 2] == [1, 2])\nlet doubled = 21 |> fn(x: int) => x * 2\nprint(doubled)\n',
  },
  {
    id: 'control-flow',
    title: 'Control flow',
    summary: 'if, while, for, loop, break and continue',
    keywords: 'if else while for in loop break continue range iterate expression',
    content: (
      <>
        <P>
          <C>if</C> is an expression: both branches must produce the same type when its value is
          used. Loops iterate over ranges, arrays, maps (as <C>(key, value)</C> tuples) and strings
          (characters).
        </P>
        <Code
          code={
            'let kind = if n > 0 { "positive" } else if n < 0 { "negative" } else { "zero" }\n\nfor i in 0..3 { print(i) }\nfor (i, item) in ["a", "b"].enumerate() { print(i, item) }\nfor (key, value) in ["x": 1] { print(key, value) }\n\nwhile x < 100 { x *= 2 }\n\nloop {\n  if done() { break }\n}'
          }
        />
      </>
    ),
    example:
      'let n = -4\nlet kind = if n > 0 { "positive" } else if n < 0 { "negative" } else { "zero" }\nprint(kind)\nfor (i, item) in ["a", "b", "c"].enumerate() {\n  if i == 1 { continue }\n  print(i, item)\n}\nvar x = 1\nwhile x < 100 { x *= 3 }\nprint(x)\n',
  },
  {
    id: 'match',
    title: 'Pattern matching',
    summary: 'match expressions, if let and exhaustiveness',
    keywords:
      'match pattern wildcard _ guard if let tuple variant range literal alternatives | exhaustive',
    content: (
      <>
        <P>
          <C>match</C> compares a value against patterns, top to bottom. The checker requires every
          possible value to be covered and warns about arms that can never match.
        </P>
        <Table
          head={['PATTERN', 'MATCHES']}
          rows={[
            [<C key="1">_</C>, 'Anything (wildcard)'],
            [<C key="2">name</C>, 'Anything, binding it to name'],
            [<C key="3">{'42  "hi"  true'}</C>, 'A literal value'],
            [<C key="4">{'1..10  90..=100'}</C>, 'An int in a range'],
            [<C key="5">{'(a, 0)'}</C>, 'A tuple, element by element'],
            [<C key="6">{'Some(x)  Rect(w, h)'}</C>, 'An enum variant and its fields'],
            [<C key="7">{'1 | 2 | 3'}</C>, 'Any of the alternatives'],
            [<C key="8">{'n if n > 0'}</C>, 'A pattern with a guard condition'],
          ]}
        />
        <Code
          code={'if let Some(user) = find(id) {\n  print(user)\n} else {\n  print("not found")\n}'}
        />
      </>
    ),
    example:
      'fn describe(p: (int, int)) -> string {\n  match p {\n    (0, 0) => "origin",\n    (0, _) | (_, 0) => "on an axis",\n    (x, y) if x == y => "diagonal",\n    _ => "somewhere",\n  }\n}\nfor p in [(0, 0), (0, 5), (3, 3), (1, 2)] {\n  print(p, describe(p))\n}\n',
  },
  {
    id: 'functions',
    title: 'Functions & closures',
    summary: 'Declarations, lambdas, closures, recursion and generics',
    keywords:
      'fn function return lambda closure generic recursion higher-order expression body type parameter',
    content: (
      <>
        <P>
          Parameters are always typed. The return type is optional — it is inferred from the body. A
          block’s last expression is its value; <C>return</C> exits early. Functions can be declared
          after they are used.
        </P>
        <Code
          code={
            'fn add(a: int, b: int) -> int { a + b }\nfn square(x: int) => x * x            // expression body\nfn first<T>(xs: [T]) -> T? => xs.get(0)  // generic\n\nlet triple = fn(x: int) => x * 3      // lambda\nlet nums = [1, 2, 3].map(fn(x) => x + 1) // parameter type inferred\n\nfn counter() -> fn() -> int {        // closures capture variables\n  var n = 0\n  fn() -> int { n += 1\n n }\n}'
          }
        />
      </>
    ),
    example:
      'fn apply_twice(f: fn(int) -> int, x: int) -> int => f(f(x))\nfn first<T>(xs: [T]) -> T? => xs.get(0)\n\nprint(apply_twice(fn(x) => x * 3, 2))\nprint(first(["a", "b"]), first([1.5]))\n',
  },
  {
    id: 'structs',
    title: 'Structs & methods',
    summary: 'Records with named fields and impl blocks',
    keywords: 'struct field impl method self static constructor generic',
    content: (
      <>
        <P>
          Structs group named fields. An <C>impl</C> block adds methods (taking <C>self</C>) and
          static functions (called as <C>Type.name()</C>). Field shorthand <C>{'Point { x, y }'}</C>{' '}
          uses variables of the same name.
        </P>
        <Code
          code={
            'struct Point { x: float, y: float }\n\nimpl Point {\n  fn new(x: float, y: float) -> Point => Point { x, y }\n  fn len(self) -> float => sqrt(self.x * self.x + self.y * self.y)\n}\n\nlet p = Point.new(3.0, 4.0)\nprint(p.len())   // 5.0\n\nstruct Box<T> { value: T }   // generic struct'
          }
        />
      </>
    ),
    example:
      'struct Point { x: float, y: float }\n\nimpl Point {\n  fn new(x: float, y: float) -> Point => Point { x, y }\n  fn len(self) -> float => sqrt(self.x * self.x + self.y * self.y)\n  fn scale(self, k: float) { self.x *= k\n self.y *= k }\n}\n\nlet p = Point.new(3.0, 4.0)\np.scale(2.0)\nprint(p, p.len())\n',
  },
  {
    id: 'enums',
    title: 'Enums',
    summary: 'Variants with data, recursion and generics',
    keywords: 'enum variant algebraic data type tagged union recursive generic',
    content: (
      <>
        <P>
          An enum value is exactly one of its variants. Variants may carry data, enums may be
          recursive and generic. Create values with <C>Enum.Variant(...)</C>; in patterns the enum
          name is optional.
        </P>
        <Code
          code={
            'enum Tree<T> {\n  Leaf,\n  Node(Tree<T>, T, Tree<T>),\n}\n\nfn size<T>(t: Tree<T>) -> int {\n  match t {\n    Leaf => 0,\n    Node(l, _, r) => size(l) + 1 + size(r),\n  }\n}'
          }
        />
      </>
    ),
    example:
      'enum Light { Red, Yellow, Green }\n\nfn next(l: Light) -> Light {\n  match l {\n    Red => Light.Green,\n    Green => Light.Yellow,\n    Yellow => Light.Red,\n  }\n}\n\nvar light = Light.Red\nfor _ in 0..4 {\n  print(light)\n  light = next(light)\n}\n',
  },
  {
    id: 'options',
    title: 'Options & results',
    summary: 'T?, Some, None, result, ?? and the ? operator',
    keywords:
      'option some none null result ok err ?? ? unwrap error handling' +
      methodWords(OPTION_METHODS.methods),
    content: (
      <>
        <P>
          Lumen has no null. <C>T?</C> (short for <C>{'option<T>'}</C>) is either <C>Some(value)</C>{' '}
          or <C>None</C>. <C>{'result<T, E>'}</C> is <C>Ok(value)</C> or <C>Err(error)</C>. Inside a
          function returning an option or result, <C>expr?</C> unwraps the value or returns early.
        </P>
        <Table rows={methodRows(OPTION_METHODS.methods, 'T?')} />
        <Table rows={methodRows(RESULT_METHODS.methods, 'result')} />
      </>
    ),
    example:
      'fn half(n: int) -> int? => if n % 2 == 0 { Some(n / 2) } else { None }\n\nfn quarter(n: int) -> int? {\n  let h = half(n)?\n  half(h)\n}\n\nprint(quarter(12), quarter(6), quarter(6) ?? -1)\n',
  },
  {
    id: 'arrays',
    title: 'Arrays',
    summary: 'The [T] type and its methods',
    keywords:
      'array list [T] index push pop map filter reduce sort ' + methodWords(ARRAY_METHODS.methods),
    content: (
      <>
        <P>
          Arrays hold elements of one type. Index with <C>xs[i]</C> (bounds-checked). Methods that
          return arrays never modify the original; <C>push</C>, <C>pop</C>, <C>insert</C>,{' '}
          <C>remove</C> and <C>clear</C> do.
        </P>
        <Table rows={methodRows(ARRAY_METHODS.methods, '[T]')} />
      </>
    ),
    example:
      'var xs = [5, 3, 8, 1]\nxs.push(4)\nprint(xs.sort(), xs.reverse(), xs.sum(), xs.max())\nprint(xs.map(fn(x) => x * x).filter(fn(x) => x > 10))\nprint(xs.enumerate().take(2), xs.zip(["a", "b"]))\n',
  },
  {
    id: 'maps',
    title: 'Maps',
    summary: 'The [K: V] type and its methods',
    keywords: 'map dictionary hash key value entries ' + methodWords(MAP_METHODS.methods),
    content: (
      <>
        <P>
          Maps associate keys (int, float, string or bool) with values and remember insertion order.{' '}
          <C>m[key]</C> stops with an error if the key is missing; <C>m.get(key)</C> returns an
          option instead. The empty map is <C>[:]</C>.
        </P>
        <Table rows={methodRows(MAP_METHODS.methods, '[K: V]')} />
      </>
    ),
    example:
      'var stock: [string: int] = [:]\nstock["apples"] = 3\nstock["pears"] = 5\nstock["apples"] += 2\nprint(stock, stock.get("kiwis"), stock.keys())\nfor (fruit, n) in stock { print(fruit, n) }\n',
  },
  {
    id: 'strings',
    title: 'Strings & numbers',
    summary: 'String and number methods',
    keywords:
      'string text split join upper lower trim chars replace number abs floor round sqrt ' +
      methodWords(STRING_METHODS.methods),
    content: (
      <>
        <Table rows={methodRows(STRING_METHODS.methods, 'string')} />
        <Table rows={methodRows(NUMBER_METHODS.methods, 'N')} />
        <P>
          Every value also has <C>to_string()</C>.
        </P>
      </>
    ),
    example:
      'let s = "  Hello, Lumen  "\nprint(s.trim().upper(), s.contains("Lumen"), s.trim().split(", "))\nprint("ab".repeat(3), "lumen".chars().reverse().join(""), (2.7).round(), (-5).abs())\n',
  },
  {
    id: 'types',
    title: 'The type system',
    summary: 'Inference, annotations, aliases and generics',
    keywords:
      'type inference annotation alias generic unification static typed type_of tuple function type',
    content: (
      <>
        <P>
          Every expression has a static type, checked before the program runs. Types of variables,
          lambda parameters and function results are inferred by unification; write annotations when
          you want to be explicit or when there is nothing to infer from (like an empty array).
        </P>
        <Table
          head={['TYPE', 'EXAMPLE VALUE']}
          rows={[
            [<C key="1">int</C>, <C key="1b">42</C>],
            [<C key="2">float</C>, <C key="2b">3.14</C>],
            [<C key="3">bool</C>, <C key="3b">true</C>],
            [<C key="4">string</C>, <C key="4b">"text"</C>],
            [<C key="5">[int]</C>, <C key="5b">[1, 2, 3]</C>],
            [<C key="6">[string: int]</C>, <C key="6b">["a": 1]</C>],
            [<C key="7">(int, string)</C>, <C key="7b">(1, "one")</C>],
            [<C key="8">int?</C>, <C key="8b">Some(1)</C>],
            [<C key="9">{'result<int, string>'}</C>, <C key="9b">Ok(1)</C>],
            [<C key="10">{'fn(int) -> bool'}</C>, <C key="10b">{'fn(x: int) => x > 0'}</C>],
          ]}
        />
        <Code
          code={
            'type Grid = [[int]]          // type alias\nlet g: Grid = [[1, 2], [3, 4]]\nprint(type_of(g))           // [[int]]'
          }
        />
      </>
    ),
    example:
      'type Grid = [[int]]\nlet g: Grid = [[1, 2], [3, 4]]\nlet sums = g.map(fn(row) => row.sum())\nprint(type_of(g), type_of(sums), type_of(fn(x: int) => x > 0))\n',
  },
  {
    id: 'builtins',
    title: 'Built-in functions',
    summary: 'print, conversions, math and more',
    keywords:
      'builtin print str type_of assert panic math sqrt random parse_int parse_float clock min max abs PI E',
    content: (
      <Table
        rows={[
          ...BUILTIN_FUNCTIONS.map((f): [ReactNode, ReactNode] => [
            <Code key={f.name} inline code={f.signature} fontSize={12} />,
            f.doc,
          ]),
          [<Code key="pi" inline code="PI, E" fontSize={12} />, 'Mathematical constants (float)'],
        ]}
      />
    ),
    example:
      'print(sqrt(2.0), floor(2.7), max(3, 9), abs(-4))\nprint(parse_int("42"), parse_float("x"), random_int(1, 6))\nprint(type_of([1.0]), str([1, 2]))\n',
  },
];
