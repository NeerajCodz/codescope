'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileCode, Trash2, AlertCircle } from 'lucide-react';
import { useAnalysisStore } from '@/components/context/analysis-context';

interface UnusedFunctionsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UnusedFunctionsModal({ open, onOpenChange }: UnusedFunctionsModalProps) {
    const { data } = useAnalysisStore();

    // Heuristic: top-level functions that weren't detected as called
    const unused = data?.files.flatMap(f =>
        (f.functions || []).filter((fn: any) => fn.isDead).map(fn => ({ ...fn, path: f.path }))
    ) || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Trash2 className="w-5 h-5 text-orange-400" />
                        <DialogTitle>Potential Dead Code</DialogTitle>
                    </div>
                    <DialogDescription className="text-muted-foreground">
                        Detected {unused.length} functions that appear to be unused in the analyzed files.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 mt-4 pr-4">
                    <div className="space-y-3">
                        {unused.length > 0 ? unused.map((fn, i) => (
                            <div key={i} className="p-3 rounded-lg border border-border/50 bg-card/60 hover:bg-card/80 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Code className="w-4 h-4 text-blue-400" />
                                        <span className="font-mono text-sm font-medium">{fn.name}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase border-orange-500/20 text-orange-400 bg-orange-500/5">
                                        Unused
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <FileCode className="w-3 h-3" />
                                    <span>{fn.path.split('/').pop()}</span>
                                    <span>•</span>
                                    <span>Line {fn.line}</span>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20 text-green-500" />
                                <p>No dead code detected in the analyzed subset.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

import { Code, CheckCircle } from 'lucide-react';
