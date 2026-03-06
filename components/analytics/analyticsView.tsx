'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  History, Users, GitBranch, Tag, BarChart3,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommitHistory } from '@/components/analytics/commitHistory';
import { ContributorsView } from '@/components/analytics/contributorsView';
import { BranchesView } from '@/components/analytics/branchesView';
import { TagsView } from '@/components/analytics/tagsView';
import { InsightsView } from '@/components/analytics/insightsView';
import { SearchCommitsView } from '@/components/analytics/searchCommitsView';

type AnalyticsTab = 'history' | 'contributors' | 'branches' | 'tags' | 'insights' | 'search';

const analyticsTabs: { id: AnalyticsTab; label: string; icon: LucideIcon }[] = [
  { id: 'history', label: 'History', icon: History },
  { id: 'contributors', label: 'Contributors', icon: Users },
  { id: 'branches', label: 'Branches', icon: GitBranch },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'search', label: 'Search', icon: Search },
];

export function AnalyticsView() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('history');

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation */}
      <div className="px-3 pt-2 pb-1 border-b border-border flex items-center gap-1 overflow-x-auto shrink-0">
        {analyticsTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'h-7 text-xs gap-1.5 shrink-0',
                activeTab === tab.id && 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              )}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'history' && <CommitHistory />}
        {activeTab === 'contributors' && <ContributorsView />}
        {activeTab === 'branches' && <BranchesView />}
        {activeTab === 'tags' && <TagsView />}
        {activeTab === 'insights' && <InsightsView />}
        {activeTab === 'search' && <SearchCommitsView />}
      </div>
    </div>
  );
}
