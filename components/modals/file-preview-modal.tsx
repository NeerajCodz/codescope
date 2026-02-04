'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileNode } from '@/types';
import { Code, Copy, Maximize2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FilePreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file: FileNode | null;
}

export function FilePreviewModal({ open, onOpenChange, file }: FilePreviewModalProps) {
    if (!file) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Code className="w-5 h-5 text-blue-400" />
                        <div>
                            <DialogTitle className="text-sm font-mono">{file.name}</DialogTitle>
                            <p className="text-[10px] text-muted-foreground truncate max-w-sm">{file.path}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <Download className="w-4 h-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 bg-muted/20">
                    <pre className="p-6 font-mono text-[13px] leading-relaxed overflow-x-auto text-foreground">
                        <code>{file.content || "// Content not available or still loading..."}</code>
                    </pre>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
