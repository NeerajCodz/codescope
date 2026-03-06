'use client';

import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { AI_MODELS, DEFAULT_MODELS, AIProvider } from '@/types/ai';
import { Settings, Zap, Check, AlertCircle, Github, X, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FetchMode } from '@/lib/analyzer';

const providers: { id: AIProvider; name: string; color: string; needsKey: boolean }[] = [
  { id: 'openai', name: 'OpenAI', color: 'text-green-400', needsKey: true },
  { id: 'anthropic', name: 'Anthropic', color: 'text-orange-400', needsKey: true },
  { id: 'gemini', name: 'Gemini', color: 'text-blue-400', needsKey: true },
  { id: 'groq', name: 'Groq', color: 'text-purple-400', needsKey: true },
  { id: 'deepseek', name: 'DeepSeek', color: 'text-cyan-400', needsKey: true },
  { id: 'mistral', name: 'Mistral', color: 'text-amber-400', needsKey: true },
  { id: 'openrouter', name: 'OpenRouter', color: 'text-rose-400', needsKey: true },
  { id: 'ollama', name: 'Ollama', color: 'text-emerald-400', needsKey: false },
];

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { aiSettings, setAISettings, fetchMode, setFetchMode, githubToken, setGithubToken } = useAnalysisStore();
  const [testStatus, setTestStatus] = React.useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [tokenInput, setTokenInput] = React.useState('');
  const [showTokenInput, setShowTokenInput] = React.useState(false);

  const currentProvider = providers.find(p => p.id === aiSettings.provider);

  const handleTestConnection = async () => {
    const needsKey = currentProvider?.needsKey !== false;
    if (needsKey && !aiSettings.apiKey) return;
    setTestStatus('testing');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey,
          model: aiSettings.model || DEFAULT_MODELS[aiSettings.provider],
          stream: false,
          baseUrl: aiSettings.baseUrl,
        }),
      });
      if (res.ok) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
      }
    } catch {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Provider</Label>
            <div className="grid grid-cols-4 gap-2">
              {providers.map(p => (
                <button
                  key={p.id}
                  onClick={() => setAISettings({ provider: p.id, model: DEFAULT_MODELS[p.id] })}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center',
                    aiSettings.provider === p.id
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                      : 'border-border hover:border-border/80 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className={p.color}>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Model</Label>
            <div className="flex flex-wrap gap-1.5">
              {AI_MODELS[aiSettings.provider].map(model => (
                <button
                  key={model}
                  onClick={() => setAISettings({ model })}
                  className={cn(
                    'px-2.5 py-1 rounded-md border text-[11px] transition-all',
                    (aiSettings.model || DEFAULT_MODELS[aiSettings.provider]) === model
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {model}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              {currentProvider?.needsKey === false ? 'Base URL (optional)' : 'API Key'}
            </Label>
            {currentProvider?.needsKey === false ? (
              <div className="space-y-1.5">
                <Input
                  type="text"
                  placeholder="http://localhost:11434 (default)"
                  value={aiSettings.baseUrl || ''}
                  onChange={e => setAISettings({ baseUrl: e.target.value || undefined })}
                  className="text-xs h-9 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Ollama runs locally — no API key needed. Override the URL if running on a different host/port.
                </p>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={`Enter your ${currentProvider?.name || ''} API key`}
                    value={aiSettings.apiKey}
                    onChange={e => setAISettings({ apiKey: e.target.value })}
                    className="text-xs h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={!aiSettings.apiKey || testStatus === 'testing'}
                    className="h-9 text-xs gap-1.5 shrink-0"
                  >
                    {testStatus === 'testing' ? (
                      <Zap className="w-3.5 h-3.5 animate-pulse" />
                    ) : testStatus === 'success' ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : testStatus === 'error' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    Test
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Keys are stored locally in your browser and sent directly to the provider. Never logged on our server.
                </p>
              </>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Badge variant="secondary" className="text-[10px]">
              {aiSettings.provider} / {aiSettings.model || DEFAULT_MODELS[aiSettings.provider]}
            </Badge>
            {aiSettings.apiKey || currentProvider?.needsKey === false ? (
              <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20">
                {currentProvider?.needsKey === false ? 'Local' : 'Key configured'}
              </Badge>
            ) : (
              <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">No key set</Badge>
            )}
          </div>

          {/* GitHub Section */}
          <div className="space-y-4 pt-4 border-t border-border">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">GitHub</Label>

            {/* Fetch Mode Toggle */}
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Fetch Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { mode: 'tarball' as FetchMode, label: 'Tarball', desc: 'Fast, single download', icon: Download },
                  { mode: 'filewise' as FetchMode, label: 'File-by-File', desc: 'Legacy, slower', icon: FileText },
                ]).map(({ mode, label, desc, icon: Icon }) => (
                  <button
                    key={mode}
                    onClick={() => setFetchMode(mode)}
                    className={cn(
                      'flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all',
                      fetchMode === mode
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-border hover:border-border/80'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon className={cn('w-3 h-3', fetchMode === mode ? 'text-blue-400' : 'text-muted-foreground')} />
                      <span className={cn('text-xs font-medium', fetchMode === mode ? 'text-blue-400' : 'text-foreground')}>
                        {label}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tarball downloads entire repo at once (recommended). File-by-File uses individual API calls.
              </p>
            </div>

            {/* GitHub Token */}
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Personal Access Token</Label>
              {githubToken ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Github className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    <span className="text-[11px] text-green-400 font-mono">
                      {githubToken.slice(0, 8)}••••••••{githubToken.slice(-4)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                    onClick={() => { setGithubToken(''); setShowTokenInput(false); }}
                    title="Clear token"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <Github className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span className="text-[11px] text-yellow-400">No token — 60 req/hr limit applies</span>
                </div>
              )}

              {showTokenInput ? (
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    className="text-xs h-8 font-mono"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={() => {
                      if (tokenInput.trim()) {
                        setGithubToken(tokenInput.trim());
                        setTokenInput('');
                        setShowTokenInput(false);
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => { setShowTokenInput(false); setTokenInput(''); }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 flex-1"
                    onClick={() => setShowTokenInput(true)}
                  >
                    {githubToken ? 'Update Token' : 'Add Token'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 flex-1"
                    onClick={() => {
                      const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
                      if (clientId) {
                        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,read:user`;
                      }
                    }}
                  >
                    <Github className="w-3.5 h-3.5" />
                    OAuth Login
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                Token stored locally in sessionStorage. Required for private repos and stats data.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
