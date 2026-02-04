'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Eye, EyeOff, Lock, Globe } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface PrivacyModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PrivacyModal({ open, onOpenChange }: PrivacyModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="w-5 h-5 text-green-400" />
                        <DialogTitle>Privacy Settings</DialogTitle>
                    </div>
                    <DialogDescription className="text-muted-foreground">
                        Control how your analysis data is handled.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-card/60 border border-border/50">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-medium">Local-Only Mode</Label>
                            <p className="text-xs text-muted-foreground">Analysis stays in your browser</p>
                        </div>
                        <Switch checked />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-card/60 border border-border/50">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-medium">Anonymize Data</Label>
                            <p className="text-xs text-muted-foreground">Strip filenames and comments</p>
                        </div>
                        <Switch />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-card/60 border border-border/50">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-medium">Auto-Delete</Label>
                            <p className="text-xs text-muted-foreground">Clear cache after session ends</p>
                        </div>
                        <Switch checked />
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="w-full">
                        Save Preferences
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
