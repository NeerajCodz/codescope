'use client';

import { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAnalysisStore } from '@/components/context/analysis-context';

interface DependenciesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DependenciesModal({ open, onOpenChange }: DependenciesModalProps) {
    const { data } = useAnalysisStore();

    const deps = useMemo(() => {
        if (!data) return [] as Array<{ name: string; count: number }>;
        const map = new Map<string, number>();
        data.files.forEach((file) => {
            const imports = file.rawImports || [];
            imports.forEach((imp) => {
                if (imp.startsWith('.') || imp.startsWith('/') || imp.startsWith('@/')) return;
                const name = imp.split('/')[0];
                map.set(name, (map.get(name) || 0) + 1);
            });
        });
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [data]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Dependencies</DialogTitle>
                    <DialogDescription>External modules detected from imports.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-105 pr-2">
                    <div className="space-y-2">
                        {deps.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No external dependencies detected.</p>
                        ) : (
                            deps.map((item) => (
                                <div key={item.name} className="flex items-center justify-between rounded-md border border-border/50 bg-card/60 px-3 py-2">
                                    <span className="text-xs text-foreground">{item.name}</span>
                                    <Badge variant="outline" className="text-[10px]">{item.count}</Badge>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
