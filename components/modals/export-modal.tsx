'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileJson, FileText, Image as ImageIcon, Code } from 'lucide-react';

interface ExportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ExportModal({ open, onOpenChange }: ExportModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle>Export Analysis</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Choose a format to export your repository analysis data.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24 border-slate-800 hover:bg-slate-800">
                        <FileJson className="w-8 h-8 text-blue-400" />
                        <span>JSON Data</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24 border-slate-800 hover:bg-slate-800">
                        <FileText className="w-8 h-8 text-green-400" />
                        <span>CSV Report</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24 border-slate-800 hover:bg-slate-800">
                        <ImageIcon className="w-8 h-8 text-purple-400" />
                        <span>PNG Image</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col items-center gap-2 h-24 border-slate-800 hover:bg-slate-800">
                        <Code className="w-8 h-8 text-orange-400" />
                        <span>SVG Vector</span>
                    </Button>
                </div>
                <DialogFooter className="sm:justify-start">
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
