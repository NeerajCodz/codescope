'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Github, LogOut, Sparkles } from 'lucide-react';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type GitHubUser = {
    login: string;
    avatar_url?: string;
};

export function Header() {
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
        <>
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/50 backdrop-blur-sm border-b border-border/40">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="p-1 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-xl font-bold bg-linear-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                        CodeScope
                    </span>
                </Link>

                {token && user ? (
                    <button
                        type="button"
                        onClick={() => setLogoutOpen(true)}
                        className="flex items-center gap-2 rounded-full border border-primary/20 px-3 py-1.5 text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                    >
                        {user.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt={user.login}
                                className="h-6 w-6 rounded-full"
                            />
                        ) : (
                            <Github className="w-4 h-4" />
                        )}
                        <span>{user.login}</span>
                    </button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGitHubLogin}
                        className="gap-2 rounded-full border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                    >
                        <Github className="w-4 h-4" />
                        Login with GitHub
                    </Button>
                )}
            </header>

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
        </>
    );
}
