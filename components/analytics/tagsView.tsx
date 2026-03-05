'use client';

import React, { useEffect, useState } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { Tag, Package, Calendar } from 'lucide-react';
import { getTags } from '@/lib/git/tags';
import { TagData } from '@/types/git';

export function TagsView() {
  const { owner, repoName } = useAnalysisStore();
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!owner || !repoName) return;
    let cancelled = false;
    const token = sessionStorage.getItem('github_token');
    getTags(owner, repoName, token)
      .then(data => { if (!cancelled) setTags(data); })
      .catch(() => { if (!cancelled) setTags([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [owner, repoName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-medium text-muted-foreground">No Tags Found</h3>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {tags.map(tag => (
          <div key={tag.name} className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {tag.isRelease ? (
                  <Package className="w-4 h-4 text-green-400" />
                ) : (
                  <Tag className="w-4 h-4 text-yellow-400" />
                )}
                <span className="text-xs font-medium">{tag.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {tag.isRelease && (
                  <Badge variant="secondary" className="text-[9px] h-4 bg-green-500/10 text-green-400 border-green-500/20">Release</Badge>
                )}
                {tag.date && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(tag.date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {tag.message && (
              <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{tag.message}</p>
            )}
            <code className="text-[9px] text-muted-foreground/50 mt-1 block">{tag.sha.slice(0, 7)}</code>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
