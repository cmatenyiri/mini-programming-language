import type { ComponentType, ReactNode } from 'react';
import { Code } from '../components/Code';
import { C, Muted, Points } from '../components/Prose';
import {
  CheckerViz,
  CodegenViz,
  HeroViz,
  LexerViz,
  ParserViz,
  PipelineViz,
} from './illustrations/compilerViz';
import {
  ControlFlowViz,
  DataViz,
  FunctionsViz,
  PipesViz,
  SafetyViz,
  VariablesViz,
} from './illustrations/languageViz';
import { PlaygroundViz } from './illustrations/playgroundViz';

export type Chapter = 'Welcome' | 'Under the hood' | 'The language' | 'Playground';

export interface TutorialStep {
  id: string;
  chapter: Chapter;
  title: string;
  lead: string;
  body: ReactNode;
  /** A runnable snippet for the "Try it" button. */
  snippet?: string;
  Illustration: ComponentType;
}

export const CHAPTERS: Chapter[] = ['Welcome', 'Under the hood', 'The language', 'Playground'];

export const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    chapter: 'Welcome',
    title: 'Meet Lumen',
    lead: 'A small but complete programming language, designed and built from scratch — and this is its playground.',
    body: (
      <Points
        items={[
          <>
            <b>Statically typed</b> — every value has a type that is checked <i>before</i> your
            program runs.
          </>,
          <>
            <b>Type inference</b> — you rarely write types; the compiler works them out for you.
          </>,
          <>
            <b>Modern features</b> — structs, enums, pattern matching, generics, closures, options
            instead of null, and the <C>|&gt;</C> pipe operator.
          </>,
          <>
            <b>Runs entirely in your browser</b> — no server. Your code is analyzed and executed
            locally.
          </>,
        ]}
      />
    ),
    Illustration: HeroViz,
  },
  {
    id: 'pipeline',
    chapter: 'Under the hood',
    title: 'From text to a running program',
    lead: 'Like real-world compilers, Lumen processes your code in a pipeline of stages. Each stage hands its result to the next.',
    body: (
      <>
        <Points
          items={[
            <>
              The <b>lexer</b> turns characters into tokens.
            </>,
            <>
              The <b>parser</b> arranges tokens into an abstract syntax tree (AST).
            </>,
            <>
              The <b>type checker</b> infers and verifies the type of every expression.
            </>,
            <>
              The <b>code generator</b> translates the typed tree into JavaScript.
            </>,
            <>
              The <b>runtime</b> executes it in a background thread and reports any errors.
            </>,
          ]}
        />
        <Muted>
          You can watch every stage live in the playground: the pipeline bar shows what each phase
          produced, and the Tokens, AST, Types and JS tabs let you inspect it.
        </Muted>
      </>
    ),
    Illustration: PipelineViz,
  },
  {
    id: 'lexer',
    chapter: 'Under the hood',
    title: 'Stage 1 · The lexer',
    lead: 'The lexer (or tokenizer) reads your program one character at a time and groups characters into tokens.',
    body: (
      <>
        <Points
          items={[
            <>
              A token is the smallest meaningful unit: a keyword like <C>let</C>, a name like{' '}
              <C>total</C>, a number like <C>2</C>, an operator like <C>*</C>.
            </>,
            <>
              Whitespace and comments are dropped. String templates such as <C>{'"Hi ${name}"'}</C>{' '}
              are split into text and embedded expressions.
            </>,
            <>Mistakes like an unterminated string are reported here, with their exact position.</>,
          ]}
        />
        <Muted>Fun fact: the editor’s syntax highlighting is powered by this very lexer.</Muted>
      </>
    ),
    Illustration: LexerViz,
  },
  {
    id: 'parser',
    chapter: 'Under the hood',
    title: 'Stage 2 · The parser & the AST',
    lead: 'The parser checks that tokens follow Lumen’s grammar and builds an abstract syntax tree — the structure of your program.',
    body: (
      <>
        <Points
          items={[
            <>
              Lumen uses a hand-written <b>recursive-descent parser</b> with{' '}
              <b>Pratt-style operator precedence</b>, so <C>price * 2 + 1</C> means{' '}
              <C>(price * 2) + 1</C>.
            </>,
            <>Statements end at a new line — no semicolons needed.</>,
            <>
              When something is wrong it recovers and keeps going, so you see all syntax errors at
              once.
            </>,
          ]}
        />
        <Muted>
          Open the AST tab to explore the tree of your own code — it follows your cursor.
        </Muted>
      </>
    ),
    Illustration: ParserViz,
  },
  {
    id: 'checker',
    chapter: 'Under the hood',
    title: 'Stage 3 · The type checker',
    lead: 'Before anything runs, the checker gives every expression a type and proves the program is consistent.',
    body: (
      <>
        <Points
          items={[
            <>
              Types are <b>inferred</b> with a Hindley–Milner-style algorithm: unknown types start
              as variables and are solved by <i>unification</i> as the checker learns more.
            </>,
            <>
              Function signatures are explicit; everything else — variables, lambda parameters,
              return types — can be inferred.
            </>,
            <>
              It also checks that <C>match</C> covers every case, catches typos (with suggestions)
              and warns about unused variables.
            </>,
          ]}
        />
        <Muted>Hover any name in the editor to see its inferred type.</Muted>
      </>
    ),
    Illustration: CheckerViz,
  },
  {
    id: 'codegen',
    chapter: 'Under the hood',
    title: 'Stage 4 · Code generation & runtime',
    lead: 'Finally, the code generator compiles the checked tree into JavaScript, and the runtime executes it.',
    body: (
      <>
        <Points
          items={[
            <>
              Lumen’s expression-oriented features — <C>if</C>, <C>match</C> and blocks that produce
              values — are <b>lowered</b> into plain JavaScript statements.
            </>,
            <>
              Every Lumen function becomes one JavaScript function, so programs run fast and can
              recurse thousands of levels deep.
            </>,
            <>
              A small <b>runtime library</b> adds what JavaScript lacks: overflow-checked integers,
              bounds checks, and Lumen call stacks in error messages.
            </>,
            <>
              Programs run in a <b>Web Worker</b> — a background thread — so even an infinite loop
              never freezes the page. You can always press Stop.
            </>,
          ]}
        />
        <Muted>Open the JS tab to read the code generated for your own program.</Muted>
      </>
    ),
    Illustration: CodegenViz,
  },
  {
    id: 'variables',
    chapter: 'The language',
    title: 'Variables & types',
    lead: 'Declare immutable bindings with let and mutable ones with var. Types are inferred from the value.',
    body: (
      <>
        <Code
          code={
            'let name = "Lumen"     // string\nvar count = 0          // int\ncount += 1\nlet ratio: float = 0.5 // optional annotation'
          }
        />
        <Muted>
          Built-in types: <C>int</C>, <C>float</C>, <C>bool</C>, <C>string</C>, arrays <C>[T]</C>,
          maps <C>[K: V]</C>, tuples <C>(A, B)</C> and options <C>T?</C>. Numbers never convert
          silently — use <C>as float</C>.
        </Muted>
      </>
    ),
    snippet:
      'let name = "Lumen"\nvar count = 0\ncount += 1\n\nlet ratio: float = count as float / 4.0\nlet point = (3, "three")\n\nprint("Hello, ${name}!", count, ratio, point)\nprint(type_of(point))\n',
    Illustration: VariablesViz,
  },
  {
    id: 'functions',
    chapter: 'The language',
    title: 'Functions & closures',
    lead: 'Functions declare parameter types; the return type can be written or inferred. Functions are values, too.',
    body: (
      <>
        <Code
          code={
            'fn add(a: int, b: int) -> int {\n  a + b\n}\nfn square(x: int) => x * x\n\nlet double = fn(x: int) => x * 2\nprint(add(3, 4), square(5), double(21))'
          }
        />
        <Muted>
          The last expression in a block is its value, so <C>return</C> is optional. Lambdas capture
          variables from where they are created (closures), and generic functions like{' '}
          <C>{'fn first<T>(xs: [T]) -> T?'}</C> work for any type.
        </Muted>
      </>
    ),
    snippet:
      'fn add(a: int, b: int) -> int {\n  a + b\n}\n\nfn square(x: int) => x * x\n\nfn make_counter() -> fn() -> int {\n  var n = 0\n  fn() -> int {\n    n += 1\n    n\n  }\n}\n\nlet next = make_counter()\nprint(add(3, 4), square(5))\nprint(next(), next(), next())\n',
    Illustration: FunctionsViz,
  },
  {
    id: 'control-flow',
    chapter: 'The language',
    title: 'Control flow',
    lead: 'if, match, for, while and loop — and if and match are expressions that produce values.',
    body: (
      <>
        <Code
          code={
            'for i in 1..=15 {\n  let label = match (i % 3, i % 5) {\n    (0, 0) => "FizzBuzz",\n    (0, _) => "Fizz",\n    (_, 0) => "Buzz",\n    _ => str(i),\n  }\n  print(label)\n}'
          }
        />
        <Muted>
          Ranges are written <C>0..10</C> (exclusive) or <C>0..=10</C> (inclusive). Use <C>break</C>{' '}
          and <C>continue</C> inside loops; <C>match</C> supports ranges, tuples, guards and{' '}
          <C>|</C> alternatives.
        </Muted>
      </>
    ),
    snippet:
      'for i in 1..=15 {\n  let label = match (i % 3, i % 5) {\n    (0, 0) => "FizzBuzz",\n    (0, _) => "Fizz",\n    (_, 0) => "Buzz",\n    _ => str(i),\n  }\n  print(label)\n}\n\nvar n = 27\nvar steps = 0\nwhile n != 1 {\n  n = if n % 2 == 0 { n / 2 } else { 3 * n + 1 }\n  steps += 1\n}\nprint("Collatz steps:", steps)\n',
    Illustration: ControlFlowViz,
  },
  {
    id: 'data',
    chapter: 'The language',
    title: 'Structs, enums & pattern matching',
    lead: 'Model your data with structs (named fields) and enums (a fixed set of variants that can carry data).',
    body: (
      <>
        <Code
          code={
            'enum Shape { Circle(float), Rect(float, float) }\n\nimpl Shape {\n  fn area(self) -> float {\n    match self {\n      Circle(r) => PI * r * r,\n      Rect(w, h) => w * h,\n    }\n  }\n}'
          }
        />
        <Muted>
          Add methods to any struct or enum with an <C>impl</C> block. Forget a variant in a{' '}
          <C>match</C> and the checker tells you exactly which one is missing.
        </Muted>
      </>
    ),
    snippet:
      'struct Point { x: float, y: float }\n\nenum Shape {\n  Circle(float),\n  Rect(float, float),\n}\n\nimpl Shape {\n  fn area(self) -> float {\n    match self {\n      Circle(r) => PI * r * r,\n      Rect(w, h) => w * h,\n    }\n  }\n}\n\nlet origin = Point { x: 0.0, y: 0.0 }\nlet shapes = [Shape.Circle(2.0), Shape.Rect(3.0, 4.0)]\nfor s in shapes {\n  print(s, "has area", s.area())\n}\nprint(origin)\n',
    Illustration: DataViz,
  },
  {
    id: 'collections',
    chapter: 'The language',
    title: 'Collections & pipelines',
    lead: 'Arrays, maps and strings come with a rich set of methods. The pipe operator |> chains them into readable data pipelines.',
    body: (
      <>
        <Code
          code={
            'let total = [1, 2, 3, 4, 5, 6]\n  |> filter(fn(n) => n % 2 == 0)\n  |> map(fn(n) => n * n)\n  |> sum()\n\nlet ages = ["ada": 36, "linus": 54]'
          }
        />
        <Muted>
          Notice there are no types on <C>n</C> — the checker infers them from the array. Methods
          include <C>map</C>, <C>filter</C>, <C>reduce</C>, <C>sort_by</C>, <C>zip</C>,{' '}
          <C>enumerate</C> and many more.
        </Muted>
      </>
    ),
    snippet:
      'let total = [1, 2, 3, 4, 5, 6]\n  |> filter(fn(n) => n % 2 == 0)\n  |> map(fn(n) => n * n)\n  |> sum()\nprint("sum of even squares:", total)\n\nvar ages = ["ada": 36, "linus": 54]\nages["grace"] = 85\nfor (name, age) in ages {\n  print("${name} is ${age}")\n}\n',
    Illustration: PipesViz,
  },
  {
    id: 'safety',
    chapter: 'The language',
    title: 'No null: options & results',
    lead: 'A value that might be missing has an option type (T?). Operations that can fail return a result.',
    body: (
      <>
        <Code
          code={
            'let user = users.get("ada")      // string?\nprint(user ?? "guest")\n\nif let Some(name) = user {\n  print("Hello, ${name}")\n}'
          }
        />
        <Muted>
          The compiler won’t let you use a <C>string?</C> as a <C>string</C> by accident. Inside
          functions, the <C>?</C> operator unwraps a value or returns the <C>None</C>/<C>Err</C>{' '}
          early.
        </Muted>
      </>
    ),
    snippet:
      'fn parse_age(text: string) -> result<int, string> {\n  match parse_int(text) {\n    Some(n) if n >= 0 => Ok(n),\n    Some(n) => Err("${n} is negative"),\n    None => Err("\'${text}\' is not a number"),\n  }\n}\n\nfn sum_ages(a: string, b: string) -> result<int, string> {\n  let x = parse_age(a)?\n  let y = parse_age(b)?\n  Ok(x + y)\n}\n\nprint(sum_ages("30", "12"))\nprint(sum_ages("30", "abc"))\n\nlet users = ["ada": "Ada Lovelace"]\nprint(users.get("ada") ?? "guest", users.get("bob") ?? "guest")\n',
    Illustration: SafetyViz,
  },
  {
    id: 'playground',
    chapter: 'Playground',
    title: 'Your playground',
    lead: 'Everything you need to write, run and understand Lumen programs — right here.',
    body: (
      <Points
        items={[
          <>
            Pick a program from <b>Examples</b>, or open your own <C>.lum</C> file.
          </>,
          <>
            Press <b>Run</b> (<kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>). Errors appear as you
            type.
          </>,
          <>
            Hover for types, press <kbd>Ctrl</kbd> + <kbd>Space</kbd> for completions.
          </>,
          <>
            Explore Tokens, AST, Types and JS to see how Lumen understands and compiles your code.
          </>,
          <>
            Your work is saved in this browser. <b>Share</b> creates a link with the code embedded.
          </>,
        ]}
      />
    ),
    Illustration: PlaygroundViz,
  },
];
