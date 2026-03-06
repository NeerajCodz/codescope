/**
 * Tests for lib/apiAnalyzer.ts
 *
 * Covers: detectCreatedAPIs, detectUsedAPIs, groupByService, getAPIStats
 */

import { detectCreatedAPIs, detectUsedAPIs, groupByService, getAPIStats } from '@/lib/apiAnalyzer';
import type { AnalysisData, FileNode } from '@/types';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeFile(path: string, content: string): FileNode {
  return {
    path,
    name: path.split('/').pop()!,
    folder: path.split('/').slice(0, -1).join('/'),
    size: content.length,
    isCode: true,
    content,
    functions: [],
    lines: content.split('\n').length,
  };
}

const baseData: AnalysisData = {
  files: [],
  connections: [],
  stats: { files: 0, codeFiles: 0, functions: 0, dead: 0, connections: 0, avgComplexity: 0 },
  issues: [],
  patterns: [],
  securityIssues: [],
};

// ─── detectCreatedAPIs ───────────────────────────────────────────────

describe('detectCreatedAPIs', () => {
  it('detects Next.js API route handlers (GET, POST, etc.)', () => {
    const file = makeFile('app/api/users/route.ts',
      `export async function GET(req) { return Response.json({ users: [] }); }
       export async function POST(req) { return Response.json({ ok: true }); }`
    );
    const data = { ...baseData, files: [file] };
    const apis = detectCreatedAPIs(data);
    expect(apis.length).toBeGreaterThanOrEqual(1);
  });

  it('detects Express-style route handlers', () => {
    const file = makeFile('server/routes.js',
      `app.get('/api/users', handler);
       app.post('/api/users', createUser);
       router.delete('/api/users/:id', deleteUser);`
    );
    const data = { ...baseData, files: [file] };
    const apis = detectCreatedAPIs(data);
    expect(apis.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when no APIs found', () => {
    const file = makeFile('src/utils.ts', 'export const add = (a, b) => a + b;');
    const data = { ...baseData, files: [file] };
    const apis = detectCreatedAPIs(data);
    expect(apis).toEqual([]);
  });
});

// ─── detectUsedAPIs ──────────────────────────────────────────────────

describe('detectUsedAPIs', () => {
  it('detects fetch calls with URLs', () => {
    const file = makeFile('src/client.ts',
      `const res = await fetch('https://api.github.com/users');
       const data = await fetch('/api/users');`
    );
    const data = { ...baseData, files: [file] };
    const apis = detectUsedAPIs(data);
    expect(apis.length).toBeGreaterThanOrEqual(1);
  });

  it('detects axios calls', () => {
    const file = makeFile('src/api.ts',
      `const res = await axios.get('https://jsonplaceholder.typicode.com/posts');
       axios.post('/api/data', payload);`
    );
    const data = { ...baseData, files: [file] };
    const apis = detectUsedAPIs(data);
    expect(apis.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when no external API usage', () => {
    const file = makeFile('src/math.ts', 'export const square = (x) => x * x;');
    const data = { ...baseData, files: [file] };
    const apis = detectUsedAPIs(data);
    expect(apis).toEqual([]);
  });
});

// ─── groupByService ──────────────────────────────────────────────────

describe('groupByService', () => {
  it('groups APIs by hostname', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apis: any[] = [
      { url: 'https://api.github.com/users', method: 'GET', file: 'a.ts', line: 1, library: 'fetch' },
      { url: 'https://api.github.com/repos', method: 'GET', file: 'a.ts', line: 2, library: 'fetch' },
      { url: 'https://api.stripe.com/charges', method: 'POST', file: 'b.ts', line: 1, library: 'fetch' },
    ];
    const groups = groupByService(apis);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const githubGroup = groups.find(g => g.name.includes('github'));
    expect(githubGroup).toBeDefined();
    expect(githubGroup!.endpoints.length).toBe(2);
  });

  it('handles internal API paths', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apis: any[] = [
      { url: '/api/users', method: 'GET', file: 'a.ts', line: 1, library: 'fetch' },
      { url: '/api/posts', method: 'GET', file: 'a.ts', line: 2, library: 'fetch' },
    ];
    const groups = groupByService(apis);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(groups[0].name).toBe('Internal API');
  });

  it('returns empty for empty input', () => {
    const groups = groupByService([]);
    expect(groups).toEqual([]);
  });
});

// ─── getAPIStats ─────────────────────────────────────────────────────

describe('getAPIStats', () => {
  it('returns correct counts', () => {
    const created = [
      { endpoint: '/api/users', method: 'GET', file: 'a.ts', line: 1, handler: 'getUsers' },
      { endpoint: '/api/users', method: 'POST', file: 'a.ts', line: 5, handler: 'createUser' },
    ];
    const used = [
      { url: 'https://api.github.com/users', method: 'GET', file: 'b.ts', line: 1 },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = getAPIStats(created as any, used as any);
    expect(stats.totalCreated).toBe(2);
    expect(stats.totalUsed).toBe(1);
  });

  it('returns zero counts for empty inputs', () => {
    const stats = getAPIStats([], []);
    expect(stats.totalCreated).toBe(0);
    expect(stats.totalUsed).toBe(0);
  });
});
