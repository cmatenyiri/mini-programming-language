# Lumen

**Lumen** is a small, statically typed programming language with type inference — and a playground
to write, inspect and run it, entirely in the browser. Source files use the `.lum` extension.

```lumen
enum Shape {
  Circle(float),
  Rect(float, float),
}

impl Shape {
  fn area(self) -> float {
    match self {
      Circle(r) => PI * r * r,
      Rect(w, h) => w * h,
    }
  }
}

let shapes = [Shape.Circle(1.5), Shape.Rect(2.0, 3.0)]
let total = shapes |> map(fn(s) => s.area()) |> reduce(0.0, fn(a, b) => a + b)
print("Total area: ${total}")   // total: float — inferred
```

## The language

- **Static types with inference** — every expression is type-checked before the program runs;
  variables, lambda parameters and return types are inferred (Hindley–Milner-style unification).
- **Types**: `int`, `float`, `bool`, `string`, arrays `[T]`, maps `[K: V]`, tuples `(A, B)`,
  functions `fn(A) -> B`, options `T?` and `result<T, E>`. No implicit numeric conversions (`as float`).
- **Bindings**: `let` (immutable) and `var` (mutable).
- **Functions**: typed signatures, expression bodies (`fn sq(x: int) => x * x`), closures,
  higher-order functions, generics (`fn first<T>(xs: [T]) -> T?`).
- **Data**: structs with `impl` methods and static functions, enums with data, generic structs/enums,
  type aliases.
- **Control flow**: `if`/`match` as expressions, `for` over ranges/arrays/maps/strings, `while`,
  `loop`, `break`, `continue`.
- **Pattern matching**: literals, ranges, tuples, variants, guards and `|` alternatives, with
  exhaustiveness checking and unreachable-arm warnings.
- **No null**: options (`Some`/`None`), results (`Ok`/`Err`), `??` fallbacks, `if let`, and the `?`
  operator for early returns.
- **Pipelines**: `xs |> filter(f) |> map(g) |> sum()`.
- **Helpful diagnostics**: precise spans, hints and "did you mean" suggestions; runtime errors with
  Lumen call stacks; integer overflow, bounds and division-by-zero checks.

## How it works

```
source ─▶ lexer ─▶ tokens ─▶ parser ─▶ AST ─▶ type checker ─▶ typed AST ─▶ code generator ─▶ JavaScript ─▶ runtime (Web Worker)
```

| Stage          | File                   | Notes                                                                   |
| -------------- | ---------------------- | ----------------------------------------------------------------------- |
| Lexer          | `src/lumen/lexer.ts`   | Tokens incl. string templates; also drives syntax highlighting          |
| Parser         | `src/lumen/parser.ts`  | Recursive descent + Pratt precedence, error recovery                    |
| Type checker   | `src/lumen/checker.ts` | Unification-based inference, generics, exhaustiveness (`patterns.ts`)   |
| Code generator | `src/lumen/codegen.ts` | Lowers expression-oriented Lumen to JavaScript (one JS fn per Lumen fn) |
| Runtime        | `src/lumen/runtime.ts` | Checked arithmetic, collections, formatting, call-stack tracking        |
| Worker         | `src/lumen/worker.ts`  | Runs programs off the main thread so infinite loops can be stopped      |

The playground (React + MUI + CodeMirror) shows every stage: a live pipeline bar, and **Tokens**,
**AST**, **Types** and **JS** (generated code) panels next to the editor. Hover any name to see its
inferred type; `Ctrl` + `Space` opens type-aware completions.

Everything runs client-side — there is no backend. Code is saved in the browser's local storage,
and **Share** creates a link with the program compressed into the URL.

## Development

Requires Node.js 22.12+ (see `.nvmrc`).

```bash
npm install
npm run dev           # start the dev server
npm run build         # type-check and build to dist/
npm run preview       # serve the production build
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
npm run typecheck     # TypeScript
```

Code style is enforced by ESLint and Prettier. The repository includes VS Code settings that format
on save and apply ESLint fixes (install the recommended extensions when prompted).

## CI and deployment

`.github/workflows/ci.yml` runs on every push and pull request:

1. **Lint, format & typecheck** — ESLint, Prettier and TypeScript.
2. **Build** — the production bundle.
3. **Deploy** — on pushes to `main`, the build is published to GitHub Pages.

One-time setup in your repository: **Settings → Pages → Build and deployment → Source: GitHub
Actions**. The app is built with relative asset paths, so it works under any repository name
without configuration.
