'use client';

import React from 'react';
import { GitBranch, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { cn } from '@/lib/utils';

export function BranchSelector() {
  const { branches, selectedBranch, setSelectedBranch, defaultBranch } = useAnalysisStore();
  const [open, setOpen] = React.useState(false);

  if (branches.length === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
        <GitBranch className="w-3 h-3" />
        <span>{defaultBranch || 'main'}</span>
      </div>
    );
  }

  return (
    <div className="relative ml-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="h-7 text-xs gap-1.5 px-2 bg-transparent border-border/50 hover:bg-muted/50"
      >
        <GitBranch className="w-3 h-3" />
        <span className="max-w-25 truncate">{selectedBranch || defaultBranch}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl min-w-50 max-h-75 overflow-y-auto">
            {branches.map(branch => (
              <button
                key={branch.name}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2 transition-colors',
                  (branch.name === selectedBranch) && 'bg-blue-500/10 text-blue-400'
                )}
                onClick={() => {
                  setSelectedBranch(branch.name);
                  setOpen(false);
                }}
              >
                <GitBranch className="w-3 h-3 shrink-0" />
                <span className="truncate">{branch.name}</span>
                {branch.isDefault && (
                  <span className="text-[9px] bg-green-500/20 text-green-400 px-1 rounded ml-auto">default</span>
                )}
                {branch.isProtected && (
                  <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1 rounded">protected</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
