'use client';

import React, { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FunctionDef } from '@/types';
import { Code } from 'lucide-react';

interface FunctionDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fn: FunctionDef | null;
}

export function FunctionDetailsModal({ open, onOpenChange, fn }: FunctionDetailsModalProps) {
    if (!fn) return null;

    const callers = useMemo(() => {
        const names = new Set<string>();
        fn.callSites?.forEach(cs => {
            if (cs.caller) names.add(cs.caller);
        });
        return Array.from(names);
    }, [fn]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Code className="w-5 h-5" />
                        {fn.name}({(fn.params || []).join(', ')})
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-125 pr-4">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-muted-foreground">File:</span>
                                <p className="text-foreground break-all">{fn.file}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Line:</span>
                                <p className="text-foreground">{fn.line}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Return:</span>
                                <p className="text-foreground">{fn.returnType || (fn.returnsValue ? 'value' : 'void')}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Total Calls:</span>
                                <p className="text-foreground">{fn.totalCalls || 0}</p>
                            </div>
                        </div>

                        {callers.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-primary">Used By</h3>
                                <div className="flex flex-wrap gap-2">
                                    {callers.map((caller, idx) => (
                                        <Badge key={idx} variant="outline" className="text-[10px]">
                                            {caller}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {fn.callSites && fn.callSites.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-primary">Call Sites</h3>
                                <div className="space-y-2">
                                    {fn.callSites.map((cs, idx) => (
                                        <div key={idx} className="bg-card/60 rounded p-3 border border-border/50">
                                            <p className="text-xs text-foreground">
                                                {cs.file || fn.file} · Line {cs.line}
                                            </p>
                                            {cs.caller && (
                                                <p className="text-[11px] text-muted-foreground mt-1">Caller: {cs.caller}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {fn.code && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-primary">Snippet</h3>
                                <pre className="bg-card/60 border border-border/50 rounded p-3 text-xs text-foreground overflow-x-auto">
                                    {fn.code}
                                </pre>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
