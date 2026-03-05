/**
 * Comprehensive Local Cache
 *
 * Saves and restores the complete CodeScope analysis state
 * including analysis data, git intelligence, processes, and diagrams.
 * Uses localStorage for persistence across sessions.
 */

import type { CodeScopeExport, AnalysisData, ProcessDetectionResult, ViewMode, AppMode } from '@/types';
import type { BranchData, CommitData, ContributorData, PRListItem } from '@/types/git';
import type { GeneratedDiagram, AISettings, ChatSession } from '@/types/ai';

const CACHE_PREFIX = 'codescope_cache_';
const CACHE_VERSION = 1;

interface CacheStoreState {
  data: AnalysisData | null;
  branches: BranchData[];
  commits: CommitData[];
  contributors: ContributorData[];
  prs: PRListItem[];
  branchCommits: Map<string, CommitData[]> | null;
  processes: ProcessDetectionResult | null;
  diagrams: GeneratedDiagram[];
  aiSettings: AISettings;
  chatSession: ChatSession | null;
  mode: AppMode;
  viewMode: ViewMode;
  selectedBranch: string;
  defaultBranch: string;
  repo: string;
}

/**
 * Build a full CodeScopeExport from the current store state.
 */
export function buildExport(state: CacheStoreState): CodeScopeExport {
  // Convert Map to Record for serialization
  let branchCommitsObj: Record<string, CommitData[]> | null = null;
  if (state.branchCommits) {
    branchCommitsObj = {};
    for (const [key, value] of state.branchCommits) {
      branchCommitsObj[key] = value;
    }
  }

  return {
    version: CACHE_VERSION,
    exportedAt: new Date().toISOString(),
    repo: state.repo,
    selectedBranch: state.selectedBranch,
    defaultBranch: state.defaultBranch,
    mode: state.mode,
    analysis: state.data,
    branches: state.branches,
    commits: state.commits,
    contributors: state.contributors,
    prs: state.prs,
    branchCommits: branchCommitsObj,
    processes: state.processes,
    diagrams: state.diagrams,
    aiSettings: { provider: state.aiSettings.provider, model: state.aiSettings.model },
    chatSession: state.chatSession,
    apiAnalysis: null,
    viewMode: state.viewMode,
  };
}

/**
 * Save the complete analysis state to localStorage.
 */
export function saveToCache(repo: string, state: CacheStoreState): boolean {
  try {
    const exportData = buildExport(state);
    const key = `${CACHE_PREFIX}${sanitizeKey(repo)}`;
    const json = JSON.stringify(exportData);

    // Check approximate size (localStorage has ~5-10MB limit per origin)
    if (json.length > 8 * 1024 * 1024) {
      console.warn('Cache data too large for localStorage, saving without file contents');
      // Strip file contents to reduce size
      if (exportData.analysis) {
        exportData.analysis = {
          ...exportData.analysis,
          files: exportData.analysis.files.map(f => ({ ...f, content: undefined })),
        };
      }
      const reducedJson = JSON.stringify(exportData);
      localStorage.setItem(key, reducedJson);
    } else {
      localStorage.setItem(key, json);
    }

    // Also keep a minimal sessionStorage cache for quick analysis reload
    if (exportData.analysis) {
      try {
        sessionStorage.setItem(
          `analysis_${repo}_${state.mode}`,
          JSON.stringify(exportData.analysis)
        );
      } catch { /* ignore quota */ }
    }

    return true;
  } catch (err) {
    console.warn('Failed to save to cache:', err);
    return false;
  }
}

/**
 * Load the complete analysis state from localStorage.
 */
export function loadFromCache(repo: string): CodeScopeExport | null {
  try {
    const key = `${CACHE_PREFIX}${sanitizeKey(repo)}`;
    const json = localStorage.getItem(key);
    if (!json) return null;

    const data = JSON.parse(json) as CodeScopeExport;

    // Version check
    if (data.version !== CACHE_VERSION) {
      console.info('Cache version mismatch, clearing stale cache');
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (err) {
    console.warn('Failed to load from cache:', err);
    return null;
  }
}

/**
 * Restore cached data into the Zustand store.
 */
export function restoreFromExport(
  exportData: CodeScopeExport,
  actions: {
    setData: (d: AnalysisData | null) => void;
    setBranches: (b: BranchData[]) => void;
    setCommits: (c: CommitData[]) => void;
    setContributors: (c: ContributorData[]) => void;
    setPRs: (p: PRListItem[]) => void;
    setBranchCommits: (m: Map<string, CommitData[]>) => void;
    setProcesses: (p: ProcessDetectionResult | null) => void;
    setDiagrams: (d: GeneratedDiagram[]) => void;
    setViewMode: (v: ViewMode) => void;
    setSelectedBranch: (b: string) => void;
  },
): void {
  if (exportData.analysis) actions.setData(exportData.analysis);
  if (exportData.branches?.length) actions.setBranches(exportData.branches);
  if (exportData.commits?.length) actions.setCommits(exportData.commits);
  if (exportData.contributors?.length) actions.setContributors(exportData.contributors);
  if (exportData.prs?.length) actions.setPRs(exportData.prs);
  if (exportData.processes) actions.setProcesses(exportData.processes);
  if (exportData.diagrams?.length) actions.setDiagrams(exportData.diagrams);
  if (exportData.viewMode) actions.setViewMode(exportData.viewMode);
  if (exportData.selectedBranch) actions.setSelectedBranch(exportData.selectedBranch);

  // Convert Record back to Map
  if (exportData.branchCommits) {
    const map = new Map<string, CommitData[]>();
    for (const [key, value] of Object.entries(exportData.branchCommits)) {
      map.set(key, value);
    }
    actions.setBranchCommits(map);
  }
}

/**
 * Clear all cached data for a repo.
 */
export function clearCache(repo: string): void {
  try {
    const key = `${CACHE_PREFIX}${sanitizeKey(repo)}`;
    localStorage.removeItem(key);
    sessionStorage.removeItem(`analysis_${repo}_simple`);
    sessionStorage.removeItem(`analysis_${repo}_advanced`);
    sessionStorage.removeItem(`analysis_${repo}_public`);
    sessionStorage.removeItem(`analysis_${repo}_auth`);
  } catch { /* ignore */ }
}

/**
 * List all cached repos.
 */
export function listCachedRepos(): string[] {
  const repos: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        repos.push(key.slice(CACHE_PREFIX.length).replace(/_/g, '/'));
      }
    }
  } catch { /* ignore */ }
  return repos;
}

function sanitizeKey(repo: string): string {
  return repo.replace(/[^a-zA-Z0-9_-]/g, '_');
}
