'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ChevronLeft,
    Download,
    Share2,
    Activity,
    Github,
    Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { Badge } from '@/components/ui/badge';
import { PrivacyModal } from '@/components/modals/privacy-modal';
import { DownloadModal } from '@/components/modals/download/download-modal';
import { ShareModal } from '@/components/modals/download/share-modal';
import { CodeHealthModal } from '@/components/modals/code-health-modal';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { LogOut } from 'lucide-react';

type GitHubUser = {
    login: string;
    avatar_url?: string;
};

export function Header() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const repo = searchParams.get('repo') || '';
    const { data, loading } = useAnalysisStore();

    const [showDownload, setShowDownload] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showHealth, setShowHealth] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<GitHubUser | null>(null);
    const [logoutOpen, setLogoutOpen] = useState(false);

    useEffect(() => {
        const storedToken = sessionStorage.getItem('github_token');
        setToken(storedToken);
        if (storedToken) {
            fetch('https://api.github.com/user', {
                headers: {
                    Authorization: `Bearer ${storedToken}`,
                },
            })
                .then(async (res) => {
                    if (!res.ok) throw new Error('Failed to fetch user');
                    return res.json();
                })
                .then((data: GitHubUser) => setUser({ login: data.login, avatar_url: data.avatar_url }))
                .catch(() => {
                    sessionStorage.removeItem('github_token');
                    setToken(null);
                    setUser(null);
                });
        }
    }, []);

    const handleBack = () => {
        router.push('/');
    };

    const handleGitHubLogin = () => {
        const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
        if (!clientId) {
            alert('GitHub OAuth is not configured. Please add NEXT_PUBLIC_GITHUB_CLIENT_ID to .env.local');
            return;
        }
        const redirectUri = `${window.location.origin}/api/auth/github`;
        const scope = 'repo';
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    };

    const handleLogout = () => {
        sessionStorage.removeItem('github_token');
        setToken(null);
        setUser(null);
        setLogoutOpen(false);
    };

    return (
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-4 justify-between shrink-0 sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
                        CM
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                            {repo.split("/").pop() || "Repository Analysis"}
                            {data && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal bg-blue-500/10 text-blue-400 border-blue-500/20">
                                    {data.stats.files} files
                                </Badge>
                            )}
                        </h1>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 opacity-70">
                            <Github className="w-3 h-3" />
                            {repo}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-2 bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-300"
                    disabled={loading || !data}
                    onClick={() => setShowHealth(true)}
                >
                    <Activity className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Code Health</span>
                </Button>

                <div className="h-4 w-px bg-border mx-1" />

                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Download" onClick={() => setShowDownload(true)}>
                    <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Share" onClick={() => setShowShare(true)}>
                    <Share2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Privacy Settings" onClick={() => setShowPrivacy(true)}>
                    <Shield className="w-4 h-4" />
                </Button>
                {token && user ? (
                    <button
                        type="button"
                        onClick={() => setLogoutOpen(true)}
                        className="flex items-center gap-2 rounded-full border border-primary/20 px-2.5 py-1 text-xs text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                    >
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.login} className="h-5 w-5 rounded-full" />
                        ) : (
                            <Github className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{user.login}</span>
                    </button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGitHubLogin}
                        className="gap-2 rounded-full border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                    >
                        <Github className="w-4 h-4" />
                        <span className="hidden sm:inline">Login</span>
                    </Button>
                )}
            </div>

            <DownloadModal open={showDownload} onOpenChange={setShowDownload} />
            <ShareModal open={showShare} onOpenChange={setShowShare} />
            <CodeHealthModal open={showHealth} onOpenChange={setShowHealth} />
            <PrivacyModal open={showPrivacy} onOpenChange={setShowPrivacy} />
            <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log out</DialogTitle>
                        <DialogDescription>
                            You will be signed out and your token will be removed from this browser.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setLogoutOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleLogout} className="gap-2">
                            <LogOut className="h-4 w-4" />
                            Log out
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </header>
    );
}
