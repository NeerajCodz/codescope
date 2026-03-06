'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PRListItem } from '@/types/git';
import {
  GitPullRequest, GitMerge, XCircle, Search,
  Clock, MessageSquare, AlertTriangle,
  Plus, Minus, FileText,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterState = 'all' | 'open' | 'closed' | 'merged';

export function PRsView() {
  const { prs, data } = useAnalysisStore();
  const [filter, setFilter] = useState<FilterState>('all');
  const [search, setSearch] = useState('');
  const [selectedPR, setSelectedPR] = useState<PRListItem | null>(null);

  const filtered = useMemo(() => {
    let result = prs;
    if (filter !== 'all') {
      result = result.filter(pr => pr.state === filter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(pr =>
        pr.title.toLowerCase().includes(q) ||
        pr.author.login.toLowerCase().includes(q) ||
        pr.number.toString().includes(q)
      );
    }
    return result;
  }, [prs, filter, search]);

  const counts = useMemo(() => ({
    all: prs.length,
    open: prs.filter(pr => pr.state === 'open').length,
    closed: prs.filter(pr => pr.state === 'closed').length,
    merged: prs.filter(pr => pr.state === 'merged').length,
  }), [prs]);

  const filters: { id: FilterState; label: string; icon: LucideIcon; color: string }[] = [
    { id: 'all', label: 'All', icon: GitPullRequest, color: 'text-foreground' },
    { id: 'open', label: 'Open', icon: GitPullRequest, color: 'text-green-400' },
    { id: 'merged', label: 'Merged', icon: GitMerge, color: 'text-purple-400' },
    { id: 'closed', label: 'Closed', icon: XCircle, color: 'text-red-400' },
  ];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  const getPRRiskScore = (pr: PRListItem): { score: number; level: string; color: string } => {
    if (!data) return { score: 0, level: 'low', color: 'text-green-400' };
    const changedPaths = pr.changedFiles;
    const adds = pr.additions;
    const dels = pr.deletions;
    const score = Math.min(100, Math.round((changedPaths * 5) + (adds * 0.1) + (dels * 0.05)));
    if (score > 70) return { score, level: 'high', color: 'text-red-400' };
    if (score > 40) return { score, level: 'medium', color: 'text-yellow-400' };
    return { score, level: 'low', color: 'text-green-400' };
  };

  if (prs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <GitPullRequest className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-medium text-muted-foreground">No Pull Requests Found</h3>
          <p className="text-xs text-muted-foreground/60 max-w-sm">
            Pull requests will appear here once loaded from the GitHub API.
            Make sure you have a valid token for private repos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* PR List */}
      <div className="w-full flex flex-col border-r border-border" style={{ maxWidth: selectedPR ? '50%' : '100%' }}>
        {/* Filters */}
        <div className="p-3 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search PRs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            {filters.map(f => {
              const Icon = f.icon;
              return (
                <Button
                  key={f.id}
                  variant={filter === f.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(f.id)}
                  className={cn('h-7 text-xs gap-1.5', filter === f.id && 'bg-muted')}
                >
                  <Icon className={cn('w-3 h-3', f.color)} />
                  {f.label}
                  <span className="text-muted-foreground">({counts[f.id]})</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {filtered.map(pr => {
              const risk = getPRRiskScore(pr);
              return (
                <button
                  key={pr.number}
                  className={cn(
                    'w-full text-left p-3 hover:bg-muted/30 transition-colors',
                    selectedPR?.number === pr.number && 'bg-muted/50'
                  )}
                  onClick={() => setSelectedPR(pr)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {pr.state === 'merged' ? (
                        <GitMerge className="w-4 h-4 text-purple-400" />
                      ) : pr.state === 'closed' ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : (
                        <GitPullRequest className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{pr.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">#{pr.number}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Image src={pr.author.avatar_url} alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full" />
                          {pr.author.login}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(pr.createdAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Plus className="w-3 h-3 text-green-400" />{pr.additions}
                          <Minus className="w-3 h-3 text-red-400" />{pr.deletions}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />{pr.changedFiles}
                        </div>
                      </div>
                      {pr.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {pr.labels.map(l => (
                            <Badge
                              key={l.name}
                              variant="secondary"
                              className="text-[9px] h-4 px-1.5"
                              style={{ backgroundColor: `#${l.color}20`, color: `#${l.color}`, borderColor: `#${l.color}40` }}
                            >
                              {l.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] h-5', risk.color)}
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {risk.level}
                      </Badge>
                      {pr.draft && (
                        <Badge variant="secondary" className="text-[9px] h-4 text-muted-foreground">Draft</Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* PR Detail */}
      {selectedPR && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{selectedPR.title}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>#{selectedPR.number}</span>
                  <span>by {selectedPR.author.login}</span>
                  <span>{selectedPR.headBranch} → {selectedPR.baseBranch}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPR(null)} className="h-7 text-xs">
                Close
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-green-400">+{selectedPR.additions}</div>
                  <div className="text-[10px] text-muted-foreground">Additions</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-red-400">-{selectedPR.deletions}</div>
                  <div className="text-[10px] text-muted-foreground">Deletions</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">{selectedPR.changedFiles}</div>
                  <div className="text-[10px] text-muted-foreground">Changed Files</div>
                </div>
              </div>

              {/* Risk analysis */}
              {data && (() => {
                const risk = getPRRiskScore(selectedPR);
                return (
                  <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <h3 className="text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className={cn('w-4 h-4', risk.color)} />
                      Risk Assessment: <span className={risk.color}>{risk.level.toUpperCase()}</span>
                    </h3>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', {
                          'bg-green-500': risk.score < 40,
                          'bg-yellow-500': risk.score >= 40 && risk.score < 70,
                          'bg-red-500': risk.score >= 70,
                        })}
                        style={{ width: `${risk.score}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      This PR modifies {selectedPR.changedFiles} files with {selectedPR.additions + selectedPR.deletions} total changes.
                    </p>
                  </div>
                );
              })()}

              {/* Body */}
              {selectedPR.body && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" /> Description
                  </h3>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedPR.body}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
