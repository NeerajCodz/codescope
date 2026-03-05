'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Network, Search, ChevronRight, ChevronDown, Activity, Zap, Database,
    Layout, AlertCircle, Layers, FolderTree, ArrowUpRight,
    BarChart3, Filter, Expand,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { ProcessNode } from '@/types';
import { detectProcesses, processToMermaid } from '@/lib/analysis/processDetector';
import { ProcessFlowModal } from '@/components/modals/processFlow';
import { getFallbackMermaidDiagram, getMermaidConfig, sanitizeMermaidCode } from '@/lib/analysis/mermaidGenerator';
import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────

const PROCESS_TYPE_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
    'user-flow': { icon: Layout, color: '#3b82f6' },
    'data-pipeline': { icon: Database, color: '#22c55e' },
    'backend-process': { icon: Zap, color: '#a855f7' },
    'api-handler': { icon: Network, color: '#ec4899' },
    'ui-render': { icon: Layout, color: '#f97316' },
    'utility-chain': { icon: Activity, color: '#eab308' },
    'general': { icon: Network, color: '#6b7280' },
};

// ─── Mermaid Inline Diagram ──────────────────────────────────────────

function ProcessDiagram({ mermaidCode, processId }: { mermaidCode: string; processId: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Sanitize processId for use as mermaid element ID (no slashes, colons, etc.)
    const safeId = useMemo(() =>
        processId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50),
        [processId]
    );

    useEffect(() => {
        let cancelled = false;
        async function render() {
            try {
                const mermaid = (await import('mermaid')).default;
                mermaid.initialize(getMermaidConfig('dark'));
                const uid = `proc-${safeId}-${Date.now()}`;
                const { svg: rendered } = await mermaid.render(uid, sanitizeMermaidCode(mermaidCode));
                if (!cancelled) { setSvg(rendered); setError(null); }
            } catch (err) {
                try {
                    const mermaid = (await import('mermaid')).default;
                    mermaid.initialize(getMermaidConfig('dark'));
                    const { svg: fallback } = await mermaid.render(`proc-fallback-${safeId}-${Date.now()}`, getFallbackMermaidDiagram('Process Mermaid Fallback'));
                    if (!cancelled) {
                        setSvg(fallback);
                        setError(err instanceof Error ? err.message : 'Render failed');
                    }
                } catch (fallbackErr) {
                    if (!cancelled) setError(fallbackErr instanceof Error ? fallbackErr.message : 'Render failed');
                }
            }
        }
        if (mermaidCode.trim()) render();
        return () => { cancelled = true; };
    }, [mermaidCode, safeId]);

    if (error) {
        return (
            <div className="p-4 text-center text-xs text-red-400">
                <AlertCircle className="w-5 h-5 mx-auto mb-1" />
                <p>{error}</p>
            </div>
        );
    }

    return svg ? (
        <div
            ref={containerRef}
            className="p-4 overflow-auto [&_svg]:max-w-full [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    ) : (
        <div className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

// ─── Stat Card ───────────────────────────────────────────────────────

function StatCard({ label, value, color, icon: Icon }: {
    label: string;
    value: number;
    color: string;
    icon: typeof Activity;
}) {
    return (
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/50">
            <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3" style={{ color }} />
                <span className="text-[10px] text-slate-500">{label}</span>
            </div>
            <span className="text-lg font-bold" style={{ color }}>{value}</span>
        </div>
    );
}

// ─── Process Card ────────────────────────────────────────────────────

function ProcessCard({ process, isExpanded, onToggle, mermaidCode, onOpenModal }: {
    process: ProcessNode;
    isExpanded: boolean;
    onToggle: () => void;
    mermaidCode: string;
    onOpenModal: (process: ProcessNode) => void;
}) {
    const typeInfo = PROCESS_TYPE_ICONS[process.processType] || PROCESS_TYPE_ICONS.general;
    const Icon = typeInfo.icon;

    return (
        <div className="border border-slate-800/50 rounded-lg overflow-hidden bg-slate-900/30">
            {/* Header */}
            <div
                role="button"
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/30 transition-colors cursor-pointer"
            >
                {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}

                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${typeInfo.color}15` }}
                >
                    <Icon className="w-3.5 h-3.5" style={{ color: typeInfo.color }} />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{process.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">{process.stepCount} steps</span>
                        <span className="text-[10px] text-slate-600">•</span>
                        <span className="text-[10px] text-slate-500">{process.traceFiles.length} files</span>
                        {process.isCrossFile && (
                            <>
                                <span className="text-[10px] text-slate-600">•</span>
                                <span className="text-[10px] text-amber-400/70">cross-file</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                        variant="outline"
                        className="text-[9px]"
                        style={{ borderColor: `${typeInfo.color}40`, color: typeInfo.color }}
                    >
                        {process.processType.replace(/-/g, ' ')}
                    </Badge>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-slate-600 hover:text-slate-300"
                        onClick={(e) => { e.stopPropagation(); onOpenModal(process); }}
                        title="Expand flow"
                    >
                        <Expand className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Expanded: diagram + trace */}
            {isExpanded && (
                <div className="border-t border-slate-800/50">
                    <ProcessDiagram mermaidCode={mermaidCode} processId={process.id} />

                    {/* File trace */}
                    <div className="px-4 pb-3 space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            File Trace
                        </span>
                        <div className="flex flex-wrap gap-1">
                            {process.traceFiles.map(f => (
                                <span key={f} className="text-[10px] bg-slate-800/50 px-2 py-0.5 rounded text-slate-400">
                                    {f.split('/').pop()}
                                </span>
                            ))}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onOpenModal(process); }}
                            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors mt-1"
                        >
                            <ArrowUpRight className="w-3 h-3" />
                            Open full-screen view
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Section Header ──────────────────────────────────────────────────

function SectionHeader({ title, count, icon: Icon, color, collapsed, onToggle }: {
    title: string;
    count: number;
    icon: typeof Layers;
    color: string;
    collapsed: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className="flex items-center gap-2 w-full py-2 group"
        >
            {collapsed
                ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            }
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <span className="text-xs font-semibold text-slate-300 group-hover:text-slate-100 transition-colors">
                {title}
            </span>
            <Badge
                variant="outline"
                className="text-[9px] ml-auto"
                style={{ borderColor: `${color}40`, color }}
            >
                {count}
            </Badge>
        </button>
    );
}

// ─── Main Processes View ─────────────────────────────────────────────

export function ProcessesView() {
    const { data, processes, setProcesses } = useAnalysisStore();
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<string | null>(null);
    const [scopeFilter, setScopeFilter] = useState<'all' | 'cross' | 'intra'>('all');
    const [crossCollapsed, setCrossCollapsed] = useState(false);
    const [intraCollapsed, setIntraCollapsed] = useState(false);
    const [statsCollapsed, setStatsCollapsed] = useState(false);
    const [modalProcess, setModalProcess] = useState<ProcessNode | null>(null);
    const [processMode, setProcessMode] = useState<'graph' | 'mermaid'>('graph');

    // Auto-detect processes from analysis data
    useEffect(() => {
        if (data && !processes) {
            try {
                const result = detectProcesses(data);
                setProcesses(result);
            } catch (err) {
                console.error('Process detection failed:', err);
            }
        }
    }, [data, processes, setProcesses]);

    // Filtered process list
    const filteredProcesses = useMemo(() => {
        if (!processes) return [];
        let list = processes.processes;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.label.toLowerCase().includes(q) ||
                p.processType.toLowerCase().includes(q) ||
                p.traceFiles.some(f => f.toLowerCase().includes(q))
            );
        }
        if (filterType) {
            list = list.filter(p => p.processType === filterType);
        }
        if (scopeFilter === 'cross') list = list.filter(p => p.isCrossFile);
        if (scopeFilter === 'intra') list = list.filter(p => !p.isCrossFile);
        return list;
    }, [processes, search, filterType, scopeFilter]);

    // Split into cross-file and intra-file
    const crossFileProcesses = useMemo(() => filteredProcesses.filter(p => p.isCrossFile), [filteredProcesses]);
    const intraFileProcesses = useMemo(() => filteredProcesses.filter(p => !p.isCrossFile), [filteredProcesses]);

    const processTypes = useMemo(() => {
        if (!processes) return [];
        const types = new Set(processes.processes.map(p => p.processType));
        return [...types];
    }, [processes]);

    const processGraphCode = useMemo(() => {
        if (!processes) return '';
        const lines: string[] = ['flowchart LR'];
        const typeNodes = new Set<string>();

        processes.processes.slice(0, 60).forEach((proc, index) => {
            const procId = `P${index}`;
            const typeId = `T_${proc.processType.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            const label = proc.label.replace(/[\[\]{}<>"\r\n]/g, ' ').trim() || 'process';
            const scope = proc.isCrossFile ? 'cross-file' : 'intra-file';
            lines.push(`    ${procId}["${label}"]`);
            lines.push(`    ${procId} --> ${typeId}`);
            lines.push(`    ${procId} -.-> ${scope === 'cross-file' ? 'CROSS' : 'INTRA'}`);
            if (!typeNodes.has(typeId)) {
                typeNodes.add(typeId);
                lines.push(`    ${typeId}["${proc.processType}"]`);
            }
        });

        lines.push('    CROSS["Cross-File"]');
        lines.push('    INTRA["Intra-File"]');

        return lines.join('\n');
    }, [processes]);

    const getMermaidCode = useCallback((process: ProcessNode): string => {
        if (!data) return '';
        try {
            return processToMermaid(process, data);
        } catch {
            return 'graph TD\n    A["Error generating diagram"]';
        }
    }, [data]);

    const handleOpenModal = useCallback((process: ProcessNode) => {
        setModalProcess(process);
    }, []);

    if (!data) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                    <Network className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No analysis data</p>
                    <p className="text-xs text-slate-600 mt-1">Analyze a repository first</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col h-full overflow-hidden">
                {/* Header with enhanced stats */}
                <div className="p-4 border-b border-border space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Network className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-semibold text-slate-200">Processes</span>
                            {processes && (
                                <Badge variant="outline" className="text-[9px] text-blue-400 border-blue-500/30">
                                    {processes.processes.length} detected
                                </Badge>
                            )}
                        </div>
                        <button
                            onClick={() => setStatsCollapsed(v => !v)}
                            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                            title={statsCollapsed ? 'Show stats' : 'Hide stats'}
                        >
                            {statsCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            Stats
                        </button>
                    </div>

                    {/* Stats row - 5 columns (collapsible) */}
                    {!statsCollapsed && processes && (
                        <div className="grid grid-cols-5 gap-2">
                            <StatCard label="Entry Points" value={processes.totalEntryPoints} color="#3b82f6" icon={ArrowUpRight} />
                            <StatCard label="Terminals" value={processes.totalTerminals} color="#22c55e" icon={Activity} />
                            <StatCard label="Avg Chain" value={processes.avgChainLength} color="#a855f7" icon={BarChart3} />
                            <StatCard label="Cross-File" value={processes.crossFileCount ?? 0} color="#eab308" icon={Layers} />
                            <StatCard label="Intra-File" value={processes.intraFileCount ?? 0} color="#6b7280" icon={FolderTree} />
                        </div>
                    )}

                    {/* Search + scope filter + type filter */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                                <Input
                                    placeholder="Search processes..."
                                    className="pl-8 h-8 bg-slate-900/50 border-slate-800 text-xs"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Scope filter */}
                            <div className="flex items-center gap-0.5 bg-slate-900/50 rounded-lg p-0.5 border border-slate-800/50">
                                {([
                                    { key: 'all' as const, label: 'All' },
                                    { key: 'cross' as const, label: 'Cross', icon: Layers },
                                    { key: 'intra' as const, label: 'Intra', icon: FolderTree },
                                ]).map(({ key, label, icon: SIcon }) => (
                                    <button
                                        key={key}
                                        onClick={() => setScopeFilter(key)}
                                        className={cn(
                                            'h-7 px-2 text-[10px] rounded-md flex items-center gap-1 transition-colors',
                                            scopeFilter === key
                                                ? 'bg-blue-500/10 text-blue-400'
                                                : 'text-slate-500 hover:text-slate-300'
                                        )}
                                    >
                                        {SIcon && <SIcon className="w-3 h-3" />}
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Type filter bar */}
                        <div className="flex items-center gap-1 flex-wrap">
                            <Filter className="w-3 h-3 text-slate-600 mr-1" />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilterType(null)}
                                className={cn(
                                    'h-6 text-[10px] px-2',
                                    !filterType ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500'
                                )}
                            >
                                All Types
                            </Button>
                            {processTypes.map(type => {
                                const info = PROCESS_TYPE_ICONS[type] || PROCESS_TYPE_ICONS.general;
                                return (
                                    <Button
                                        key={type}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setFilterType(type === filterType ? null : type)}
                                        className={cn(
                                            'h-6 text-[10px] px-2',
                                            filterType === type ? '' : 'text-slate-500'
                                        )}
                                        style={filterType === type ? { color: info.color, backgroundColor: `${info.color}15` } : {}}
                                    >
                                        {type.replace(/-/g, ' ')}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="px-4 pt-3 pb-0 shrink-0">
                    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-800/60 bg-slate-900/40 p-1">
                        <button
                            onClick={() => setProcessMode('graph')}
                            className={cn(
                                'h-7 px-2.5 text-[10px] rounded-md transition-colors',
                                processMode === 'graph' ? 'bg-blue-500/15 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                            )}
                        >
                            Graph
                        </button>
                        <button
                            onClick={() => setProcessMode('mermaid')}
                            className={cn(
                                'h-7 px-2.5 text-[10px] rounded-md transition-colors',
                                processMode === 'mermaid' ? 'bg-purple-500/15 text-purple-400' : 'text-slate-500 hover:text-slate-300'
                            )}
                        >
                            Mermaid
                        </button>
                    </div>
                </div>

                {/* Process list with sections */}
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                        {processMode === 'graph' && processGraphCode && (
                            <div className="border border-slate-800/50 rounded-lg overflow-hidden bg-slate-900/30">
                                <div className="px-4 py-2 border-b border-slate-800/50 text-[11px] text-slate-400">
                                    Process Graph Overview (type + cross/intra)
                                </div>
                                <ProcessDiagram mermaidCode={processGraphCode} processId="process-overview" />
                            </div>
                        )}

                        {/* Cross-File Processes Section */}
                        {processMode === 'mermaid' && crossFileProcesses.length > 0 && scopeFilter !== 'intra' && (
                            <div>
                                <SectionHeader
                                    title="Cross-File Processes"
                                    count={crossFileProcesses.length}
                                    icon={Layers}
                                    color="#eab308"
                                    collapsed={crossCollapsed}
                                    onToggle={() => setCrossCollapsed(!crossCollapsed)}
                                />
                                {!crossCollapsed && (
                                    <div className="space-y-2 mt-2 ml-5">
                                        {crossFileProcesses.map(process => (
                                            <ProcessCard
                                                key={process.id}
                                                process={process}
                                                isExpanded={expandedId === process.id}
                                                onToggle={() => setExpandedId(expandedId === process.id ? null : process.id)}
                                                mermaidCode={expandedId === process.id ? getMermaidCode(process) : ''}
                                                onOpenModal={handleOpenModal}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Intra-File Processes Section */}
                        {processMode === 'mermaid' && intraFileProcesses.length > 0 && scopeFilter !== 'cross' && (
                            <div>
                                <SectionHeader
                                    title="Intra-Module Processes"
                                    count={intraFileProcesses.length}
                                    icon={FolderTree}
                                    color="#6b7280"
                                    collapsed={intraCollapsed}
                                    onToggle={() => setIntraCollapsed(!intraCollapsed)}
                                />
                                {!intraCollapsed && (
                                    <div className="space-y-2 mt-2 ml-5">
                                        {intraFileProcesses.map(process => (
                                            <ProcessCard
                                                key={process.id}
                                                process={process}
                                                isExpanded={expandedId === process.id}
                                                onToggle={() => setExpandedId(expandedId === process.id ? null : process.id)}
                                                mermaidCode={expandedId === process.id ? getMermaidCode(process) : ''}
                                                onOpenModal={handleOpenModal}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Empty state */}
                        {processMode === 'mermaid' && filteredProcesses.length === 0 && processes && (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                <Network className="w-8 h-8 mb-2 opacity-30" />
                                <p className="text-sm">No processes match your filter</p>
                            </div>
                        )}

                        {/* Loading state */}
                        {!processes && (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                                <p className="text-sm text-slate-500">Detecting processes...</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Process Flow Modal */}
            {modalProcess && (
                <ProcessFlowModal
                    process={modalProcess}
                    mermaidCode={getMermaidCode(modalProcess)}
                    open={!!modalProcess}
                    onClose={() => setModalProcess(null)}
                />
            )}
        </>
    );
}
