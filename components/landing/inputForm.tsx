'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Key, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function InputForm() {
    const router = useRouter();
    const [repoUrl, setRepoUrl] = useState('');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!repoUrl.trim()) return;

        setLoading(true);

        // Extract owner/repo from URL
        // Supports:
        // - owner/repo
        // - github.com/owner/repo
        // - https://github.com/owner/repo
        const cleanUrl = repoUrl.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/\/$/, '');
        const match = cleanUrl.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);

        if (!match) {
            alert('Invalid GitHub URL. Use format "owner/repo" or "https://github.com/owner/repo"');
            setLoading(false);
            return;
        }

        const repo = `${match[1]}/${match[2]}`;
        const params = new URLSearchParams({ repo });
        if (token.trim()) params.set('token', token.trim());

        router.push(`/analysis?${params.toString()}`);
    };

    return (
        <div className="max-w-2xl mx-auto py-12">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4 p-8 rounded-2xl bg-card border border-border shadow-2xl">
                    <div className="space-y-2">
                        <Label htmlFor="repo" className="text-sm font-medium flex items-center gap-2">
                            <Github className="w-4 h-4 text-primary" />
                            GitHub Repository URL
                        </Label>
                        <Input
                            id="repo"
                            type="url"
                            placeholder="https://github.com/facebook/react"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            className="h-12 text-base"
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Enter any public GitHub repository URL
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="token" className="text-sm font-medium flex items-center gap-2">
                            <Key className="w-4 h-4 text-muted-foreground" />
                            GitHub Token (Optional)
                        </Label>
                        <Input
                            id="token"
                            type="password"
                            placeholder="ghp_xxxxxxxxxxxx"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="h-12 text-base font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                            For higher rate limits (5000/hr) and private repos.{' '}
                            <a
                                href="https://github.com/settings/tokens"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                Get token →
                            </a>
                        </p>
                    </div>

                    <Button
                        type="submit"
                        size="lg"
                        className="w-full h-12 text-base font-semibold gradient-primary"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                Analyze Repository
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>

                <div className="text-center text-xs text-muted-foreground">
                    <p>
                        🔒 Privacy-first: All analysis runs in your browser. Your code never leaves your
                        machine.
                    </p>
                </div>
            </form>
        </div>
    );
}
