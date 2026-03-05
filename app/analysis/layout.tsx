'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { analyzeRepository } from '@/lib/analyzer';
import { AnalysisNav } from '@/components/nav/analysisNav';
import { AnalysisTopBar } from '@/components/nav/analysisTopBar';
import { AnalysisLoading } from '@/components/analysis/loading';
import { RateLimitModal } from '@/components/modals/rateLimit';
import { SettingsModal } from '@/components/settings/settings';
import { ChatPanel } from '@/components/chatbot/chatPanel';
import { useToast } from '@/components/ui/useToast';
import { BranchData, ContributorData, CommitData } from '@/types/git';
import { simpleGithub } from '@/lib/github/clientSimple';
import { saveToCache, loadFromCache, restoreFromExport } from '@/utils/cache';

interface GitDataResponse {
  commits: CommitData[];
  branches: BranchData[];
  contributors: ContributorData[];
  tags: unknown[];
  stats: {
    defaultBranch: string;
    totalCommits: number;
    totalBranches: number;
    totalContributors: number;
    totalTags: number;
    rateLimited?: boolean;
  };
  error?: string;
}

/** Read token from URL params, then sessionStorage fallback */
function resolveToken(urlToken: string | null): string {
  if (urlToken) return urlToken;
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('github_token') || '';
  }
  return '';
}

/**
 * Fire-and-forget persistence to SurrealDB via the graph API.
 * Silently skips if SurrealDB is unavailable (503).
 * Tracks availability so we never retry after a known failure.
 */
let _dbAvailable: boolean | null = null; // null = untested, true/false = known

interface PersistData {
    files: Array<{ path: string; name: string; isCode?: boolean; layer?: string; functions?: Array<{ isExported?: boolean }>; complexity?: { score: number } }>;
    connections: Array<{ source: string; target: string; fn: string; count: number }>;
    stats: Record<string, unknown>;
    processes?: Array<{ label: string; processType: string; entryPoint: string; stepCount: number; trace: string[]; traceFiles: string[]; isCrossFile: boolean }>;
}

async function persistToDb(repo: string, data: PersistData) {
    if (_dbAvailable === false) return; // known unavailable — skip immediately
    try {
        // Init schema once
        const initRes = await fetch('/api/graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'init' }),
        });
        if (initRes.status === 503) { _dbAvailable = false; return; }
        _dbAvailable = true;

        // Map AnalysisData → API graph format
        const MAX_PERSIST = 500;
        const codeFiles = data.files.filter(f => f.isCode).slice(0, MAX_PERSIST);
        const fileIds = new Set(codeFiles.map(f => f.path));

        const nodes = codeFiles.map(f => ({
            id: f.path,
            label: f.name,
            file: f.path,
            type: 'file' as const,
            layer: f.layer,
            isExported: f.functions?.some(fn => fn.isExported) || false,
            complexity: f.complexity?.score,
        }));
        const edges = data.connections
            .filter(c => fileIds.has(c.source) && fileIds.has(c.target))
            .map(c => ({ source: c.source, target: c.target, fn: c.fn, count: c.count }));

        // Normalise repo to "owner/name" format
        const cleanRepo = repo.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/\/$/, '');

        await fetch('/api/graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save',
                repo: cleanRepo,
                data: { stats: data.stats, nodes, edges, processes: data.processes || [] },
            }),
        });
    } catch {
        // Non-critical — SurrealDB is optional
    }
}

function AnalysisLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    data, loading, setData, setLoading, setError, setRepo,
    setBranches, setContributors, setCommits, setPRs,
    setBranchCommits, setProcesses, setDiagrams, setViewMode,
    setSelectedBranch,
    fetchMode, setGithubToken, mode,
  } = useAnalysisStore();
  const [showRateLimit, setShowRateLimit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentStep, setCurrentStep] = useState('init');
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const { toast } = useToast();

  const handleAnalysis = async (tokenOverride?: string) => {
    const importFlag = searchParams.get('import');
    if (importFlag) {
      const imported = sessionStorage.getItem('analysis_import');
      if (imported) {
        try {
          const importedData = JSON.parse(imported);
          setData(importedData);
          setError(null);
          setLoading(false);
          toast({ title: 'Imported analysis', description: 'Loaded from JSON file' });
          return;
        } catch {
          sessionStorage.removeItem('analysis_import');
        }
      }
    }

    const repo = searchParams.get('repo');
    // Token precedence: argument override → URL param → sessionStorage
    const token = tokenOverride || resolveToken(searchParams.get('token'));

    if (!repo) {
      router.push('/');
      return;
    }

    setRepo(repo);

    // Persist token
    if (token) {
      setGithubToken(token);
    }

    // Check comprehensive cache first
    const fullCache = loadFromCache(repo);
    if (fullCache?.analysis) {
      restoreFromExport(fullCache, {
        setData, setBranches, setCommits, setContributors, setPRs,
        setBranchCommits, setProcesses, setDiagrams, setViewMode,
        setSelectedBranch,
      });
      toast({ title: 'Loaded from cache', description: 'Complete analysis state restored' });
      // Still refresh git data in background
      loadGitData(repo, token);
      return;
    }

    // Fallback: check legacy sessionStorage cache
    const cacheKey = `analysis_${repo}_${token ? 'auth' : 'public'}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        setData(cachedData);
        toast({ title: 'Loaded from cache', description: 'Using previously analyzed data' });
        loadGitData(repo, token);
        return;
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    try {
      setLoading(true);
      setError(null);
      setCurrentStep('init');
      setProgress(5);
      await new Promise(resolve => setTimeout(resolve, 200));

      if (mode === 'simple') {
        // ── Simple Mode: client-side GitHub API only ──
        const cleanUrl = repo
          .replace(/^(https?:\/\/)?(www\.)?github\.com\//, '')
          .replace(/\/$/, '');
        const repoMatch = cleanUrl.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
        if (!repoMatch) throw new Error('Invalid GitHub URL');
        const [, owner, repoName] = repoMatch;

        if (token) simpleGithub.setToken(token);

        setCurrentStep('Scanning repository tree...');
        setProgress(10);
        const { files: treeFiles, branch } = await simpleGithub.scanTree(owner, repoName);
        setProgress(30);

        setCurrentStep('Fetching file contents...');
        const enrichedFiles = await simpleGithub.fetchAllContents(
          owner,
          repoName,
          treeFiles,
          branch,
          (msg) => {
            setCurrentFile(msg);
            setProgress(prev => Math.min(prev + 1, 80));
          }
        );
        setProgress(80);

        setCurrentStep('Parsing & analyzing...');
        // Build a full AnalysisData from the fetched file contents
        const contentsMap = new Map<string, string>();
        for (const file of enrichedFiles) {
          if (file.content) contentsMap.set(file.path, file.content);
        }
        const { parseFilesFromContents } = await import('@/lib/parser');
        const analysisData = parseFilesFromContents(contentsMap, repo);
        setProgress(95);

        // Load git data in parallel (client-side)
        setCurrentStep('Loading git data...');
        const gitResult = await simpleGithub.fetchGitData(owner, repoName, token);
        if (gitResult.branches?.length) setBranches(gitResult.branches);
        if (gitResult.commits?.length) setCommits(gitResult.commits);
        if (gitResult.contributors?.length) setContributors(gitResult.contributors);

        // Load PRs
        try {
          const prs = await simpleGithub.fetchPRs(owner, repoName);
          if (prs.length) setPRs(prs);
        } catch { /* non-critical */ }

        setCurrentStep('complete');
        setProgress(100);
        setData(analysisData);

        // Comprehensive cache — save ALL data
        saveToCache(repo, useAnalysisStore.getState());

        // Non-blocking DB persistence (fire-and-forget)
        persistToDb(repo, analysisData);
      } else {
        // ── Advanced Mode: server-side tarball analysis ──
        // Kick off git data load in parallel
        const gitDataPromise = loadGitData(repo, token);

        const analysisData = await analyzeRepository(
          repo,
          token || undefined,
          (step, file) => {
            setCurrentStep(step);
            setCurrentFile(file || '');
            setProgress(prev => Math.min(prev + 4, 95));
          },
          fetchMode
        );

        setCurrentStep('complete');
        setProgress(100);
        setData(analysisData);

        await gitDataPromise;

        // Comprehensive cache — save ALL data after git data is loaded
        saveToCache(repo, useAnalysisStore.getState());

        // Non-blocking DB persistence (fire-and-forget)
        persistToDb(repo, analysisData);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to analyze repository';
      const isRateLimit =
        message.includes('Rate limited') ||
        message.includes('403') ||
        message.includes('429') ||
        message.includes('rate limit');
      if (isRateLimit) {
        setShowRateLimit(true);
        setError('Rate limit exceeded. Please provide a GitHub token.');
      } else {
        setError(message);
        toast({ variant: 'destructive', title: 'Analysis Failed', description: message });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadGitData = async (repo: string, token?: string | null) => {
    const cleanUrl = repo
      .replace(/^(https?:\/\/)?(www\.)?github\.com\//, '')
      .replace(/\/$/, '');
    const match = cleanUrl.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (!match) return;
    const [, o, r] = match;

    try {
      const response = await fetch('/api/git-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: o, repo: r, token: token || null }),
      });

      if (!response.ok) {
        console.warn('Git data fetch failed:', response.status);
        return;
      }

      const gitData = await response.json() as GitDataResponse;

      if (gitData.stats?.rateLimited && !token) {
        // Silently note it - don't interrupt UX for lens data
        console.info('Git data partially rate-limited (no token)');
      }

      if (gitData.branches?.length) setBranches(gitData.branches);
      if (gitData.contributors?.length) setContributors(gitData.contributors);
      if (gitData.commits?.length) setCommits(gitData.commits);
      loadPRs(o, r, token);
    } catch (err) {
      console.warn('Git data fetch error:', err);
    }
  };

  const loadPRs = async (owner: string, repo: string, token?: string | null) => {
    try {
      const { getPRs } = await import('@/lib/git/prs');
      const prs = await getPRs(owner, repo, 'all', 30, token);
      if (prs.length) setPRs(prs);
    } catch {
      // PRs are non-critical
    }
  };

  useEffect(() => {
    if (!data) {
      handleAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTokenSubmit = (token: string) => {
    setGithubToken(token);
    // Clear cache so analysis reruns with token
    const repo = searchParams.get('repo');
    if (repo) {
      try {
        sessionStorage.removeItem(`analysis_${repo}_public`);
        sessionStorage.removeItem(`analysis_${repo}_auth`);
      } catch { /* */ }
    }
    handleAnalysis(token);
  };

  if (loading || !data) {
    return (
      <AnalysisLoading
        currentStep={currentStep}
        progress={progress}
        fileName={currentFile}
        fetchMode={fetchMode}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <AnalysisTopBar onSettingsOpen={() => setShowSettings(true)} />
      <AnalysisNav />
      <div className="flex-1 overflow-hidden">{children}</div>
      <RateLimitModal
        open={showRateLimit}
        onOpenChange={setShowRateLimit}
        onTokenSubmit={handleTokenSubmit}
      />
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
      <ChatPanel />
    </div>
  );
}

export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AnalysisLoading currentStep="init" progress={0} fileName="" fetchMode="tarball" />}>
      <AnalysisLayoutInner>{children}</AnalysisLayoutInner>
    </Suspense>
  );
}
