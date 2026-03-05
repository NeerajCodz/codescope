'use client';

import { useEffect, useState } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { ChartView } from '@/components/chart/chartView';
import { GraphView } from '@/components/chart/graphView';
import { ProcessesView } from '@/components/charts/processesView';
import { SurrealLiveGraph } from '@/components/chart/liveGraph';
import { Button } from '@/components/ui/button';
import { Bot, Network, Workflow, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChartSubTab = 'root' | 'processes' | 'ai' | 'live';

export default function ChartPage() {
  const { setActiveTab } = useAnalysisStore();
  const [subTab, setSubTab] = useState<ChartSubTab>('root');

  useEffect(() => {
    setActiveTab('chart');
  }, [setActiveTab]);

  const tabs: { id: ChartSubTab; label: string; icon: React.ReactNode; activeClass: string }[] = [
    { id: 'root',      label: 'Root',       icon: <Workflow className="w-3 h-3" />,  activeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
    { id: 'processes', label: 'Processes',  icon: <Network className="w-3 h-3" />,   activeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
    { id: 'ai',        label: 'AI',         icon: <Bot className="w-3 h-3" />,        activeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
    { id: 'live',      label: 'Live Graph', icon: <Share2 className="w-3 h-3" />,    activeClass: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tab bar */}
      <div className="h-9 border-b border-border bg-card/20 flex items-center px-4 gap-1 shrink-0">
        {tabs.map(({ id, label, icon, activeClass }) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            onClick={() => setSubTab(id)}
            className={cn(
              'h-6 px-2.5 text-xs gap-1.5',
              subTab === id ? activeClass : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {icon}
            {label}
          </Button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'root'      && <GraphView />}
        {subTab === 'processes' && <ProcessesView />}
        {subTab === 'ai'        && <ChartView mode="ai" />}
        {subTab === 'live'      && <SurrealLiveGraph />}
      </div>
    </div>
  );
}
