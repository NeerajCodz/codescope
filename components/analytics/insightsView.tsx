'use client';

import React, { useMemo, useState } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, TrendingUp, Clock, Users, FileText,
  AlertTriangle, Zap, Activity,
} from 'lucide-react';

export function InsightsView() {
  const { data, commits, contributors } = useAnalysisStore();

  // Use stable timestamp for activity heatmap
  const [now] = useState(() => Date.now());

  const insights = useMemo(() => {
    if (!data) return null;

    // Code churn (last 30 days of commits)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const recentCommits = commits.filter(c => new Date(c.author.date) > thirtyDaysAgo);

    // Commit frequency
    const commitsPerDay = recentCommits.length / 30;

    // Hotspot files (highest complexity)
    const hotspots = data.files
      .filter(f => f.isCode && f.complexity)
      .sort((a, b) => (b.complexity?.score || 0) - (a.complexity?.score || 0))
      .slice(0, 10);

    // Largest files
    const largestFiles = data.files
      .filter(f => f.isCode)
      .sort((a, b) => (b.lines || 0) - (a.lines || 0))
      .slice(0, 10);

    // Dead code percentage
    const deadPercent = data.stats.functions > 0
      ? Math.round((data.stats.dead / data.stats.functions) * 100)
      : 0;

    // Bus factor
    const totalC = contributors.reduce((s, c) => s + c.contributions, 0);
    const busFactor = contributors.filter(c => c.contributions > totalC * 0.1).length;

    return {
      commitsPerDay: commitsPerDay.toFixed(1),
      recentCommits: recentCommits.length,
      hotspots,
      largestFiles,
      deadPercent,
      busFactor,
      totalContributors: contributors.length,
      avgComplexity: data.stats.avgComplexity,
      securityIssues: data.securityIssues.length,
      totalLines: data.totalLines || 0,
    };
  }, [data, commits, contributors]);

  if (!insights) return null;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Activity, label: 'Velocity', value: `${insights.commitsPerDay}/day`, color: 'text-blue-400' },
            { icon: Users, label: 'Bus Factor', value: insights.busFactor.toString(), color: insights.busFactor <= 1 ? 'text-red-400' : 'text-green-400' },
            { icon: AlertTriangle, label: 'Dead Code', value: `${insights.deadPercent}%`, color: insights.deadPercent > 20 ? 'text-yellow-400' : 'text-green-400' },
            { icon: Zap, label: 'Security Issues', value: insights.securityIssues.toString(), color: insights.securityIssues > 0 ? 'text-red-400' : 'text-green-400' },
          ].map((metric, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-3 text-center">
              {(() => { const Icon = metric.icon; return <Icon className={`w-5 h-5 mx-auto mb-1 ${metric.color}`} />; })()}
              <div className="text-lg font-bold">{metric.value}</div>
              <div className="text-[10px] text-muted-foreground">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Activity heatmap placeholder */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-400" /> Recent Activity ({insights.recentCommits} commits in 30d)
          </h3>
          <div className="flex gap-0.5 flex-wrap">
            {Array.from({ length: 30 }, (_, i) => {
              const date = new Date(now - (29 - i) * 86400000);
              const count = commits.filter(c => {
                const d = new Date(c.author.date);
                return d.toDateString() === date.toDateString();
              }).length;
              const intensity = count === 0 ? 'bg-muted' : count <= 2 ? 'bg-green-900' : count <= 5 ? 'bg-green-700' : 'bg-green-500';
              return (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-sm ${intensity}`}
                  title={`${date.toLocaleDateString()}: ${count} commits`}
                />
              );
            })}
          </div>
        </div>

        {/* Hotspot files */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-orange-400" /> Complexity Hotspots
          </h3>
          <div className="space-y-1.5">
            {insights.hotspots.map((file, i) => (
              <div key={file.path} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-4 text-right">#{i + 1}</span>
                <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{file.path}</span>
                <Badge
                  variant="secondary"
                  className={`text-[9px] h-4 ${
                    (file.complexity?.score || 0) > 30 ? 'text-red-400 bg-red-500/10' :
                    (file.complexity?.score || 0) > 15 ? 'text-yellow-400 bg-yellow-500/10' :
                    'text-green-400 bg-green-500/10'
                  }`}
                >
                  {file.complexity?.score || 0}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Largest files */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" /> Largest Files (by lines)
          </h3>
          <div className="space-y-1.5">
            {insights.largestFiles.map((file, i) => (
              <div key={file.path} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-4 text-right">#{i + 1}</span>
                <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{file.path}</span>
                <span className="text-muted-foreground">{file.lines} lines</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
