'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, Download, Share2, Activity, Github,
  Shield, Settings, LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { Badge } from '@/components/ui/badge';
import { PrivacyModal } from '@/components/modals/privacy';
import { DownloadModal } from '@/components/modals/download/download';
import { ShareModal } from '@/components/modals/download/share';
import { CodeHealthModal } from '@/components/modals/codeHealth';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useGitHubUser } from '@/hooks/useGitHubUser';

interface AnalysisTopBarProps {
  onSettingsOpen: () => void;
}

export function AnalysisTopBar({ onSettingsOpen }: AnalysisTopBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repo = searchParams.get('repo') || '';
  const { data, loading, contributors } = useAnalysisStore();

  const [showDownload, setShowDownload] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const { token, user, logout } = useGitHubUser();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleBack = () => router.push('/');

  const handleGitHubLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId) {
      alert('GitHub OAuth not configured. Add NEXT_PUBLIC_GITHUB_CLIENT_ID to .env.local');
      return;
    }
    const redirectUri = `${window.location.origin}/api/auth/github`;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;
  };

  const handleLogout = () => {
    logout();
    setLogoutOpen(false);
  };

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-4 justify-between shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost" size="icon" onClick={handleBack}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="h-8 w-8 rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
          CS
        </div>

        <div className="flex flex-col">
          <h1 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
            {repo.split('/').pop() || 'Repository Analysis'}
            {data && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal bg-blue-500/10 text-blue-400 border-blue-500/20">
                {data.stats.files} files
              </Badge>
            )}
          </h1>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 opacity-70">
            <Github className="w-3 h-3" /> {repo}
          </span>
        </div>

        {/* Contributors strip */}
        {contributors.length > 0 && (
          <div className="hidden md:flex items-center gap-1 ml-2">
            <div className="flex -space-x-1.5">
              {contributors.slice(0, 5).map(c => (
                <Image
                  key={c.login}
                  src={c.avatar_url}
                  alt={c.login}
                  width={24}
                  height={24}
                  title={`${c.login} (${c.contributions} commits)`}
                  className="w-6 h-6 rounded-full border-2 border-background"
                />
              ))}
            </div>
            {contributors.length > 5 && (
              <span className="text-[10px] text-muted-foreground ml-1">+{contributors.length - 5}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline" size="sm"
          className="h-8 text-xs gap-1.5 bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-300"
          disabled={loading || !data}
          onClick={() => setShowHealth(true)}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Health</span>
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowDownload(true)} title="Download">
          <Download className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowShare(true)} title="Share">
          <Share2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowPrivacy(true)} title="Privacy">
          <Shield className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onSettingsOpen} title="Settings">
          <Settings className="w-4 h-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {token && user ? (
          <button
            type="button" onClick={() => setLogoutOpen(true)}
            className="flex items-center gap-2 rounded-full border border-primary/20 px-2.5 py-1 text-xs text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            {user.avatar_url ? (
              <Image src={user.avatar_url} alt={user.login} width={20} height={20} className="h-5 w-5 rounded-full" />
            ) : (
              <Github className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{user.login}</span>
          </button>
        ) : (
          <Button
            variant="outline" size="sm" onClick={handleGitHubLogin}
            className="gap-2 rounded-full border-primary/20 hover:border-primary/50 hover:bg-primary/5"
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
            <DialogDescription>You will be signed out and your token will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLogoutOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
