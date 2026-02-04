'use client';

import { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown } from 'lucide-react';
import { useAnalysisStore } from '@/components/context/analysis-context';

interface ConnectionDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourcePath?: string | null;
    targetPath?: string | null;
}

type FunctionConnectionSummary = {
    name: string;
    totalCalls: number;
    lines: number[];
};

export function ConnectionDetailsModal({
    open,
    onOpenChange,
    sourcePath,
    targetPath,
}: ConnectionDetailsModalProps) {
    const { data } = useAnalysisStore();
    const [openForward, setOpenForward] = useState<string | null>(null);
    const [openReverse, setOpenReverse] = useState<string | null>(null);

    const details = useMemo(() => {
        if (!data || !sourcePath || !targetPath) return null;
        const source = data.files.find((f) => f.path === sourcePath) || null;
        const target = data.files.find((f) => f.path === targetPath) || null;
        const forward = data.connections.filter((c) => c.source === sourcePath && c.target === targetPath);
        const reverse = data.connections.filter((c) => c.source === targetPath && c.target === sourcePath);

        const groupByFn = (connections: typeof forward): FunctionConnectionSummary[] => {
            const map = new Map<string, FunctionConnectionSummary>();
            connections.forEach((c) => {
                const existing = map.get(c.fn) || { name: c.fn, totalCalls: 0, lines: [] };
                existing.totalCalls += c.count || 0;
                if (c.lines && c.lines.length > 0) {
                    existing.lines.push(...c.lines);
                }
                map.set(c.fn, existing);
            });
            return Array.from(map.values())
                .map((entry) => ({
                    ...entry,
                    lines: Array.from(new Set(entry.lines)).sort((a, b) => a - b),
                }))
                .sort((a, b) => b.totalCalls - a.totalCalls);
        };

        return {
            source,
            target,
            forward: groupByFn(forward),
            reverse: groupByFn(reverse),
        };
    }, [data, sourcePath, targetPath]);

    if (!details || !details.source || !details.target) return null;
    const source = details.source;
    const target = details.target;

    const getSnippet = (filePath: string, lineNumber: number) => {
        const file = data?.files.find((f) => f.path === filePath);
        if (!file?.content) return null;
        const lines = file.content.split('\n');
        const idx = Math.max(0, Math.min(lines.length - 1, lineNumber - 1));
        const line = lines[idx] ?? '';
        return {
            lineNumber,
            line: line.trim() || line,
        };
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Connection Details</DialogTitle>
                    <DialogDescription>
                        {source.name} → {target.name}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[500px] pr-4">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                                <div className="text-xs text-muted-foreground">Source</div>
                                <div className="text-sm font-semibold text-foreground truncate">{source.name}</div>
                                <div className="text-[10px] text-muted-foreground break-all">{source.path}</div>
                            </div>
                            <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                                <div className="text-xs text-muted-foreground">Target</div>
                                <div className="text-sm font-semibold text-foreground truncate">{target.name}</div>
                                <div className="text-[10px] text-muted-foreground break-all">{target.path}</div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-cyan-400">Functions imported: Source → Target</h3>
                            {details.forward.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No direct calls found.</p>
                            ) : (
                                <div className="space-y-2">
                                    {details.forward.map((item) => (
                                        <div key={`forward-${item.name}`} className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => setOpenForward(openForward === item.name ? null : item.name)}
                                                className="flex w-full items-center justify-between text-left"
                                            >
                                                <span className="text-sm font-mono text-foreground">{item.name}()</span>
                                                <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    {item.totalCalls} call{item.totalCalls === 1 ? '' : 's'}
                                                    <ChevronDown className={openForward === item.name ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'} />
                                                </span>
                                            </button>
                                            {openForward === item.name && (
                                                <div className="mt-2 space-y-2">
                                                    {item.lines.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">No callsite lines recorded.</p>
                                                    ) : (
                                                        item.lines.slice(0, 12).map((lineNumber) => {
                                                            const snippet = getSnippet(target.path, lineNumber);
                                                            return (
                                                                <div key={`forward-${item.name}-${lineNumber}`} className="rounded-md border border-border/40 bg-card/40 p-2">
                                                                    <div className="text-[10px] text-muted-foreground">Line {lineNumber}</div>
                                                                    <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-background/50 p-2 font-mono text-[11px] text-foreground">
                                                                        {snippet?.line || 'Snippet unavailable'}
                                                                    </pre>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-cyan-400">Functions imported: Target → Source</h3>
                            {details.reverse.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No direct calls found.</p>
                            ) : (
                                <div className="space-y-2">
                                    {details.reverse.map((item) => (
                                        <div key={`reverse-${item.name}`} className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => setOpenReverse(openReverse === item.name ? null : item.name)}
                                                className="flex w-full items-center justify-between text-left"
                                            >
                                                <span className="text-sm font-mono text-foreground">{item.name}()</span>
                                                <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    {item.totalCalls} call{item.totalCalls === 1 ? '' : 's'}
                                                    <ChevronDown className={openReverse === item.name ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'} />
                                                </span>
                                            </button>
                                            {openReverse === item.name && (
                                                <div className="mt-2 space-y-2">
                                                    {item.lines.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">No callsite lines recorded.</p>
                                                    ) : (
                                                        item.lines.slice(0, 12).map((lineNumber) => {
                                                            const snippet = getSnippet(source.path, lineNumber);
                                                            return (
                                                                <div key={`reverse-${item.name}-${lineNumber}`} className="rounded-md border border-border/40 bg-card/40 p-2">
                                                                    <div className="text-[10px] text-muted-foreground">Line {lineNumber}</div>
                                                                    <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-background/50 p-2 font-mono text-[11px] text-foreground">
                                                                        {snippet?.line || 'Snippet unavailable'}
                                                                    </pre>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
