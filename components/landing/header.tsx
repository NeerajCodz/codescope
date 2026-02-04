'use client';

import { Button } from '@/components/ui/button';
import { Github, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function Header() {
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

    return (
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/50 backdrop-blur-sm border-b border-border/40">
            <Link href="/" className="flex items-center gap-2 group">
                <div className="p-1 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                    CodeScope
                </span>
            </Link>

            <Button
                variant="outline"
                size="sm"
                onClick={handleGitHubLogin}
                className="gap-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
            >
                <Github className="w-4 h-4" />
                Login with GitHub
            </Button>
        </header>
    );
}
