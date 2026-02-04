'use client';

import { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileJson, FileText } from 'lucide-react';
import { useAnalysisStore } from '@/components/context/analysis-context';

interface DownloadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const downloadBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

export function DownloadModal({ open, onOpenChange }: DownloadModalProps) {
    const { data } = useAnalysisStore();

    const csv = useMemo(() => {
        if (!data) return '';
        const header = 'source,target,fn,count\n';
        const rows = data.connections
            .map((c) => `${c.source},${c.target},${c.fn},${c.count}`)
            .join('\n');
        return header + rows;
    }, [data]);

    const handleJson = () => {
        if (!data) return;
        downloadBlob(JSON.stringify(data, null, 2), 'codescope-analysis.json', 'application/json');
    };

    const handleCsv = () => {
        if (!csv) return;
        downloadBlob(csv, 'codescope-connections.csv', 'text/csv');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Download Analysis</DialogTitle>
                    <DialogDescription>
                        Export your analysis in common formats.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4">
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24" onClick={handleJson} disabled={!data}>
                        <FileJson className="w-8 h-8 text-cyan-400" />
                        <span>JSON Data</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24" onClick={handleCsv} disabled={!csv}>
                        <FileText className="w-8 h-8 text-emerald-400" />
                        <span>Connections CSV</span>
                    </Button>
                </div>

                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button type="button" className="gap-2" onClick={handleJson} disabled={!data}>
                        <Download className="w-4 h-4" />
                        Download JSON
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
