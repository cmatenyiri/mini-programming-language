export type ExampleCategory = 'Start here' | 'Language' | 'Data & types' | 'Showcase';

export interface Example {
  id: string;
  title: string;
  description: string;
  category: ExampleCategory;
  code: string;
}

const welcome = `// Welcome to Lumen ✦ a small, statically typed language
// that runs entirely in your browser.
//
// Press ▶ Run (or Ctrl/⌘ + Enter) to execute this file.
// Hover any name to see its inferred type.

struct Planet {
  name: string,
  moons: int,
  radius_km: float,
}

impl Planet {
  fn describe(self) -> string {
    let size = if self.radius_km > 20000.0 { "giant" } else { "rocky" }
    "\${self.name} is a \${size} world with \${self.moons} moon(s)"
  }
}

let planets = [
  Planet { name: "Mercury", moons: 0, radius_km: 2439.7 },
  Planet { name: "Earth", moons: 1, radius_km: 6371.0 },
  Planet { name: "Jupiter", moons: 95, radius_km: 69911.0 },
  Planet { name: "Neptune", moons: 16, radius_km: 24622.0 },
]

for planet in planets {
  print(planet.describe())
}

// Types are inferred: \`total_moons\` is an int, \`giants\` is a [string].
let total_moons = planets.map(fn(p) => p.moons).sum()
let giants = planets
  |> filter(fn(p) => p.radius_km > 20000.0)
  |> map(fn(p) => p.name)

print("Total moons:", total_moons)
print("Giants:", giants, "has type", type_of(giants))
`;

const hello = `// Variables: \`let\` is immutable, \`var\` can change.
let language = "Lumen"
let version = 1.0
var visits = 0

visits += 1
visits *= 10

// String interpolation works with any expression.
print("Hello from \${language} v\${version}!")
print("Visits: \${visits}, doubled: \${visits * 2}")

// Explicit type annotations are optional — but always checked.
let pi: float = 3.14159
let radius = 2.5
let area = pi * radius * radius
print("A circle with radius \${radius} has area \${area}")

// Numbers never convert implicitly. Use \`as\` to convert.
let items = 7
let average = 23.5 / items as float
print("Average:", average)

// Tuples group values of different types.
let point = (3, "three", true)
let (number, word, flag) = point
print(point, number, word, flag, point.1)
`;

const functions = `// Functions declare their parameter types.
// The return type can be written or inferred.
fn add(a: int, b: int) -> int {
  a + b // the last expression is the result
}

// Expression-bodied function with an inferred return type
fn square(x: int) => x * x

fn factorial(n: int) -> int {
  if n <= 1 { return 1 }
  n * factorial(n - 1)
}

fn fib(n: int) -> int {
  match n {
    0 | 1 => n,
    _ => fib(n - 1) + fib(n - 2),
  }
}

fn gcd(a: int, b: int) -> int => if b == 0 { a } else { gcd(b, a % b) }

print("add(2, 3) =", add(2, 3))
print("square(12) =", square(12))
print("10! =", factorial(10))
print("gcd(84, 36) =", gcd(84, 36))

let fibs = (0..15).map(fib)
print("Fibonacci:", fibs)

// Functions are values too.
let ops = [add, fn(a: int, b: int) => a * b, fn(a: int, b: int) => a - b]
for op in ops {
  print(op(20, 5))
}

// Generic functions work for any type.
fn repeat_all<T>(items: [T], times: int) -> [T] {
  var out: [T] = []
  for _ in 0..times {
    out = out.concat(items)
  }
  out
}
print(repeat_all(["la"], 3), repeat_all([1, 2], 2))
`;

const controlFlow = `// if / else is an expression
let temperature = 23
let feeling = if temperature > 25 { "hot" } else if temperature > 15 { "pleasant" } else { "cold" }
print("It feels \${feeling}")

// for loops over ranges (exclusive ..  and inclusive ..=)
for i in 1..=15 {
  let label = match (i % 3, i % 5) {
    (0, 0) => "FizzBuzz",
    (0, _) => "Fizz",
    (_, 0) => "Buzz",
    _ => str(i),
  }
  print(label)
}

// while loops
var n = 27
var steps = 0
while n != 1 {
  n = if n % 2 == 0 { n / 2 } else { 3 * n + 1 }
  steps += 1
}
print("Collatz(27) reaches 1 after \${steps} steps")

// loop + break, continue
var found = 0
var candidate = 100
loop {
  candidate += 1
  if candidate % 7 != 0 { continue }
  if candidate % 11 == 0 {
    found = candidate
    break
  }
}
print("First number > 100 divisible by 7 and 11:", found)

// Match with ranges and guards
fn classify(score: int) -> string {
  match score {
    90..=100 => "excellent",
    70..90 => "good",
    s if s < 0 => "invalid",
    _ => "keep going",
  }
}
for s in [95, 72, 40, -3] {
  print(s, "→", classify(s))
}
`;

const inference = `// Lumen is statically typed, but you rarely have to write types.
// Every expression below gets its type from the type checker
// (hover over the names in the editor to see them).

let count = 42                       // int
let ratio = 0.75                     // float
let names = ["Ada", "Grace", "Linus"]   // [string]
let ages = ["Ada": 36, "Grace": 85]  // [string: int]
let pair = (count, names)            // (int, [string])
let maybe = ages.get("Ada")          // int?

// Lambda parameter types are inferred from how they are used...
let lengths = names.map(fn(name) => name.len())   // [int]

// ...and from context, like the element type of the array.
let shout = fn(s: string) => s.upper() + "!"
let shouted = names.map(shout)

// Empty collections get their type from later use.
var scores = []
scores.push(9.5)                     // now scores: [float]

// Generic functions are instantiated per call.
fn first<T>(items: [T]) -> T? => items.get(0)

print(type_of(count), type_of(ratio), type_of(names))
print(type_of(ages), type_of(pair), type_of(maybe))
print(type_of(lengths), type_of(shout), type_of(scores))
print(type_of(first(names)), type_of(first(scores)))
print(shouted)
`;

const structs = `// Structs group named fields. Methods live in impl blocks.
struct Vec2 {
  x: float,
  y: float,
}

impl Vec2 {
  // A static function (no self) — call it as Vec2.new(...)
  fn new(x: float, y: float) -> Vec2 => Vec2 { x, y }
  fn zero() -> Vec2 => Vec2.new(0.0, 0.0)

  fn add(self, other: Vec2) -> Vec2 => Vec2.new(self.x + other.x, self.y + other.y)
  fn scale(self, k: float) -> Vec2 => Vec2.new(self.x * k, self.y * k)
  fn length(self) -> float => sqrt(self.x * self.x + self.y * self.y)
  fn to_string(self) -> string => "(\${self.x}, \${self.y})"
}

struct Particle {
  name: string,
  position: Vec2,
  velocity: Vec2,
}

impl Particle {
  fn step(self, dt: float) {
    self.position = self.position.add(self.velocity.scale(dt))
  }
}

let p = Particle {
  name: "photon",
  position: Vec2.zero(),
  velocity: Vec2.new(3.0, 4.0),
}

print("speed:", p.velocity.length())
for tick in 1..=3 {
  p.step(0.5)
  print("t=\${tick}: \${p.name} at \${p.position.to_string()}")
}
print(p)
`;

const enums = `// Enums are types with a fixed set of variants that can carry data.
enum Shape {
  Circle(float),
  Rect(float, float),
  Triangle(float, float, float),
}

impl Shape {
  fn area(self) -> float {
    match self {
      Circle(r) => PI * r * r,
      Rect(w, h) => w * h,
      Triangle(a, b, c) => {
        let s = (a + b + c) / 2.0
        sqrt(s * (s - a) * (s - b) * (s - c))
      },
    }
  }

  fn name(self) -> string {
    match self {
      Circle(_) => "circle",
      Rect(w, h) if w == h => "square",
      Rect(_, _) => "rectangle",
      Triangle(_, _, _) => "triangle",
    }
  }
}

let shapes = [Shape.Circle(1.5), Shape.Rect(2.0, 2.0), Shape.Rect(2.0, 5.0), Shape.Triangle(3.0, 4.0, 5.0)]
for shape in shapes {
  print("\${shape.name()}: area \${shape.area()}")
}

// Recursive enums make it easy to build trees — here, a tiny calculator.
enum Expr {
  Num(float),
  Add(Expr, Expr),
  Mul(Expr, Expr),
  Neg(Expr),
}

fn eval(e: Expr) -> float {
  match e {
    Num(v) => v,
    Add(a, b) => eval(a) + eval(b),
    Mul(a, b) => eval(a) * eval(b),
    Neg(inner) => -eval(inner),
  }
}

fn show(e: Expr) -> string {
  match e {
    Num(v) => str(v),
    Add(a, b) => "(\${show(a)} + \${show(b)})",
    Mul(a, b) => "\${show(a)} * \${show(b)}",
    Neg(inner) => "-\${show(inner)}",
  }
}

let expr = Expr.Mul(Expr.Add(Expr.Num(2.0), Expr.Num(3.0)), Expr.Neg(Expr.Num(4.0)))
print(show(expr), "=", eval(expr))

// The checker makes sure every case is handled.
// Try deleting one of the arms in \`eval\` above!
`;

const closures = `// Functions capture their environment (closures).
fn make_counter(step: int) -> fn() -> int {
  var count = 0
  fn() -> int {
    count += step
    count
  }
}

let by_one = make_counter(1)
let by_ten = make_counter(10)
print(by_one(), by_one(), by_one())
print(by_ten(), by_ten())

// Higher-order functions take or return functions.
fn compose(f: fn(int) -> int, g: fn(int) -> int) -> fn(int) -> int {
  fn(x) => g(f(x))
}
let inc = fn(x: int) => x + 1
let double = fn(x: int) => x * 2
print(compose(inc, double)(5), compose(double, inc)(5))

// The pipe operator |> feeds a value into the next call.
fn clamp_to_100(x: int) => min(x, 100)
let result = 7 |> double |> double |> clamp_to_100
print("piped:", result)

// Pipes also work with methods — great for data pipelines.
let words = "the quick brown fox jumps over the lazy dog".split(" ")
let report = words
  |> filter(fn(w) => w.len() > 3)
  |> map(fn(w) => w.upper())
  |> sort()
  |> join(", ")
print(report)

let total = (1..=100)
  |> filter(fn(n) => n % 3 == 0 || n % 5 == 0)
  |> reduce(0, fn(acc, n) => acc + n)
print("Sum of multiples of 3 or 5 up to 100:", total)
`;

const collections = `// Arrays
var primes = [2, 3, 5, 7]
primes.push(11)
print(primes, "length:", primes.len(), "last:", primes.last())
print("contains 5?", primes.contains(5), "index of 7:", primes.index_of(7))
print("squares:", primes.map(fn(p) => p * p))
print("evens:", (1..=10).filter(fn(n) => n % 2 == 0))
print("enumerate:", ["a", "b", "c"].enumerate())

// Maps use [key: value] literals
let text = "the cat and the hat and the bat"
var freq: [string: int] = [:]
for word in text.split(" ") {
  freq[word] = freq.get(word).unwrap_or(0) + 1
}
print(freq)

// Iterate maps as (key, value) tuples
let ranked = freq.entries().sort_by(fn(e) => -e.1)
for (word, n) in ranked.take(3) {
  print("\${word.pad_end(5, " ")} \${"█".repeat(n)} \${n}")
}

// Strings have handy methods too
let title = "  lumen: light for your code  "
print(title.trim().upper(), title.contains("light"), title.trim().split(": "))

// Nested collections
let grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
let transposed = (0..3).map(fn(c) => grid.map(fn(row) => row[c]))
print("grid:", grid)
print("transposed:", transposed)
print("diagonal sum:", (0..3).map(fn(i) => grid[i][i]).sum())
`;

const optionResult = `// No null! Missing values are options: T? (Some(value) or None)
fn find_user(id: int) -> string? {
  match id {
    1 => Some("ada"),
    2 => Some("grace"),
    _ => None,
  }
}

// Handle options with if let, match, or ?? for a fallback
if let Some(name) = find_user(1) {
  print("found", name)
}
print(find_user(7) ?? "nobody")

// Errors are values too: result<T, E> is Ok(value) or Err(error)
fn parse_age(text: string) -> result<int, string> {
  match parse_int(text) {
    Some(n) if n >= 0 && n < 150 => Ok(n),
    Some(n) => Err("\${n} is not a realistic age"),
    None => Err("'\${text}' is not a number"),
  }
}

// The ? operator returns early when something fails
fn total_age(a: string, b: string) -> result<int, string> {
  let x = parse_age(a)?
  let y = parse_age(b)?
  Ok(x + y)
}

for (a, b) in [("30", "12"), ("41", "abc"), ("200", "1")] {
  match total_age(a, b) {
    Ok(sum) => print("✔ \${a} + \${b} = \${sum}"),
    Err(msg) => print("✘ \${msg}"),
  }
}

// Options compose nicely
let scores = ["ann": 92, "bo": 78]
let bonus = scores.get("ann").map(fn(s) => s + 5)
print("bonus:", bonus, "missing:", scores.get("cy").map(fn(s) => s + 5))
`;

const generics = `// Generic types work with any element type.
struct Stack<T> {
  items: [T],
}

impl Stack {
  fn new() -> Stack<T> => Stack { items: [] }
  fn push(self, item: T) { self.items.push(item) }
  fn pop(self) -> T? => self.items.pop()
  fn peek(self) -> T? => self.items.last()
  fn size(self) -> int => self.items.len()
}

let stack: Stack<string> = Stack.new()
stack.push("first")
stack.push("second")
print(stack.peek(), stack.size())
print(stack.pop(), stack.pop(), stack.pop())

// Generic functions
fn swap<A, B>(pair: (A, B)) -> (B, A) => (pair.1, pair.0)
fn last_or<T>(items: [T], fallback: T) -> T => items.last() ?? fallback

print(swap((1, "one")), swap(("pi", 3.14)))
print(last_or([1, 2, 3], 0), last_or([], "empty"))

// Generic enums
enum Tree<T> {
  Leaf,
  Node(Tree<T>, T, Tree<T>),
}

fn insert(tree: Tree<int>, value: int) -> Tree<int> {
  match tree {
    Leaf => Tree.Node(Tree.Leaf, value, Tree.Leaf),
    Node(left, v, right) => if value < v {
      Tree.Node(insert(left, value), v, right)
    } else {
      Tree.Node(left, v, insert(right, value))
    },
  }
}

fn in_order<T>(tree: Tree<T>) -> [T] {
  match tree {
    Leaf => [],
    Node(left, v, right) => in_order(left).concat([v]).concat(in_order(right)),
  }
}

var tree: Tree<int> = Tree.Leaf
for n in [50, 30, 70, 20, 40, 60, 80] {
  tree = insert(tree, n)
}
print("sorted via BST:", in_order(tree))
`;

const sorting = `// Classic algorithms, written in Lumen.
fn quicksort(xs: [int]) -> [int] {
  if xs.len() <= 1 { return xs }
  let pivot = xs[xs.len() / 2]
  let less = xs.filter(fn(x) => x < pivot)
  let equal = xs.filter(fn(x) => x == pivot)
  let greater = xs.filter(fn(x) => x > pivot)
  quicksort(less).concat(equal).concat(quicksort(greater))
}

fn bubble_sort(input: [int]) -> [int] {
  var xs = input.slice(0, input.len())
  let n = xs.len()
  for i in 0..n {
    for j in 0..n - i - 1 {
      if xs[j] > xs[j + 1] {
        let tmp = xs[j]
        xs[j] = xs[j + 1]
        xs[j + 1] = tmp
      }
    }
  }
  xs
}

fn binary_search(xs: [int], target: int) -> int? {
  var lo = 0
  var hi = xs.len() - 1
  while lo <= hi {
    let mid = (lo + hi) / 2
    if xs[mid] == target { return Some(mid) }
    if xs[mid] < target { lo = mid + 1 } else { hi = mid - 1 }
  }
  None
}

let data = (0..20).map(fn(_) => random_int(1, 99))
print("data:      ", data)
let sorted = quicksort(data)
print("quicksort: ", sorted)
assert(sorted == bubble_sort(data), "both sorts must agree")
assert(sorted == data.sort(), "and match the builtin sort")
print("bubble sort agrees ✔")

let needle = sorted[7]
match binary_search(sorted, needle) {
  Some(i) => print("found \${needle} at index \${i}"),
  None => print("\${needle} not found"),
}
`;

const mandelbrot = `// ASCII Mandelbrot set
let width = 72
let height = 28
let max_iter = 60
let palette = " .:-=+*#%@".chars()

for row in 0..height {
  var line = ""
  for col in 0..width {
    let cx = (col as float) / (width as float) * 3.5 - 2.5
    let cy = (row as float) / (height as float) * 2.4 - 1.2
    var x = 0.0
    var y = 0.0
    var i = 0
    while x * x + y * y < 4.0 && i < max_iter {
      let next_x = x * x - y * y + cx
      y = 2.0 * x * y + cy
      x = next_x
      i += 1
    }
    let shade = if i == max_iter { 0 } else { i % (palette.len() - 1) + 1 }
    line += palette[shade]
  }
  print(line)
}
`;

const life = `// Conway's Game of Life on a small torus
let rows = 12
let cols = 30

fn neighbors(grid: [[bool]], r: int, c: int) -> int {
  var count = 0
  for dr in -1..=1 {
    for dc in -1..=1 {
      if dr == 0 && dc == 0 { continue }
      let rr = (r + dr + rows) % rows
      let cc = (c + dc + cols) % cols
      if grid[rr][cc] { count += 1 }
    }
  }
  count
}

fn step(grid: [[bool]]) -> [[bool]] {
  (0..rows).map(fn(r) => (0..cols).map(fn(c) => {
    let n = neighbors(grid, r, c)
    match (grid[r][c], n) {
      (true, 2) | (true, 3) => true,
      (false, 3) => true,
      _ => false,
    }
  }))
}

fn render(grid: [[bool]]) -> string {
  grid.map(fn(row) => row.map(fn(alive) => if alive { "●" } else { "·" }).join("")).join("\\n")
}

// A glider and a blinker
var grid = (0..rows).map(fn(_) => (0..cols).map(fn(_) => false))
for (r, c) in [(1, 2), (2, 3), (3, 1), (3, 2), (3, 3), (6, 20), (6, 21), (6, 22)] {
  grid[r][c] = true
}

for generation in 0..4 {
  print("Generation \${generation}:")
  print(render(grid))
  print("")
  grid = step(grid)
}
`;

const primes = `// Sieve of Eratosthenes + a few number-theory helpers
fn sieve(limit: int) -> [int] {
  var is_prime = (0..=limit).map(fn(_) => true)
  is_prime[0] = false
  is_prime[1] = false
  var p = 2
  while p * p <= limit {
    if is_prime[p] {
      var multiple = p * p
      while multiple <= limit {
        is_prime[multiple] = false
        multiple += p
      }
    }
    p += 1
  }
  is_prime.enumerate().filter(fn(e) => e.1).map(fn(e) => e.0)
}

let primes = sieve(200)
print("\${primes.len()} primes below 200:")
print(primes)

let twins = primes.zip(primes.skip(1)).filter(fn(pair) => pair.1 - pair.0 == 2)
print("twin primes:", twins.take(8))

fn digits_sum(n: int) -> int => str(n).chars().map(fn(d) => parse_int(d) ?? 0).sum()
print("primes with digit sum 10:", primes.filter(fn(p) => digits_sum(p) == 10))

let start = clock()
let big = sieve(100000)
print("found \${big.len()} primes below 100,000 in \${round(clock() - start)} ms")
`;

const errorsTour = `// The type checker catches mistakes before anything runs.
// This file has deliberate errors: open the Problems tab,
// or hover the red squiggles. Fix them one by one!

struct User {
  name: string,
  age: int,
}

fn greet(user: User) -> string {
  "Hello, " + user.name + "!"
}

// 1. A string is not an int
let age: int = "thirty"

// 2. Missing field
let ada = User { name: "Ada" }

// 3. Numbers never convert implicitly
let half = 10 / 2.0

// 4. Typos get suggestions
print(gret(ada))

// 5. Options must be unwrapped before use
let maybe = [1, 2, 3].first()
print(maybe + 1)

// 6. Non-exhaustive match
enum Light { Red, Yellow, Green }
fn next(l: Light) -> Light {
  match l {
    Red => Light.Green,
    Green => Light.Yellow,
  }
}

print(age, half, next(Light.Red))
`;

export const EXAMPLES: Example[] = [
  {
    id: 'welcome',
    title: 'Welcome tour',
    description: 'Structs, methods, pipelines and inference in one file',
    category: 'Start here',
    code: welcome,
  },
  {
    id: 'hello',
    title: 'Variables & strings',
    description: 'let, var, interpolation, tuples',
    category: 'Start here',
    code: hello,
  },
  {
    id: 'inference',
    title: 'Type inference',
    description: 'See what the checker figures out on its own',
    category: 'Start here',
    code: inference,
  },
  {
    id: 'functions',
    title: 'Functions & recursion',
    description: 'Typed signatures, recursion, generics',
    category: 'Language',
    code: functions,
  },
  {
    id: 'control-flow',
    title: 'Control flow',
    description: 'if, match, for, while, loop, break',
    category: 'Language',
    code: controlFlow,
  },
  {
    id: 'closures',
    title: 'Closures & pipes',
    description: 'Higher-order functions and |>',
    category: 'Language',
    code: closures,
  },
  {
    id: 'errors',
    title: 'Error tour',
    description: 'Watch the type checker catch bugs',
    category: 'Language',
    code: errorsTour,
  },
  {
    id: 'structs',
    title: 'Structs & methods',
    description: 'Records with behavior via impl',
    category: 'Data & types',
    code: structs,
  },
  {
    id: 'enums',
    title: 'Enums & matching',
    description: 'Algebraic data types, exhaustive match',
    category: 'Data & types',
    code: enums,
  },
  {
    id: 'collections',
    title: 'Arrays, maps & strings',
    description: 'Builtin collections and methods',
    category: 'Data & types',
    code: collections,
  },
  {
    id: 'option-result',
    title: 'Options & results',
    description: 'No null — safe error handling with ?',
    category: 'Data & types',
    code: optionResult,
  },
  {
    id: 'generics',
    title: 'Generics',
    description: 'Generic structs, enums and functions',
    category: 'Data & types',
    code: generics,
  },
  {
    id: 'sorting',
    title: 'Sorting & searching',
    description: 'Quicksort, bubble sort, binary search',
    category: 'Showcase',
    code: sorting,
  },
  {
    id: 'mandelbrot',
    title: 'Mandelbrot set',
    description: 'Floating-point art in ASCII',
    category: 'Showcase',
    code: mandelbrot,
  },
  {
    id: 'life',
    title: 'Game of Life',
    description: "Conway's cellular automaton",
    category: 'Showcase',
    code: life,
  },
  {
    id: 'primes',
    title: 'Prime sieve',
    description: 'Number crunching and zipped arrays',
    category: 'Showcase',
    code: primes,
  },
];

export const DEFAULT_EXAMPLE = EXAMPLES[0];
