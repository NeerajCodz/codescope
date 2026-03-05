'use client';

import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, Flame, Bug, ChevronRight, Trash2, GitFork, Copy, AlertTriangle,
  Network, Layers, BarChart3, TrendingUp, Zap, Package,
  Code2, ArrowRightLeft, Users, GitCommit, Calendar, GitBranch,
} from 'lucide-react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { cn } from '@/lib/utils';
import { APIsModal } from '@/components/modals/features/apis';
import { DependenciesModal } from '@/components/modals/features/dependencies';
import { UnusedFunctionsModal } from '@/components/modals/unusedFunctions';

export function InfoView() {
  const { data, contributors, commits, branches } = useAnalysisStore();
  const [patternQuery, setPatternQuery] = useState('');
  const [antiOnly, setAntiOnly] = useState(false);
  const [warningOnly, setWarningOnly] = useState(false);
  const [apisOpen, setApisOpen] = useState(false);
  const [depsOpen, setDepsOpen] = useState(false);
  const [deadCodeOpen, setDeadCodeOpen] = useState(false);

  const highComplexityFiles = (data?.files ?? [])
    .filter(f => f.complexity && f.complexity.score > 20)
    .sort((a, b) => (b.complexity?.score || 0) - (a.complexity?.score || 0))
    .slice(0, 8);

  // Extended stats
  const extendedStats = useMemo(() => {
    if (!data) return null;
    const codeFiles = data.files.filter(f => f.isCode);
    const totalLines = data.totalLines ?? codeFiles.reduce((sum, f) => sum + (f.lines || 0), 0);
    const avgLines = codeFiles.length > 0 ? Math.round(totalLines / codeFiles.length) : 0;
    const exportedFns = data.files.flatMap(f => (f.functions || []).filter(fn => fn.isExported)).length;
    const totalFns = data.stats.functions || 0;
    const avgComplexity = data.stats.avgComplexity || 0;
    const largestFile = codeFiles.sort((a, b) => (b.lines || 0) - (a.lines || 0))[0];
    const layers = new Set(codeFiles.map(f => f.layer).filter(Boolean));

    // File size distribution
    const sizeRanges = { small: 0, medium: 0, large: 0, huge: 0 };
    for (const f of codeFiles) {
      const lines = f.lines || 0;
      if (lines <= 50) sizeRanges.small++;
      else if (lines <= 200) sizeRanges.medium++;
      else if (lines <= 500) sizeRanges.large++;
      else sizeRanges.huge++;
    }

    // Dependency count (unique imports)
    const allImports = new Set<string>();
    for (const f of data.files) {
      for (const imp of f.rawImports || []) allImports.add(imp);
    }

    return {
      totalLines,
      avgLines,
      exportedFns,
      totalFns,
      avgComplexity,
      largestFile,
      layers: layers.size,
      sizeRanges,
      uniqueImports: allImports.size,
      codeFiles: codeFiles.length,
    };
  }, [data]);

  const issueStats = useMemo(() => {
    if (!data) return { layerViolations: [], duplicates: [], issues: [] };
    return {
      layerViolations: data.layerViolations || [],
      duplicates: data.duplicates || [],
      issues: data.issues || [],
    };
  }, [data]);

  // Git stats
  const gitStats = useMemo(() => {
    const totalCommits = commits.length;
    const totalContributors = contributors.length;
    const totalBranches = branches.length;
    const protectedBranches = branches.filter(b => b.isProtected).length;

    // Commit frequency — group by day-of-week
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const commitsByDay = new Array(7).fill(0);
    const commitsByMonth: Record<string, number> = {};
    let firstCommitDate = '';
    let lastCommitDate = '';

    for (const c of commits) {
      const d = new Date(c.author.date);
      if (!isNaN(d.getTime())) {
        commitsByDay[d.getDay()]++;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        commitsByMonth[monthKey] = (commitsByMonth[monthKey] || 0) + 1;
        if (!firstCommitDate || c.author.date < firstCommitDate) firstCommitDate = c.author.date;
        if (!lastCommitDate || c.author.date > lastCommitDate) lastCommitDate = c.author.date;
      }
    }

    // Top contributors
    const topContributors = [...contributors]
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 10);

    // Monthly activity (last 12 months)
    const monthlyActivity = Object.entries(commitsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12);

    const maxMonthly = Math.max(...monthlyActivity.map(([, v]) => v), 1);

    return {
      totalCommits,
      totalContributors,
      totalBranches,
      protectedBranches,
      commitsByDay,
      dayMap,
      topContributors,
      monthlyActivity,
      maxMonthly,
      firstCommitDate,
      lastCommitDate,
    };
  }, [commits, contributors, branches]);

  const patternStats = useMemo(() => {
    const patterns = data?.patterns ?? [];
    const totalPatterns = patterns.length;
    const totalMatches = patterns.reduce((acc, p) => acc + p.files.length, 0);
    const topPattern = patterns.slice().sort((a, b) => b.files.length - a.files.length)[0];
    return { totalPatterns, totalMatches, topPattern };
  }, [data?.patterns]);

  const filteredPatterns = useMemo(() => {
    const patterns = data?.patterns ?? [];
    return patterns.filter((pat) => {
      if (antiOnly && !pat.isAnti) return false;
      if (warningOnly && pat.severity !== 'warning') return false;
      if (!patternQuery.trim()) return true;
      const q = patternQuery.toLowerCase();
      return pat.name.toLowerCase().includes(q) || pat.desc.toLowerCase().includes(q);
    });
  }, [data?.patterns, antiOnly, warningOnly, patternQuery]);

  if (!data) return (
    <div className="flex items-center justify-center h-full p-8 text-center italic text-slate-500 text-sm">
      Analysis pending...
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-foreground">Repository Info</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {data.stats.files} files
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {data.stats.functions} fns
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {extendedStats?.totalLines.toLocaleString() || 0} lines
              </Badge>
            </div>
          </div>
          <TabsList className="grid w-full max-w-lg grid-cols-5 bg-slate-900 border border-slate-800 h-9 p-1">
            <TabsTrigger value="overview" className="text-[10px] uppercase font-bold py-1">Info</TabsTrigger>
            <TabsTrigger value="git" className="text-[10px] uppercase font-bold py-1">Git</TabsTrigger>
            <TabsTrigger value="patterns" className="text-[10px] uppercase font-bold py-1">Patterns</TabsTrigger>
            <TabsTrigger value="security" className="text-[10px] uppercase font-bold py-1">Security</TabsTrigger>
            <TabsTrigger value="issues" className="text-[10px] uppercase font-bold py-1">Issues</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {/* ── Info / Overview ── */}
          <TabsContent value="overview" className="h-full m-0">
            <ScrollArea className="h-full px-6 py-4">
              <div className="space-y-6 max-w-3xl">

                {/* Secondary Stats */}
                {extendedStats && (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { label: 'Total Lines', value: extendedStats.totalLines.toLocaleString(), icon: Code2 },
                      { label: 'Avg Lines/File', value: extendedStats.avgLines, icon: TrendingUp },
                      { label: 'Exported Fns', value: extendedStats.exportedFns, icon: ArrowRightLeft },
                      { label: 'Dead Code', value: data.stats.dead, icon: Trash2 },
                      { label: 'Avg Complexity', value: extendedStats.avgComplexity.toFixed(1), icon: Zap },
                      { label: 'Layers', value: extendedStats.layers, icon: Layers },
                    ].map(s => {
                      const SIcon = s.icon;
                      return (
                        <Card key={s.label} className="p-2.5 bg-slate-900/50 border-slate-800">
                          <div className="flex items-center gap-1.5 mb-1">
                            <SIcon className="w-3 h-3 text-slate-500" />
                            <span className="text-[8px] text-muted-foreground uppercase truncate">{s.label}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-200">{s.value}</p>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* File Size Distribution */}
                {extendedStats && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      File Size Distribution
                    </h3>
                    <Card className="p-4 bg-slate-900/50 border-slate-800">
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Small (≤50)', count: extendedStats.sizeRanges.small, color: 'bg-green-500' },
                          { label: 'Medium (≤200)', count: extendedStats.sizeRanges.medium, color: 'bg-blue-500' },
                          { label: 'Large (≤500)', count: extendedStats.sizeRanges.large, color: 'bg-yellow-500' },
                          { label: 'Huge (>500)', count: extendedStats.sizeRanges.huge, color: 'bg-red-500' },
                        ].map(range => {
                          const total = extendedStats.codeFiles || 1;
                          const pct = Math.round((range.count / total) * 100);
                          return (
                            <div key={range.label} className="text-center">
                              <div className="h-16 flex items-end justify-center mb-2">
                                <div
                                  className={cn('w-8 rounded-t transition-all', range.color)}
                                  style={{ height: `${Math.max(4, pct)}%`, opacity: 0.7 }}
                                />
                              </div>
                              <p className="text-sm font-bold text-slate-200">{range.count}</p>
                              <p className="text-[9px] text-slate-500">{range.label}</p>
                              <p className="text-[9px] text-slate-600">{pct}%</p>
                            </div>
                          );
                        })}
                      </div>
                      {extendedStats.largestFile && (
                        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Largest file</span>
                          <span className="text-[10px] text-slate-300 font-mono">
                            {extendedStats.largestFile.name} ({extendedStats.largestFile.lines || 0} lines)
                          </span>
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                <Separator className="opacity-30" />

                {/* Hotspots */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Complexity Hotspots
                    </h3>
                    {highComplexityFiles.length > 0 && (
                      <Badge variant="outline" className="text-[8px] text-red-400 border-red-500/30">
                        {highComplexityFiles.length} files &gt; threshold
                      </Badge>
                    )}
                  </div>
                  {highComplexityFiles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {highComplexityFiles.map((file, i) => (
                        <Card key={i} className="p-3 bg-red-500/5 border-red-500/10 hover:border-red-500/30 transition-all cursor-pointer">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 shrink-0">
                              <Flame className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-red-400 truncate">{file.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{file.path}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-1.5 bg-red-500/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-red-500 rounded-full"
                                    style={{ width: `${Math.min(100, (file.complexity?.score || 0) * 2)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono font-bold text-red-400">{file.complexity?.score}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-600">
                                <span>{file.lines || 0} lines</span>
                                <span>{(file.functions || []).length} fns</span>
                                <Badge variant="outline" className={cn(
                                  'text-[7px] h-3.5',
                                  file.complexity?.level === 'critical' ? 'text-red-400 border-red-500/30' :
                                  file.complexity?.level === 'high' ? 'text-orange-400 border-orange-500/30' :
                                  'text-yellow-400 border-yellow-500/30'
                                )}>
                                  {file.complexity?.level}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-4 bg-green-500/5 border-green-500/10 text-center">
                      <Zap className="w-6 h-6 mx-auto text-green-400 mb-2" />
                      <p className="text-xs text-green-400 font-medium">All files within complexity threshold</p>
                    </Card>
                  )}
                </div>

                <Separator className="opacity-30" />

                {/* Architecture */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Architecture
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Card className="p-3 bg-card/60 border-border/60 hover:border-primary/40 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Network className="w-3.5 h-3.5 text-blue-400" />
                        <p className="text-[10px] text-muted-foreground uppercase">APIs</p>
                      </div>
                      <p className="text-xs text-foreground/80 mb-2">Detected endpoints</p>
                      <Button variant="outline" size="sm" className="w-full text-[10px]" onClick={() => setApisOpen(true)}>
                        View APIs
                      </Button>
                    </Card>
                    <Card className="p-3 bg-card/60 border-border/60 hover:border-primary/40 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-3.5 h-3.5 text-purple-400" />
                        <p className="text-[10px] text-muted-foreground uppercase">Dependencies</p>
                      </div>
                      <p className="text-xs text-foreground/80 mb-2">{extendedStats?.uniqueImports || 0} unique imports</p>
                      <Button variant="outline" size="sm" className="w-full text-[10px]" onClick={() => setDepsOpen(true)}>
                        View Deps
                      </Button>
                    </Card>
                    <Card className="p-3 bg-card/60 border-border/60 hover:border-primary/40 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-3.5 h-3.5 text-green-400" />
                        <p className="text-[10px] text-muted-foreground uppercase">Layers</p>
                      </div>
                      <p className="text-xs text-foreground/80 mb-2">{extendedStats?.layers || 0} code layers</p>
                      <Badge variant="outline" className="text-[8px] text-slate-500 border-slate-700">
                        {data.stats.connections} cross-layer calls
                      </Badge>
                    </Card>
                  </div>
                </div>

                {/* Languages */}
                {data.languages && Object.keys(data.languages).length > 0 && (
                  <>
                    <Separator className="opacity-30" />
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Languages
                      </h3>
                      <Card className="p-4 bg-slate-900/50 border-slate-800">
                        <div className="space-y-2">
                          {Object.entries(data.languages)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 10)
                            .map(([lang, count]) => {
                              const total = Object.values(data.languages!).reduce((s, v) => s + v, 0);
                              const pct = Math.round((count / total) * 100);
                              return (
                                <div key={lang} className="flex items-center gap-3">
                                  <span className="text-xs text-slate-300 w-20 shrink-0 font-medium">{lang}</span>
                                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[10px] text-slate-500 w-12 text-right shrink-0">{count} ({pct}%)</span>
                                </div>
                              );
                            })}
                        </div>
                      </Card>
                    </div>
                  </>
                )}

              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Git ── */}
          <TabsContent value="git" className="h-full m-0">
            <ScrollArea className="h-full px-6 py-4">
              <div className="space-y-6 max-w-3xl">

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: 'Commits', value: gitStats.totalCommits, icon: GitCommit, color: 'text-blue-400' },
                    { label: 'Contributors', value: gitStats.totalContributors, icon: Users, color: 'text-green-400' },
                    { label: 'Branches', value: gitStats.totalBranches, icon: GitBranch, color: 'text-purple-400' },
                    { label: 'Protected', value: gitStats.protectedBranches, icon: ShieldCheck, color: 'text-amber-400' },
                  ].map(s => {
                    const SIcon = s.icon;
                    return (
                      <Card key={s.label} className="p-3 bg-slate-900/50 border-slate-800">
                        <div className="flex items-center gap-1.5 mb-1">
                          <SIcon className={cn('w-3.5 h-3.5', s.color)} />
                          <span className="text-[9px] text-muted-foreground uppercase">{s.label}</span>
                        </div>
                        <p className="text-lg font-bold text-slate-200">{s.value}</p>
                      </Card>
                    );
                  })}
                </div>

                {/* Commit Activity by Day of Week */}
                {gitStats.totalCommits > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Commit Activity by Day
                    </h3>
                    <Card className="p-4 bg-slate-900/50 border-slate-800">
                      <div className="grid grid-cols-7 gap-2">
                        {gitStats.dayMap.map((day, i) => {
                          const max = Math.max(...gitStats.commitsByDay, 1);
                          const pct = Math.round((gitStats.commitsByDay[i] / max) * 100);
                          return (
                            <div key={day} className="text-center">
                              <div className="h-20 flex items-end justify-center mb-1.5">
                                <div
                                  className="w-6 bg-blue-500 rounded-t transition-all"
                                  style={{ height: `${Math.max(4, pct)}%`, opacity: 0.7 }}
                                />
                              </div>
                              <p className="text-xs font-bold text-slate-300">{gitStats.commitsByDay[i]}</p>
                              <p className="text-[9px] text-slate-500">{day}</p>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                )}

                {/* Monthly Activity */}
                {gitStats.monthlyActivity.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Monthly Activity
                    </h3>
                    <Card className="p-4 bg-slate-900/50 border-slate-800">
                      <div className="space-y-1.5">
                        {gitStats.monthlyActivity.map(([month, count]) => (
                          <div key={month} className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-500 w-16 shrink-0 font-mono">{month}</span>
                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${(count / gitStats.maxMonthly) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 w-8 text-right font-mono">{count}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                )}

                <Separator className="opacity-30" />

                {/* Top Contributors */}
                {gitStats.topContributors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Top Contributors
                      </h3>
                      <Badge variant="outline" className="text-[8px] text-green-400 border-green-500/30">
                        {gitStats.totalContributors} total
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {gitStats.topContributors.map((c, i) => (
                        <Card key={c.login} className="p-3 bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={c.avatar_url}
                                alt={c.login}
                                className="w-8 h-8 rounded-full border border-slate-700"
                              />
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                                <span className="text-[7px] font-bold text-slate-400">#{i + 1}</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-200 truncate">{c.name || c.login}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-slate-500">{c.contributions} contributions</span>
                                <span className="text-[9px] text-slate-600">·</span>
                                <span className="text-[9px] text-slate-500">{c.commits} commits</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Branches */}
                {branches.length > 0 && (
                  <>
                    <Separator className="opacity-30" />
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Branches
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {branches.slice(0, 12).map(b => (
                          <Card key={b.name} className={cn(
                            'p-2.5 border-slate-800 flex items-center gap-2',
                            b.isDefault ? 'bg-blue-500/5 border-blue-500/20' : 'bg-slate-900/50'
                          )}>
                            <GitBranch className={cn('w-3 h-3 shrink-0', b.isDefault ? 'text-blue-400' : 'text-slate-500')} />
                            <span className="text-[10px] font-mono text-slate-300 truncate flex-1">{b.name}</span>
                            {b.isDefault && <Badge variant="outline" className="text-[7px] text-blue-400 border-blue-500/30">default</Badge>}
                            {b.isProtected && <Badge variant="outline" className="text-[7px] text-amber-400 border-amber-500/30">protected</Badge>}
                          </Card>
                        ))}
                      </div>
                      {branches.length > 12 && (
                        <p className="text-[10px] text-slate-600 text-center">+{branches.length - 12} more branches</p>
                      )}
                    </div>
                  </>
                )}

                {/* Timeline */}
                {gitStats.firstCommitDate && (
                  <>
                    <Separator className="opacity-30" />
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Timeline
                      </h3>
                      <Card className="p-4 bg-slate-900/50 border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="text-center">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
                            <p className="text-[9px] text-slate-500 uppercase">First Commit</p>
                            <p className="text-xs font-semibold text-slate-300">{new Date(gitStats.firstCommitDate).toLocaleDateString()}</p>
                          </div>
                          <div className="flex-1 mx-4 h-px bg-linear-to-r from-blue-500/40 via-slate-700 to-green-500/40" />
                          <div className="text-center">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
                            <p className="text-[9px] text-slate-500 uppercase">Latest Commit</p>
                            <p className="text-xs font-semibold text-slate-300">{new Date(gitStats.lastCommitDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </>
                )}

                {gitStats.totalCommits === 0 && gitStats.totalContributors === 0 && (
                  <div className="text-center py-20 text-slate-600">
                    <GitCommit className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <h4 className="text-sm font-bold mb-1">No Git Data</h4>
                    <p className="text-xs">Git data will appear after fetching repository information.</p>
                  </div>
                )}

              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Patterns ── */}
          <TabsContent value="patterns" className="h-full m-0">
            <ScrollArea className="h-full px-6 py-4">
              <div className="space-y-4 max-w-2xl">
                <Card className="p-4 bg-slate-900 border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">Pattern Insights</p>
                      <p className="text-sm font-semibold text-slate-200">Architectural Patterns</p>
                    </div>
                    <Badge variant="outline" className="text-[9px]">{patternStats.totalPatterns} patterns</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                      <p className="text-[9px] text-slate-500">Matches</p>
                      <p className="text-sm font-semibold text-cyan-400">{patternStats.totalMatches}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                      <p className="text-[9px] text-slate-500">Top</p>
                      <p className="text-xs font-semibold text-slate-200 truncate">{patternStats.topPattern?.name || '—'}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                      <p className="text-[9px] text-slate-500">Coverage</p>
                      <p className="text-sm font-semibold text-emerald-400">
                        {data.files.length === 0 ? 0 : Math.round((patternStats.totalMatches / data.files.length) * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Input
                      value={patternQuery}
                      onChange={(e) => setPatternQuery(e.target.value)}
                      placeholder="Search patterns"
                      className="h-8 text-xs bg-slate-950 border-slate-800"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAntiOnly((v) => !v)}
                        className={cn(
                          'px-2 py-1 text-[10px] rounded border transition',
                          antiOnly ? 'border-orange-500/40 text-orange-400 bg-orange-500/10' : 'border-slate-800 text-slate-500'
                        )}
                      >
                        Anti-patterns
                      </button>
                      <button
                        type="button"
                        onClick={() => setWarningOnly((v) => !v)}
                        className={cn(
                          'px-2 py-1 text-[10px] rounded border transition',
                          warningOnly ? 'border-red-500/40 text-red-400 bg-red-500/10' : 'border-slate-800 text-slate-500'
                        )}
                      >
                        Warnings
                      </button>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredPatterns.map((pat, i) => (
                    <Card key={i} className="p-3 bg-slate-900 border-slate-800 hover:border-blue-500/20 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{pat.icon}</span>
                          <h4 className="text-xs font-bold text-blue-400 uppercase tracking-tight">{pat.name}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {pat.isAnti && (
                            <Badge variant="outline" className="text-[9px] text-orange-400 border-orange-500/30">Anti</Badge>
                          )}
                          <Badge variant="outline" className={cn(
                            'text-[9px] bg-blue-500/5',
                            pat.severity === 'warning' && 'text-red-400 border-red-500/30'
                          )}>
                            {pat.files.length}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed mb-3">{pat.desc}</p>
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[9px] text-slate-500 mb-1">
                          <span>Coverage</span>
                          <span>{data.files.length === 0 ? 0 : Math.round((pat.files.length / data.files.length) * 100)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800">
                          <div
                            className="h-1.5 rounded-full bg-cyan-500"
                            style={{ width: `${data.files.length === 0 ? 0 : Math.min(100, (pat.files.length / data.files.length) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        {pat.files.slice(0, 3).map((f, fi) => (
                          <div key={fi} className="flex items-center justify-between py-1 border-t border-slate-800/50 group cursor-pointer">
                            <div className="flex flex-col min-w-0">
                              <span className="text-[9px] text-slate-500 font-mono truncate max-w-50">{f.name}</span>
                              <span className="text-[9px] text-slate-600">{f.fns || 0} fns · {f.lines || 0} lines</span>
                            </div>
                            <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-blue-500" />
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
                {filteredPatterns.length === 0 && (
                  <div className="text-center text-xs text-slate-600 py-10">
                    No patterns match your filters.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Security ── */}
          <TabsContent value="security" className="h-full m-0">
            <ScrollArea className="h-full px-6 py-4">
              <div className="space-y-4 max-w-2xl">
                <Card className="p-3 bg-amber-500/10 border-amber-500/20">
                  <p className="text-[10px] text-amber-300 uppercase">Beta — Under Testing</p>
                  <p className="text-xs text-amber-200">Security findings are experimental.</p>
                </Card>
                {data.securityIssues.length > 0 ? data.securityIssues.map((iss, i) => (
                  <Card key={i} className={cn(
                    "p-3 border transition-colors",
                    iss.severity === 'high' ? "bg-red-500/5 border-red-500/20" : "bg-orange-500/5 border-orange-500/20"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className={cn(
                        "text-[9px] uppercase",
                        iss.severity === 'high' ? "text-red-400 border-red-500/20" : "text-orange-400 border-orange-500/20"
                      )}>
                        {iss.severity}
                      </Badge>
                      <span className="text-[9px] text-slate-500">line {iss.line}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200 mb-1">{iss.title}</h4>
                    <p className="text-[10px] text-slate-400 mb-3">{iss.desc}</p>
                    <div className="bg-black/50 p-2 rounded border border-white/5 overflow-x-auto">
                      <code className="text-[10px] font-mono text-red-300/80 whitespace-pre italic">
                        {iss.code || '// snippet hidden'}
                      </code>
                    </div>
                  </Card>
                )) : (
                  <div className="text-center py-20 text-slate-600">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-medium">Clear scan</p>
                    <p className="text-xs opacity-50">No known vulnerabilities found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Issues ── */}
          <TabsContent value="issues" className="h-full m-0">
            <ScrollArea className="h-full px-6 py-4">
              <div className="space-y-4 max-w-2xl">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 bg-slate-900/50 border-slate-800 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase">Issues</p>
                    <p className="text-lg font-bold text-red-400">{issueStats.issues.length}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/50 border-slate-800 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase">Layer Violations</p>
                    <p className="text-lg font-bold text-orange-400">{issueStats.layerViolations.length}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/50 border-slate-800 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase">Duplicates</p>
                    <p className="text-lg font-bold text-purple-400">{issueStats.duplicates.length}</p>
                  </Card>
                </div>

                {/* Issues List */}
                {issueStats.issues.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Architecture Issues</h3>
                    {issueStats.issues.map((issue, i) => (
                      <Card key={i} className={cn(
                        'p-3 border transition-colors',
                        issue.severity === 'critical' || issue.severity === 'high'
                          ? 'bg-red-500/5 border-red-500/20'
                          : issue.severity === 'medium'
                            ? 'bg-orange-500/5 border-orange-500/20'
                            : 'bg-slate-900/50 border-slate-800'
                      )}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={cn(
                              'w-3.5 h-3.5',
                              issue.severity === 'critical' || issue.severity === 'high' ? 'text-red-400' :
                              issue.severity === 'medium' ? 'text-orange-400' : 'text-yellow-400'
                            )} />
                            <span className="text-xs font-semibold text-slate-200">{issue.title}</span>
                          </div>
                          <Badge variant="outline" className={cn(
                            'text-[8px] uppercase',
                            issue.severity === 'critical' || issue.severity === 'high' ? 'text-red-400 border-red-500/30' :
                            issue.severity === 'medium' ? 'text-orange-400 border-orange-500/30' : 'text-yellow-400 border-yellow-500/30'
                          )}>
                            {issue.severity}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-400">{issue.desc}</p>
                        {issue.file && (
                          <p className="text-[9px] text-slate-600 mt-1 font-mono">{issue.file}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}

                {/* Layer Violations */}
                {issueStats.layerViolations.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <GitFork className="w-3 h-3" /> Layer Violations
                    </h3>
                    {issueStats.layerViolations.map((v, i) => (
                      <Card key={i} className="p-3 bg-orange-500/5 border-orange-500/10">
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="text-[8px] text-blue-400 border-blue-500/30">{v.fromLayer}</Badge>
                          <ChevronRight className="w-3 h-3 text-slate-600" />
                          <Badge variant="outline" className="text-[8px] text-purple-400 border-purple-500/30">{v.toLayer}</Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          <span className="font-mono text-slate-300">{v.fn}</span> in{' '}
                          <span className="text-slate-500">{v.from}</span> imports from{' '}
                          <span className="text-slate-500">{v.to}</span>
                        </p>
                        {v.suggestion && (
                          <p className="text-[9px] text-green-400/60 mt-1">{v.suggestion}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}

                {/* Duplicates */}
                {issueStats.duplicates.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Duplicate Code
                    </h3>
                    {issueStats.duplicates.map((d, i) => (
                      <Card key={i} className="p-3 bg-purple-500/5 border-purple-500/10">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-purple-400">{d.name}</span>
                          <Badge variant="outline" className="text-[8px] text-purple-400 border-purple-500/30">
                            {d.count}x {Math.round(d.similarity * 100)}% similar
                          </Badge>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {d.files.slice(0, 3).map((f, fi) => (
                            <p key={fi} className="text-[9px] text-slate-500 font-mono">
                              {f.file}:{f.line}
                            </p>
                          ))}
                        </div>
                        {d.suggestion && (
                          <p className="text-[9px] text-green-400/60 mt-1">{d.suggestion}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}

                {issueStats.issues.length === 0 && issueStats.layerViolations.length === 0 && issueStats.duplicates.length === 0 && (
                  <div className="text-center py-20 text-slate-600">
                    <Bug className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <h4 className="text-sm font-bold mb-1">Clean Architecture</h4>
                    <p className="text-xs">No architectural issues, layer violations, or duplicates found.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
      <APIsModal open={apisOpen} onOpenChange={setApisOpen} />
      <DependenciesModal open={depsOpen} onOpenChange={setDepsOpen} />
      <UnusedFunctionsModal open={deadCodeOpen} onOpenChange={setDeadCodeOpen} />
    </div>
  );
}
