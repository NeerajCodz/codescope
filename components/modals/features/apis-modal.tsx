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

interface APIsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function APIsModal({ open, onOpenChange }: APIsModalProps) {
    const { data } = useAnalysisStore();

    const endpoints = useMemo(() => {
        if (!data) return [] as Array<{ url: string; count: number }>;
        const map = new Map<string, number>();
        const regex = /(https?:\/\/[^\s'"`]+)|(\/api\/[\w\-/]+)/g;
        data.files.forEach((file) => {
            if (!file.content) return;
            const matches = file.content.match(regex) || [];
            matches.forEach((m) => {
                const key = m;
                map.set(key, (map.get(key) || 0) + 1);
            });
        });
        return Array.from(map.entries())
            .map(([url, count]) => ({ url, count }))
            .sort((a, b) => b.count - a.count);
    }, [data]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>External APIs</DialogTitle>
                    <DialogDescription>Endpoints detected across the codebase (beta).</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[420px] pr-2">
                    <div className="space-y-2">
                        {endpoints.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No endpoints detected.</p>
                        ) : (
                            endpoints.map((item) => (
                                <div key={item.url} className="flex items-center justify-between rounded-md border border-border/50 bg-card/60 px-3 py-2">
                                    <span className="text-xs text-foreground break-all max-w-95">{item.url}</span>
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
