'use client';

import React from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Shield, Star } from 'lucide-react';

export function BranchesView() {
  const { branches, selectedBranch, setSelectedBranch } = useAnalysisStore();

  if (branches.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <GitBranch className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-medium text-muted-foreground">No Branches Loaded</h3>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground">{branches.length} branches</span>
        </div>

        {branches.sort((a, b) => {
          if (a.isDefault) return -1;
          if (b.isDefault) return 1;
          return a.name.localeCompare(b.name);
        }).map(branch => (
          <button
            key={branch.name}
            className={`w-full text-left bg-card border border-border rounded-lg p-3 hover:border-blue-500/30 transition-colors ${
              branch.name === selectedBranch ? 'border-blue-500/50 bg-blue-500/5' : ''
            }`}
            onClick={() => setSelectedBranch(branch.name)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium">{branch.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {branch.isDefault && (
                  <Badge variant="secondary" className="text-[9px] h-4 bg-green-500/10 text-green-400 border-green-500/20">
                    <Star className="w-2.5 h-2.5 mr-0.5" /> default
                  </Badge>
                )}
                {branch.isProtected && (
                  <Badge variant="secondary" className="text-[9px] h-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                    <Shield className="w-2.5 h-2.5 mr-0.5" /> protected
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground font-mono">
              {branch.sha.slice(0, 7)}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
