'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sparkles, Github, Key, Zap, ChevronDown, ChevronUp,
  Server, FileJson, Upload, Globe, Shield,
  ArrowRight, Loader2, Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnalysisStore } from '@/components/context/analysisContext';

type ImportTab = 'simple' | 'advanced' | 'codespace';

export function Hero() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setMode } = useAnalysisStore();

  const [activeTab, setActiveTab] = useState<ImportTab>('simple');
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const [repos, setRepos] = useState<Array<{ id: number; full_name: string; private: boolean }>>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState('');

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    // Check URL fragment first (OAuth redirects token via hash)
    const hash = window.location.hash;
    const hashToken = hash.startsWith('#github_token=') ? hash.slice('#github_token='.length) : null;
    // Also check query param for backwards compat
    const queryToken = searchParams.get('github_token');
    const githubToken = hashToken || queryToken;
    if (githubToken) {
      setToken(githubToken);
      setShowTokenInput(true);
      sessionStorage.setItem('github_token', githubToken);
      // Clean the token out of the URL
      window.history.replaceState({}, '', '/');
    } else {
      const stored = sessionStorage.getItem('github_token');
      if (stored) setToken(stored);
    }
  }, [searchParams]);

  useEffect(() => {
    const activeToken = token || sessionStorage.getItem('github_token') || '';
    if (!activeToken) { setRepos([]); setRepoError(null); return; }

    let alive = true;
    setReposLoading(true);
    setRepoError(null);

    fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all',
        token: activeToken,
      }),
    })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: Array<{ id: number; full_name: string; private: boolean }>) => { if (alive) setRepos(d || []); })
      .catch(() => { if (alive) setRepoError('Could not load repos.'); })
      .finally(() => { if (alive) setReposLoading(false); });

    return () => { alive = false; };
  }, [token]);

  const handleLogout = () => { setToken(''); sessionStorage.removeItem('github_token'); };

  const navigateToAnalysis = (repo: string, userToken: string, mode: 'simple' | 'advanced') => {
    setLoading(true);
    setMode(mode);
    // Store token in sessionStorage — NEVER put it in the URL
    if (userToken.trim()) sessionStorage.setItem('github_token', userToken.trim());
    const params = new URLSearchParams({ repo, mode });
    router.push(`/analysis?${params.toString()}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !repoUrl.trim()) return;

    let cleanUrl = repoUrl.trim();
    if (cleanUrl.startsWith('http')) {
      cleanUrl = cleanUrl.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/\/$/, '').replace(/\.git$/, '');
    }
    const match = cleanUrl.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (!match) { alert('Invalid GitHub URL. Use "owner/repo" or full URL.'); return; }

    navigateToAnalysis(`${match[1]}/${match[2]}`, token, activeTab === 'advanced' ? 'advanced' : 'simple');
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportError(null);
    setImportLoading(true);
    try {
      const text = await importFile.text();
      const parsed = JSON.parse(text);
      if (!parsed?.files || !parsed?.connections || !parsed?.stats) throw new Error();
      sessionStorage.setItem('analysis_import', JSON.stringify(parsed));
      router.push('/analysis?import=1');
    } catch {
      setImportError('Failed to import. Use a valid CodeScope export.');
    } finally {
      setImportLoading(false);
    }
  };

  const tabs: { id: ImportTab; label: string; icon: typeof Zap; color: string; desc: string }[] = [
    { id: 'simple', label: 'Simple', icon: Zap, color: 'emerald', desc: 'Client-side, zero server' },
    { id: 'advanced', label: 'Advanced', icon: Server, color: 'blue', desc: 'Server-powered, tarball' },
    { id: 'codespace', label: 'CodeSpace', icon: FileJson, color: 'purple', desc: 'Import JSON export' },
  ];

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-primary/5 via-transparent to-transparent opacity-50" />
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />

      <div className="container mx-auto px-4 min-h-[calc(100vh-80px)] flex flex-col justify-center py-16 md:py-0">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Badge variant="outline" className="px-4 py-2 text-sm border-primary/20 bg-primary/5 shadow-sm shadow-primary/10 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 mr-2 text-primary" />
              Open Source Architecture Intelligence
            </Badge>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            <span className="bg-linear-to-r from-cyan-400 via-blue-500 to-cyan-600 bg-clip-text text-transparent pb-2 block">
              CodeScope
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            Visualize any GitHub repository&apos;s architecture in seconds.
            See dependencies, blast radius, and code patterns.
          </p>

          {/* 3-Tab Import Card */}
          <div className="max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
            <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-2xl hover:border-primary/20 transition-colors duration-500 space-y-5">
              {/* Tab Selector */}
              <div className="flex rounded-lg border border-border/60 bg-background/50 p-1 gap-1">
                {tabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  const colorMap: Record<string, string> = {
                    emerald: isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : '',
                    blue: isActive ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : '',
                    purple: isActive ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : '',
                  };
                  return (
                    <button
                      key={tab.id} type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-md text-xs font-medium transition-all border',
                        isActive ? colorMap[tab.color] : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </div>
                      <span className="text-[9px] opacity-60 font-normal">{tab.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Simple ── */}
              {activeTab === 'simple' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[10px] text-emerald-300/80">
                        Fetches files via GitHub API. All parsing in your browser. No server needed.
                      </span>
                    </div>
                  </div>

                  {repos.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-2">
                        <Github className="w-3.5 h-3.5 text-primary" /> Your Repositories
                      </Label>
                      <select
                        value={selectedRepo}
                        onChange={e => { setSelectedRepo(e.target.value); if (e.target.value) setRepoUrl(e.target.value); }}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Choose a repository...</option>
                        {repos.map(r => <option key={r.id} value={r.full_name}>{r.full_name}{r.private ? ' (Private)' : ''}</option>)}
                      </select>
                      {reposLoading && <p className="text-[10px] text-muted-foreground">Loading...</p>}
                      {repoError && <p className="text-[10px] text-destructive">{repoError}</p>}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Repository URL
                    </Label>
                    <Input placeholder="https://github.com/facebook/react" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} className="h-11 text-sm" disabled={loading} />
                  </div>

                  <div className="space-y-2">
                    <button type="button" onClick={() => setShowTokenInput(!showTokenInput)} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                      {showTokenInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <Key className="w-3 h-3" /> GitHub Token (Optional)
                    </button>
                    {showTokenInput && (
                      <div className="space-y-1.5">
                        <Input type="password" placeholder="ghp_xxxxxxxxxxxx" value={token} onChange={e => setToken(e.target.value)} className="h-9 text-xs font-mono" />
                        <p className="text-[10px] text-muted-foreground">
                          For private repos &amp; higher limits.{' '}
                          <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get token</a>
                        </p>
                        {token && <Button type="button" variant="ghost" size="sm" onClick={handleLogout} className="text-[10px] h-6 px-2">Clear</Button>}
                      </div>
                    )}
                  </div>

                  <Button type="submit" size="lg" disabled={loading || !repoUrl} className="w-full h-11 text-sm font-medium shadow-lg shadow-emerald-500/20 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</> : <><Zap className="w-4 h-4 mr-2" /> Analyze (Client-Side)</>}
                  </Button>
                </form>
              )}

              {/* ── Advanced ── */}
              {activeTab === 'advanced' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
                    <div className="flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-[10px] text-blue-300/80">
                        Downloads repo as tarball via server. Supports large repos (10K+ files).
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[9px] text-blue-300/50"><Database className="w-3 h-3" /> PostgreSQL + pgvector</span>
                      <span className="flex items-center gap-1 text-[9px] text-blue-300/50"><Server className="w-3 h-3" /> API Routes</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Repository URL
                    </Label>
                    <Input placeholder="https://github.com/facebook/react" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} className="h-11 text-sm" disabled={loading} />
                  </div>

                  <div className="space-y-2">
                    <button type="button" onClick={() => setShowTokenInput(!showTokenInput)} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                      {showTokenInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <Shield className="w-3 h-3" /> GitHub Token (Optional)
                    </button>
                    {showTokenInput && <Input type="password" placeholder="ghp_xxxxxxxxxxxx" value={token} onChange={e => setToken(e.target.value)} className="h-9 text-xs font-mono" />}
                  </div>

                  <Button type="submit" size="lg" disabled={loading || !repoUrl} className="w-full h-11 text-sm font-medium shadow-lg shadow-blue-500/20 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Downloading...</> : <><Server className="w-4 h-4 mr-2" /> Analyze (Server-Powered)</>}
                  </Button>
                </form>
              )}

              {/* ── CodeSpace ── */}
              {activeTab === 'codespace' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5">
                    <div className="flex items-center gap-2">
                      <FileJson className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-[10px] text-purple-300/80">
                        Load a CodeScope export JSON. Instantly restores the full analysis.
                      </span>
                    </div>
                  </div>

                  <input id="hero-import-file" type="file" accept="application/json,.json" className="hidden" onChange={e => { if (e.target.files?.[0]) setImportFile(e.target.files[0]); }} />
                  <button
                    type="button"
                    onClick={() => document.getElementById('hero-import-file')?.click()}
                    className="w-full h-24 rounded-lg border-2 border-dashed border-border/60 hover:border-purple-500/40 bg-background/30 hover:bg-purple-500/5 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
                  >
                    <Upload className="w-5 h-5 text-muted-foreground group-hover:text-purple-400 transition-colors" />
                    <span className="text-xs text-muted-foreground group-hover:text-purple-300 transition-colors">
                      {importFile ? importFile.name : 'Click to select JSON file'}
                    </span>
                    {importFile && <span className="text-[10px] text-muted-foreground/50">{(importFile.size / 1024).toFixed(1)} KB</span>}
                  </button>
                  {importError && <p className="text-xs text-destructive bg-destructive/10 rounded p-2">{importError}</p>}

                  <Button type="button" size="lg" onClick={handleImport} disabled={!importFile || importLoading} className="w-full h-11 text-sm font-medium shadow-lg shadow-purple-500/20 bg-linear-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white border-0">
                    {importLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing...</> : <><ArrowRight className="w-4 h-4 mr-2" /> Import Analysis</>}
                  </Button>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              🔒 Your code stays in your browser. Tokens stored locally only.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-500">
            <Badge variant="secondary" className="px-4 py-2 bg-secondary/10 hover:bg-secondary/20 transition-colors">
              <Zap className="w-4 h-4 mr-2 text-yellow-400" /> Zero Setup
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 bg-secondary/10 hover:bg-secondary/20 transition-colors">
              <Github className="w-4 h-4 mr-2" /> Privacy-First
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 bg-secondary/10 hover:bg-secondary/20 transition-colors">
              <Sparkles className="w-4 h-4 mr-2 text-cyan-400" /> Runs in Browser
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
