'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
    X, Maximize2, Minimize2, Download, Copy, Check,
    GitBranch, FileCode, Activity, Zap, Database,
    Layout, Network, Layers, ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react';
import ReactFlow, {
    Controls, Background, MiniMap,
    Node, Edge, Position, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider,
    MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import { getMermaidConfig, sanitizeMermaidCode, getFallbackMermaidDiagram } from '@/lib/analysis/mermaidGenerator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { ProcessNode } from '@/types';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────

interface ProcessFlowModalProps {
    process: ProcessNode;
    mermaidCode: string;
    open: boolean;
    onClose: () => void;
}

const PROCESS_TYPE_META: Record<string, { icon: typeof Activity; color: string; label: string }> = {
    'user-flow': { icon: Layout, color: '#3b82f6', label: 'User Flow' },
    'data-pipeline': { icon: Database, color: '#22c55e', label: 'Data Pipeline' },
    'backend-process': { icon: Zap, color: '#a855f7', label: 'Backend Process' },
    'api-handler': { icon: Network, color: '#ec4899', label: 'API Handler' },
    'ui-render': { icon: Layout, color: '#f97316', label: 'UI Render' },
    'utility-chain': { icon: Activity, color: '#eab308', label: 'Utility Chain' },
    'general': { icon: Network, color: '#6b7280', label: 'General' },
};

// ─── Dagre Layout Helper ─────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;

function layoutGraph(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB'): { nodes: Node[]; edges: Edge[] } {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, nodesep: 50, edgesep: 30, ranksep: 80 });

    nodes.forEach(node => {
        g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });
    edges.forEach(edge => {
        g.setEdge(edge.source, edge.target);
    });
    dagre.layout(g);

    const isHorizontal = direction === 'LR';
    const layoutNodes = nodes.map(node => {
        const pos = g.node(node.id);
        return {
            ...node,
            targetPosition: isHorizontal ? Position.Left : Position.Top,
            sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
            position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
        };
    });
    return { nodes: layoutNodes, edges };
}

// ─── Process → ReactFlow Conversion ─────────────────────────────────

function processToFlow(process: ProcessNode): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < process.trace.length; i++) {
        const nodeId = process.trace[i];
        if (seen.has(nodeId)) continue;
        seen.add(nodeId);

        const file = nodeId.includes('::') ? nodeId.split('::')[0] : nodeId;
        const fn = nodeId.includes('::') ? nodeId.split('::')[1] : nodeId.split('/').pop() || nodeId;
        const isEntry = nodeId === process.entryPoint;
        const isTerminal = process.terminal.includes(nodeId);

        const color = isEntry ? '#3b82f6' : isTerminal ? '#22c55e' : '#6b7280';
        const bg = isEntry ? 'rgba(59,130,246,0.1)' : isTerminal ? 'rgba(34,197,94,0.1)' : 'rgba(51,65,85,0.3)';
        const border = isEntry ? '1px solid rgba(59,130,246,0.4)' : isTerminal ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(71,85,105,0.4)';

        nodes.push({
            id: nodeId,
            data: {
                label: (
                    <div className="text-center px-2">
                        <div className="text-[11px] font-mono font-medium truncate" style={{ color }}>
                            {fn}()
                        </div>
                        <div className="text-[9px] text-slate-500 truncate mt-0.5">
                            {file.split('/').pop()}
                        </div>
                    </div>
                ),
            },
            position: { x: 0, y: 0 },
            style: {
                background: bg,
                border,
                borderRadius: '8px',
                width: NODE_WIDTH,
                padding: '8px 4px',
            },
        });
    }

    // Edges follow trace order
    for (let i = 0; i < process.trace.length - 1; i++) {
        const src = process.trace[i];
        const tgt = process.trace[i + 1];
        if (src === tgt) continue;
        const edgeId = `${src}->${tgt}`;
        if (edges.some(e => e.id === edgeId)) continue;

        edges.push({
            id: edgeId,
            source: src,
            target: tgt,
            animated: true,
            style: { stroke: '#475569', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 16, height: 16 },
        });
    }

    return layoutGraph(nodes, edges);
}

// ─── ReactFlow Diagram Component ─────────────────────────────────────

function FlowDiagramInner({ process, highlightedNodeId }: { process: ProcessNode; highlightedNodeId?: string }) {
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => processToFlow(process), [process]);
    const { fitView } = useReactFlow();

    // Apply highlight styling
    const styledNodes = useMemo(() => {
        if (!highlightedNodeId) return initialNodes;
        return initialNodes.map(node => {
            const isHighlighted = node.id === highlightedNodeId;
            return {
                ...node,
                style: {
                    ...node.style,
                    ...(isHighlighted
                        ? {
                            border: '2px solid #3b82f6',
                            boxShadow: '0 0 16px rgba(59,130,246,0.4)',
                            zIndex: 10,
                        }
                        : { opacity: highlightedNodeId ? 0.4 : 1 }),
                },
            };
        });
    }, [initialNodes, highlightedNodeId]);

    const [nodes, , onNodesChange] = useNodesState(styledNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);

    // Zoom to highlighted node when it changes
    useEffect(() => {
        if (!highlightedNodeId) return;
        const timeout = setTimeout(() => {
            fitView({ nodes: [{ id: highlightedNodeId }], duration: 400, padding: 0.5 });
        }, 50);
        return () => clearTimeout(timeout);
    }, [highlightedNodeId, fitView]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={3}
        >
            <Controls
                showInteractive={false}
                className="bg-slate-900! border-slate-700! shadow-lg! [&_button]:bg-slate-800! [&_button]:border-slate-700! [&_button]:text-slate-300! [&_button:hover]:bg-slate-700!"
            />
            <MiniMap
                nodeStrokeColor="#475569"
                nodeColor="#1e293b"
                maskColor="rgba(0,0,0,0.6)"
                className="bg-slate-900! border-slate-700!"
            />
            <Background color="#334155" gap={20} size={1} />
        </ReactFlow>
    );
}

function FlowDiagram({ process, highlightedNodeId }: { process: ProcessNode; highlightedNodeId?: string }) {
    return (
        <div className="w-full h-full min-h-100" style={{ height: '100%' }}>
            <ReactFlowProvider>
                <FlowDiagramInner process={process} highlightedNodeId={highlightedNodeId} />
            </ReactFlowProvider>
        </div>
    );
}

// ─── Mermaid Diagram Component ──────────────────────────────────────

function MermaidDiagram({ mermaidCode, processId }: { mermaidCode: string; processId: string }) {
    const [svg, setSvg] = useState('');
    const [error, setError] = useState<string | null>(null);

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
                const uid = `modal-${safeId}-${Date.now()}`;
                const { svg: rendered } = await mermaid.render(uid, sanitizeMermaidCode(mermaidCode));
                if (!cancelled) { setSvg(rendered); setError(null); }
            } catch (err) {
                try {
                    const mermaid = (await import('mermaid')).default;
                    const { svg: fallback } = await mermaid.render(`modal-fb-${safeId}-${Date.now()}`, getFallbackMermaidDiagram('Mermaid'));
                    if (!cancelled) { setSvg(fallback); setError(err instanceof Error ? err.message : 'Render failed'); }
                } catch {
                    if (!cancelled) setError('Mermaid render failed');
                }
            }
        }
        if (mermaidCode.trim()) render();
        return () => { cancelled = true; };
    }, [mermaidCode, safeId]);

    if (error && !svg) return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-red-400">
            <AlertCircle className="w-6 h-6" />
            <p className="text-xs">{error}</p>
        </div>
    );

    return svg ? (
        <div
            className="w-full h-full overflow-auto p-4 [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:mx-auto [&_svg]:block"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    ) : (
        <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
        </div>
    );
}

// ─── Detail Row ──────────────────────────────────────────────────────

function DetailRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
            <span className="text-xs font-medium" style={{ color: color || '#e2e8f0' }}>{value}</span>
        </div>
    );
}

// ─── Main Modal Component ────────────────────────────────────────────

export function ProcessFlowModal({ process, mermaidCode, open, onClose }: ProcessFlowModalProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'diagram' | 'trace' | 'code'>('trace');
    const [currentStep, setCurrentStep] = useState(0);
    const overlayRef = useRef<HTMLDivElement>(null);
    const traceListRef = useRef<HTMLDivElement>(null);

    const meta = PROCESS_TYPE_META[process.processType] || PROCESS_TYPE_META.general;
    const TypeIcon = meta.icon;

    // Close on Escape, arrow key navigation
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') setCurrentStep(s => Math.max(0, s - 1));
            if (e.key === 'ArrowRight') setCurrentStep(s => Math.min(process.trace.length - 1, s + 1));
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose, process.trace.length]);

    // Close on overlay click
    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    }, [onClose]);

    const handleCopyCode = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(mermaidCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard fail */ }
    }, [mermaidCode]);

    const handleDownloadSvg = useCallback(() => {
        const svgEl = activeTab === 'diagram'
            ? document.querySelector('[data-mermaid-modal] svg')
            : document.querySelector('.react-flow svg') || document.querySelector('.react-flow__renderer svg');
        if (!svgEl) return;
        const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${process.label.replace(/\s+/g, '_')}_flow.svg`;
        a.click();
        URL.revokeObjectURL(url);
    }, [process.label, activeTab]);
    useEffect(() => {
        if (!traceListRef.current) return;
        const el = traceListRef.current.querySelector(`[data-step="${currentStep}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [currentStep]);

    // Get the unique node ID for the current trace step (for highlighting in diagram)
    const highlightedNodeId = process.trace[currentStep] || undefined;

    if (!open) return null;

    // Build file trace with step numbers
    const traceSteps = process.trace.map((nodeId, idx) => {
        const file = nodeId.includes('::') ? nodeId.split('::')[0] : nodeId;
        const fn = nodeId.includes('::') ? nodeId.split('::')[1] : nodeId.split('/').pop() || nodeId;
        return { file, fn, nodeId, step: idx + 1 };
    });

    const uniqueFiles = [...new Set(process.traceFiles)];
    const uniqueFolders = [...new Set(uniqueFiles.map(f => {
        const parts = f.split('/');
        return parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
    }))];

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
            <div
                className={cn(
                    'bg-slate-950 border border-slate-800/50 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200',
                    isFullscreen ? 'fixed inset-2' : 'w-[90vw] max-w-5xl h-[85vh]'
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/50 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${meta.color}15` }}
                        >
                            <TypeIcon className="w-4 h-4" style={{ color: meta.color }} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold text-slate-200 truncate">
                                {process.label}
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                    variant="outline"
                                    className="text-[9px]"
                                    style={{ borderColor: `${meta.color}40`, color: meta.color }}
                                >
                                    {meta.label}
                                </Badge>
                                {process.isCrossFile && (
                                    <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">
                                        <Layers className="w-2.5 h-2.5 mr-1" />
                                        Cross-file
                                    </Badge>
                                )}
                                {process.isCrossFolder && (
                                    <Badge variant="outline" className="text-[9px] border-pink-500/30 text-pink-400">
                                        <GitBranch className="w-2.5 h-2.5 mr-1" />
                                        Cross-folder
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={handleDownloadSvg} className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300">
                            <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300">
                            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300">
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Body: diagram + sidebar */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Main content area */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Tabs */}
                        <div className="flex items-center gap-1 px-4 pt-3 shrink-0">
                            {(['trace', 'diagram', 'code'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        'px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors capitalize',
                                        activeTab === tab
                                            ? 'bg-blue-500/10 text-blue-400'
                                            : 'text-slate-500 hover:text-slate-300'
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <div className="flex-1 overflow-hidden relative">
                            {activeTab === 'trace' && (
                                <div className="flex h-full">
                                    {/* Diagram takes most of the space */}
                                    <div className="flex-1 relative" style={{ minHeight: 400 }}>
                                        <FlowDiagram process={process} highlightedNodeId={highlightedNodeId} />

                                        {/* Navigation arrows — bottom-left overlay */}
                                        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-lg px-2 py-1.5">
                                            <button
                                                onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                                                disabled={currentStep === 0}
                                                className={cn(
                                                    'p-1.5 rounded-md transition-colors',
                                                    currentStep === 0
                                                        ? 'text-slate-700 cursor-not-allowed'
                                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                                )}
                                                title="Previous step (←)"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <span className="text-[10px] font-mono text-slate-400 min-w-16 text-center">
                                                Step {currentStep + 1} / {traceSteps.length}
                                            </span>
                                            <button
                                                onClick={() => setCurrentStep(s => Math.min(traceSteps.length - 1, s + 1))}
                                                disabled={currentStep >= traceSteps.length - 1}
                                                className={cn(
                                                    'p-1.5 rounded-md transition-colors',
                                                    currentStep >= traceSteps.length - 1
                                                        ? 'text-slate-700 cursor-not-allowed'
                                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                                )}
                                                title="Next step (→)"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Trace list — right panel inside trace tab */}
                                    <div className="w-56 border-l border-slate-800/50 bg-slate-950/80 overflow-hidden flex flex-col shrink-0">
                                        <div className="px-3 py-2 border-b border-slate-800/50 shrink-0">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Execution Trace</span>
                                        </div>
                                        <div ref={traceListRef} className="flex-1 overflow-y-auto">
                                            <div className="p-2 space-y-0.5">
                                                {traceSteps.map((step, idx) => (
                                                    <button
                                                        key={`${step.nodeId}-${idx}`}
                                                        data-step={idx}
                                                        onClick={() => setCurrentStep(idx)}
                                                        className={cn(
                                                            'w-full flex items-center gap-2 py-1.5 px-2 rounded-md transition-all text-left',
                                                            idx === currentStep
                                                                ? 'bg-blue-500/15 border border-blue-500/30'
                                                                : 'hover:bg-slate-900/50 border border-transparent'
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            'w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold',
                                                            idx === currentStep
                                                                ? 'bg-blue-500 text-white'
                                                                : 'bg-slate-800 text-slate-500'
                                                        )}>
                                                            {step.step}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className={cn(
                                                                'text-[10px] font-mono truncate',
                                                                idx === currentStep ? 'text-blue-300' : 'text-slate-400'
                                                            )}>
                                                                {step.fn}()
                                                            </p>
                                                            <p className="text-[8px] text-slate-600 truncate">{step.file.split('/').pop()}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'diagram' && (
                                <div className="h-full bg-slate-950/50" data-mermaid-modal style={{ minHeight: 400 }}>
                                    <MermaidDiagram mermaidCode={mermaidCode} processId={process.id} />
                                </div>
                            )}

                            {activeTab === 'code' && (
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                            Mermaid Source
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleCopyCode}
                                            className="h-6 text-[10px] px-2 text-slate-500 hover:text-slate-300"
                                        >
                                            {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                            {copied ? 'Copied' : 'Copy'}
                                        </Button>
                                    </div>
                                    <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/50 rounded-lg p-4 overflow-auto whitespace-pre-wrap border border-slate-800/50">
                                        {mermaidCode}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right sidebar */}
                    <div className="w-64 border-l border-slate-800/50 shrink-0 overflow-auto bg-slate-950/50">
                        <div className="p-4 space-y-4">
                            {/* Process Info */}
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                    Process Info
                                </span>
                                <div className="space-y-0.5 border border-slate-800/30 rounded-lg p-3 bg-slate-900/20">
                                    <DetailRow label="Steps" value={process.stepCount} color="#3b82f6" />
                                    <DetailRow label="Files" value={uniqueFiles.length} color="#22c55e" />
                                    <DetailRow label="Folders" value={uniqueFolders.length} color="#a855f7" />
                                    <DetailRow label="Terminals" value={process.terminal.length} color="#f97316" />
                                    <DetailRow
                                        label="Scope"
                                        value={process.isCrossFolder ? 'Cross-folder' : process.isCrossFile ? 'Cross-file' : 'Single file'}
                                        color={process.isCrossFolder ? '#ec4899' : process.isCrossFile ? '#eab308' : '#6b7280'}
                                    />
                                </div>
                            </div>

                            {/* Files involved */}
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                    <FileCode className="w-3 h-3 inline mr-1" />
                                    Files ({uniqueFiles.length})
                                </span>
                                <div className="space-y-1">
                                    {uniqueFiles.map(f => (
                                        <div
                                            key={f}
                                            className="text-[10px] bg-slate-900/50 px-2.5 py-1.5 rounded border border-slate-800/30 text-slate-400 truncate"
                                            title={f}
                                        >
                                            {f.split('/').pop()}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Entry & Terminal */}
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                    Entry Point
                                </span>
                                <div className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2.5 py-1.5 rounded font-mono truncate">
                                    {process.entryPoint.includes('::')
                                        ? process.entryPoint.split('::')[1]
                                        : process.entryPoint.split('/').pop()}
                                </div>
                            </div>

                            {process.terminal.length > 0 && (
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                        Terminals ({process.terminal.length})
                                    </span>
                                    <div className="space-y-1">
                                        {process.terminal.slice(0, 8).map(t => (
                                            <div
                                                key={t}
                                                className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-300 px-2.5 py-1.5 rounded font-mono truncate"
                                            >
                                                {t.includes('::') ? t.split('::')[1] : t.split('/').pop()}
                                            </div>
                                        ))}
                                        {process.terminal.length > 8 && (
                                            <p className="text-[10px] text-slate-600 text-center">
                                                +{process.terminal.length - 8} more
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
