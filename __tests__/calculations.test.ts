/**
 * Tests for utils/calculations.ts
 *
 * Covers: calcBlast, calcHealth, formatNumber, formatBytes,
 *         getColorForLevel, getColorForSeverity
 */

import { calcBlast, calcHealth, formatNumber, formatBytes, getColorForLevel, getColorForSeverity } from '@/utils/calculations';
import type { Connection, FileNode, AnalysisData } from '@/types';

// ─── Fixtures ────────────────────────────────────────────────────────

const makeFile = (path: string, fns = 0): FileNode => ({
  path,
  name: path.split('/').pop()!,
  folder: path.split('/').slice(0, -1).join('/'),
  size: 100,
  isCode: true,
  functions: Array.from({ length: fns }, (_, i) => ({
    name: `fn${i}`,
    file: path,
    line: i * 10 + 1,
    code: `function fn${i}() {}`,
  })),
});

const makeConn = (source: string, target: string, fn = 'default', count = 1): Connection => ({
  source, target, fn, count,
});

const baseAnalysisData: AnalysisData = {
  files: [makeFile('src/a.ts', 3), makeFile('src/b.ts', 2), makeFile('src/c.ts', 1)],
  connections: [makeConn('src/a.ts', 'src/b.ts'), makeConn('src/b.ts', 'src/c.ts')],
  stats: { files: 3, codeFiles: 3, functions: 6, dead: 0, connections: 2, avgComplexity: 3 },
  issues: [],
  patterns: [],
  securityIssues: [],
};

// ─── calcBlast ───────────────────────────────────────────────────────

describe('calcBlast', () => {
  const files = [makeFile('a.ts'), makeFile('b.ts'), makeFile('c.ts'), makeFile('d.ts')];
  const connections = [
    makeConn('a.ts', 'b.ts', 'fn1', 2),
    makeConn('a.ts', 'c.ts', 'fn2', 1),
    makeConn('b.ts', 'd.ts', 'fn3', 1),
  ];

  it('returns correct direct dependencies', () => {
    const result = calcBlast('a.ts', connections, files);
    expect(result.affected).toEqual(expect.arrayContaining(['b.ts', 'c.ts']));
    expect(result.count).toBe(2);
  });

  it('detects transitive dependencies', () => {
    const result = calcBlast('a.ts', connections, files);
    expect(result.transitive).toContain('d.ts');
    expect(result.transitiveCount).toBeGreaterThanOrEqual(1);
  });

  it('computes function usage count', () => {
    const result = calcBlast('a.ts', connections, files);
    expect(result.fnsUsed).toBe(2); // fn1, fn2
    expect(result.totalCalls).toBe(3); // 2 + 1
  });

  it('computes dependencies (reverse direction)', () => {
    const result = calcBlast('b.ts', connections, files);
    expect(result.dependencies).toContain('a.ts');
  });

  it('sets level based on direct deps count', () => {
    // 2 direct deps → medium
    const result = calcBlast('a.ts', connections, files);
    expect(result.level).toBe('medium');
  });

  it('returns low level for isolated files', () => {
    const result = calcBlast('d.ts', connections, files);
    expect(result.level).toBe('low');
    expect(result.count).toBe(0);
  });

  it('returns critical for heavily connected files', () => {
    const manyConn = Array.from({ length: 10 }, (_, i) =>
      makeConn('hub.ts', `target${i}.ts`, `fn${i}`, 1)
    );
    const manyFiles = [makeFile('hub.ts'), ...Array.from({ length: 10 }, (_, i) => makeFile(`target${i}.ts`))];
    const result = calcBlast('hub.ts', manyConn, manyFiles);
    expect(result.level).toBe('critical');
  });

  it('computes impactScore and centrality', () => {
    const result = calcBlast('a.ts', connections, files);
    expect(result.impactScore).toBeGreaterThan(0);
    expect(result.centrality).toBeGreaterThan(0);
  });
});

// ─── calcHealth ──────────────────────────────────────────────────────

describe('calcHealth', () => {
  it('returns F grade for null data', () => {
    const result = calcHealth(null);
    expect(result).toEqual({ score: 0, grade: 'F' });
  });

  it('returns A grade for clean codebase', () => {
    const result = calcHealth(baseAnalysisData);
    expect(result.grade).toBe('A');
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('penalizes dead code', () => {
    const data: AnalysisData = {
      ...baseAnalysisData,
      stats: { ...baseAnalysisData.stats, dead: 5 },
    };
    const result = calcHealth(data);
    expect(result.score).toBeLessThan(100);
  });

  it('penalizes circular dependencies', () => {
    const data: AnalysisData = {
      ...baseAnalysisData,
      issues: [
        { title: 'Circular Dependency in A → B', desc: '', severity: 'high' },
        { title: 'Circular Dependency in C → D', desc: '', severity: 'high' },
      ],
    };
    const result = calcHealth(data);
    expect(result.score).toBeLessThan(100);
  });

  it('penalizes god files (Large)', () => {
    const data: AnalysisData = {
      ...baseAnalysisData,
      issues: [{ title: 'Large File: a.ts', desc: '', severity: 'high' }],
    };
    const result = calcHealth(data);
    expect(result.score).toBeLessThan(100);
  });

  it('penalizes high-severity security issues', () => {
    const data: AnalysisData = {
      ...baseAnalysisData,
      securityIssues: [
        { severity: 'high', title: 'XSS', file: 'a.ts', path: 'a.ts', desc: 'XSS vulnerability' },
        { severity: 'high', title: 'SQL Injection', file: 'b.ts', path: 'b.ts', desc: 'SQL injection' },
      ],
    };
    const result = calcHealth(data);
    expect(result.score).toBeLessThan(100);
  });

  it('assigns correct grade brackets', () => {
    // All penalties combined → low score
    const data: AnalysisData = {
      ...baseAnalysisData,
      stats: { ...baseAnalysisData.stats, dead: 6, connections: 100 },
      issues: [
        { title: 'Circular Dependency A', desc: '', severity: 'high' },
        { title: 'Circular Dependency B', desc: '', severity: 'high' },
        { title: 'Circular Dependency C', desc: '', severity: 'high' },
        { title: 'Circular Dependency D', desc: '', severity: 'high' },
        { title: 'Large File X', desc: '', severity: 'high' },
        { title: 'Large File Y', desc: '', severity: 'high' },
      ],
      securityIssues: [
        { severity: 'high', title: 'a', file: 'a', path: 'a', desc: '' },
        { severity: 'high', title: 'b', file: 'b', path: 'b', desc: '' },
        { severity: 'high', title: 'c', file: 'c', path: 'c', desc: '' },
        { severity: 'high', title: 'd', file: 'd', path: 'd', desc: '' },
      ],
    };
    const result = calcHealth(data);
    expect(result.score).toBeLessThanOrEqual(60);
    expect(['D', 'F']).toContain(result.grade);
  });

  it('score never goes below 0', () => {
    const data: AnalysisData = {
      ...baseAnalysisData,
      stats: { ...baseAnalysisData.stats, functions: 1, dead: 1, connections: 999 },
      issues: Array.from({ length: 20 }, (_, i) => ({
        title: `Circular Dep ${i}`, desc: '', severity: 'high' as const,
      })),
      securityIssues: Array.from({ length: 20 }, (_, i) => ({
        severity: 'high' as const, title: `sec${i}`, file: `f${i}`, path: `f${i}`, desc: '',
      })),
    };
    const result = calcHealth(data);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ─── formatNumber ────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('returns plain number for < 1000', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(50000)).toBe('50.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
  });
});

// ─── formatBytes ─────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});

// ─── getColorForLevel ────────────────────────────────────────────────

describe('getColorForLevel', () => {
  it('returns correct colors for all levels', () => {
    expect(getColorForLevel('critical')).toBe('hsl(var(--viz-red))');
    expect(getColorForLevel('high')).toBe('hsl(var(--viz-orange))');
    expect(getColorForLevel('medium')).toBe('hsl(var(--viz-blue))');
    expect(getColorForLevel('low')).toBe('hsl(var(--viz-green))');
  });
});

// ─── getColorForSeverity ─────────────────────────────────────────────

describe('getColorForSeverity', () => {
  it('returns correct colors for all severities', () => {
    expect(getColorForSeverity('high')).toBe('hsl(var(--viz-red))');
    expect(getColorForSeverity('medium')).toBe('hsl(var(--viz-orange))');
    expect(getColorForSeverity('low')).toBe('hsl(var(--viz-blue))');
  });
});
