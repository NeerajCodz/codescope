'use client';

import { useEffect, useState } from 'react';
import { Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RateLimitModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTokenSubmit: (token: string) => void;
}

export function RateLimitModal({ open, onOpenChange, onTokenSubmit }: RateLimitModalProps) {
    const [token, setToken] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onTokenSubmit(token);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        Rate Limit Exceeded
                    </DialogTitle>
                    <DialogDescription>
                        GitHub API rate limit exceeded (60 requests/hour for unauthenticated users).
                        <br />
                        Please enter a Personal Access Token to continue (5000 requests/hour).
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="token" className="text-right">
                            GitHub Token
                        </Label>
                        <div className="relative">
                            <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="token"
                                placeholder="ghp_xxxxxxxxxxxx"
                                className="pl-9"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                required
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tokens are only stored in memory for this session.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!token}>
                            Save & Retry
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
