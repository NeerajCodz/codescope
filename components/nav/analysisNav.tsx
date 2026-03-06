'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Telescope, GitPullRequest, Plug, LineChart, GitBranch,
  BarChart3, Info, Cpu,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnalysisStore } from '@/components/context/analysisContext';

const tabs: { id: string; label: string; icon: LucideIcon; href: string }[] = [
  { id: 'scope', label: 'Scope', icon: Telescope, href: '/analysis/scope' },
  { id: 'prs', label: 'PRs', icon: GitPullRequest, href: '/analysis/prs' },
  { id: 'api', label: 'API', icon: Plug, href: '/analysis/api' },
  { id: 'analytics', label: 'Analytics', icon: LineChart, href: '/analysis/analytics' },
  { id: 'lens', label: 'Lens', icon: GitBranch, href: '/analysis/lens' },
  { id: 'chart', label: 'Graph', icon: BarChart3, href: '/analysis/chart' },
  { id: 'info', label: 'Info', icon: Info, href: '/analysis/info' },
  { id: 'mcp', label: 'MCP', icon: Cpu, href: '/analysis/mcp' },
];

export function AnalysisNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { hasDeepWiki } = useAnalysisStore();

  const activeTab = tabs.find(t => pathname.startsWith(t.href))?.id || 'scope';

  return (
    <nav className="h-10 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-4 gap-1 shrink-0 overflow-x-auto">
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;
        const href = `${tab.href}${queryString ? `?${queryString}` : ''}`;

        return (
          <Link
            key={tab.id}
            href={href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all relative shrink-0',
              isActive
                ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {(() => { const Icon = tab.icon; return <Icon className="w-3.5 h-3.5" />; })()}
            <span>{tab.label}</span>
            {/* MCP badge dot if DeepWiki is available */}
            {tab.id === 'mcp' && hasDeepWiki && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-background" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
