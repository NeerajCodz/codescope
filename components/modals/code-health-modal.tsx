'use client';

import { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { HealthRing } from '@/components/analysis/health-ring';
import { StatsGrid } from '@/components/analysis/stats-grid';
import { useAnalysisStore } from '@/components/context/analysis-context';

interface CodeHealthModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CodeHealthModal({ open, onOpenChange }: CodeHealthModalProps) {
    const { data } = useAnalysisStore();

    const health = useMemo(() => {
        if (!data) return 0;
        const base = 100 - (data.stats.avgComplexity * 2);
        const securityPenalty = data.securityIssues.length * 5;
        return Math.max(5, Math.min(100, base - securityPenalty));
    }, [data]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Code Health</DialogTitle>
                    <DialogDescription>
                        Overall system health based on complexity, security findings, and repo scale.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 flex flex-col items-center gap-3 rounded-lg border border-border/50 bg-card/60 p-4">
                        <HealthRing score={health} size={120} strokeWidth={8} />
                        <Badge variant="outline" className="text-[10px] uppercase">
                            {health > 80 ? 'Robust' : health > 50 ? 'Stable' : 'Risk'}
                        </Badge>
                    </div>
                    <div className="col-span-2 rounded-lg border border-border/50 bg-card/60 p-4">
                        <StatsGrid stats={data?.stats} />
                        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                            <p>• Complexity lowers the score as files get harder to maintain.</p>
                            <p>• Security issues impose heavier penalties.</p>
                            <p>• Use patterns and refactors to raise health over time.</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
