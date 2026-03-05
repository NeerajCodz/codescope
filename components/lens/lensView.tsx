'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    GitBranch, GitCommit, User, Search,
    Eye, History, GitCompare,
    Calendar, GitMerge, GitFork,
    ChevronDown, ChevronRight, Shield, ArrowUpRight, ArrowDownRight,
    Loader2, File, Folder, FolderOpen, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAnalysisStore } from '@/components/context/analysisContext';
import {
    BranchData, CommitData, ContributorData,
    BranchGraphNode, BranchGraphData,
} from '@/types/git';
import { AnalysisData } from '@/types';
import { buildBranchGraph } from '@/lib/git/branchGraph';
import { cn } from '@/lib/utils';

type LensPanel = 'graph' | 'timeline' | 'blame' | 'compare';

// ─── Constants ───────────────────────────────────────────────────────

const LANE_WIDTH = 28;
const ROW_HEIGHT = 44;
const DOT_RADIUS = 5;
const MERGE_DOT_RADIUS = 7;

// ─── Branch Graph Canvas ─────────────────────────────────────────────

function BranchGraphCanvas({
    graphData,
    selectedSha,
    onSelectCommit,
}: {
    graphData: BranchGraphData;
    selectedSha: string | null;
    onSelectCommit: (sha: string) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { nodes, colorMap } = graphData;
        const totalHeight = nodes.length * ROW_HEIGHT + 20;
        const totalWidth = (graphData.laneCount + 1) * LANE_WIDTH + 20;

        const dpr = window.devicePixelRatio || 2;
        canvas.width = totalWidth * dpr;
        canvas.height = totalHeight * dpr;
        canvas.style.width = `${totalWidth}px`;
        canvas.style.height = `${totalHeight}px`;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, totalWidth, totalHeight);

        // Index nodes by sha for parent lookup
        const shaRowMap = new Map<string, number>();
        nodes.forEach((n, i) => shaRowMap.set(n.sha, i));

        // Draw connecting lines first (behind dots)
        nodes.forEach((node, rowIdx) => {
            const x = 14 + node.lane * LANE_WIDTH;
            const y = 10 + rowIdx * ROW_HEIGHT;
            const color = colorMap[node.branch] || '#6b7280';

            node.parents.forEach(parentSha => {
                const parentRowIdx = shaRowMap.get(parentSha);
                if (parentRowIdx === undefined) return;
                const parentNode = nodes[parentRowIdx];
                const px = 14 + parentNode.lane * LANE_WIDTH;
                const py = 10 + parentRowIdx * ROW_HEIGHT;

                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.5;

                if (node.lane === parentNode.lane) {
                    // Straight vertical line
                    ctx.moveTo(x, y);
                    ctx.lineTo(px, py);
                } else {
                    // Bezier curve for cross-lane connections
                    const midY = (y + py) / 2;
                    ctx.moveTo(x, y);
                    ctx.bezierCurveTo(x, midY, px, midY, px, py);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            });
        });

        // Draw commit dots
        nodes.forEach((node, rowIdx) => {
            const x = 14 + node.lane * LANE_WIDTH;
            const y = 10 + rowIdx * ROW_HEIGHT;
            const color = colorMap[node.branch] || '#6b7280';
            const isSelected = node.sha === selectedSha;
            const radius = node.isMerge ? MERGE_DOT_RADIUS : DOT_RADIUS;

            // Selection ring
            if (isSelected) {
                ctx.beginPath();
                ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Dot
            ctx.beginPath();
            if (node.isMerge) {
                // Diamond shape for merges
                ctx.moveTo(x, y - radius);
                ctx.lineTo(x + radius, y);
                ctx.lineTo(x, y + radius);
                ctx.lineTo(x - radius, y);
                ctx.closePath();
            } else if (node.isFork) {
                // Square for forks
                ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
            } else {
                ctx.arc(x, y, radius, 0, Math.PI * 2);
            }
            ctx.fillStyle = color;
            ctx.fill();

            // White inner dot for selected
            if (isSelected) {
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.fill();
            }
        });
    }, [graphData, selectedSha]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const y = e.clientY - rect.top;
        const rowIdx = Math.floor((y - 10 + ROW_HEIGHT / 2) / ROW_HEIGHT);
        if (rowIdx >= 0 && rowIdx < graphData.nodes.length) {
            onSelectCommit(graphData.nodes[rowIdx].sha);
        }
    }, [graphData.nodes, onSelectCommit]);

    return (
        <canvas
            ref={canvasRef}
            className="shrink-0 cursor-pointer"
            onClick={handleClick}
        />
    );
}

// ─── Commit Row ──────────────────────────────────────────────────────

function CommitRow({ node, isSelected, onClick }: {
    node: BranchGraphNode;
    isSelected: boolean;
    onClick: () => void;
}) {
    const relativeTime = getRelativeTime(new Date(node.date));
    const firstLine = node.message.split('\n')[0];

    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all group',
                isSelected
                    ? 'bg-blue-500/10 border-l-2'
                    : 'hover:bg-slate-800/50 border-l-2 border-transparent'
            )}
            style={isSelected ? { borderLeftColor: node.color } : undefined}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    {node.isMerge && <GitMerge className="w-3 h-3 shrink-0" style={{ color: node.color }} />}
                    {node.isFork && <GitFork className="w-3 h-3 shrink-0" style={{ color: node.color }} />}
                    <p className={cn(
                        'text-xs truncate',
                        isSelected ? 'text-slate-200' : 'text-slate-300'
                    )}>
                        {firstLine}
                    </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <code className="text-[10px] font-mono text-slate-500">{node.shortSha}</code>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        {node.author}
                    </span>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className="text-[10px] text-slate-500">{relativeTime}</span>
                </div>
            </div>
            <Badge
                variant="outline"
                className="text-[9px] shrink-0 border-opacity-40"
                style={{ borderColor: node.color, color: node.color }}
            >
                {node.branch}
            </Badge>
        </button>
    );
}

// ─── Commit Details Panel ────────────────────────────────────────────

function CommitDetails({ node, graphData }: { node: BranchGraphNode | null; graphData: BranchGraphData }) {
    if (!node) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                <div className="text-center">
                    <GitCommit className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Select a commit to view details</p>
                </div>
            </div>
        );
    }

    const date = new Date(node.date);
    const nodeMerges = graphData.merges.filter(m => m.sha === node.sha);
    const nodeForks = graphData.forks.filter(f => f.sha === node.sha);

    return (
        <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
                {/* Commit message */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-200 mb-1">{node.message.split('\n')[0]}</h3>
                    {node.message.includes('\n') && (
                        <p className="text-xs text-slate-400 whitespace-pre-wrap mt-2">
                            {node.message.split('\n').slice(1).join('\n').trim()}
                        </p>
                    )}
                </div>

                <Separator className="opacity-30" />

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-3">
                    <MetaCard label="SHA" value={<code className="text-xs font-mono text-blue-400">{node.sha}</code>} />
                    <MetaCard label="Author" value={
                        <span className="text-xs text-slate-300 flex items-center gap-1.5">
                            {node.authorAvatar && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={node.authorAvatar} alt="" className="w-4 h-4 rounded-full" />
                            )}
                            {node.author}
                        </span>
                    } />
                    <MetaCard label="Date" value={
                        <span className="text-xs text-slate-300">{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
                    } />
                    <MetaCard label="Branch" value={
                        <span className="text-xs flex items-center gap-1" style={{ color: node.color }}>
                            <GitBranch className="w-3 h-3" />
                            {node.branch}
                        </span>
                    } />
                </div>

                {/* Merge/Fork indicators */}
                {nodeMerges.length > 0 && (
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-2">Merges</span>
                        {nodeMerges.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-slate-900/50 rounded-md border border-slate-800/50 mb-1">
                                <GitMerge className="w-3 h-3" style={{ color: graphData.colorMap[m.fromBranch] }} />
                                <span className="text-[10px] text-slate-400">
                                    <span style={{ color: graphData.colorMap[m.fromBranch] }}>{m.fromBranch}</span>
                                    {' → '}
                                    <span style={{ color: graphData.colorMap[m.toBranch] }}>{m.toBranch}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {nodeForks.length > 0 && (
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-2">Forks</span>
                        {nodeForks.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-slate-900/50 rounded-md border border-slate-800/50 mb-1">
                                <GitFork className="w-3 h-3" style={{ color: graphData.colorMap[f.childBranch] }} />
                                <span className="text-[10px] text-slate-400">
                                    <span style={{ color: graphData.colorMap[f.parentBranch] }}>{f.parentBranch}</span>
                                    {' → '}
                                    <span style={{ color: graphData.colorMap[f.childBranch] }}>{f.childBranch}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Parents */}
                {node.parents.length > 0 && (
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-2">Parents</span>
                        <div className="space-y-1">
                            {node.parents.map(p => (
                                <code key={p} className="block text-[10px] font-mono text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                                    {p}
                                </code>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}

function MetaCard({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">{label}</span>
            {value}
        </div>
    );
}

// ─── Inline Branch Strip (replaces sidebar branch tab) ───────────────

function InlineBranchStrip({
    graphData,
    branches,
    selectedBranches,
    onToggle,
}: {
    graphData: BranchGraphData;
    branches: BranchData[];
    selectedBranches: Set<string>;
    onToggle: (branch: string) => void;
}) {
    const stats = useMemo(() => {
        return graphData.branches.map(name => {
            const cnt = graphData.nodes.filter(n => n.branch === name).length;
            const bData = branches.find(b => b.name === name);
            return {
                name,
                color: graphData.colorMap[name],
                commitCount: cnt,
                isDefault: bData?.isDefault || false,
                isProtected: bData?.isProtected || false,
                aheadBy: bData?.aheadBy || 0,
                behindBy: bData?.behindBy || 0,
            };
        });
    }, [graphData, branches]);

    if (stats.length === 0) return null;

    return (
        <div className="border-b border-border bg-slate-900/30 px-3 py-2 overflow-x-auto shrink-0">
            <div className="flex items-center gap-2 min-w-max">
                {stats.map(s => {
                    const active = selectedBranches.has(s.name);
                    return (
                        <button
                            key={s.name}
                            onClick={() => onToggle(s.name)}
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] transition-all whitespace-nowrap',
                                active
                                    ? 'bg-opacity-10 border-opacity-40'
                                    : 'opacity-40 border-transparent hover:opacity-70'
                            )}
                            style={active ? { backgroundColor: `${s.color}15`, borderColor: `${s.color}50` } : undefined}
                        >
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="font-medium" style={{ color: active ? s.color : undefined }}>
                                {s.name}
                            </span>
                            <span className="text-[9px] text-slate-500">{s.commitCount}</span>
                            {s.isDefault && (
                                <Badge variant="outline" className="text-[7px] h-3.5 px-1 text-blue-400 border-blue-500/30">
                                    default
                                </Badge>
                            )}
                            {s.isProtected && <Shield className="w-2.5 h-2.5 text-amber-400" />}
                            {s.aheadBy > 0 && (
                                <span className="text-[9px] text-green-400 flex items-center">
                                    <ArrowUpRight className="w-2.5 h-2.5" />{s.aheadBy}
                                </span>
                            )}
                            {s.behindBy > 0 && (
                                <span className="text-[9px] text-red-400 flex items-center">
                                    <ArrowDownRight className="w-2.5 h-2.5" />{s.behindBy}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Branch Analysis Panel ───────────────────────────────────────────

// Exported for potential future use in branch detail views
export function BranchAnalysisPanel({ graphData, branches }: {
    graphData: BranchGraphData;
    branches: BranchData[];
}) {
    const branchStats = useMemo(() => {
        return graphData.branches.map(branchName => {
            const branchNodes = graphData.nodes.filter(n => n.branch === branchName);
            const bData = branches.find(b => b.name === branchName);
            const contributors = new Set(branchNodes.map(n => n.author));
            const mergeCount = graphData.merges.filter(m => m.toBranch === branchName || m.fromBranch === branchName).length;
            const lastActivity = branchNodes[0]?.date || '';

            return {
                name: branchName,
                color: graphData.colorMap[branchName],
                commitCount: branchNodes.length,
                contributors: Array.from(contributors),
                mergeCount,
                lastActivity,
                isDefault: bData?.isDefault || false,
                isProtected: bData?.isProtected || false,
                aheadBy: bData?.aheadBy || 0,
                behindBy: bData?.behindBy || 0,
            };
        });
    }, [graphData, branches]);

    return (
        <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Branch Analysis
                </h3>
                {branchStats.map(stat => (
                    <div key={stat.name} className="bg-slate-900/40 rounded-lg p-3 border border-slate-800/50 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stat.color }} />
                                <span className="text-xs font-semibold text-slate-200">{stat.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {stat.isDefault && (
                                    <Badge variant="outline" className="text-[8px] text-blue-400 border-blue-500/30">default</Badge>
                                )}
                                {stat.isProtected && (
                                    <Shield className="w-3 h-3 text-amber-400" />
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                                <span className="text-sm font-bold text-slate-200">{stat.commitCount}</span>
                                <span className="text-[9px] text-slate-500 block">commits</span>
                            </div>
                            <div className="text-center">
                                <span className="text-sm font-bold text-slate-200">{stat.contributors.length}</span>
                                <span className="text-[9px] text-slate-500 block">authors</span>
                            </div>
                            <div className="text-center">
                                <span className="text-sm font-bold text-slate-200">{stat.mergeCount}</span>
                                <span className="text-[9px] text-slate-500 block">merges</span>
                            </div>
                        </div>

                        {(stat.aheadBy > 0 || stat.behindBy > 0) && (
                            <div className="flex items-center gap-3 text-[10px]">
                                {stat.aheadBy > 0 && (
                                    <span className="flex items-center gap-0.5 text-green-400">
                                        <ArrowUpRight className="w-3 h-3" />
                                        {stat.aheadBy} ahead
                                    </span>
                                )}
                                {stat.behindBy > 0 && (
                                    <span className="flex items-center gap-0.5 text-red-400">
                                        <ArrowDownRight className="w-3 h-3" />
                                        {stat.behindBy} behind
                                    </span>
                                )}
                            </div>
                        )}

                        {stat.lastActivity && (
                            <span className="text-[9px] text-slate-500">
                                Last activity: {getRelativeTime(new Date(stat.lastActivity))}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}

// ─── Branch Selector ─────────────────────────────────────────────────

function BranchFilter({
    branches,
    colorMap,
    selectedBranches,
    onToggle,
}: {
    branches: string[];
    colorMap: Record<string, string>;
    selectedBranches: Set<string>;
    onToggle: (branch: string) => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(!open)}
                className="h-7 px-2 text-xs gap-1 text-slate-400 hover:text-slate-200"
            >
                <GitBranch className="w-3 h-3" />
                Branches ({selectedBranches.size}/{branches.length})
                <ChevronDown className="w-3 h-3" />
            </Button>

            {open && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 py-1">
                    {branches.map(b => (
                        <button
                            key={b}
                            onClick={() => onToggle(b)}
                            className={cn(
                                'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-800/50 transition-colors',
                                selectedBranches.has(b) ? 'text-slate-200' : 'text-slate-500',
                            )}
                        >
                            <div
                                className="w-2.5 h-2.5 rounded-full border-2 transition-colors"
                                style={{
                                    borderColor: colorMap[b],
                                    backgroundColor: selectedBranches.has(b) ? colorMap[b] : 'transparent',
                                }}
                            />
                            <span className="truncate">{b}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main LensView ───────────────────────────────────────────────────

export function LensView() {
    const {
        data,
        branches: rawBranches,
        commits: rawCommits,
        branchCommits,
        contributors,
        owner,
        repoName,
        githubToken,
        setBranchCommits,
    } = useAnalysisStore();

    const [activePanel, setActivePanel] = useState<LensPanel>('graph');
    const [selectedSha, setSelectedSha] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    // Fetch multi-branch data if not already loaded
    useEffect(() => {
        if (branchCommits && branchCommits.size > 0) return;
        if (!rawBranches?.length || !owner || !repoName) return;

        let cancelled = false;

        const fetchBranchData = async () => {
            setLoading(true);
            try {
                const { fetchMultiBranchCommits, simpleGithub } = await import('@/lib/github/clientSimple');
                if (githubToken) simpleGithub.setToken(githubToken);

                const result = await fetchMultiBranchCommits(
                    simpleGithub,
                    owner,
                    repoName,
                    rawBranches,
                    20,
                    50,
                );

                if (!cancelled) {
                    // Convert to Map<string, CommitData[]>
                    const commitMap = new Map<string, CommitData[]>();
                    for (const [branch, commits] of result) {
                        commitMap.set(branch, commits.map(c => ({
                            sha: c.sha,
                            message: c.message,
                            author: c.author,
                            committer: c.committer,
                            parents: c.parents,
                        })));
                    }
                    setBranchCommits(commitMap);
                }
            } catch (err) {
                console.warn('Failed to fetch multi-branch data:', err);
                // Fall back to building from rawCommits
                if (!cancelled && rawCommits?.length) {
                    const defaultBranch = rawBranches.find(b => b.isDefault)?.name || 'main';
                    const fallback = new Map<string, CommitData[]>();
                    fallback.set(defaultBranch, rawCommits);
                    setBranchCommits(fallback);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchBranchData();
        return () => { cancelled = true; };
    }, [rawBranches, rawCommits, owner, repoName, githubToken, branchCommits, setBranchCommits]);

    // Build the graph from branch commits
    const graphData: BranchGraphData = useMemo(() => {
        const map = branchCommits || new Map<string, CommitData[]>();

        // If no multi-branch data yet, use rawCommits on default branch
        if (map.size === 0 && rawCommits?.length) {
            const defaultBranch = (rawBranches || []).find((b: BranchData) => b.isDefault)?.name || 'main';
            map.set(defaultBranch, rawCommits);
        }

        return buildBranchGraph(map, rawBranches || []);
    }, [branchCommits, rawCommits, rawBranches]);

    // Init selected branches to all
    useEffect(() => {
        if (selectedBranches.size === 0 && graphData.branches.length > 0) {
            setSelectedBranches(new Set(graphData.branches));
        }
    }, [graphData.branches, selectedBranches.size]);

    // Filter by selected branches + search
    const filteredGraphData = useMemo(() => {
        let filtered = graphData.nodes;

        // Filter by branch selection
        if (selectedBranches.size > 0 && selectedBranches.size < graphData.branches.length) {
            filtered = filtered.filter(n => selectedBranches.has(n.branch));
        }

        // Search filter
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(n =>
                n.message.toLowerCase().includes(q) ||
                n.author.toLowerCase().includes(q) ||
                n.sha.toLowerCase().includes(q) ||
                n.branch.toLowerCase().includes(q)
            );
        }

        return {
            ...graphData,
            nodes: filtered,
        };
    }, [graphData, selectedBranches, search]);

    const selectedNode = graphData.nodes.find(n => n.sha === selectedSha) || null;

    const toggleBranch = useCallback((branch: string) => {
        setSelectedBranches(prev => {
            const next = new Set(prev);
            if (next.has(branch)) {
                // Don't allow deselecting all
                if (next.size > 1) next.delete(branch);
            } else {
                next.add(branch);
            }
            return next;
        });
    }, []);

    const panels: { id: LensPanel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
        { id: 'graph', label: 'Graph', icon: GitBranch },
        { id: 'timeline', label: 'Timeline', icon: History },
        { id: 'blame', label: 'Blame', icon: Eye },
        { id: 'compare', label: 'Compare', icon: GitCompare },
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Lens Header */}
            <div className="h-12 border-b border-border bg-card/30 flex items-center px-4 gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold text-slate-200">Lens</span>
                    <Badge variant="outline" className="text-[9px] text-blue-400 border-blue-500/30">
                        {graphData.nodes.length} commits
                    </Badge>
                    <Badge variant="outline" className="text-[9px] text-purple-400 border-purple-500/30">
                        {graphData.branches.length} branches
                    </Badge>
                    {graphData.merges.length > 0 && (
                        <Badge variant="outline" className="text-[9px] text-green-400 border-green-500/30">
                            {graphData.merges.length} merges
                        </Badge>
                    )}
                </div>

                <Separator orientation="vertical" className="h-5 opacity-30" />

                {/* Panel tabs */}
                <div className="flex items-center gap-1">
                    {panels.map(p => (
                        <Button
                            key={p.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => setActivePanel(p.id)}
                            className={cn(
                                'h-7 px-2.5 text-xs gap-1.5',
                                activePanel === p.id
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : 'text-slate-400 hover:text-slate-200'
                            )}
                        >
                            {(() => { const PIcon = p.icon; return <PIcon className="w-3 h-3" />; })()}
                            {p.label}
                        </Button>
                    ))}
                </div>

                <Separator orientation="vertical" className="h-5 opacity-30" />

                {/* Branch filter */}
                <BranchFilter
                    branches={graphData.branches}
                    colorMap={graphData.colorMap}
                    selectedBranches={selectedBranches}
                    onToggle={toggleBranch}
                />

                <div className="ml-auto w-52">
                    <div className="relative">
                        <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-500" />
                        <Input
                            placeholder="Search commits..."
                            className="pl-7 h-7 bg-slate-900/50 border-slate-800 text-xs"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Loading overlay */}
            {loading && (
                <div className="h-8 bg-blue-500/5 border-b border-blue-500/10 flex items-center justify-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span className="text-[10px] text-blue-400">Loading multi-branch data...</span>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Graph + commit list */}
                <div className="flex-1 flex overflow-hidden border-r border-border">
                    {activePanel === 'graph' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Inline branch summary strip */}
                            <InlineBranchStrip
                                graphData={graphData}
                                branches={rawBranches || []}
                                selectedBranches={selectedBranches}
                                onToggle={toggleBranch}
                            />

                            {/* Graph + commit list */}
                            <div className="flex-1 flex overflow-hidden">
                                {/* Branch graph canvas */}
                                <ScrollArea className="shrink-0">
                                    <BranchGraphCanvas
                                        graphData={filteredGraphData}
                                        selectedSha={selectedSha}
                                        onSelectCommit={setSelectedSha}
                                    />
                                </ScrollArea>

                                {/* Commit list */}
                                <ScrollArea className="flex-1">
                                    <div className="divide-y divide-slate-800/50">
                                        {filteredGraphData.nodes.length > 0 ? filteredGraphData.nodes.map(node => (
                                            <CommitRow
                                                key={node.sha}
                                                node={node}
                                                isSelected={node.sha === selectedSha}
                                                onClick={() => setSelectedSha(node.sha)}
                                            />
                                        )) : (
                                            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-sm">
                                                <GitCommit className="w-8 h-8 mb-2 opacity-30" />
                                                <p>No commits found</p>
                                                {search && <p className="text-xs mt-1">Try a different search term</p>}
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    )}

                    {activePanel === 'timeline' && (
                        <TimelinePanel
                            nodes={filteredGraphData.nodes}
                            colorMap={graphData.colorMap}
                            laneCount={graphData.laneCount}
                            selectedSha={selectedSha}
                            onSelectCommit={setSelectedSha}
                        />
                    )}

                    {activePanel === 'blame' && (
                        <BlamePanel data={data} graphData={graphData} />
                    )}

                    {activePanel === 'compare' && (
                        <ComparePanel
                            graphData={graphData}
                            branches={rawBranches || []}
                            contributors={contributors || []}
                        />
                    )}
                </div>

                {/* Right: Commit details panel — only for graph/timeline */}
                {(activePanel === 'graph' || activePanel === 'timeline') && (
                    <div className="w-80 flex flex-col bg-card/20 shrink-0">
                        <div className="h-10 border-b border-border flex items-center px-3">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-blue-400">
                                Commit Details
                            </span>
                        </div>
                        <CommitDetails node={selectedNode} graphData={graphData} />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Blame Panel (IDE File Tree) ─────────────────────────────────────

interface TreeNode {
    name: string;
    path: string;
    isDir: boolean;
    children: TreeNode[];
    ext?: string;
    lines?: number;
    functions?: number;
}

function buildFileTree(data: AnalysisData): TreeNode {
    const root: TreeNode = { name: '/', path: '', isDir: true, children: [] };

    for (const file of data.files) {
        const fullPath = file.folder ? `${file.folder}/${file.name}` : file.name;
        const parts = fullPath.split('/').filter(Boolean);
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            let child = current.children.find(c => c.name === part);

            if (!child) {
                child = {
                    name: part,
                    path: parts.slice(0, i + 1).join('/'),
                    isDir: !isLast,
                    children: [],
                    ...(isLast ? {
                        ext: file.name.split('.').pop() || '',
                        lines: file.lines,
                        functions: (file.functions || []).length,
                    } : {}),
                };
                current.children.push(child);
            }
            current = child;
        }
    }

    // Sort: directories first, then alphabetical
    const sortTree = (node: TreeNode) => {
        node.children.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
    };
    sortTree(root);
    return root;
}

function FileTreeItem({
    node,
    depth,
    selectedFile,
    onSelect,
    expandedDirs,
    onToggleDir,
}: {
    node: TreeNode;
    depth: number;
    selectedFile: string | null;
    onSelect: (path: string) => void;
    expandedDirs: Set<string>;
    onToggleDir: (path: string) => void;
}) {
    const isExpanded = expandedDirs.has(node.path);
    const isSelected = node.path === selectedFile;

    if (node.isDir) {
        return (
            <>
                <button
                    onClick={() => onToggleDir(node.path)}
                    className={cn(
                        'w-full flex items-center gap-1.5 py-1 px-2 text-xs hover:bg-slate-800/50 transition-colors',
                    )}
                    style={{ paddingLeft: `${8 + depth * 14}px` }}
                >
                    {isExpanded ? (
                        <>
                            <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                            <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        </>
                    ) : (
                        <>
                            <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                            <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </>
                    )}
                    <span className="text-slate-300 truncate">{node.name}</span>
                    <span className="text-[9px] text-slate-600 ml-auto">{node.children.length}</span>
                </button>
                {isExpanded && node.children.map(child => (
                    <FileTreeItem
                        key={child.path}
                        node={child}
                        depth={depth + 1}
                        selectedFile={selectedFile}
                        onSelect={onSelect}
                        expandedDirs={expandedDirs}
                        onToggleDir={onToggleDir}
                    />
                ))}
            </>
        );
    }

    return (
        <button
            onClick={() => onSelect(node.path)}
            className={cn(
                'w-full flex items-center gap-1.5 py-1 px-2 text-xs transition-colors',
                isSelected
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300',
            )}
            style={{ paddingLeft: `${8 + depth * 14 + 16}px` }}
        >
            <File className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{node.name}</span>
            {node.lines !== undefined && (
                <span className="text-[9px] text-slate-600 ml-auto">{node.lines}L</span>
            )}
        </button>
    );
}

type BlameTab = 'code' | 'functions' | 'commits';

// Improved blame: score commits by relevance to a file path, not just message substring
function scoreCommitForFile(commitMsg: string, filePath: string): number {
    const msg = commitMsg.toLowerCase();
    const parts = filePath.toLowerCase().split('/').filter(Boolean);
    const fileName = parts[parts.length - 1] || '';
    const baseName = fileName.replace(/\.\w+$/, '');
    const ext = fileName.split('.').pop() || '';
    const folder = parts.length > 1 ? parts[parts.length - 2] : '';

    let score = 0;
    // Exact filename match
    if (msg.includes(fileName)) score += 10;
    // Base name (without extension)
    if (baseName.length > 2 && msg.includes(baseName)) score += 7;
    // Folder name match
    if (folder && folder.length > 2 && msg.includes(folder)) score += 4;
    // Extension-specific keywords
    if (ext === 'tsx' || ext === 'jsx') {
        if (msg.includes('component') || msg.includes('ui') || msg.includes('render')) score += 2;
    }
    if (ext === 'ts' || ext === 'js') {
        if (msg.includes('util') || msg.includes('lib') || msg.includes('helper')) score += 2;
    }
    // Common keywords
    if (msg.includes('fix') || msg.includes('bug') || msg.includes('update') || msg.includes('refactor')) score += 1;
    // Path segment matches
    for (const part of parts.slice(0, -1)) {
        if (part.length > 2 && msg.includes(part)) score += 2;
    }
    return score;
}

function BlamePanel({ data, graphData }: {
    data: AnalysisData | null;
    graphData: BranchGraphData;
}) {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [blameTab, setBlameTab] = useState<BlameTab>('code');
    const [showBlameGutter, setShowBlameGutter] = useState(true);
    const [diffMode, setDiffMode] = useState(false);
    const tree = useMemo(() => data ? buildFileTree(data) : null, [data]);

    const initialExpanded = useMemo(() => {
        if (!tree) return new Set<string>();
        const dirs = new Set<string>();
        const expand = (node: TreeNode, depth: number) => {
            if (node.isDir && depth < 2) {
                dirs.add(node.path);
                node.children.forEach(c => expand(c, depth + 1));
            }
        };
        expand(tree, 0);
        return dirs;
    }, [tree]);

    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

    const prevTreeRef = useRef(tree);
    if (prevTreeRef.current !== tree) {
        prevTreeRef.current = tree;
        if (initialExpanded.size > 0 && expandedDirs.size === 0) {
            setExpandedDirs(initialExpanded);
        }
    }

    const toggleDir = useCallback((path: string) => {
        setExpandedDirs(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }, []);

    const selectedFileData = useMemo(() => {
        if (!data || !selectedFile) return null;
        return data.files.find(f => {
            const full = f.folder ? `${f.folder}/${f.name}` : f.name;
            return full === selectedFile;
        }) || null;
    }, [data, selectedFile]);

    // Ranked commits for this file using scoring
    const fileCommits = useMemo(() => {
        if (!selectedFile) return [];
        return graphData.nodes
            .map(n => ({ node: n, score: scoreCommitForFile(n.message, selectedFile) }))
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 50)
            .map(c => c.node);
    }, [selectedFile, graphData.nodes]);

    // Contributor statistics per file
    const contributorStats = useMemo(() => {
        if (!fileCommits.length) return [];
        const counts = new Map<string, { name: string; commits: number; lastDate: string; avatar?: string }>();
        for (const c of fileCommits) {
            const prev = counts.get(c.author);
            if (prev) {
                prev.commits++;
                if (c.date > prev.lastDate) prev.lastDate = c.date;
            } else {
                counts.set(c.author, { name: c.author, commits: 1, lastDate: c.date, avatar: c.authorAvatar });
            }
        }
        return Array.from(counts.values()).sort((a, b) => b.commits - a.commits);
    }, [fileCommits]);

    // Build per-line blame with improved heuristic
    const blameLines = useMemo(() => {
        if (!selectedFileData?.content) return [];
        const lines = selectedFileData.content.split('\n');
        const functions = selectedFileData.functions || [];

        // Assign commits to function regions, with fallback by line grouping
        const functionRegions: { start: number; end: number; fn: typeof functions[0]; commitIdx: number }[] = [];
        for (const fn of functions) {
            if (fn.line === undefined) continue;
            const codeLines = fn.code ? fn.code.split('\n').length : 15;
            const end = fn.line + codeLines;
            // Pick commit based on function name hash for stability
            const commitIdx = fileCommits.length > 0
                ? Math.abs(hashCode(fn.name + fn.file)) % fileCommits.length
                : -1;
            functionRegions.push({ start: fn.line, end, fn, commitIdx });
        }

        return lines.map((text, idx) => {
            const lineNum = idx + 1;
            // Find enclosing function
            const region = functionRegions.find(r => lineNum >= r.start && lineNum <= r.end);
            const fn = region?.fn;
            // Pick commit: use region's assigned commit or group by 10-line blocks
            let commit = null;
            if (region && region.commitIdx >= 0) {
                commit = fileCommits[region.commitIdx];
            } else if (fileCommits.length > 0) {
                const blockIdx = Math.floor(lineNum / 10) % fileCommits.length;
                commit = fileCommits[blockIdx];
            }

            // Diff mode: mark lines inside functions with high complexity or dead code
            const isChanged = diffMode && (
                (fn?.isDead) ||
                (region && selectedFileData?.complexity && selectedFileData.complexity.score > 20) ||
                (commit && isRecentCommit(commit.date))
            );
            const diffType = diffMode
                ? fn?.isDead ? 'deleted' as const
                    : isChanged ? 'modified' as const
                    : null
                : null;

            return { lineNum, text, commit, fn, isChanged: !!isChanged, diffType };
        });
    }, [selectedFileData, fileCommits, diffMode]);

    if (!data) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                <div className="text-center">
                    <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No analysis data available</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* File tree */}
            <div className="w-64 border-r border-border flex flex-col shrink-0">
                <div className="h-8 border-b border-border flex items-center px-3 justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Explorer</span>
                    <Badge variant="outline" className="text-[8px] text-slate-600 border-slate-800">
                        {data.files.length} files
                    </Badge>
                </div>
                <ScrollArea className="flex-1">
                    {tree && tree.children.map(child => (
                        <FileTreeItem
                            key={child.path}
                            node={child}
                            depth={0}
                            selectedFile={selectedFile}
                            onSelect={setSelectedFile}
                            expandedDirs={expandedDirs}
                            onToggleDir={toggleDir}
                        />
                    ))}
                </ScrollArea>
            </div>

            {/* IDE editor / blame view */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {selectedFileData ? (
                    <>
                        {/* File tab bar */}
                        <div className="h-9 border-b border-border flex items-center px-2 gap-1 bg-slate-900/30 shrink-0">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded text-xs border border-slate-700/50">
                                <File className="w-3 h-3 text-blue-400" />
                                <span className="text-slate-300 font-mono text-[11px]">{selectedFile}</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1">
                                <button
                                    onClick={() => setShowBlameGutter(!showBlameGutter)}
                                    className={cn(
                                        'px-2 py-1 rounded text-[10px] transition-all',
                                        showBlameGutter
                                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                                            : 'text-slate-500 hover:text-slate-300'
                                    )}
                                >
                                    Blame
                                </button>
                                <button
                                    onClick={() => setDiffMode(!diffMode)}
                                    className={cn(
                                        'px-2 py-1 rounded text-[10px] transition-all',
                                        diffMode
                                            ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                                            : 'text-slate-500 hover:text-slate-300'
                                    )}
                                >
                                    Diff
                                </button>
                            </div>
                        </div>

                        {/* Contributor summary */}
                        {contributorStats.length > 0 && (
                            <div className="h-8 border-b border-border bg-slate-950/60 flex items-center px-3 gap-3 shrink-0 overflow-x-auto">
                                <span className="text-[9px] uppercase tracking-widest text-slate-600 shrink-0">Contributors</span>
                                <div className="flex items-center gap-2">
                                    {contributorStats.slice(0, 5).map(c => (
                                        <div key={c.name} className="flex items-center gap-1 text-[10px]">
                                            {c.avatar && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={c.avatar} alt="" className="w-3.5 h-3.5 rounded-full" />
                                            )}
                                            <span className="text-slate-400">{c.name}</span>
                                            <span className="text-slate-600">({c.commits})</span>
                                        </div>
                                    ))}
                                </div>
                                <Badge variant="outline" className="text-[8px] text-slate-600 border-slate-800 ml-auto shrink-0">
                                    {fileCommits.length} related commits
                                </Badge>
                            </div>
                        )}

                        {/* Sub-tabs */}
                        <div className="h-8 border-b border-border flex items-center px-3 gap-2 shrink-0 bg-slate-950/50">
                            {([
                                { id: 'code' as const, label: 'Code', icon: File },
                                { id: 'functions' as const, label: `Functions (${(selectedFileData.functions || []).length})`, icon: GitBranch },
                                { id: 'commits' as const, label: `Commits (${fileCommits.length})`, icon: GitCommit },
                            ]).map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setBlameTab(t.id)}
                                    className={cn(
                                        'flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all',
                                        blameTab === t.id
                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            : 'text-slate-500 hover:text-slate-300'
                                    )}
                                >
                                    {(() => { const TIcon = t.icon; return <TIcon className="w-2.5 h-2.5" />; })()}
                                    {t.label}
                                </button>
                            ))}
                            <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-600">
                                {diffMode && (
                                    <span className="text-green-400/60 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-500/60 rounded-full" /> modified
                                        <span className="w-1.5 h-1.5 bg-red-500/60 rounded-full ml-1" /> dead code
                                    </span>
                                )}
                                <span>{selectedFileData.lines || 0} lines</span>
                                <span>{selectedFileData.size || 0} bytes</span>
                                {selectedFileData.name.includes('.') && (
                                    <Badge variant="outline" className="text-[7px] text-slate-600 border-slate-800">
                                        {selectedFileData.name.split('.').pop()}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Content area */}
                        {blameTab === 'code' && (
                            <ScrollArea className="flex-1">
                                {selectedFileData.content ? (
                                    <div className="font-mono text-[11px] leading-5 min-w-max">
                                        {blameLines.map(line => (
                                            <div
                                                key={line.lineNum}
                                                className={cn(
                                                    'flex hover:bg-slate-800/30 group',
                                                    line.diffType === 'modified' && 'bg-green-500/5 border-l-2 border-green-500/30',
                                                    line.diffType === 'deleted' && 'bg-red-500/5 border-l-2 border-red-500/30',
                                                    !line.diffType && line.fn?.isDead && diffMode && 'bg-red-500/3',
                                                )}
                                            >
                                                {/* Diff gutter */}
                                                {diffMode && (
                                                    <div className="w-5 shrink-0 flex items-center justify-center text-[10px] border-r border-slate-800/30">
                                                        {line.diffType === 'modified' && <span className="text-green-400">~</span>}
                                                        {line.diffType === 'deleted' && <span className="text-red-400">-</span>}
                                                    </div>
                                                )}
                                                {/* Blame gutter */}
                                                {showBlameGutter && (
                                                    <div className="w-48 shrink-0 flex items-center gap-1 px-2 border-r border-slate-800/50 text-[9px] text-slate-600 overflow-hidden group-hover:text-slate-400 transition-colors">
                                                        {line.commit ? (
                                                            <>
                                                                <span className="truncate max-w-16 font-mono" style={{ color: line.commit.color }}>
                                                                    {line.commit.shortSha}
                                                                </span>
                                                                <span className="truncate max-w-14 text-slate-600">{line.commit.author}</span>
                                                                <span className="ml-auto shrink-0 text-slate-700">
                                                                    {getRelativeTime(new Date(line.commit.date))}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-800">—</span>
                                                        )}
                                                    </div>
                                                )}
                                                {/* Line number */}
                                                <div className="w-12 shrink-0 text-right pr-3 text-slate-700 select-none border-r border-slate-800/30">
                                                    {line.lineNum}
                                                </div>
                                                {/* Code */}
                                                <pre className="flex-1 px-4 whitespace-pre text-slate-300 overflow-hidden">
                                                    {line.text}
                                                </pre>
                                                {/* Function indicator */}
                                                {line.fn && line.lineNum === line.fn.line && (
                                                    <div className="shrink-0 px-2 flex items-center">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                'text-[7px] h-3.5',
                                                                line.fn.isDead
                                                                    ? 'text-red-400 border-red-500/30'
                                                                    : 'text-blue-400 border-blue-500/30'
                                                            )}
                                                        >
                                                            {line.fn.name}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
                                        <div className="text-center">
                                            <File className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p>File content not available</p>
                                            <p className="text-xs text-slate-600 mt-1">Content is loaded during analysis</p>
                                        </div>
                                    </div>
                                )}
                            </ScrollArea>
                        )}

                        {blameTab === 'functions' && (
                            <ScrollArea className="flex-1">
                                <div className="p-3 space-y-1">
                                    {(selectedFileData.functions || []).length > 0 ? selectedFileData.functions!.map((fn, i) => {
                                        // Find the commit most likely responsible for this function
                                        const fnCommit = fileCommits.length > 0
                                            ? fileCommits[Math.abs(hashCode(fn.name + fn.file)) % fileCommits.length]
                                            : null;
                                        return (
                                            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-900/40 rounded-lg border border-slate-800/30 text-xs group hover:border-blue-500/20 transition-all">
                                                <div className={cn(
                                                    'w-1.5 h-1.5 rounded-full shrink-0',
                                                    fn.isDead ? 'bg-red-400' : 'bg-blue-400'
                                                )} />
                                                <span className="text-blue-400 font-mono truncate">{fn.name}</span>
                                                <span className="text-slate-600 shrink-0 font-mono text-[10px]">:{fn.line}</span>
                                                {fn.params && fn.params.length > 0 && (
                                                    <span className="text-slate-600 text-[10px] truncate">
                                                        ({fn.params.join(', ')})
                                                    </span>
                                                )}
                                                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                                    {fnCommit && (
                                                        <span className="text-[9px] text-slate-600 truncate max-w-20" title={fnCommit.message}>
                                                            {fnCommit.author}
                                                        </span>
                                                    )}
                                                    {fn.totalCalls !== undefined && (
                                                        <Badge variant="outline" className="text-[8px] h-4 text-slate-500 border-slate-700">
                                                            {fn.totalCalls} calls
                                                        </Badge>
                                                    )}
                                                    {fn.isDead && (
                                                        <Badge variant="outline" className="text-[8px] h-4 text-red-400 border-red-500/30">
                                                            unused
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="flex items-center justify-center py-16 text-slate-500 text-xs">
                                            No functions found in this file
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        )}

                        {blameTab === 'commits' && (
                            <ScrollArea className="flex-1">
                                <div className="p-3 space-y-1">
                                    {fileCommits.length > 0 ? fileCommits.map(c => {
                                        const score = scoreCommitForFile(c.message, selectedFile || '');
                                        return (
                                            <div key={c.sha} className="flex items-center gap-2 px-3 py-2 bg-slate-900/40 rounded-lg border border-slate-800/30 hover:border-slate-700/50 transition-all">
                                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                                <code className="text-[9px] font-mono shrink-0" style={{ color: c.color }}>{c.shortSha}</code>
                                                <span className="text-xs text-slate-400 truncate flex-1">{c.message.split('\n')[0]}</span>
                                                <Badge variant="outline" className={cn(
                                                    'text-[7px] h-3.5 shrink-0',
                                                    score >= 8 ? 'text-green-400 border-green-500/30' :
                                                    score >= 4 ? 'text-yellow-400 border-yellow-500/30' :
                                                    'text-slate-500 border-slate-700'
                                                )}>
                                                    {score >= 8 ? 'high' : score >= 4 ? 'med' : 'low'}
                                                </Badge>
                                                <span className="text-[9px] text-slate-600 shrink-0">{c.author}</span>
                                                <span className="text-[9px] text-slate-700 shrink-0">{getRelativeTime(new Date(c.date))}</span>
                                            </div>
                                        );
                                    }) : (
                                        <div className="flex items-center justify-center py-16 text-slate-500 text-xs">
                                            <div className="text-center">
                                                <GitCommit className="w-6 h-6 mx-auto mb-2 opacity-30" />
                                                <p>No related commits found</p>
                                                <p className="text-[10px] text-slate-600 mt-1">Commits are matched by file path relevance</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                        <div className="text-center">
                            <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p>Select a file to view blame</p>
                            <p className="text-xs text-slate-600 mt-1">IDE code view with per-line blame &amp; diff annotations</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function hashCode(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}

function isRecentCommit(dateStr: string): boolean {
    const diff = Date.now() - new Date(dateStr).getTime();
    return diff < 7 * 24 * 3600 * 1000; // Last 7 days
}

// ─── Compare Panel ───────────────────────────────────────────────────

function ComparePanel({ graphData, branches, contributors }: {
    graphData: BranchGraphData;
    branches: BranchData[];
    contributors: ContributorData[];
}) {
    const [baseBranch, setBaseBranch] = useState('');
    const [headBranch, setHeadBranch] = useState('');
    const [comparison, setComparison] = useState<{
        aheadBy: number; behindBy: number; totalCommits: number;
        baseOnlyCommits: BranchGraphNode[];
        headOnlyCommits: BranchGraphNode[];
        baseAuthors: Map<string, number>;
        headAuthors: Map<string, number>;
    } | null>(null);
    const [comparing, setComparing] = useState(false);

    const defaultBranch = branches.find(b => b.isDefault)?.name || graphData.branches[0] || 'main';

    useEffect(() => {
        if (!baseBranch && graphData.branches.length > 0) {
            setBaseBranch(defaultBranch);
        }
        if (!headBranch && graphData.branches.length > 1) {
            setHeadBranch(graphData.branches.find(b => b !== defaultBranch) || '');
        }
    }, [graphData.branches, baseBranch, headBranch, defaultBranch]);

    const handleCompare = useCallback(async () => {
        if (!baseBranch || !headBranch || baseBranch === headBranch) return;
        setComparing(true);
        try {
            const baseCommits = new Set(
                graphData.nodes.filter(n => n.branch === baseBranch).map(n => n.sha)
            );
            const headCommits = new Set(
                graphData.nodes.filter(n => n.branch === headBranch).map(n => n.sha)
            );

            const headOnlyCommits = graphData.nodes.filter(n => n.branch === headBranch && !baseCommits.has(n.sha));
            const baseOnlyCommits = graphData.nodes.filter(n => n.branch === baseBranch && !headCommits.has(n.sha));

            // Count authors per side
            const baseAuthors = new Map<string, number>();
            baseOnlyCommits.forEach(n => baseAuthors.set(n.author, (baseAuthors.get(n.author) || 0) + 1));
            const headAuthors = new Map<string, number>();
            headOnlyCommits.forEach(n => headAuthors.set(n.author, (headAuthors.get(n.author) || 0) + 1));

            setComparison({
                aheadBy: headOnlyCommits.length,
                behindBy: baseOnlyCommits.length,
                totalCommits: headOnlyCommits.length + baseOnlyCommits.length,
                baseOnlyCommits: baseOnlyCommits.slice(0, 15),
                headOnlyCommits: headOnlyCommits.slice(0, 15),
                baseAuthors,
                headAuthors,
            });
        } finally {
            setComparing(false);
        }
    }, [baseBranch, headBranch, graphData.nodes]);

    return (
        <ScrollArea className="flex-1">
            <div className="p-6 max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-2 mb-4">
                    <GitCompare className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Compare Branches</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Base</label>
                        <select
                            value={baseBranch}
                            onChange={e => setBaseBranch(e.target.value)}
                            className="w-full h-8 text-xs bg-slate-900/80 border border-slate-800 rounded-md px-2 text-slate-200"
                        >
                            {graphData.branches.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">Head</label>
                        <select
                            value={headBranch}
                            onChange={e => setHeadBranch(e.target.value)}
                            className="w-full h-8 text-xs bg-slate-900/80 border border-slate-800 rounded-md px-2 text-slate-200"
                        >
                            {graphData.branches.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <Button
                    onClick={handleCompare}
                    disabled={comparing || !baseBranch || !headBranch || baseBranch === headBranch}
                    className="w-full h-9 text-xs"
                >
                    {comparing ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                        <GitCompare className="w-3 h-3 mr-1" />
                    )}
                    Compare
                </Button>

                {comparison && (
                    <div className="space-y-5">
                        {/* Summary stats */}
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800/50 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-400">
                                    <span style={{ color: graphData.colorMap[headBranch] }}>{headBranch}</span>
                                    {' vs '}
                                    <span style={{ color: graphData.colorMap[baseBranch] }}>{baseBranch}</span>
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center">
                                    <span className="text-lg font-bold text-green-400">{comparison.aheadBy}</span>
                                    <span className="text-[9px] text-slate-500 block">ahead</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-lg font-bold text-red-400">{comparison.behindBy}</span>
                                    <span className="text-[9px] text-slate-500 block">behind</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-lg font-bold text-slate-300">{comparison.totalCommits}</span>
                                    <span className="text-[9px] text-slate-500 block">total diff</span>
                                </div>
                            </div>
                        </div>

                        {/* Contributors diff */}
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800/50">
                            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
                                <Users className="w-3 h-3" /> Contributors
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[9px] text-slate-600 block mb-1" style={{ color: graphData.colorMap[baseBranch] }}>
                                        {baseBranch} only
                                    </span>
                                    {Array.from(comparison.baseAuthors.entries())
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([author, count]) => {
                                            const c = contributors.find(ct => ct.login === author || ct.name === author);
                                            return (
                                                <div key={author} className="flex items-center gap-1.5 py-0.5">
                                                    {c?.avatar_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={c.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                                                    ) : (
                                                        <User className="w-3 h-3 text-slate-600" />
                                                    )}
                                                    <span className="text-[10px] text-slate-400 truncate">{author}</span>
                                                    <Badge variant="outline" className="text-[8px] h-3.5 ml-auto">{count}</Badge>
                                                </div>
                                            );
                                        })}
                                    {comparison.baseAuthors.size === 0 && (
                                        <span className="text-[9px] text-slate-600">No unique commits</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-[9px] text-slate-600 block mb-1" style={{ color: graphData.colorMap[headBranch] }}>
                                        {headBranch} only
                                    </span>
                                    {Array.from(comparison.headAuthors.entries())
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([author, count]) => {
                                            const c = contributors.find(ct => ct.login === author || ct.name === author);
                                            return (
                                                <div key={author} className="flex items-center gap-1.5 py-0.5">
                                                    {c?.avatar_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={c.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                                                    ) : (
                                                        <User className="w-3 h-3 text-slate-600" />
                                                    )}
                                                    <span className="text-[10px] text-slate-400 truncate">{author}</span>
                                                    <Badge variant="outline" className="text-[8px] h-3.5 ml-auto">{count}</Badge>
                                                </div>
                                            );
                                        })}
                                    {comparison.headAuthors.size === 0 && (
                                        <span className="text-[9px] text-slate-600">No unique commits</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Commit diffs - head only */}
                        {comparison.headOnlyCommits.length > 0 && (
                            <div className="bg-slate-900/50 rounded-lg border border-slate-800/50">
                                <div className="px-3 py-2 border-b border-slate-800/50 flex items-center gap-2">
                                    <ArrowUpRight className="w-3 h-3 text-green-400" />
                                    <span className="text-[10px] uppercase tracking-wider text-green-400 font-bold">
                                        Ahead — {headBranch} only ({comparison.aheadBy})
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-800/30">
                                    {comparison.headOnlyCommits.map(n => (
                                        <div key={n.sha} className="flex items-center gap-2 px-3 py-2">
                                            <code className="text-[9px] font-mono text-slate-500 shrink-0">{n.shortSha}</code>
                                            <span className="text-xs text-slate-400 truncate flex-1">{n.message.split('\n')[0]}</span>
                                            <span className="text-[9px] text-slate-600 shrink-0">{n.author}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Commit diffs - base only */}
                        {comparison.baseOnlyCommits.length > 0 && (
                            <div className="bg-slate-900/50 rounded-lg border border-slate-800/50">
                                <div className="px-3 py-2 border-b border-slate-800/50 flex items-center gap-2">
                                    <ArrowDownRight className="w-3 h-3 text-red-400" />
                                    <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold">
                                        Behind — {baseBranch} only ({comparison.behindBy})
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-800/30">
                                    {comparison.baseOnlyCommits.map(n => (
                                        <div key={n.sha} className="flex items-center gap-2 px-3 py-2">
                                            <code className="text-[9px] font-mono text-slate-500 shrink-0">{n.shortSha}</code>
                                            <span className="text-xs text-slate-400 truncate flex-1">{n.message.split('\n')[0]}</span>
                                            <span className="text-[9px] text-slate-600 shrink-0">{n.author}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}

// ─── Timeline Panel (with inline branch graph lanes) ─────────────────

const TIMELINE_LANE_W = 20;
const TIMELINE_ROW_H = 56;

function TimelinePanel({ nodes, colorMap, laneCount, selectedSha, onSelectCommit }: {
    nodes: BranchGraphNode[];
    colorMap: Record<string, string>;
    laneCount: number;
    selectedSha: string | null;
    onSelectCommit: (sha: string) => void;
}) {
    // Build sha → global index map for parent line drawing
    const shaRowMap = useMemo(() => {
        const m = new Map<string, number>();
        nodes.forEach((n, i) => m.set(n.sha, i));
        return m;
    }, [nodes]);

    // SVG lane graph width
    const graphW = (laneCount + 1) * TIMELINE_LANE_W + 10;

    // Render SVG elements for one node at a given y-offset in the full timeline
    const renderNodeSvg = useCallback((node: BranchGraphNode, rowIdx: number) => {
        const x = 8 + node.lane * TIMELINE_LANE_W;
        const y = rowIdx * TIMELINE_ROW_H + TIMELINE_ROW_H / 2;
        const color = colorMap[node.branch] || '#6b7280';
        const isSelected = node.sha === selectedSha;
        const r = node.isMerge ? 5 : 4;

        const elements: React.ReactElement[] = [];

        // Parent connection lines
        node.parents.forEach((parentSha, pi) => {
            const parentRow = shaRowMap.get(parentSha);
            if (parentRow === undefined) return;
            const parentNode = nodes[parentRow];
            const px = 8 + parentNode.lane * TIMELINE_LANE_W;
            const py = parentRow * TIMELINE_ROW_H + TIMELINE_ROW_H / 2;

            if (node.lane === parentNode.lane) {
                elements.push(
                    <line key={`${node.sha}-p${pi}`} x1={x} y1={y} x2={px} y2={py}
                        stroke={color} strokeWidth={1.5} opacity={0.4} />
                );
            } else {
                const midY = (y + py) / 2;
                elements.push(
                    <path key={`${node.sha}-p${pi}`}
                        d={`M${x},${y} C${x},${midY} ${px},${midY} ${px},${py}`}
                        stroke={color} strokeWidth={1.5} fill="none" opacity={0.4} />
                );
            }
        });

        // Selection ring
        if (isSelected) {
            elements.push(
                <circle key={`${node.sha}-sel`} cx={x} cy={y} r={r + 3}
                    stroke={color} strokeWidth={1.5} fill="none" />
            );
        }

        // Commit dot
        if (node.isMerge) {
            elements.push(
                <polygon key={`${node.sha}-dot`}
                    points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
                    fill={color} />
            );
        } else if (node.isFork) {
            elements.push(
                <rect key={`${node.sha}-dot`} x={x - r} y={y - r}
                    width={r * 2} height={r * 2} fill={color} />
            );
        } else {
            elements.push(
                <circle key={`${node.sha}-dot`} cx={x} cy={y} r={r} fill={color} />
            );
        }

        return elements;
    }, [colorMap, selectedSha, shaRowMap, nodes]);

    const totalSvgHeight = nodes.length * TIMELINE_ROW_H;

    return (
        <div className="flex flex-1 overflow-hidden">
            {/* Mini branch graph SVG */}
            <ScrollArea className="shrink-0 border-r border-slate-800/50">
                <svg width={graphW} height={totalSvgHeight}
                    className="bg-slate-950/30">
                    {nodes.map((node, idx) => (
                        <g key={node.sha} onClick={() => onSelectCommit(node.sha)}
                            className="cursor-pointer">
                            {renderNodeSvg(node, idx)}
                        </g>
                    ))}
                </svg>
            </ScrollArea>

            {/* Timeline commit list */}
            <ScrollArea className="flex-1">
                <div className="divide-y divide-slate-800/30">
                    {nodes.length > 0 ? nodes.map((n, idx) => {
                        const isSelected = n.sha === selectedSha;
                        const color = colorMap[n.branch] || '#6b7280';
                        const firstLine = n.message.split('\n')[0];

                        // Show day header if first node of the day
                        const day = new Date(n.date).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        });
                        const prevDay = idx > 0
                            ? new Date(nodes[idx - 1].date).toLocaleDateString('en-US', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                            })
                            : null;
                        const showDayHeader = day !== prevDay;

                        return (
                            <div key={n.sha}>
                                {showDayHeader && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border-b border-slate-800/50">
                                        <Calendar className="w-3 h-3 text-blue-400" />
                                        <span className="text-[10px] font-semibold text-slate-400">{day}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => onSelectCommit(n.sha)}
                                    className={cn(
                                        'w-full flex items-center gap-3 px-3 text-left transition-all group',
                                        isSelected
                                            ? 'bg-blue-500/10 border-l-2'
                                            : 'hover:bg-slate-800/30 border-l-2 border-transparent',
                                    )}
                                    style={{
                                        height: `${TIMELINE_ROW_H}px`,
                                        borderLeftColor: isSelected ? color : undefined,
                                    }}
                                >
                                    {/* Branch lane dot */}
                                    <div className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: color }} />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            {n.isMerge && <GitMerge className="w-2.5 h-2.5 shrink-0" style={{ color }} />}
                                            {n.isFork && <GitFork className="w-2.5 h-2.5 shrink-0" style={{ color }} />}
                                            <p className="text-xs text-slate-300 truncate">{firstLine}</p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <code className="text-[9px] font-mono text-slate-500">{n.shortSha}</code>
                                            <span className="text-[9px] text-slate-600">{n.author}</span>
                                            <Badge variant="outline" className="text-[7px] h-3.5 px-1 border-opacity-30"
                                                style={{ borderColor: color, color }}>
                                                {n.branch}
                                            </Badge>
                                            <span className="text-[9px] text-slate-600">
                                                {new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        );
                    }) : (
                        <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
                            <div className="text-center">
                                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p>No commit history available</p>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

// ─── Utility ─────────────────────────────────────────────────────────

function getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}
