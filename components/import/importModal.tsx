'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Zap, Server, FileJson, type LucideIcon } from 'lucide-react';
import { SimpleImport } from './tabs/simpleImport';
import { AdvancedImport } from './tabs/advancedImport';
import { CodespaceImport } from './tabs/codespaceImport';

type ImportTab = 'simple' | 'advanced' | 'codespace';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSimpleSubmit: (repo: string, token: string) => void;
  onAdvancedSubmit: (repo: string, token: string) => void;
  onFileImport: (file: File) => void;
  loading?: boolean;
  error?: string | null;
}

const tabDefs: { id: ImportTab; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'simple', label: 'Simple', icon: Zap, color: 'emerald' },
  { id: 'advanced', label: 'Advanced', icon: Server, color: 'blue' },
  { id: 'codespace', label: 'CodeSpace', icon: FileJson, color: 'purple' },
];

export function ImportModal({
  open,
  onOpenChange,
  onSimpleSubmit,
  onAdvancedSubmit,
  onFileImport,
  loading,
  error,
}: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('simple');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden border-border/60 bg-card">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-base">Import Repository</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose how to analyze your GitHub repository
          </DialogDescription>
        </DialogHeader>

        {/* Tab selector */}
        <div className="px-6 pb-3">
          <div className="flex rounded-lg border border-border/60 bg-background/50 p-1 gap-1">
            {tabDefs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              const colorMap: Record<string, string> = {
                emerald: isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : '',
                blue: isActive ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : '',
                purple: isActive ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : '',
              };
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all border',
                    isActive
                      ? colorMap[tab.color]
                      : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/30'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="px-6 pb-6">
          {activeTab === 'simple' && (
            <SimpleImport onSubmit={onSimpleSubmit} loading={loading} />
          )}
          {activeTab === 'advanced' && (
            <AdvancedImport onSubmit={onAdvancedSubmit} loading={loading} />
          )}
          {activeTab === 'codespace' && (
            <CodespaceImport onImport={onFileImport} loading={loading} error={error} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
