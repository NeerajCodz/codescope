'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Github, Key, Zap, ChevronDown, ChevronUp } from 'lucide-react';

export function Hero() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [repoUrl, setRepoUrl] = useState('');
    const [token, setToken] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check if GitHub OAuth token is in URL
        const githubToken = searchParams.get('github_token');
        if (githubToken) {
            setToken(githubToken);
            setShowTokenInput(true);
            // Store in sessionStorage
            sessionStorage.setItem('github_token', githubToken);
            // Clean URL
            window.history.replaceState({}, '', '/');
        } else {
            // Load from sessionStorage
            const storedToken = sessionStorage.getItem('github_token');
            if (storedToken) {
                setToken(storedToken);
            }
        }
    }, [searchParams]);


    // handleGitHubLogin is now in Header component


    const handleLogout = () => {
        setToken('');
        sessionStorage.removeItem('github_token');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        setLoading(true);

        // Parse GitHub URL
        let cleanUrl = repoUrl.trim();
        if (cleanUrl.startsWith('http')) {
            cleanUrl = cleanUrl
                .replace(/^(https?:\/\/)?(www\.)?github\.com\//, '')
                .replace(/\/$/, '')
                .replace(/\.git$/, '');
        }

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
        <div className="relative">
            {/* Background gradient */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-transparent to-transparent opacity-50" />

            {/* Floating geometric shapes for ambient background */}
            <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '0s' }} />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-viz-purple/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />

            <div className="container mx-auto px-4 min-h-[calc(100vh-80px)] flex flex-col justify-center py-16 md:py-0">
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    {/* Badge */}
                    <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Badge
                            variant="outline"
                            className="px-4 py-2 text-sm border-primary/20 bg-primary/5 shadow-sm shadow-primary/10 backdrop-blur-sm"
                        >
                            <Sparkles className="w-4 h-4 mr-2 text-primary" />
                            Open Source Architecture Intelligence
                        </Badge>
                    </div>

                    {/* Title */}
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                        <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-600 bg-clip-text text-transparent pb-2 block">
                            CodeScope
                        </span>
                    </h1>

                    {/* Description */}
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        Visualize any GitHub repository&apos;s architecture in seconds.
                        See dependencies, blast radius, and code patterns.
                    </p>

                    {/* Form */}
                    <div className="max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="p-8 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-2xl space-y-4 hover:border-primary/20 transition-colors duration-500">
                                {/* Repository URL Input */}
                                <div className="space-y-2">
                                    <Label htmlFor="repo" className="text-sm font-medium flex items-center gap-2">
                                        <Github className="w-4 h-4 text-primary" />
                                        GitHub Repository URL
                                    </Label>
                                    <Input
                                        id="repo"
                                        type="text"
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

                                {/* Token Section - Collapsible */}
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowTokenInput(!showTokenInput)}
                                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showTokenInput ? (
                                            <ChevronUp className="w-4 h-4" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4" />
                                        )}
                                        <Key className="w-4 h-4" />
                                        GitHub Token (Optional - for higher rate limits)
                                    </button>

                                    {showTokenInput && (
                                        <div className="space-y-2 pt-2">
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
                                                    Get token
                                                </a>
                                            </p>
                                            {token && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleLogout}
                                                    className="text-xs"
                                                >
                                                    Clear Token
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={loading || !repoUrl}
                                    className="w-full h-12 text-base font-medium shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 transition-all duration-300 transform hover:scale-[1.02]"
                                >
                                    {loading ? (
                                        <>
                                            <span className="animate-spin mr-2">⏳</span> Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            🔍 Analyze Repository
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Privacy Note */}
                            <p className="text-xs text-muted-foreground text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                                🔒 Your code stays in your browser. Tokens stored locally only.
                            </p>
                        </form>
                    </div>

                    {/* Feature Badges */}
                    <div className="flex flex-wrap justify-center gap-4 pt-8 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-500">
                        <Badge variant="secondary" className="px-4 py-2 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                            <Zap className="w-4 h-4 mr-2 text-yellow-400" />
                            Zero Setup
                        </Badge>
                        <Badge variant="secondary" className="px-4 py-2 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                            <Github className="w-4 h-4 mr-2" />
                            Privacy-First
                        </Badge>
                        <Badge variant="secondary" className="px-4 py-2 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                            <Sparkles className="w-4 h-4 mr-2 text-cyan-400" />
                            Runs in Browser
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    );
}
