'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface ImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (file: File) => void;
    loading?: boolean;
    error?: string | null;
}

export function ImportModal({ open, onOpenChange, onImport, loading, error }: ImportModalProps) {
    const [localFile, setLocalFile] = useState<File | null>(null);

    const handlePick = (file?: File) => {
        if (!file) return;
        setLocalFile(file);
    };

    const handleImport = () => {
        if (localFile) onImport(localFile);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Analysis JSON</DialogTitle>
                    <DialogDescription>
                        Load a CodeScope export and recreate the exact analysis results.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <input
                        id="analysis-import-modal"
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={(e) => handlePick(e.target.files?.[0])}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-12 gap-2"
                        onClick={() => document.getElementById('analysis-import-modal')?.click()}
                    >
                        <Upload className="h-4 w-4" />
                        {localFile ? localFile.name : 'Choose JSON file'}
                    </Button>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleImport} disabled={!localFile || loading}>
                        {loading ? 'Importing…' : 'Import'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
