/**
 * Tests for lib/ai/contextBuilder.ts
 *
 * Covers: buildRepoContext, buildChatSystemPrompt
 */

import { buildRepoContext, buildChatSystemPrompt } from '@/lib/ai/contextBuilder';
import type { AnalysisData } from '@/types';

// ─── Fixtures ────────────────────────────────────────────────────────

const baseData: AnalysisData = {
  files: [
    {
      path: 'src/app.ts',
      name: 'app.ts',
      folder: 'src',
      size: 200,
      isCode: true,
      functions: [
        { name: 'main', file: 'src/app.ts', line: 1, code: 'function main() {}', totalCalls: 10 },
        { name: 'helper', file: 'src/app.ts', line: 10, code: 'function helper() {}', totalCalls: 5 },
      ],
    },
    {
      path: 'lib/utils.ts',
      name: 'utils.ts',
      folder: 'lib',
      size: 100,
      isCode: true,
      functions: [
        { name: 'format', file: 'lib/utils.ts', line: 1, code: 'function format() {}', totalCalls: 20 },
      ],
    },
  ],
  connections: [
    { source: 'src/app.ts', target: 'lib/utils.ts', fn: 'import', count: 1 },
  ],
  stats: {
    files: 2,
    codeFiles: 2,
    functions: 3,
    dead: 0,
    connections: 1,
    avgComplexity: 2.5,
  },
  issues: [],
  patterns: [
    {
      name: 'Singleton',
      icon: '🔒',
      desc: 'Singleton pattern detected',
      severity: 'info',
      files: [{ name: 'app.ts', path: 'src/app.ts' }],
      metrics: { count: 1 },
    },
  ],
  securityIssues: [
    { severity: 'high', title: 'XSS', file: 'src/app.ts', path: 'src/app.ts', desc: 'Cross-site scripting' },
  ],
  totalLines: 300,
  languages: { TypeScript: 2 },
};

// ─── buildRepoContext ────────────────────────────────────────────────

describe('buildRepoContext', () => {
  it('includes repository stats', () => {
    const ctx = buildRepoContext(baseData);
    expect(ctx).toContain('Repository Stats');
    expect(ctx).toContain('Files: 2');
    expect(ctx).toContain('Functions: 3');
  });

  it('includes languages section', () => {
    const ctx = buildRepoContext(baseData);
    expect(ctx).toContain('Languages');
    expect(ctx).toContain('TypeScript: 2 files');
  });

  it('includes file structure', () => {
    const ctx = buildRepoContext(baseData);
    expect(ctx).toContain('File Structure');
    expect(ctx).toContain('app.ts');
    expect(ctx).toContain('utils.ts');
  });

  it('includes key functions sorted by usage', () => {
    const ctx = buildRepoContext(baseData);
    expect(ctx).toContain('Key Functions');
    expect(ctx).toContain('format');
    expect(ctx).toContain('20 calls');
  });

  it('includes patterns', () => {
    const ctx = buildRepoContext(baseData);
    expect(ctx).toContain('Design Patterns');
    expect(ctx).toContain('Singleton');
  });

  it('includes security issues summary', () => {
    const ctx = buildRepoContext(baseData);
    expect(ctx).toContain('Security Issues');
    expect(ctx).toContain('high: 1');
  });

  it('includes key dependencies', () => {
    const ctx = buildRepoContext(baseData);
    expect(ctx).toContain('Key Dependencies');
  });

  it('truncates output to maxTokens', () => {
    const ctx = buildRepoContext(baseData, 10); // very small
    // 10 tokens * 4 chars = 40 chars max
    expect(ctx.length).toBeLessThanOrEqual(200); // accounts for truncation text
    expect(ctx).toContain('[context truncated]');
  });

  it('handles empty data gracefully', () => {
    const empty: AnalysisData = {
      files: [],
      connections: [],
      stats: { files: 0, codeFiles: 0, functions: 0, dead: 0, connections: 0, avgComplexity: 0 },
      issues: [],
      patterns: [],
      securityIssues: [],
    };
    const ctx = buildRepoContext(empty);
    expect(ctx).toContain('Repository Stats');
    expect(ctx).toContain('Files: 0');
  });
});

// ─── buildChatSystemPrompt ───────────────────────────────────────────

describe('buildChatSystemPrompt', () => {
  it('includes CodeScope AI identity', () => {
    const prompt = buildChatSystemPrompt('test context');
    expect(prompt).toContain('CodeScope AI');
  });

  it('includes the repo context', () => {
    const ctx = 'My repo has 100 files';
    const prompt = buildChatSystemPrompt(ctx);
    expect(prompt).toContain(ctx);
  });

  it('includes guidelines', () => {
    const prompt = buildChatSystemPrompt('ctx');
    expect(prompt).toContain('Be concise');
    expect(prompt).toContain('markdown');
  });
});
