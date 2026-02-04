'use client';

import { useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Link2 } from 'lucide-react';
import { useAnalysisStore } from '@/components/context/analysis-context';

interface ShareModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ShareModal({ open, onOpenChange }: ShareModalProps) {
    const { data } = useAnalysisStore();
    const [copied, setCopied] = useState(false);

    const shareLink = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return window.location.href;
    }, [open]);

    const handleCopy = async () => {
        if (!shareLink) return;
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Share Analysis</DialogTitle>
                    <DialogDescription>
                        Share a link to this analysis view.
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        <span className="break-all whitespace-normal">{shareLink}</span>
                    </div>
                    {data && (
                        <div className="mt-2 text-[10px] text-muted-foreground">
                            {data.stats.files} files · {data.stats.functions} functions · {data.stats.connections} connections
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button type="button" className="gap-2" onClick={handleCopy}>
                        <Copy className="h-4 w-4" />
                        {copied ? 'Copied' : 'Copy link'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
