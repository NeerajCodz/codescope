'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileCode, Activity, Share2, Layers, AlertCircle, Zap } from 'lucide-react';
import { FileNode } from '@/types';

interface DrillDownModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file: FileNode | null;
}

export function DrillDownModal({ open, onOpenChange, file }: DrillDownModalProps) {
    if (!file) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <FileCode className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl">{file.name}</DialogTitle>
                                <DialogDescription className="text-muted-foreground font-mono text-xs truncate max-w-md">
                                    {file.path}
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className={`
                            ${file.complexity?.level === 'high' ? 'border-red-500 text-red-400' :
                                file.complexity?.level === 'medium' ? 'border-orange-500 text-orange-400' :
                                    'border-green-500 text-green-400'}
                        `}>
                            {file.complexity?.level || "low"} complexity
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-4 gap-4 py-6">
                    <div className="p-3 rounded-lg bg-card/60 border border-border/50">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Functions</p>
                        <p className="text-xl font-bold">{file.functions?.length || 0}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/60 border border-border/50">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Complexity</p>
                        <p className="text-xl font-bold">{file.complexity?.score || 0}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/60 border border-border/50">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Impact</p>
                        <p className="text-xl font-bold">Low</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card/60 border border-border/50">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Layer</p>
                        <p className="text-xl font-bold">{file.layer || 'N/A'}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        Internal Methods
                    </h4>
                    <ScrollArea className="flex-1 rounded-lg border border-border/50 bg-muted/20 p-4">
                        <div className="space-y-4">
                            {file.functions?.map((fn, i) => (
                                <div key={i} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                                    <div className="space-y-1">
                                        <p className="text-sm font-mono text-primary">{fn.name}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                            <span>Line {fn.line}</span>
                                            <span>•</span>
                                            <span className="capitalize">{fn.type}</span>
                                            {fn.isExported && <Badge className="h-4 px-1 text-[8px] bg-green-500/20 text-green-400 border-0">Exported</Badge>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-[10px] text-muted-foreground">Blast</p>
                                            <p className="text-xs font-bold font-mono">2%</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
