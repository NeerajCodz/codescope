/**
 * Tests for components/context/analysisContext.tsx (Zustand store)
 *
 * Covers: all state fields and actions of useAnalysisStore
 */

import { useAnalysisStore } from '@/components/context/analysisContext';
import type { AnalysisData } from '@/types';
import type { BranchData, CommitData, PRListItem } from '@/types/git';

// Reset the store before each test
beforeEach(() => {
  useAnalysisStore.setState({
    data: null,
    loading: false,
    error: null,
    viewMode: 'force',
    selectedFile: null,
    selectedFunction: null,
    filterFolder: null,
    mode: 'simple',
    activeTab: 'scope',
    repo: '',
    owner: '',
    repoName: '',
    branches: [],
    selectedBranch: '',
    defaultBranch: 'main',
    contributors: [],
    commits: [],
    prs: [],
    branchCommits: null,
    diagrams: [],
    processes: null,
    hasDeepWiki: false,
    chatSession: null,
  });
});

describe('useAnalysisStore', () => {
  // ─── Core State ────────────────────────────────────────────────

  describe('core state', () => {
    it('has correct initial state', () => {
      const state = useAnalysisStore.getState();
      expect(state.data).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.viewMode).toBe('force');
      expect(state.selectedFile).toBeNull();
      expect(state.selectedFunction).toBeNull();
      expect(state.filterFolder).toBeNull();
    });

    it('setData updates data', () => {
      const mockData = { files: [], connections: [], stats: { files: 0, codeFiles: 0, functions: 0, dead: 0, connections: 0, avgComplexity: 0 }, issues: [], patterns: [], securityIssues: [] } as AnalysisData;
      useAnalysisStore.getState().setData(mockData);
      expect(useAnalysisStore.getState().data).toBe(mockData);
    });

    it('setData(null) clears data', () => {
      useAnalysisStore.getState().setData(null);
      expect(useAnalysisStore.getState().data).toBeNull();
    });

    it('setLoading toggles loading state', () => {
      useAnalysisStore.getState().setLoading(true);
      expect(useAnalysisStore.getState().loading).toBe(true);
      useAnalysisStore.getState().setLoading(false);
      expect(useAnalysisStore.getState().loading).toBe(false);
    });

    it('setError sets and clears error', () => {
      useAnalysisStore.getState().setError('Something failed');
      expect(useAnalysisStore.getState().error).toBe('Something failed');
      useAnalysisStore.getState().setError(null);
      expect(useAnalysisStore.getState().error).toBeNull();
    });

    it('setViewMode changes view mode', () => {
      useAnalysisStore.getState().setViewMode('treemap');
      expect(useAnalysisStore.getState().viewMode).toBe('treemap');
    });

    it('setSelectedFile updates selected file', () => {
      useAnalysisStore.getState().setSelectedFile('src/app.ts');
      expect(useAnalysisStore.getState().selectedFile).toBe('src/app.ts');
    });

    it('setSelectedFunction updates selected function', () => {
      useAnalysisStore.getState().setSelectedFunction('handleClick');
      expect(useAnalysisStore.getState().selectedFunction).toBe('handleClick');
    });

    it('setFilterFolder updates filter', () => {
      useAnalysisStore.getState().setFilterFolder('src/');
      expect(useAnalysisStore.getState().filterFolder).toBe('src/');
    });
  });

  // ─── Mode ──────────────────────────────────────────────────────

  describe('mode', () => {
    it('setMode changes mode', () => {
      useAnalysisStore.getState().setMode('advanced');
      expect(useAnalysisStore.getState().mode).toBe('advanced');
    });
  });

  // ─── Navigation ────────────────────────────────────────────────

  describe('navigation', () => {
    it('setActiveTab changes tab', () => {
      useAnalysisStore.getState().setActiveTab('lens');
      expect(useAnalysisStore.getState().activeTab).toBe('lens');
    });

    it('setRepo parses owner and repoName from full URL', () => {
      useAnalysisStore.getState().setRepo('https://github.com/vercel/next.js');
      const state = useAnalysisStore.getState();
      expect(state.owner).toBe('vercel');
      expect(state.repoName).toBe('next.js');
    });

    it('setRepo handles short format', () => {
      useAnalysisStore.getState().setRepo('facebook/react');
      const state = useAnalysisStore.getState();
      expect(state.owner).toBe('facebook');
      expect(state.repoName).toBe('react');
    });

    it('setRepo handles trailing slash', () => {
      useAnalysisStore.getState().setRepo('https://github.com/vercel/next.js/');
      expect(useAnalysisStore.getState().owner).toBe('vercel');
      expect(useAnalysisStore.getState().repoName).toBe('next.js');
    });
  });

  // ─── Branches ──────────────────────────────────────────────────

  describe('branches', () => {
    const mockBranches: BranchData[] = [
      { name: 'main', sha: 'abc', isDefault: true, isProtected: true },
      { name: 'develop', sha: 'def', isDefault: false, isProtected: false },
    ];

    it('setBranches stores branches and sets default', () => {
      useAnalysisStore.getState().setBranches(mockBranches);
      const state = useAnalysisStore.getState();
      expect(state.branches).toEqual(mockBranches);
      expect(state.defaultBranch).toBe('main');
    });

    it('setBranches sets selectedBranch to default when empty', () => {
      useAnalysisStore.getState().setBranches(mockBranches);
      expect(useAnalysisStore.getState().selectedBranch).toBe('main');
    });

    it('setBranches preserves existing selectedBranch', () => {
      useAnalysisStore.getState().setSelectedBranch('develop');
      useAnalysisStore.getState().setBranches(mockBranches);
      expect(useAnalysisStore.getState().selectedBranch).toBe('develop');
    });

    it('setSelectedBranch changes branch', () => {
      useAnalysisStore.getState().setSelectedBranch('feature');
      expect(useAnalysisStore.getState().selectedBranch).toBe('feature');
    });
  });

  // ─── Git Data ──────────────────────────────────────────────────

  describe('git data', () => {
    it('setContributors stores contributors', () => {
      const contribs = [{ login: 'user1', avatar_url: '', contributions: 10, commits: 5 }];
      useAnalysisStore.getState().setContributors(contribs);
      expect(useAnalysisStore.getState().contributors).toEqual(contribs);
    });

    it('setCommits stores commits', () => {
      const commits: CommitData[] = [{
        sha: 'abc', message: 'init', parents: [],
        author: { name: 'a', email: 'a@a', date: '2024-01-01' },
        committer: { name: 'a', email: 'a@a', date: '2024-01-01' },
      }];
      useAnalysisStore.getState().setCommits(commits);
      expect(useAnalysisStore.getState().commits).toEqual(commits);
    });

    it('setPRs stores PRs', () => {
      const prs: PRListItem[] = [{
        number: 1, title: 'PR 1', state: 'open',
        author: { login: 'user', avatar_url: '' },
        labels: [], createdAt: '', updatedAt: '',
        additions: 10, deletions: 5, changedFiles: 2,
        draft: false, headBranch: 'feature', baseBranch: 'main',
      }];
      useAnalysisStore.getState().setPRs(prs);
      expect(useAnalysisStore.getState().prs).toEqual(prs);
    });

    it('setBranchCommits stores branch commit map', () => {
      const map = new Map([['main', []]]);
      useAnalysisStore.getState().setBranchCommits(map);
      expect(useAnalysisStore.getState().branchCommits).toBe(map);
    });
  });

  // ─── AI ────────────────────────────────────────────────────────

  describe('ai', () => {
    it('setAISettings merges settings', () => {
      useAnalysisStore.getState().setAISettings({ provider: 'anthropic' });
      expect(useAnalysisStore.getState().aiSettings.provider).toBe('anthropic');
    });

    it('setChatSession sets and clears session', () => {
      const session = { id: '1', messages: [], focusMode: 'repo' as const, createdAt: Date.now(), repoContext: '' };
      useAnalysisStore.getState().setChatSession(session);
      expect(useAnalysisStore.getState().chatSession).toBe(session);
      useAnalysisStore.getState().setChatSession(null);
      expect(useAnalysisStore.getState().chatSession).toBeNull();
    });

    it('addChatMessage appends to session', () => {
      const session = { id: '1', messages: [], focusMode: 'repo' as const, createdAt: Date.now(), repoContext: '' };
      useAnalysisStore.getState().setChatSession(session);
      const msg = { id: 'm1', role: 'user' as const, content: 'Hello', timestamp: Date.now() };
      useAnalysisStore.getState().addChatMessage(msg);
      expect(useAnalysisStore.getState().chatSession!.messages).toHaveLength(1);
      expect(useAnalysisStore.getState().chatSession!.messages[0].content).toBe('Hello');
    });

    it('addChatMessage does nothing without session', () => {
      const msg = { id: 'm1', role: 'user' as const, content: 'Hello', timestamp: Date.now() };
      useAnalysisStore.getState().addChatMessage(msg);
      expect(useAnalysisStore.getState().chatSession).toBeNull();
    });

    it('addDiagram appends diagram', () => {
      const diagram = { type: 'flowchart', mermaidCode: 'graph LR; A-->B', title: 'Test', description: 'test diagram', generatedAt: Date.now() };
      useAnalysisStore.getState().addDiagram(diagram);
      expect(useAnalysisStore.getState().diagrams).toHaveLength(1);
    });

    it('setDiagrams replaces all diagrams', () => {
      useAnalysisStore.getState().addDiagram({ type: 'flowchart', mermaidCode: 'a', title: 'T', description: '', generatedAt: Date.now() });
      useAnalysisStore.getState().setDiagrams([]);
      expect(useAnalysisStore.getState().diagrams).toEqual([]);
    });
  });

  // ─── Processes & DeepWiki ──────────────────────────────────────

  describe('processes and deepwiki', () => {
    it('setProcesses stores processes', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const procs = { processes: [], connections: [] as any, metrics: {} as any } as any;
      useAnalysisStore.getState().setProcesses(procs);
      expect(useAnalysisStore.getState().processes).toBeDefined();
    });

    it('setHasDeepWiki toggles flag', () => {
      useAnalysisStore.getState().setHasDeepWiki(true);
      expect(useAnalysisStore.getState().hasDeepWiki).toBe(true);
    });
  });

  // ─── Fetch Settings ────────────────────────────────────────────

  describe('fetch settings', () => {
    it('setFetchMode changes mode', () => {
      useAnalysisStore.getState().setFetchMode('filewise');
      expect(useAnalysisStore.getState().fetchMode).toBe('filewise');
    });

    it('setGithubToken stores token', () => {
      useAnalysisStore.getState().setGithubToken('ghp_test123');
      expect(useAnalysisStore.getState().githubToken).toBe('ghp_test123');
    });
  });
});
