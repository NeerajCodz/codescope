'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Globe, Loader2, ArrowRight, Shield, Zap,
} from 'lucide-react';

interface SimpleImportProps {
  onSubmit: (repo: string, token: string) => void;
  loading?: boolean;
}

export function SimpleImport({ onSubmit, loading }: SimpleImportProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    onSubmit(repoUrl.trim(), token.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info banner */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-300">Client-Side Only</span>
          <Badge variant="outline" className="text-[9px] h-4 border-emerald-500/30 text-emerald-400">
            No Server
          </Badge>
        </div>
        <p className="text-[10px] text-emerald-300/70 leading-relaxed">
          Fetches files directly from GitHub API. All parsing happens in your browser.
          Best for small-medium repos (&lt;500 files). Your code never touches a server.
        </p>
      </div>

      {/* Repo URL */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          GitHub Repository URL
        </label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="https://github.com/owner/repo"
            className="pl-10 h-10 bg-background/50 border-border/60 text-sm"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* Token toggle */}
      <div className="space-y-2">
        <button
          type="button"
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          onClick={() => setShowToken(!showToken)}
        >
          <Shield className="w-3 h-3" />
          {showToken ? 'Hide token field' : 'Add GitHub token (optional, for private repos)'}
        </button>
        {showToken && (
          <Input
            type="password"
            placeholder="ghp_xxxxxxxxxxxx"
            className="h-9 bg-background/50 border-border/60 text-xs font-mono"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={loading}
          />
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={!repoUrl.trim() || loading}
        className="w-full h-10 text-sm gap-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Fetching files...
          </>
        ) : (
          <>
            Analyze (Client-Side)
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </form>
  );
}
