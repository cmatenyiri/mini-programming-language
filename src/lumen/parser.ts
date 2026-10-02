import type * as A from './ast';
import { type Diagnostic, LumenError, type Span, joinSpans } from './diagnostics';
import { Lexer } from './lexer';
import { type Token, type TokenKind, describeToken } from './tokens';

export interface ParseResult {
  program: A.Program;
  diagnostics: Diagnostic[];
  nodeCount: number;
}

const MAX_ERRORS = 40;

const STATEMENT_START: ReadonlySet<string> = new Set([
  'let',
  'var',
  'fn',
  'struct',
  'enum',
  'impl',
  'type',
  'for',
  'while',
  'loop',
  'return',
  'if',
  'match',
]);

const ASSIGN_OPS: ReadonlySet<string> = new Set(['=', '+=', '-=', '*=', '/=', '%=']);

/** Binding power of infix operators (higher binds tighter). */
const INFIX_PRECEDENCE: Partial<Record<TokenKind, number>> = {
  '|>': 1,
  '??': 2,
  '||': 3,
  '&&': 4,
  '==': 5,
  '!=': 5,
  '<': 6,
  '<=': 6,
  '>': 6,
  '>=': 6,
  '..': 7,
  '..=': 7,
  '+': 8,
  '-': 8,
  '*': 9,
  '/': 9,
  '%': 9,
  as: 10,
};

const isPascal = (name: string) => /^[A-Z]/.test(name);

/**
 * A recursive-descent parser with Pratt-style operator precedence.
 *
 * Statements are separated by newlines (or optional semicolons). Binary operators and
 * `.` may continue an expression on the next line, while `(`, `[` and `{` must stay on
 * the same line to be treated as a call, index or struct literal.
 */
export class Parser {
  private readonly tokens: Token[];
  private pos = 0;
  private readonly diagnostics: Diagnostic[];
  private allowStruct = true;
  private nodeCount = 0;
  /** Names declared with `struct` / as enum variants anywhere in the file (pre-scanned). */
  private readonly structNames: Set<string>;
  private readonly variantNames: Set<string>;

  private readonly source: string;

  constructor(
    source: string,
    tokens: Token[],
    diagnostics: Diagnostic[] = [],
    names?: { structs: Set<string>; variants: Set<string> },
  ) {
    this.source = source;
    this.tokens = tokens.filter((t) => t.kind !== 'comment');
    this.diagnostics = diagnostics;
    const scanned = names ?? Parser.scanDeclaredNames(this.tokens);
    this.structNames = scanned.structs;
    this.variantNames = scanned.variants;
  }

  /** Collects struct and enum-variant names so their syntax is recognized regardless of naming style. */
  private static scanDeclaredNames(tokens: Token[]): {
    structs: Set<string>;
    variants: Set<string>;
  } {
    const structs = new Set<string>();
    const variants = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i].kind === 'struct' && tokens[i + 1].kind === 'ident')
        structs.add(tokens[i + 1].text);
      if (tokens[i].kind !== 'enum') continue;
      let j = i + 1;
      while (j < tokens.length && tokens[j].kind !== '{' && tokens[j].kind !== 'eof') j++;
      let depth = 0;
      for (; j < tokens.length && tokens[j].kind !== 'eof'; j++) {
        const t = tokens[j];
        if (t.kind === '{' || t.kind === '(') depth++;
        else if (t.kind === '}' || t.kind === ')') {
          depth--;
          if (depth === 0) break;
        } else if (depth === 1 && t.kind === 'ident') {
          const prev = tokens[j - 1].kind;
          if (prev === '{' || prev === ',' || t.nlBefore) variants.add(t.text);
        }
      }
    }
    return { structs, variants };
  }

  private isStructName(name: string): boolean {
    return isPascal(name) || this.structNames.has(name);
  }

  private isVariantName(name: string): boolean {
    return isPascal(name) || this.variantNames.has(name);
  }

  static parse(source: string, tokens: Token[]): ParseResult {
    const parser = new Parser(source, tokens);
    const program = parser.parseProgram();
    return { program, diagnostics: parser.diagnostics, nodeCount: parser.nodeCount };
  }

  /* ─────────────────────────── token helpers ─────────────────────────── */

  private get peek(): Token {
    return this.tokens[this.pos];
  }

  private peekAt(offset: number): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private get previous(): Token {
    return this.tokens[Math.max(0, this.pos - 1)];
  }

  private at(kind: TokenKind): boolean {
    return this.peek.kind === kind;
  }

  private advance(): Token {
    const token = this.peek;
    if (token.kind !== 'eof') this.pos++;
    return token;
  }

  private eat(kind: TokenKind): Token | undefined {
    return this.at(kind) ? this.advance() : undefined;
  }

  private expect(kind: TokenKind, context?: string, hint?: string): Token {
    if (this.at(kind)) return this.advance();
    const where = context ? ` ${context}` : '';
    throw this.error(
      `Expected '${kind}'${where}, found ${describeToken(this.peek)}`,
      this.peek.span,
      hint,
    );
  }

  private expectIdent(context: string): Token {
    if (this.at('ident')) return this.advance();
    throw this.error(`Expected ${context}, found ${describeToken(this.peek)}`, this.peek.span);
  }

  private error(message: string, span: Span, hint?: string): LumenError {
    return new LumenError('parser', message, span, hint);
  }

  private spanFrom(start: Span): Span {
    return joinSpans(start, this.previous.span);
  }

  private node<T extends { span: Span }>(node: T): T {
    this.nodeCount++;
    return node;
  }

  private report(err: unknown) {
    if (!(err instanceof LumenError)) throw err;
    if (this.diagnostics.length < MAX_ERRORS) this.diagnostics.push(err.toDiagnostic());
  }

  /**
   * Skips tokens until a plausible statement boundary: a new line outside of any braces,
   * where either all parentheses are balanced or the line starts with a statement keyword.
   */
  private synchronize() {
    let braces = 0;
    let parens = 0;
    const startPos = this.pos;
    while (!this.at('eof')) {
      const t = this.peek;
      if (
        t.nlBefore &&
        braces === 0 &&
        (STATEMENT_START.has(t.kind) || (parens <= 0 && this.pos > startPos))
      ) {
        return;
      }
      if (t.kind === '{') braces++;
      else if (t.kind === '(' || t.kind === '[') parens++;
      else if (t.kind === ')' || t.kind === ']') parens--;
      else if (t.kind === '}') {
        if (braces === 0) return;
        braces--;
      } else if (t.kind === ';' && braces === 0) {
        this.advance();
        return;
      }
      this.advance();
    }
  }

  private withStruct<T>(allow: boolean, fn: () => T): T {
    const saved = this.allowStruct;
    this.allowStruct = allow;
    try {
      return fn();
    } finally {
      this.allowStruct = saved;
    }
  }

  /** Statements must be followed by a newline, `;`, `}` or the end of input. */
  private endStatement(): boolean {
    if (this.eat(';')) return true;
    if (this.at('}') || this.at('eof') || this.peek.nlBefore) return false;
    throw this.error(
      `Unexpected ${describeToken(this.peek)} — expected a new line or ';'`,
      this.peek.span,
      'Put each statement on its own line, or separate them with ";"',
    );
  }

  /* ─────────────────────────── program & statements ─────────────────────────── */

  parseProgram(): A.Program {
    const body: A.Stmt[] = [];
    while (!this.at('eof')) {
      if (this.eat(';')) continue;
      const before = this.pos;
      try {
        body.push(this.parseStatement());
      } catch (err) {
        this.report(err);
        this.synchronize();
        if (this.at('}')) this.advance();
        if (this.pos === before) this.advance();
      }
    }
    const end = this.peek.span.end;
    return { kind: 'Program', body, span: { start: 0, end } };
  }

  private parseBlock(context = 'to start a block'): A.Block {
    const open = this.expect('{', context);
    const stmts: A.Stmt[] = [];
    this.withStruct(true, () => {
      while (!this.at('}') && !this.at('eof')) {
        if (this.eat(';')) continue;
        const before = this.pos;
        try {
          stmts.push(this.parseStatement());
        } catch (err) {
          this.report(err);
          this.synchronize();
          if (this.pos === before && !this.at('}')) this.advance();
        }
      }
    });
    if (!this.at('}')) {
      throw this.error("Unclosed block — expected '}'", open.span, "Add a matching '}'");
    }
    this.advance();
    return this.node({ kind: 'Block', stmts, span: this.spanFrom(open.span) });
  }

  private parseStatement(): A.Stmt {
    const t = this.peek;
    switch (t.kind) {
      case 'let':
      case 'var':
        return this.parseLet();
      case 'return':
        return this.parseReturn();
      case 'break':
      case 'continue': {
        this.advance();
        const stmt = this.node({
          kind: t.kind === 'break' ? ('Break' as const) : ('Continue' as const),
          span: t.span,
        });
        this.endStatement();
        return stmt;
      }
      case 'while':
        return this.parseWhile();
      case 'for':
        return this.parseFor();
      case 'loop': {
        this.advance();
        const body = this.parseBlock("after 'loop'");
        const stmt = this.node({ kind: 'Loop' as const, body, span: this.spanFrom(t.span) });
        this.endStatement();
        return stmt;
      }
      case 'fn':
        if (this.peekAt(1).kind === 'ident') {
          const decl = this.parseFnDecl(false);
          this.endStatement();
          return decl;
        }
        break;
      case 'struct':
        return this.finish(this.parseStruct());
      case 'enum':
        return this.finish(this.parseEnum());
      case 'impl':
        return this.finish(this.parseImpl());
      case 'type':
        return this.finish(this.parseTypeAlias());
    }
    return this.parseExpressionStatement();
  }

  private finish<T extends A.Stmt>(stmt: T): T {
    this.endStatement();
    return stmt;
  }

  private parseLet(): A.LetStmt {
    const kw = this.advance();
    const pattern = this.parsePattern(false);
    if (
      pattern.kind !== 'BindingPattern' &&
      pattern.kind !== 'TuplePattern' &&
      pattern.kind !== 'WildcardPattern'
    ) {
      throw this.error(
        `'${kw.kind}' only supports names and tuple destructuring`,
        pattern.span,
        'Use `if let` or `match` for refutable patterns',
      );
    }
    let typeAnn: A.TypeExpr | undefined;
    if (this.eat(':')) typeAnn = this.parseType();
    if (!this.at('=')) {
      throw this.error(
        `Variables must be initialized — expected '=' after ${
          pattern.kind === 'BindingPattern' ? `'${pattern.name}'` : 'the pattern'
        }`,
        this.peek.span,
        typeAnn ? undefined : `e.g. ${kw.kind} name = value`,
      );
    }
    this.advance();
    const init = this.parseExpression();
    const stmt = this.node<A.LetStmt>({
      kind: 'Let',
      mutable: kw.kind === 'var',
      pattern,
      typeAnn,
      init,
      span: this.spanFrom(kw.span),
    });
    this.endStatement();
    return stmt;
  }

  private parseReturn(): A.ReturnStmt {
    const kw = this.advance();
    let value: A.Expr | undefined;
    if (!this.at('}') && !this.at(';') && !this.at('eof') && !this.peek.nlBefore) {
      value = this.parseExpression();
    }
    const stmt = this.node<A.ReturnStmt>({ kind: 'Return', value, span: this.spanFrom(kw.span) });
    this.endStatement();
    return stmt;
  }

  private parseWhile(): A.WhileStmt {
    const kw = this.advance();
    const cond = this.withStruct(false, () => this.parseExpression());
    const body = this.parseBlock('after the while condition');
    const stmt = this.node<A.WhileStmt>({
      kind: 'While',
      cond,
      body,
      span: this.spanFrom(kw.span),
    });
    this.endStatement();
    return stmt;
  }

  private parseFor(): A.ForStmt {
    const kw = this.advance();
    const pattern = this.parsePattern(false);
    this.expect('in', 'in for loop', 'for item in items { ... }');
    const iterable = this.withStruct(false, () => this.parseExpression());
    const body = this.parseBlock('after the for loop header');
    const stmt = this.node<A.ForStmt>({
      kind: 'For',
      pattern,
      iterable,
      body,
      span: this.spanFrom(kw.span),
    });
    this.endStatement();
    return stmt;
  }

  private parseExpressionStatement(): A.Stmt {
    const expr = this.parseExpression();
    if (ASSIGN_OPS.has(this.peek.kind)) {
      const opToken = this.advance();
      if (expr.kind !== 'Ident' && expr.kind !== 'Member' && expr.kind !== 'Index') {
        throw this.error(
          'Invalid assignment target',
          expr.span,
          'You can assign to variables, fields and indexes',
        );
      }
      const value = this.parseExpression();
      const stmt = this.node<A.AssignStmt>({
        kind: 'Assign',
        op: opToken.kind as A.AssignOp,
        target: expr,
        value,
        span: joinSpans(expr.span, value.span),
      });
      this.endStatement();
      return stmt;
    }
    const stmt = this.node<A.ExprStmt>({ kind: 'ExprStmt', expr, semi: false, span: expr.span });
    stmt.semi = this.endStatement();
    return stmt;
  }

  /* ─────────────────────────── declarations ─────────────────────────── */

  private parseTypeParams(): { name: string; span: Span }[] {
    const params: { name: string; span: Span }[] = [];
    if (!this.eat('<')) return params;
    do {
      if (this.at('>')) break;
      const id = this.expectIdent('a type parameter name');
      params.push({ name: id.text, span: id.span });
    } while (this.eat(','));
    this.expect('>', 'to close the type parameter list');
    return params;
  }

  private parseFnDecl(inImpl: boolean): A.FnDecl {
    const kw = this.expect('fn');
    const name = this.expectIdent('a function name');
    const typeParams = this.parseTypeParams();
    this.expect('(', `after function name '${name.text}'`);
    const params: A.FnParam[] = [];
    while (!this.at(')')) {
      if (this.at('self')) {
        const selfTok = this.advance();
        if (!inImpl)
          throw this.error("'self' parameters are only allowed in impl blocks", selfTok.span);
        if (params.length > 0) throw this.error("'self' must be the first parameter", selfTok.span);
        params.push({ name: 'self', span: selfTok.span, isSelf: true });
      } else {
        const id = this.expectIdent('a parameter name');
        if (!this.at(':')) {
          throw this.error(
            `Parameter '${id.text}' needs a type annotation`,
            id.span,
            `e.g. ${id.text}: int — function signatures are explicitly typed`,
          );
        }
        this.advance();
        const type = this.parseType();
        params.push({ name: id.text, type, span: joinSpans(id.span, type.span), isSelf: false });
      }
      if (!this.eat(',')) break;
    }
    this.expect(')', 'to close the parameter list');
    let ret: A.TypeExpr | undefined;
    if (this.eat('->')) ret = this.parseType();
    let body: A.Expr;
    if (this.eat('=>')) {
      body = this.parseExpression();
    } else {
      body = this.parseBlock(`to start the body of '${name.text}'`);
    }
    return this.node<A.FnDecl>({
      kind: 'FnDecl',
      name: name.text,
      nameSpan: name.span,
      typeParams,
      params,
      ret,
      body,
      span: this.spanFrom(kw.span),
    });
  }

  private parseStruct(): A.StructDecl {
    const kw = this.advance();
    const name = this.expectIdent('a struct name');
    const typeParams = this.parseTypeParams();
    this.expect('{', `to start struct '${name.text}'`);
    const fields: A.StructDecl['fields'] = [];
    while (!this.at('}') && !this.at('eof')) {
      const id = this.expectIdent('a field name');
      this.expect(':', `after field '${id.text}'`);
      const type = this.parseType();
      fields.push({ name: id.text, type, span: joinSpans(id.span, type.span) });
      if (!this.eat(',') && !this.at('}') && !this.peek.nlBefore) {
        throw this.error(`Expected ',' or a new line after field '${id.text}'`, this.peek.span);
      }
    }
    this.expect('}', `to close struct '${name.text}'`);
    return this.node<A.StructDecl>({
      kind: 'StructDecl',
      name: name.text,
      nameSpan: name.span,
      typeParams,
      fields,
      span: this.spanFrom(kw.span),
    });
  }

  private parseEnum(): A.EnumDecl {
    const kw = this.advance();
    const name = this.expectIdent('an enum name');
    const typeParams = this.parseTypeParams();
    this.expect('{', `to start enum '${name.text}'`);
    const variants: A.EnumDecl['variants'] = [];
    while (!this.at('}') && !this.at('eof')) {
      const id = this.expectIdent('a variant name');
      const fields: A.TypeExpr[] = [];
      if (this.eat('(')) {
        while (!this.at(')')) {
          fields.push(this.parseType());
          if (!this.eat(',')) break;
        }
        this.expect(')', `to close variant '${id.text}'`);
      }
      variants.push({ name: id.text, fields, span: this.spanFrom(id.span) });
      if (!this.eat(',') && !this.at('}') && !this.peek.nlBefore) {
        throw this.error(`Expected ',' or a new line after variant '${id.text}'`, this.peek.span);
      }
    }
    this.expect('}', `to close enum '${name.text}'`);
    return this.node<A.EnumDecl>({
      kind: 'EnumDecl',
      name: name.text,
      nameSpan: name.span,
      typeParams,
      variants,
      span: this.spanFrom(kw.span),
    });
  }

  private parseImpl(): A.ImplDecl {
    const kw = this.advance();
    const name = this.expectIdent('a type name');
    if (this.at('<')) {
      throw this.error(
        'impl blocks use the type name only',
        this.peek.span,
        `Write 'impl ${name.text} { ... }' — the struct's type parameters are in scope automatically`,
      );
    }
    this.expect('{', `to start impl block for '${name.text}'`);
    const methods: A.FnDecl[] = [];
    while (!this.at('}') && !this.at('eof')) {
      if (this.eat(';')) continue;
      if (!this.at('fn')) {
        throw this.error('Only functions can be declared inside an impl block', this.peek.span);
      }
      methods.push(this.parseFnDecl(true));
    }
    this.expect('}', `to close impl block for '${name.text}'`);
    return this.node<A.ImplDecl>({
      kind: 'ImplDecl',
      typeName: name.text,
      nameSpan: name.span,
      methods,
      span: this.spanFrom(kw.span),
    });
  }

  private parseTypeAlias(): A.TypeAliasDecl {
    const kw = this.advance();
    const name = this.expectIdent('a type alias name');
    const typeParams = this.parseTypeParams();
    this.expect('=', `after type alias '${name.text}'`);
    const type = this.parseType();
    return this.node<A.TypeAliasDecl>({
      kind: 'TypeAlias',
      name: name.text,
      nameSpan: name.span,
      typeParams,
      type,
      span: this.spanFrom(kw.span),
    });
  }

  /* ─────────────────────────── types ─────────────────────────── */

  parseType(): A.TypeExpr {
    let type = this.parseTypeAtom();
    // `T??` lexes as the `??` operator, so it counts as two levels of optional.
    while ((this.at('?') || this.at('??')) && !this.peek.nlBefore) {
      const levels = this.advance().kind === '??' ? 2 : 1;
      for (let i = 0; i < levels; i++) {
        type = this.node<A.TypeExpr>({
          kind: 'OptionalType',
          inner: type,
          span: this.spanFrom(type.span),
        });
      }
    }
    return type;
  }

  private parseTypeAtom(): A.TypeExpr {
    const t = this.peek;
    if (t.kind === 'ident') {
      this.advance();
      const args: A.TypeExpr[] = [];
      if (this.eat('<')) {
        do {
          args.push(this.parseType());
        } while (this.eat(','));
        this.expect('>', `to close the type arguments of '${t.text}'`);
      }
      return this.node<A.TypeExpr>({
        kind: 'NamedType',
        name: t.text,
        args,
        span: this.spanFrom(t.span),
      });
    }
    if (t.kind === '[') {
      this.advance();
      const first = this.parseType();
      if (this.eat(':')) {
        const value = this.parseType();
        this.expect(']', 'to close the map type');
        return this.node<A.TypeExpr>({
          kind: 'MapType',
          key: first,
          value,
          span: this.spanFrom(t.span),
        });
      }
      this.expect(']', 'to close the array type');
      return this.node<A.TypeExpr>({ kind: 'ArrayType', elem: first, span: this.spanFrom(t.span) });
    }
    if (t.kind === '(') {
      this.advance();
      const elems: A.TypeExpr[] = [];
      let trailingComma = false;
      while (!this.at(')')) {
        elems.push(this.parseType());
        trailingComma = Boolean(this.eat(','));
        if (!trailingComma) break;
      }
      this.expect(')', 'to close the tuple type');
      if (elems.length === 1 && !trailingComma) return elems[0];
      if (elems.length < 2) {
        throw this.error(
          'Tuple types need at least two elements',
          this.spanFrom(t.span),
          'Use void for "no value"',
        );
      }
      return this.node<A.TypeExpr>({ kind: 'TupleType', elems, span: this.spanFrom(t.span) });
    }
    if (t.kind === 'fn') {
      this.advance();
      this.expect('(', "after 'fn' in function type");
      const params: A.TypeExpr[] = [];
      while (!this.at(')')) {
        params.push(this.parseType());
        if (!this.eat(',')) break;
      }
      this.expect(')', 'to close the function type parameters');
      let ret: A.TypeExpr;
      if (this.eat('->')) {
        ret = this.parseType();
      } else {
        ret = { kind: 'NamedType', name: 'void', args: [], span: this.previous.span };
      }
      return this.node<A.TypeExpr>({ kind: 'FnType', params, ret, span: this.spanFrom(t.span) });
    }
    throw this.error(
      `Expected a type, found ${describeToken(t)}`,
      t.span,
      'e.g. int, string, [float], Point',
    );
  }

  /* ─────────────────────────── patterns ─────────────────────────── */

  private parsePattern(allowOr = true): A.Pattern {
    const first = this.parsePatternAtom();
    if (!allowOr || !this.at('|')) return first;
    const alternatives = [first];
    while (this.eat('|')) alternatives.push(this.parsePatternAtom());
    return this.node<A.Pattern>({
      kind: 'OrPattern',
      alternatives,
      span: joinSpans(first.span, alternatives[alternatives.length - 1].span),
    });
  }

  private parseLiteralPatternValue(): {
    value: number | string | boolean;
    litKind: 'int' | 'float' | 'string' | 'bool';
    span: Span;
  } | null {
    const t = this.peek;
    if (t.kind === '-' && (this.peekAt(1).kind === 'int' || this.peekAt(1).kind === 'float')) {
      this.advance();
      const num = this.advance();
      return {
        value: -(num.value as number),
        litKind: num.kind === 'int' ? 'int' : 'float',
        span: this.spanFrom(t.span),
      };
    }
    if (t.kind === 'int' || t.kind === 'float') {
      this.advance();
      return { value: t.value as number, litKind: t.kind, span: t.span };
    }
    if (t.kind === 'string') {
      this.advance();
      return { value: t.value as string, litKind: 'string', span: t.span };
    }
    if (t.kind === 'true' || t.kind === 'false') {
      this.advance();
      return { value: t.kind === 'true', litKind: 'bool', span: t.span };
    }
    return null;
  }

  private parsePatternAtom(): A.Pattern {
    const t = this.peek;
    const lit = this.parseLiteralPatternValue();
    if (lit) {
      if ((this.at('..') || this.at('..=')) && lit.litKind === 'int') {
        const inclusive = this.advance().kind === '..=';
        const end = this.parseLiteralPatternValue();
        if (!end || end.litKind !== 'int')
          throw this.error('Range patterns need an int upper bound', this.peek.span);
        return this.node<A.Pattern>({
          kind: 'RangePattern',
          start: lit.value as number,
          end: end.value as number,
          inclusive,
          span: joinSpans(lit.span, end.span),
        });
      }
      return this.node<A.Pattern>({
        kind: 'LiteralPattern',
        value: lit.value,
        litKind: lit.litKind,
        span: lit.span,
      });
    }
    if (t.kind === 'template') {
      throw this.error('String interpolation is not allowed in patterns', t.span);
    }
    if (t.kind === '(') {
      this.advance();
      const elems: A.Pattern[] = [];
      while (!this.at(')')) {
        elems.push(this.parsePattern());
        if (!this.eat(',')) break;
      }
      this.expect(')', 'to close the tuple pattern');
      if (elems.length === 1) return elems[0];
      return this.node<A.Pattern>({ kind: 'TuplePattern', elems, span: this.spanFrom(t.span) });
    }
    if (t.kind === 'ident') {
      this.advance();
      if (t.text === '_') return this.node<A.Pattern>({ kind: 'WildcardPattern', span: t.span });
      const qualified = this.at('.') && this.peekAt(1).kind === 'ident';
      if (!qualified && !this.isVariantName(t.text)) {
        return this.node<A.Pattern>({ kind: 'BindingPattern', name: t.text, span: t.span });
      }
      let enumName: string | undefined;
      let variant = t.text;
      if (this.at('.') && this.peekAt(1).kind === 'ident') {
        this.advance();
        enumName = t.text;
        variant = this.advance().text;
      }
      const args: A.Pattern[] = [];
      if (this.at('(') && !this.peek.nlBefore) {
        this.advance();
        while (!this.at(')')) {
          args.push(this.parsePattern());
          if (!this.eat(',')) break;
        }
        this.expect(')', `to close the '${variant}' pattern`);
      }
      return this.node<A.Pattern>({
        kind: 'VariantPattern',
        enumName,
        variant,
        args,
        span: this.spanFrom(t.span),
      });
    }
    throw this.error(
      `Expected a pattern, found ${describeToken(t)}`,
      t.span,
      'e.g. _, name, 42, Some(x), (a, b)',
    );
  }

  /* ─────────────────────────── expressions ─────────────────────────── */

  parseExpression(minPrec = 0): A.Expr {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek;
      const prec = INFIX_PRECEDENCE[t.kind];
      if (prec === undefined || prec <= minPrec) break;
      this.advance();
      if (t.kind === 'as') {
        const target = this.parseType();
        left = this.node<A.Cast>({
          kind: 'Cast',
          expr: left,
          target,
          span: joinSpans(left.span, target.span),
        });
        continue;
      }
      if (t.kind === '..' || t.kind === '..=') {
        const end = this.parseExpression(prec);
        left = this.node<A.Range>({
          kind: 'Range',
          start: left,
          end,
          inclusive: t.kind === '..=',
          span: joinSpans(left.span, end.span),
        });
        continue;
      }
      const right = this.parseExpression(prec);
      if (t.kind === '|>') {
        left = this.node<A.Pipe>({
          kind: 'Pipe',
          left,
          right,
          span: joinSpans(left.span, right.span),
        });
      } else {
        left = this.node<A.Binary>({
          kind: 'Binary',
          op: t.kind as A.BinaryOp,
          left,
          right,
          span: joinSpans(left.span, right.span),
        });
      }
    }
    return left;
  }

  private parseUnary(): A.Expr {
    const t = this.peek;
    if (t.kind === '-' || t.kind === '!') {
      this.advance();
      const operand = this.parseUnary();
      // Fold negative numeric literals so `-5` is a single literal.
      if (
        t.kind === '-' &&
        (operand.kind === 'IntLit' || operand.kind === 'FloatLit') &&
        operand.span.start === t.span.end
      ) {
        return { ...operand, value: -operand.value, span: joinSpans(t.span, operand.span) };
      }
      return this.node<A.Unary>({
        kind: 'Unary',
        op: t.kind,
        operand,
        span: joinSpans(t.span, operand.span),
      });
    }
    return this.parsePower();
  }

  private parsePower(): A.Expr {
    const base = this.parsePostfix();
    if (this.at('**')) {
      this.advance();
      const exponent = this.parseUnary();
      return this.node<A.Binary>({
        kind: 'Binary',
        op: '**',
        left: base,
        right: exponent,
        span: joinSpans(base.span, exponent.span),
      });
    }
    return base;
  }

  private parsePostfix(): A.Expr {
    let expr = this.parsePrimary();
    while (true) {
      const t = this.peek;
      if (t.kind === '(' && !t.nlBefore) {
        this.advance();
        const args = this.withStruct(true, () =>
          this.parseCommaList(')', () => this.parseExpression()),
        );
        this.expect(')', 'to close the argument list');
        expr = this.node<A.Call>({
          kind: 'Call',
          callee: expr,
          args,
          span: this.spanFrom(expr.span),
        });
      } else if (t.kind === '[' && !t.nlBefore) {
        this.advance();
        const index = this.withStruct(true, () => this.parseExpression());
        this.expect(']', 'to close the index');
        expr = this.node<A.Index>({
          kind: 'Index',
          object: expr,
          index,
          span: this.spanFrom(expr.span),
        });
      } else if (t.kind === '.') {
        this.advance();
        const name = this.peek;
        if (name.kind !== 'ident' && name.kind !== 'int') {
          throw this.error(
            `Expected a field or method name after '.', found ${describeToken(name)}`,
            name.span,
          );
        }
        this.advance();
        expr = this.node<A.Member>({
          kind: 'Member',
          object: expr,
          name: name.kind === 'int' ? String(name.value) : name.text,
          nameSpan: name.span,
          span: this.spanFrom(expr.span),
        });
      } else if (t.kind === '?' && !t.nlBefore) {
        this.advance();
        expr = this.node<A.Try>({ kind: 'Try', expr, span: this.spanFrom(expr.span) });
      } else {
        return expr;
      }
    }
  }

  private parseCommaList<T>(close: TokenKind, item: () => T): T[] {
    const items: T[] = [];
    while (!this.at(close) && !this.at('eof')) {
      items.push(item());
      if (!this.eat(',')) break;
    }
    return items;
  }

  private parsePrimary(): A.Expr {
    const t = this.peek;
    switch (t.kind) {
      case 'int':
        this.advance();
        return this.node<A.IntLit>({ kind: 'IntLit', value: t.value as number, span: t.span });
      case 'float':
        this.advance();
        return this.node<A.FloatLit>({ kind: 'FloatLit', value: t.value as number, span: t.span });
      case 'string':
        this.advance();
        return this.node<A.StringLit>({
          kind: 'StringLit',
          value: t.value as string,
          span: t.span,
        });
      case 'template':
        this.advance();
        return this.parseTemplate(t);
      case 'true':
      case 'false':
        this.advance();
        return this.node<A.BoolLit>({ kind: 'BoolLit', value: t.kind === 'true', span: t.span });
      case 'self':
        this.advance();
        return this.node<A.SelfExpr>({ kind: 'SelfExpr', span: t.span });
      case 'ident':
        this.advance();
        if (this.allowStruct && this.isStructName(t.text) && this.at('{') && !this.peek.nlBefore) {
          return this.parseStructLiteral(t);
        }
        return this.node<A.Ident>({ kind: 'Ident', name: t.text, span: t.span });
      case '(':
        return this.parseParenOrTuple();
      case '[':
        return this.parseArrayOrMap();
      case '{':
        return this.parseBlock();
      case 'if':
        return this.parseIf();
      case 'match':
        return this.parseMatch();
      case 'fn':
        return this.parseLambda();
    }
    if (t.kind === 'eof')
      throw this.error('Unexpected end of input — expected an expression', t.span);
    const hint =
      t.kind === 'loop' || t.kind === 'while' || t.kind === 'for'
        ? 'Loops are statements and cannot be used as values'
        : undefined;
    throw this.error(`Expected an expression, found ${describeToken(t)}`, t.span, hint);
  }

  private parseTemplate(t: Token): A.TemplateLit {
    const parts: (string | A.Expr)[] = [];
    for (const part of t.parts ?? []) {
      if (part.kind === 'text') {
        if (part.value) parts.push(part.value);
        continue;
      }
      const src = this.source.slice(part.span.start, part.span.end);
      const lexed = Lexer.lex(src, part.span.start);
      for (const d of lexed.diagnostics) this.diagnostics.push(d);
      const sub = new Parser(this.source, lexed.tokens, this.diagnostics, {
        structs: this.structNames,
        variants: this.variantNames,
      });
      const expr = sub.parseExpression();
      if (!sub.at('eof')) {
        throw this.error(`Unexpected ${describeToken(sub.peek)} in interpolation`, sub.peek.span);
      }
      this.nodeCount += sub.nodeCount;
      parts.push(expr);
    }
    return this.node<A.TemplateLit>({ kind: 'TemplateLit', parts, span: t.span });
  }

  private parseStructLiteral(name: Token): A.StructLit {
    this.expect('{');
    const fields: A.StructLit['fields'] = [];
    this.withStruct(true, () => {
      while (!this.at('}') && !this.at('eof')) {
        const id = this.expectIdent('a field name');
        let value: A.Expr;
        if (this.eat(':')) {
          value = this.parseExpression();
        } else {
          // Field init shorthand: `Point { x, y }`
          value = this.node<A.Ident>({ kind: 'Ident', name: id.text, span: id.span });
        }
        fields.push({ name: id.text, value, span: joinSpans(id.span, value.span) });
        if (!this.eat(',') && !this.at('}') && !this.peek.nlBefore) {
          throw this.error(`Expected ',' or '}' after field '${id.text}'`, this.peek.span);
        }
      }
    });
    this.expect('}', `to close the '${name.text}' literal`);
    return this.node<A.StructLit>({
      kind: 'StructLit',
      name: name.text,
      nameSpan: name.span,
      fields,
      span: this.spanFrom(name.span),
    });
  }

  private parseParenOrTuple(): A.Expr {
    const open = this.advance();
    if (this.at(')')) {
      throw this.error('Empty parentheses are not a value', this.spanFrom(open.span));
    }
    const first = this.withStruct(true, () => this.parseExpression());
    if (this.eat(')')) {
      return { ...first, span: this.spanFrom(open.span) };
    }
    const elements = [first];
    while (this.eat(',')) {
      if (this.at(')')) break;
      elements.push(this.withStruct(true, () => this.parseExpression()));
    }
    this.expect(')', 'to close the tuple');
    if (elements.length < 2) {
      throw this.error('Tuples need at least two elements', this.spanFrom(open.span));
    }
    return this.node<A.TupleLit>({ kind: 'TupleLit', elements, span: this.spanFrom(open.span) });
  }

  private parseArrayOrMap(): A.Expr {
    const open = this.advance();
    if (this.at(':') && this.peekAt(1).kind === ']') {
      this.advance();
      this.advance();
      return this.node<A.MapLit>({ kind: 'MapLit', entries: [], span: this.spanFrom(open.span) });
    }
    if (this.eat(']')) {
      return this.node<A.ArrayLit>({
        kind: 'ArrayLit',
        elements: [],
        span: this.spanFrom(open.span),
      });
    }
    return this.withStruct(true, () => {
      const first = this.parseExpression();
      if (this.eat(':')) {
        const entries = [{ key: first, value: this.parseExpression() }];
        while (this.eat(',')) {
          if (this.at(']')) break;
          const key = this.parseExpression();
          this.expect(':', 'between map key and value');
          entries.push({ key, value: this.parseExpression() });
        }
        this.expect(']', 'to close the map literal');
        return this.node<A.MapLit>({ kind: 'MapLit', entries, span: this.spanFrom(open.span) });
      }
      const elements = [first];
      while (this.eat(',')) {
        if (this.at(']')) break;
        elements.push(this.parseExpression());
      }
      this.expect(']', 'to close the array literal');
      return this.node<A.ArrayLit>({ kind: 'ArrayLit', elements, span: this.spanFrom(open.span) });
    });
  }

  private parseIf(): A.If | A.IfLet {
    const kw = this.advance();
    let result: A.If | A.IfLet;
    if (this.eat('let')) {
      const pattern = this.parsePattern();
      this.expect('=', 'in if let', 'if let Some(value) = maybe { ... }');
      const value = this.withStruct(false, () => this.parseExpression());
      const then = this.parseBlock('after the if let condition');
      result = this.node<A.IfLet>({ kind: 'IfLet', pattern, value, then, span: kw.span });
    } else {
      const cond = this.withStruct(false, () => this.parseExpression());
      const then = this.parseBlock('after the if condition');
      result = this.node<A.If>({ kind: 'If', cond, then, span: kw.span });
    }
    if (this.eat('else')) {
      result.else = this.at('if') ? this.parseIf() : this.parseBlock("after 'else'");
    }
    result.span = this.spanFrom(kw.span);
    return result;
  }

  private parseMatch(): A.Match {
    const kw = this.advance();
    const subject = this.withStruct(false, () => this.parseExpression());
    this.expect('{', 'to start the match arms');
    const arms: A.MatchArm[] = [];
    this.withStruct(true, () => {
      while (!this.at('}') && !this.at('eof')) {
        const pattern = this.parsePattern();
        let guard: A.Expr | undefined;
        if (this.eat('if')) guard = this.parseExpression();
        this.expect('=>', 'after the match pattern', 'pattern => result');
        const body = this.parseArmBody();
        arms.push({ pattern, guard, body, span: joinSpans(pattern.span, body.span) });
        if (!this.eat(',') && !this.at('}') && !this.peek.nlBefore) {
          throw this.error(`Expected ',' or a new line after the match arm`, this.peek.span);
        }
      }
    });
    this.expect('}', 'to close the match');
    if (arms.length === 0)
      throw this.error('A match needs at least one arm', this.spanFrom(kw.span));
    return this.node<A.Match>({ kind: 'Match', subject, arms, span: this.spanFrom(kw.span) });
  }

  /** A match arm body: an expression, or `break` / `continue` / `return` as a shorthand. */
  private parseArmBody(): A.Expr {
    const t = this.peek;
    if (t.kind !== 'break' && t.kind !== 'continue' && t.kind !== 'return')
      return this.parseExpression();
    this.advance();
    let stmt: A.Stmt;
    if (t.kind === 'return') {
      let value: A.Expr | undefined;
      if (!this.at(',') && !this.at('}') && !this.peek.nlBefore) value = this.parseExpression();
      stmt = this.node<A.ReturnStmt>({ kind: 'Return', value, span: this.spanFrom(t.span) });
    } else {
      stmt = this.node({
        kind: t.kind === 'break' ? ('Break' as const) : ('Continue' as const),
        span: t.span,
      });
    }
    return this.node<A.Block>({ kind: 'Block', stmts: [stmt], span: stmt.span });
  }

  private parseLambda(): A.Lambda {
    const kw = this.advance();
    this.expect('(', "after 'fn' in a lambda", 'fn(x) => x * 2');
    const params = this.parseCommaList(')', (): A.Param => {
      const id = this.expectIdent('a parameter name');
      let type: A.TypeExpr | undefined;
      if (this.eat(':')) type = this.parseType();
      return { name: id.text, type, span: this.spanFrom(id.span) };
    });
    this.expect(')', 'to close the lambda parameters');
    let ret: A.TypeExpr | undefined;
    if (this.eat('->')) ret = this.parseType();
    let body: A.Expr;
    if (this.eat('=>')) {
      body = this.withStruct(true, () => this.parseExpression());
    } else if (this.at('{')) {
      body = this.withStruct(true, () => this.parseBlock());
    } else {
      throw this.error(
        "Expected '=>' or a block for the lambda body",
        this.peek.span,
        'fn(x) => x * 2',
      );
    }
    return this.node<A.Lambda>({ kind: 'Lambda', params, ret, body, span: this.spanFrom(kw.span) });
  }
}
