/**
 * Tests for lib/git/branchGraph.ts
 *
 * Covers: buildBranchGraph — lane assignment, color mapping,
 *         merge/fork detection, branch ordering, topology-aware assignment
 */

import { buildBranchGraph } from '@/lib/git/branchGraph';
import type { CommitData, BranchData } from '@/types/git';

// ─── Helpers ─────────────────────────────────────────────────────────

function commit(sha: string, message: string, parents: string[], date: string): CommitData {
  return {
    sha,
    message,
    author: { name: 'Test', email: 'test@test.com', date, login: 'test' },
    committer: { name: 'Test', email: 'test@test.com', date },
    parents,
  };
}

function branch(name: string, sha: string, isDefault = false): BranchData {
  return { name, sha, isDefault, isProtected: false };
}

// ─── Test Suite ──────────────────────────────────────────────────────

describe('buildBranchGraph', () => {
  describe('single branch (main only)', () => {
    const commits = [
      commit('c3', 'third', ['c2'], '2024-01-03T00:00:00Z'),
      commit('c2', 'second', ['c1'], '2024-01-02T00:00:00Z'),
      commit('c1', 'first', [], '2024-01-01T00:00:00Z'),
    ];

    const branchList = [branch('main', 'c3', true)];
    const branchCommitsMap = new Map([['main', commits]]);

    it('produces correct number of nodes', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      expect(result.nodes).toHaveLength(3);
    });

    it('assigns all commits to main', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      result.nodes.forEach(n => {
        expect(n.branch).toBe('main');
      });
    });

    it('puts main in lane 0', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      result.nodes.forEach(n => {
        expect(n.lane).toBe(0);
      });
    });

    it('returns main as the only branch', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      expect(result.branches).toEqual(['main']);
      expect(result.laneCount).toBe(1);
    });

    it('assigns a color to main', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      expect(result.colorMap['main']).toBeDefined();
    });

    it('has no merges or forks', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      expect(result.merges).toHaveLength(0);
      expect(result.forks).toHaveLength(0);
    });
  });

  describe('two branches with fork', () => {
    // main:    c1 ← c2 ← c3
    // feature:            c2 ← f1 ← f2
    const mainCommits = [
      commit('c3', 'main-3', ['c2'], '2024-01-03T00:00:00Z'),
      commit('c2', 'main-2', ['c1'], '2024-01-02T00:00:00Z'),
      commit('c1', 'init', [], '2024-01-01T00:00:00Z'),
    ];
    const featureCommits = [
      commit('f2', 'feat-2', ['f1'], '2024-01-04T00:00:00Z'),
      commit('f1', 'feat-1', ['c2'], '2024-01-03T12:00:00Z'),
      commit('c2', 'main-2', ['c1'], '2024-01-02T00:00:00Z'),
      commit('c1', 'init', [], '2024-01-01T00:00:00Z'),
    ];

    const branchList = [
      branch('main', 'c3', true),
      branch('feature', 'f2', false),
    ];
    const branchCommitsMap = new Map([
      ['main', mainCommits],
      ['feature', featureCommits],
    ]);

    it('assigns feature-only commits to feature branch', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      const f1Node = result.nodes.find(n => n.sha === 'f1');
      const f2Node = result.nodes.find(n => n.sha === 'f2');
      expect(f1Node?.branch).toBe('feature');
      expect(f2Node?.branch).toBe('feature');
    });

    it('assigns shared commits to main', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      const c1Node = result.nodes.find(n => n.sha === 'c1');
      const c2Node = result.nodes.find(n => n.sha === 'c2');
      expect(c1Node?.branch).toBe('main');
      expect(c2Node?.branch).toBe('main');
    });

    it('assigns different colors to branches', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      expect(result.colorMap['main']).not.toBe(result.colorMap['feature']);
    });

    it('puts feature on lane 1', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      const f1Node = result.nodes.find(n => n.sha === 'f1');
      expect(f1Node?.lane).toBe(1);
    });

    it('detects fork point', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      expect(result.forks.length).toBeGreaterThanOrEqual(1);
      const fork = result.forks.find(f =>
        f.parentBranch === 'main' && f.childBranch === 'feature'
      );
      expect(fork).toBeDefined();
    });

    it('deduplicates shared commits', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      const shas = result.nodes.map(n => n.sha);
      const unique = new Set(shas);
      expect(shas.length).toBe(unique.size);
    });
  });

  describe('merge commit detection', () => {
    // main: c1 ← c2 ← m1 (merge)
    // feature: c1 ← f1
    // m1 has parents [c2, f1] — merge commit
    const mainCommits = [
      commit('m1', 'Merge feature', ['c2', 'f1'], '2024-01-05T00:00:00Z'),
      commit('c2', 'main-2', ['c1'], '2024-01-02T00:00:00Z'),
      commit('c1', 'init', [], '2024-01-01T00:00:00Z'),
    ];
    const featureCommits = [
      commit('f1', 'feat-1', ['c1'], '2024-01-03T00:00:00Z'),
      commit('c1', 'init', [], '2024-01-01T00:00:00Z'),
    ];

    const branchList = [
      branch('main', 'm1', true),
      branch('feature', 'f1', false),
    ];
    const branchCommitsMap = new Map([
      ['main', mainCommits],
      ['feature', featureCommits],
    ]);

    it('marks merge commit as isMerge', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      const mergeNode = result.nodes.find(n => n.sha === 'm1');
      expect(mergeNode?.isMerge).toBe(true);
    });

    it('detects merge point with correct branches', () => {
      const result = buildBranchGraph(branchCommitsMap, branchList);
      expect(result.merges.length).toBeGreaterThanOrEqual(1);
      const merge = result.merges.find(m =>
        m.fromBranch === 'feature' && m.toBranch === 'main'
      );
      expect(merge).toBeDefined();
    });
  });

  describe('branch ordering', () => {
    it('puts default branch first', () => {
      const commits = [commit('c1', 'init', [], '2024-01-01T00:00:00Z')];
      const branchList = [
        branch('dev', 'c1', false),
        branch('main', 'c1', true),
        branch('staging', 'c1', false),
      ];
      const map = new Map([
        ['dev', commits],
        ['main', commits],
        ['staging', commits],
      ]);

      const result = buildBranchGraph(map, branchList);
      expect(result.branches[0]).toBe('main');
    });
  });

  describe('nodes metadata', () => {
    it('includes shortSha, author, date, color, message', () => {
      const commits = [
        commit('abc1234def', 'test message', [], '2024-01-01T00:00:00Z'),
      ];
      const branchList = [branch('main', 'abc1234def', true)];
      const map = new Map([['main', commits]]);

      const result = buildBranchGraph(map, branchList);
      const node = result.nodes[0];
      expect(node.shortSha).toBe('abc1234');
      expect(node.message).toBe('test message');
      expect(node.author).toBe('test');
      expect(node.color).toBeDefined();
      expect(node.date).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('empty data', () => {
    it('handles empty branch map', () => {
      const result = buildBranchGraph(new Map(), []);
      expect(result.nodes).toEqual([]);
      expect(result.branches).toEqual([]);
      expect(result.laneCount).toBe(0);
    });
  });
});
