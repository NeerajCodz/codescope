'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GitPullRequest, AlertTriangle, ShieldAlert } from 'lucide-react';

interface PRModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PRModal({ open, onOpenChange }: PRModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <GitPullRequest className="w-5 h-5 text-blue-400" />
                        <DialogTitle>Pull Request Risk Analysis</DialogTitle>
                    </div>
                    <DialogDescription className="text-muted-foreground">
                        Deep impact analysis for incoming changes.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                            <p className="text-xs text-red-400 font-medium uppercase mb-1">Risk Score</p>
                            <p className="text-3xl font-bold text-red-500">82/100</p>
                        </div>
                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                            <p className="text-xs text-blue-400 font-medium uppercase mb-1">Blast Radius</p>
                            <p className="text-3xl font-bold text-blue-500">14%</p>
                        </div>
                        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                            <p className="text-xs text-orange-400 font-medium uppercase mb-1">Affected Fns</p>
                            <p className="text-3xl font-bold text-orange-500">12</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-foreground/80">Risk Factors</h4>
                        <div className="space-y-2">
                            <div className="flex items-start gap-3 p-3 rounded bg-card/60 border border-border/50 text-sm">
                                <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5" />
                                <div>
                                    <p className="font-medium">Circular Dependency Introduced</p>
                                    <p className="text-muted-foreground text-xs">`auth-service.ts` now depends on `user-session.ts` transitively.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 rounded bg-card/60 border border-border/50 text-sm">
                                <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5" />
                                <div>
                                    <p className="font-medium">High Complexity Change</p>
                                    <p className="text-muted-foreground text-xs">`processPayment` complexity increased by 14 points.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        View Detailed Diff
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
