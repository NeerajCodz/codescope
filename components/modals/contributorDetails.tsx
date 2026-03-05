'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    GitCommit,
    GitPullRequest,
    Calendar,
    FileCode,
    Clock,
    Plus,
    Minus,
} from 'lucide-react';
import { ContributorData, CommitData, PRListItem } from '@/types/git';
import { cn } from '@/lib/utils';

interface ContributorDetailsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contributor: ContributorData | null;
    commits: CommitData[];
    prs: PRListItem[];
}

function formatRelativeDate(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

/** Build a weekly activity heatmap from commits */
function buildActivityGrid(commits: CommitData[]): { week: number; day: number; count: number; date: string }[] {
    const now = new Date();
    const grid: Map<string, number> = new Map();

    // 26 weeks back
    for (let w = 0; w < 26; w++) {
        for (let d = 0; d < 7; d++) {
            const date = new Date(now);
            date.setDate(date.getDate() - (25 - w) * 7 - (6 - d));
            grid.set(date.toISOString().slice(0, 10), 0);
        }
    }

    for (const c of commits) {
        const key = new Date(c.author.date).toISOString().slice(0, 10);
        if (grid.has(key)) grid.set(key, (grid.get(key) || 0) + 1);
    }

    const result: { week: number; day: number; count: number; date: string }[] = [];
    let idx = 0;
    for (const [date, count] of grid) {
        result.push({ week: Math.floor(idx / 7), day: idx % 7, count, date });
        idx++;
    }
    return result;
}

function ActivityHeatmap({ commits }: { commits: CommitData[] }) {
    const grid = useMemo(() => buildActivityGrid(commits), [commits]);
    const maxCount = Math.max(1, ...grid.map(g => g.count));

    const getColor = (count: number) => {
        if (count === 0) return 'bg-slate-800/50';
        const intensity = count / maxCount;
        if (intensity < 0.25) return 'bg-green-900/60';
        if (intensity < 0.5) return 'bg-green-700/70';
        if (intensity < 0.75) return 'bg-green-500/80';
        return 'bg-green-400';
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Activity — last 26 weeks</span>
            </div>
            <div className="flex gap-0.5">
                {Array.from({ length: 26 }, (_, w) => (
                    <div key={w} className="flex flex-col gap-0.5">
                        {Array.from({ length: 7 }, (_, d) => {
                            const cell = grid.find(g => g.week === w && g.day === d);
                            return (
                                <div
                                    key={d}
                                    className={cn('w-2.5 h-2.5 rounded-xs', getColor(cell?.count || 0))}
                                    title={cell ? `${cell.date}: ${cell.count} commits` : ''}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span>Less</span>
                {['bg-slate-800/50', 'bg-green-900/60', 'bg-green-700/70', 'bg-green-500/80', 'bg-green-400'].map((c, i) => (
                    <div key={i} className={cn('w-2.5 h-2.5 rounded-xs', c)} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}

export function ContributorDetailsModal({ open, onOpenChange, contributor, commits, prs }: ContributorDetailsProps) {
    const userCommits = useMemo(() => {
        if (!contributor) return [];
        return commits.filter(c =>
            c.author.login === contributor.login || c.author.name === contributor.login
        ).sort((a, b) => new Date(b.author.date).getTime() - new Date(a.author.date).getTime());
    }, [contributor, commits]);

    const userPRs = useMemo(() => {
        if (!contributor) return [];
        return prs.filter(p => p.author.login === contributor.login)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [contributor, prs]);

    const stats = useMemo(() => {
        const totalAdditions = userCommits.reduce((s, c) => s + (c.stats?.additions || 0), 0);
        const totalDeletions = userCommits.reduce((s, c) => s + (c.stats?.deletions || 0), 0);
        const filesModified = new Set(userCommits.flatMap(c => c.files?.map(f => f.filename) || [])).size;
        const openPRs = userPRs.filter(p => p.state === 'open').length;
        const mergedPRs = userPRs.filter(p => p.state === 'merged').length;
        return { totalAdditions, totalDeletions, filesModified, openPRs, mergedPRs };
    }, [userCommits, userPRs]);

    if (!contributor) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-slate-950 border-slate-800">
                <DialogHeader className="pb-0">
                    <DialogTitle className="flex items-center gap-3">
                        <Image
                            src={contributor.avatar_url}
                            alt={contributor.login}
                            width={40}
                            height={40}
                            className="rounded-full ring-2 ring-blue-500/30"
                        />
                        <div>
                            <div className="text-base font-semibold">{contributor.login}</div>
                            <div className="text-xs text-muted-foreground font-normal">
                                {contributor.contributions} contributions
                            </div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {/* Quick Stats */}
                <div className="grid grid-cols-5 gap-2 py-3">
                    {[
                        { icon: GitCommit, label: 'Commits', value: userCommits.length, color: 'text-blue-400' },
                        { icon: GitPullRequest, label: 'PRs', value: userPRs.length, color: 'text-purple-400' },
                        { icon: Plus, label: 'Additions', value: `+${stats.totalAdditions.toLocaleString()}`, color: 'text-green-400' },
                        { icon: Minus, label: 'Deletions', value: `-${stats.totalDeletions.toLocaleString()}`, color: 'text-red-400' },
                        { icon: FileCode, label: 'Files', value: stats.filesModified, color: 'text-yellow-400' },
                    ].map(item => (
                        <div key={item.label} className="bg-slate-900/50 border border-slate-800 rounded-lg p-2 text-center">
                            <item.icon className={cn('w-3.5 h-3.5 mx-auto mb-0.5', item.color)} />
                            <div className="text-xs font-bold">{item.value}</div>
                            <div className="text-[9px] text-muted-foreground">{item.label}</div>
                        </div>
                    ))}
                </div>

                {/* Activity Heatmap */}
                <ActivityHeatmap commits={userCommits} />

                {/* Tabs */}
                <Tabs defaultValue="commits" className="flex-1 min-h-0 mt-2">
                    <TabsList className="w-full bg-slate-900/50">
                        <TabsTrigger value="commits" className="flex-1 text-xs gap-1.5">
                            <GitCommit className="w-3 h-3" /> Commits ({userCommits.length})
                        </TabsTrigger>
                        <TabsTrigger value="prs" className="flex-1 text-xs gap-1.5">
                            <GitPullRequest className="w-3 h-3" /> Pull Requests ({userPRs.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="commits" className="mt-2 flex-1 min-h-0">
                        <ScrollArea className="h-50">
                            {userCommits.length === 0 ? (
                                <div className="text-xs text-muted-foreground text-center py-6">No commits found in current data</div>
                            ) : (
                                <div className="space-y-1 pr-3">
                                    {userCommits.map(c => (
                                        <div key={c.sha} className="flex items-start gap-2 p-2 rounded-md hover:bg-slate-900/50 group">
                                            <GitCommit className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs truncate">{c.message.split('\n')[0]}</div>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                    <span className="font-mono">{c.sha.slice(0, 7)}</span>
                                                    <span className="flex items-center gap-0.5">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {formatRelativeDate(c.author.date)}
                                                    </span>
                                                    {c.stats && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="text-green-400">+{c.stats.additions}</span>
                                                            <span className="text-red-400">-{c.stats.deletions}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="prs" className="mt-2 flex-1 min-h-0">
                        <ScrollArea className="h-50">
                            {userPRs.length === 0 ? (
                                <div className="text-xs text-muted-foreground text-center py-6">No pull requests found in current data</div>
                            ) : (
                                <div className="space-y-1 pr-3">
                                    {userPRs.map(pr => (
                                        <div key={pr.number} className="flex items-start gap-2 p-2 rounded-md hover:bg-slate-900/50">
                                            <GitPullRequest className={cn(
                                                'w-3 h-3 mt-0.5 shrink-0',
                                                pr.state === 'merged' ? 'text-purple-400' :
                                                pr.state === 'open' ? 'text-green-400' : 'text-red-400'
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs truncate">{pr.title}</span>
                                                    <Badge variant="secondary" className={cn(
                                                        'text-[9px] px-1 py-0 shrink-0',
                                                        pr.state === 'merged' ? 'text-purple-400 bg-purple-500/10' :
                                                        pr.state === 'open' ? 'text-green-400 bg-green-500/10' :
                                                        'text-red-400 bg-red-500/10'
                                                    )}>
                                                        {pr.state}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                    <span>#{pr.number}</span>
                                                    <span>{pr.headBranch} → {pr.baseBranch}</span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="text-green-400">+{pr.additions}</span>
                                                        <span className="text-red-400">-{pr.deletions}</span>
                                                    </span>
                                                    <span className="flex items-center gap-0.5">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {formatRelativeDate(pr.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
