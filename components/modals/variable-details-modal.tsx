'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VariableDef } from '@/types';
import { Code } from 'lucide-react';

interface VariableDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variable: VariableDef | null;
}

export function VariableDetailsModal({ open, onOpenChange, variable }: VariableDetailsModalProps) {
    if (!variable) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Code className="w-5 h-5" />
                        {variable.name}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-100 pr-4">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-muted-foreground">File:</span>
                                <p className="text-foreground break-all">{variable.file}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Line:</span>
                                <p className="text-foreground">{variable.line}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Kind:</span>
                                <p className="text-foreground">{variable.kind}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Type:</span>
                                <p className="text-foreground">{variable.valueType || 'unknown'}</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold mb-2 text-primary">Usage</h3>
                            <p className="text-sm text-muted-foreground">
                                Total uses: {variable.totalUsages || 0}
                            </p>
                            {variable.usageLines && variable.usageLines.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {variable.usageLines.map((line, idx) => (
                                        <span key={idx} className="text-[10px] px-2 py-1 rounded bg-card/60 border border-border/50 text-muted-foreground">
                                            Line {line}
                                        </span>
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
