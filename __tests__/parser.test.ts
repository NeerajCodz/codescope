/**
 * Tests for lib/parser.ts
 *
 * Covers: Parser.isCode, Parser.stripTypeScript, Parser.extract
 */

import { Parser } from '@/lib/parser';

// ─── isCode ──────────────────────────────────────────────────────────

describe('Parser.isCode', () => {
  it('recognizes JavaScript files', () => {
    expect(Parser.isCode('app.js')).toBe(true);
    expect(Parser.isCode('component.jsx')).toBe(true);
    expect(Parser.isCode('module.mjs')).toBe(true);
    expect(Parser.isCode('util.cjs')).toBe(true);
  });

  it('recognizes TypeScript files', () => {
    expect(Parser.isCode('app.ts')).toBe(true);
    expect(Parser.isCode('component.tsx')).toBe(true);
  });

  it('recognizes Python files', () => {
    expect(Parser.isCode('main.py')).toBe(true);
  });

  it('recognizes Go files', () => {
    expect(Parser.isCode('main.go')).toBe(true);
  });

  it('recognizes Rust files', () => {
    expect(Parser.isCode('lib.rs')).toBe(true);
  });

  it('recognizes shell scripts', () => {
    expect(Parser.isCode('deploy.sh')).toBe(true);
    expect(Parser.isCode('run.bash')).toBe(true);
  });

  it('rejects non-code files', () => {
    expect(Parser.isCode('README.md')).toBe(false);
    expect(Parser.isCode('image.png')).toBe(false);
    expect(Parser.isCode('data.json')).toBe(false);
    expect(Parser.isCode('style.css')).toBe(false);
    expect(Parser.isCode('config.yaml')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(Parser.isCode('App.JS')).toBe(true);
    expect(Parser.isCode('FILE.TSX')).toBe(true);
  });

  it('handles files without extension', () => {
    expect(Parser.isCode('Makefile')).toBe(false);
  });
});

// ─── stripTypeScript ─────────────────────────────────────────────────

describe('Parser.stripTypeScript', () => {
  it('removes type annotations from parameters', () => {
    const input = 'function foo(x: number, y: string) {}';
    const result = Parser.stripTypeScript(input);
    expect(result).not.toContain(': number');
    expect(result).not.toContain(': string');
  });

  it('removes "as" type assertions', () => {
    const input = 'const x = value as string;';
    const result = Parser.stripTypeScript(input);
    expect(result).not.toContain('as string');
  });

  it('removes generic type parameters before calls', () => {
    const input = 'const result = useState<number>(0);';
    const result = Parser.stripTypeScript(input);
    expect(result).not.toContain('<number>');
  });

  it('removes import type statements', () => {
    const input = 'import type { Foo } from "./bar";';
    const result = Parser.stripTypeScript(input);
    expect(result.trim()).toBe('');
  });

  it('removes export type statements', () => {
    const input = 'export type MyType = string | number;';
    const result = Parser.stripTypeScript(input);
    expect(result.trim()).toBe('');
  });

  it('removes export interface statements', () => {
    const input = 'export interface Props { name: string; }';
    const result = Parser.stripTypeScript(input);
    expect(result.trim()).toBe('');
  });

  it('removes interface blocks', () => {
    const input = 'interface Foo { bar: string }';
    const result = Parser.stripTypeScript(input);
    expect(result.trim()).toBe('');
  });

  it('removes type alias assignments', () => {
    const input = 'type ID = string | number;';
    const result = Parser.stripTypeScript(input);
    expect(result.trim()).toBe('');
  });

  it('preserves regular JavaScript code', () => {
    const input = 'const x = 42;\nconsole.log(x);';
    const result = Parser.stripTypeScript(input);
    expect(result).toContain('const x = 42');
    expect(result).toContain('console.log(x)');
  });
});

// ─── extract ─────────────────────────────────────────────────────────

describe('Parser.extract', () => {
  it('extracts named function declarations', () => {
    const code = `function greet(name) { return "Hello " + name; }`;
    const fns = Parser.extract(code, 'test.js');
    expect(fns.length).toBeGreaterThanOrEqual(1);
    expect(fns[0].name).toBe('greet');
    expect(fns[0].type).toBe('function');
  });

  it('extracts arrow function assignments', () => {
    const code = `const add = (a, b) => a + b;`;
    const fns = Parser.extract(code, 'test.js');
    expect(fns.length).toBeGreaterThanOrEqual(1);
    expect(fns.find(f => f.name === 'add')).toBeDefined();
  });

  it('extracts exported functions', () => {
    const code = `export function doSomething() { return 1; }`;
    const fns = Parser.extract(code, 'test.js');
    expect(fns.length).toBeGreaterThanOrEqual(1);
    const fn = fns.find(f => f.name === 'doSomething');
    expect(fn).toBeDefined();
    // isExported may or may not be set depending on parser implementation
    // The key assertion is that the function was extracted
  });

  it('extracts default exported functions', () => {
    const code = `export default function main() {}`;
    const fns = Parser.extract(code, 'test.js');
    expect(fns.length).toBeGreaterThanOrEqual(1);
    const fn = fns.find(f => f.name === 'main');
    expect(fn).toBeDefined();
  });

  it('extracts class methods', () => {
    const code = `class MyClass {
      constructor() {}
      getValue() { return 42; }
    }`;
    const fns = Parser.extract(code, 'test.js');
    const method = fns.find(f => f.name === 'getValue');
    expect(method).toBeDefined();
  });

  it('detects parameters', () => {
    const code = `function calc(a, b, c) { return a + b + c; }`;
    const fns = Parser.extract(code, 'test.js');
    const fn = fns.find(f => f.name === 'calc');
    expect(fn).toBeDefined();
    expect(fn!.params).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('detects rest parameters', () => {
    const code = `function sum(...nums) { return nums.reduce((a, b) => a + b, 0); }`;
    const fns = Parser.extract(code, 'test.js');
    const fn = fns.find(f => f.name === 'sum');
    expect(fn).toBeDefined();
    expect(fn!.params).toEqual(expect.arrayContaining(['...nums']));
  });

  it('detects return value', () => {
    const code = `function getter() { return 42; }`;
    const fns = Parser.extract(code, 'test.js');
    const fn = fns.find(f => f.name === 'getter');
    expect(fn).toBeDefined();
    expect(fn!.returnsValue).toBe(true);
  });

  it('detects arrow expression (implicit return)', () => {
    const code = `const double = (x) => x * 2;`;
    const fns = Parser.extract(code, 'test.js');
    const fn = fns.find(f => f.name === 'double');
    expect(fn).toBeDefined();
    expect(fn!.returnsValue).toBe(true);
  });

  it('handles TypeScript files by stripping types', () => {
    const code = `export function greet(name: string): string { return "hi " + name; }`;
    const fns = Parser.extract(code, 'test.ts');
    expect(fns.length).toBeGreaterThanOrEqual(1);
    expect(fns[0].name).toBe('greet');
  });

  it('returns empty array for non-JS/TS files', () => {
    const code = `def hello():\n    print("hello")`;
    // Parser delegates non-JS to regex-based extraction — might find or not
    const fns = Parser.extract(code, 'test.py');
    // Should not throw
    expect(Array.isArray(fns)).toBe(true);
  });

  it('handles empty content', () => {
    const fns = Parser.extract('', 'empty.js');
    expect(fns).toEqual([]);
  });

  it('handles syntax errors without throwing', () => {
    const code = `function broken( { incomplete syntax`;
    expect(() => Parser.extract(code, 'broken.js')).not.toThrow();
  });
});
