'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { CommitData, CommitFile } from '@/types/git';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { GitCommit, Clock, User, ChevronDown, ChevronRight, Plus, Minus, FileCode, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Diff Viewer Components ──────────────────────────────────────────

function FileDiffStat({ file }: { file: CommitFile }) {
    const [showPatch, setShowPatch] = useState(false);
    const statusColor = {
        added: 'text-green-400',
        removed: 'text-red-400',
        modified: 'text-yellow-400',
        renamed: 'text-blue-400',
    }[file.status] || 'text-slate-400';

    return (
        <div className="border-t border-slate-800/30">
            <button
                onClick={() => file.patch && setShowPatch(!showPatch)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800/30 transition-colors"
            >
                {file.patch ? (
                    showPatch ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                ) : (
                    <FileCode className="w-3 h-3 text-slate-600 shrink-0" />
                )}
                <span className={cn('text-[10px] font-bold uppercase w-12 shrink-0', statusColor)}>
                    {file.status.slice(0, 3)}
                </span>
                <span className="text-[11px] text-slate-300 font-mono truncate flex-1">
                    {file.filename}
                </span>
                <span className="text-[10px] text-green-400 shrink-0">+{file.additions}</span>
                <span className="text-[10px] text-red-400 shrink-0 ml-1">-{file.deletions}</span>
            </button>
            {showPatch && file.patch && (
                <div className="bg-black/30 overflow-x-auto px-3 py-2 font-mono text-[10px] leading-4.5">
                    {file.patch.split('\n').map((line, i) => {
                        let lineClass = 'text-slate-500';
                        if (line.startsWith('+') && !line.startsWith('+++')) lineClass = 'text-green-400 bg-green-500/5';
                        else if (line.startsWith('-') && !line.startsWith('---')) lineClass = 'text-red-400 bg-red-500/5';
                        else if (line.startsWith('@@')) lineClass = 'text-blue-400';
                        return (
                            <div key={i} className={cn('whitespace-pre', lineClass)}>
                                {line}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function CommitDiffPanel({ commit }: { commit: CommitData }) {
    const { owner, repoName, githubToken } = useAnalysisStore();
    const [files, setFiles] = useState<CommitFile[] | null>(commit.files || null);
    const [stats, setStats] = useState(commit.stats || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDiff = useCallback(async () => {
        if (files || loading || !owner || !repoName) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/git-data/diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo: repoName, sha: commit.sha, token: githubToken || undefined }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setFiles(data.files || []);
            setStats(data.stats || null);
            // Persist back to the commit object for future renders
            commit.files = data.files;
            commit.stats = data.stats;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load diff');
        } finally {
            setLoading(false);
        }
    }, [commit, files, loading, owner, repoName, githubToken]);

    // Auto-load when panel is displayed
    React.useEffect(() => { loadDiff(); }, [loadDiff]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-3 py-4 text-slate-500 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading diff…
            </div>
        );
    }

    if (error) {
        return <div className="px-3 py-3 text-xs text-red-400">{error}</div>;
    }

    if (!files || files.length === 0) {
        return <div className="px-3 py-3 text-xs text-slate-500">No file changes</div>;
    }

    return (
        <div className="bg-slate-900/40 rounded-b-lg border border-t-0 border-slate-800/30 overflow-hidden">
            {stats && (
                <div className="flex items-center gap-3 px-3 py-2 text-[10px] border-b border-slate-800/30">
                    <span className="text-slate-400">{files.length} files changed</span>
                    <span className="text-green-400 flex items-center gap-0.5">
                        <Plus className="w-2.5 h-2.5" />{stats.additions}
                    </span>
                    <span className="text-red-400 flex items-center gap-0.5">
                        <Minus className="w-2.5 h-2.5" />{stats.deletions}
                    </span>
                </div>
            )}
            {files.map(f => (
                <FileDiffStat key={f.filename} file={f} />
            ))}
        </div>
    );
}

export function CommitHistory() {
  const { commits, mode } = useAnalysisStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleDiff = (sha: string) => {
    setExpanded(prev => ({ ...prev, [sha]: !prev[sha] }));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const groupByDate = (items: CommitData[]) => {
    const groups: Record<string, CommitData[]> = {};
    items.forEach(c => {
      const date = new Date(c.author.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(c);
    });
    return groups;
  };

  const grouped = groupByDate(commits);
  const isAdvanced = mode === 'advanced';

  if (commits.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <GitCommit className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-medium text-muted-foreground">No Commits Loaded</h3>
          <p className="text-xs text-muted-foreground/60">Commit history will appear once loaded from GitHub.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {Object.entries(grouped).map(([date, dateCommits]) => (
          <div key={date}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{date}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-1">
              {dateCommits.map(commit => {
                const isOpen = expanded[commit.sha];
                const st = commit.stats;
                return (
                  <div key={commit.sha}>
                    <div
                      className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      {/* Timeline dot */}
                      <div className="mt-1.5 relative shrink-0">
                        <div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-background" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug">
                          {commit.message.split('\n')[0]}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {commit.author.avatar_url ? (
                              <Image src={commit.author.avatar_url} alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            {commit.author.login || commit.author.name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(commit.author.date)}
                          </div>
                          <code className="font-mono text-muted-foreground/50 group-hover:text-blue-400 transition-colors">
                            {commit.sha.slice(0, 7)}
                          </code>
                          {commit.parents.length > 1 && (
                            <Badge variant="secondary" className="text-[8px] h-3.5 px-1">merge</Badge>
                          )}
                          {st && (
                            <span className="flex items-center gap-1 ml-1">
                              <span className="text-green-400">+{st.additions}</span>
                              <span className="text-red-400">-{st.deletions}</span>
                            </span>
                          )}
                          {isAdvanced && (
                            <button
                              onClick={() => toggleDiff(commit.sha)}
                              className="ml-auto flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors"
                              title="View commit diff"
                            >
                              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              diff
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {isOpen && <CommitDiffPanel commit={commit} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
