'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
    X, Maximize2, Minimize2, Download, Copy, Check,
    GitBranch, FileCode, ArrowRight, Activity, Zap, Database,
    Layout, Network, AlertCircle, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scrollArea';
import { ProcessNode } from '@/types';
import { getMermaidConfig } from '@/lib/analysis/mermaidGenerator';
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

// ─── Mermaid Renderer ────────────────────────────────────────────────

function ModalMermaid({ code, id }: { code: string; id: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Sanitize id for use as mermaid element ID
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

    useEffect(() => {
        let cancelled = false;
        async function render() {
            try {
                const mermaid = (await import('mermaid')).default;
                const config = getMermaidConfig('dark');
                mermaid.initialize(config);
                const uid = `modal-${safeId}-${Date.now()}`;
                const { svg: rendered } = await mermaid.render(uid, code);
                if (!cancelled) { setSvg(rendered); setError(null); }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Render failed');
            }
        }
        if (code.trim()) render();
        return () => { cancelled = true; };
    }, [code, safeId]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-sm text-red-300">Diagram render error</p>
                <p className="text-xs text-slate-500 max-w-md">{error}</p>
                <pre className="text-[10px] text-slate-600 mt-2 max-h-40 overflow-auto bg-slate-950 rounded p-3 w-full whitespace-pre-wrap">
                    {code}
                </pre>
            </div>
        );
    }

    return svg ? (
        <div
            ref={containerRef}
            className="p-6 overflow-auto [&_svg]:max-w-full [&_svg]:h-auto flex items-center justify-center min-h-75"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    ) : (
        <div className="flex items-center justify-center p-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
    const [activeTab, setActiveTab] = useState<'diagram' | 'trace' | 'code'>('diagram');
    const overlayRef = useRef<HTMLDivElement>(null);

    const meta = PROCESS_TYPE_META[process.processType] || PROCESS_TYPE_META.general;
    const TypeIcon = meta.icon;

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

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
        const svgEl = document.querySelector('[data-modal-diagram] svg');
        if (!svgEl) return;
        const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${process.label.replace(/\s+/g, '_')}_flow.svg`;
        a.click();
        URL.revokeObjectURL(url);
    }, [process.label]);

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
                            {(['diagram', 'trace', 'code'] as const).map(tab => (
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
                        <div className="flex-1 overflow-auto">
                            {activeTab === 'diagram' && (
                                <div data-modal-diagram>
                                    <ModalMermaid code={mermaidCode} id={process.id} />
                                </div>
                            )}

                            {activeTab === 'trace' && (
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-1">
                                        {traceSteps.map((step, idx) => (
                                            <div
                                                key={step.nodeId}
                                                className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-900/50 transition-colors"
                                            >
                                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                                    <span className="text-[9px] font-bold text-slate-400">{step.step}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-slate-200 truncate font-mono">
                                                        {step.fn}()
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 truncate">{step.file}</p>
                                                </div>
                                                {idx < traceSteps.length - 1 && (
                                                    <ArrowRight className="w-3 h-3 text-slate-700 shrink-0" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
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
