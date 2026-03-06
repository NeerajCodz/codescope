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
import { Download, FileJson, FileText, Package, Upload } from 'lucide-react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { Exporter, importFullJSON } from '@/utils/export';
import { restoreFromExport } from '@/utils/cache';
import { useToast } from '@/components/ui/useToast';

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
    const store = useAnalysisStore();
    const { toast } = useToast();
    const [importing, setImporting] = useState(false);

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

    const handleFullExport = () => {
        Exporter.toFullJSON();
        toast({ title: 'Exported', description: 'Full project exported as JSON' });
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const result = await importFullJSON();
            if (result) {
                restoreFromExport(result, {
                    setData: store.setData,
                    setBranches: store.setBranches,
                    setCommits: store.setCommits,
                    setContributors: store.setContributors,
                    setPRs: store.setPRs,
                    setBranchCommits: store.setBranchCommits,
                    setProcesses: store.setProcesses,
                    setDiagrams: store.setDiagrams,
                    setViewMode: store.setViewMode,
                    setSelectedBranch: store.setSelectedBranch,
                });
                toast({ title: 'Imported', description: `Loaded ${result.repo} analysis` });
                onOpenChange(false);
            } else {
                toast({ variant: 'destructive', title: 'Import failed', description: 'Invalid or unrecognized JSON file' });
            }
        } finally {
            setImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Export / Import</DialogTitle>
                    <DialogDescription>
                        Export or import your complete analysis data.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 py-4">
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24" onClick={handleFullExport} disabled={!data}>
                        <Package className="w-8 h-8 text-blue-400" />
                        <span className="text-xs">Full Project JSON</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24" onClick={handleImport} disabled={importing}>
                        <Upload className="w-8 h-8 text-amber-400" />
                        <span className="text-xs">{importing ? 'Importing...' : 'Import JSON'}</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24" onClick={handleJson} disabled={!data}>
                        <FileJson className="w-8 h-8 text-cyan-400" />
                        <span className="text-xs">Analysis Only</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24" onClick={handleCsv} disabled={!csv}>
                        <FileText className="w-8 h-8 text-emerald-400" />
                        <span className="text-xs">Connections CSV</span>
                    </Button>
                </div>

                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button type="button" className="gap-2" onClick={handleFullExport} disabled={!data}>
                        <Download className="w-4 h-4" />
                        Export All
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
