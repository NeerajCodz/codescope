'use client';

import React, { useState, useMemo } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Input } from '@/components/ui/input';
import { Search, Clock, User } from 'lucide-react';

export function SearchCommitsView() {
  const { commits } = useAnalysisStore();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return commits.filter(c =>
      c.message.toLowerCase().includes(q) ||
      c.author.name.toLowerCase().includes(q) ||
      (c.author.login && c.author.login.toLowerCase().includes(q)) ||
      c.sha.startsWith(q)
    );
  }, [commits, query]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search commits by message, author, or SHA..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        {query && (
          <p className="text-[10px] text-muted-foreground mt-1.5">{results.length} results found</p>
        )}
      </div>

      <ScrollArea className="flex-1">
        {!query.trim() ? (
          <div className="flex items-center justify-center h-full min-h-50">
            <div className="text-center space-y-3">
              <Search className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Search across {commits.length} commits</p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-1">
            {results.map(commit => (
              <div key={commit.sha} className="p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                <p className="text-xs font-medium">{commit.message.split('\n')[0]}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {commit.author.login || commit.author.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(commit.author.date).toLocaleDateString()}
                  </div>
                  <code className="font-mono">{commit.sha.slice(0, 7)}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
