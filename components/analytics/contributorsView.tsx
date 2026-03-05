'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { Users, GitCommit, Trophy, TrendingUp } from 'lucide-react';
import { ContributorData } from '@/types/git';
import { ContributorDetailsModal } from '@/components/modals/contributorDetails';

export function ContributorsView() {
  const { contributors, commits, prs } = useAnalysisStore();
  const [selected, setSelected] = useState<ContributorData | null>(null);

  if (contributors.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-medium text-muted-foreground">No Contributors Data</h3>
        </div>
      </div>
    );
  }

  const totalContribs = contributors.reduce((s, c) => s + c.contributions, 0);
  const maxContribs = contributors[0]?.contributions || 1;

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-blue-400" />
              <div className="text-lg font-bold">{contributors.length}</div>
              <div className="text-[10px] text-muted-foreground">Contributors</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <GitCommit className="w-5 h-5 mx-auto mb-1 text-green-400" />
              <div className="text-lg font-bold">{totalContribs}</div>
              <div className="text-[10px] text-muted-foreground">Total Commits</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
              <div className="text-lg font-bold">{contributors[0]?.login || '-'}</div>
              <div className="text-[10px] text-muted-foreground">Top Contributor</div>
            </div>
          </div>

          {/* Bus Factor */}
          {(() => {
            const top = contributors.slice(0, 1);
            const topPercent = Math.round((top.reduce((s, c) => s + c.contributions, 0) / totalContribs) * 100);
            const busFactor = contributors.filter(c => c.contributions > totalContribs * 0.1).length;
            return (
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                    Bus Factor: {busFactor}
                  </span>
                  <Badge variant="secondary" className={`text-[10px] ${busFactor <= 1 ? 'text-red-400 bg-red-500/10' : busFactor <= 2 ? 'text-yellow-400 bg-yellow-500/10' : 'text-green-400 bg-green-500/10'}`}>
                    {busFactor <= 1 ? 'Critical Risk' : busFactor <= 2 ? 'Medium Risk' : 'Healthy'}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Top contributor owns {topPercent}% of commits. {busFactor <= 1 ? 'High risk if they leave.' : 'Knowledge is distributed.'}
                </p>
              </div>
            );
          })()}

          {/* Contributor list */}
          <div className="space-y-2">
            {contributors.map((c, i) => {
              const percent = Math.round((c.contributions / totalContribs) * 100);
              const barWidth = Math.round((c.contributions / maxContribs) * 100);
              return (
                <button
                  key={c.login}
                  onClick={() => setSelected(c)}
                  className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-blue-500/30 hover:bg-card/80 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right">#{i + 1}</span>
                    <Image src={c.avatar_url} alt={c.login} width={32} height={32} className="w-8 h-8 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{c.login}</span>
                        <span className="text-xs text-muted-foreground">{c.contributions} commits ({percent}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      <ContributorDetailsModal
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        contributor={selected}
        commits={commits}
        prs={prs}
      />
    </>
  );
}
