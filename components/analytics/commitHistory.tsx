'use client';

import React from 'react';
import Image from 'next/image';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { CommitData } from '@/types/git';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { GitCommit, Clock, User } from 'lucide-react';

export function CommitHistory() {
  const { commits } = useAnalysisStore();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const groupByDate = (items: CommitData[]) => {
    const groups: Record<string, CommitData[]> = {};
    items.forEach(c => {
      const date = new Date(c.author.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(c);
    });
    return groups;
  };

  const grouped = groupByDate(commits);

  if (commits.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <GitCommit className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-medium text-muted-foreground">No Commits Loaded</h3>
          <p className="text-xs text-muted-foreground/60">Commit history will appear once loaded from GitHub.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {Object.entries(grouped).map(([date, dateCommits]) => (
          <div key={date}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{date}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-1">
              {dateCommits.map(commit => (
                <div
                  key={commit.sha}
                  className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  {/* Timeline dot */}
                  <div className="mt-1.5 relative shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-background" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-snug">
                      {commit.message.split('\n')[0]}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {commit.author.avatar_url ? (
                          <Image src={commit.author.avatar_url} alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full" />
                        ) : (
                          <User className="w-3 h-3" />
                        )}
                        {commit.author.login || commit.author.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(commit.author.date)}
                      </div>
                      <code className="font-mono text-muted-foreground/50 group-hover:text-blue-400 transition-colors">
                        {commit.sha.slice(0, 7)}
                      </code>
                      {commit.parents.length > 1 && (
                        <Badge variant="secondary" className="text-[8px] h-3.5 px-1">merge</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
