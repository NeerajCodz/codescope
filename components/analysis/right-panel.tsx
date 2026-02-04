'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    AlertTriangle,
    ShieldCheck,
    Zap,
    Code2,
    ChevronRight,
    Bug,
    ShieldAlert,
    Clock,
    Flame
} from 'lucide-react';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { cn } from '@/lib/utils';

export function RightPanel() {
    const { data } = useAnalysisStore();

    if (!data) return (
        <aside className="w-80 border-l border-border bg-card/30 flex items-center justify-center p-8 text-center italic text-slate-500 text-sm">
            Analysis pending...
        </aside>
    );

    const highComplexityFiles = data.files
        .filter(f => f.complexity && f.complexity.score > 20)
        .sort((a, b) => (b.complexity?.score || 0) - (a.complexity?.score || 0))
        .slice(0, 5);

    return (
        <aside className="w-80 border-l border-border bg-card/50 backdrop-blur-md flex flex-col h-full shrink-0 overflow-hidden">
            <Tabs defaultValue="overview" className="flex-1 flex flex-col">
                <div className="px-4 pt-4 shrink-0">
                    <TabsList className="grid w-full grid-cols-4 bg-slate-900 border border-slate-800 h-9 p-1">
                        <TabsTrigger value="overview" className="text-[10px] uppercase font-bold py-1">Info</TabsTrigger>
                        <TabsTrigger value="patterns" className="text-[10px] uppercase font-bold py-1">Pats</TabsTrigger>
                        <TabsTrigger value="security" className="text-[10px] uppercase font-bold py-1">Sec</TabsTrigger>
                        <TabsTrigger value="issues" className="text-[10px] uppercase font-bold py-1">Iss</TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                    <TabsContent value="overview" className="h-full m-0">
                        <ScrollArea className="h-full px-4 py-4">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Major Hotspots</h3>
                                    <div className="space-y-2">
                                        {highComplexityFiles.map((file, i) => (
                                            <Card key={i} className="p-3 bg-red-500/5 border-red-500/10 hover:border-red-500/30 transition-all cursor-pointer group">
                                                <div className="flex items-start gap-3">
                                                    <Flame className="w-4 h-4 text-red-500 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-red-400 truncate">{file.name}</p>
                                                        <p className="text-[10px] text-slate-500 truncate">{file.path}</p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <div className="flex-1 h-1 bg-red-500/10 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-red-500"
                                                                    style={{ width: `${Math.min(100, (file.complexity?.score || 0) * 2)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[9px] font-mono text-red-400">{file.complexity?.score}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>

                                <Separator className="opacity-30" />

                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Activity Log</h3>
                                    <div className="space-y-4">
                                        <div className="flex gap-3 relative before:absolute before:left-2 before:top-4 before:bottom-0 before:w-[1px] before:bg-slate-800">
                                            <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center z-10">
                                                <Clock className="w-2.5 h-2.5 text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-medium text-slate-300">Analysis completed</p>
                                                <p className="text-[9px] text-slate-500">2 minutes ago</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="patterns" className="h-full m-0">
                        <ScrollArea className="h-full px-4 py-4">
                            <div className="space-y-4">
                                {data.patterns.map((pat, i) => (
                                    <Card key={i} className="p-3 bg-slate-900 border-slate-800 hover:border-blue-500/20 transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{pat.icon}</span>
                                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-tight">{pat.name}</h4>
                                            </div>
                                            <Badge variant="outline" className="text-[9px] bg-blue-500/5">{pat.files.length}</Badge>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-relaxed mb-3">{pat.desc}</p>
                                        <div className="space-y-1">
                                            {pat.files.slice(0, 3).map((f, fi) => (
                                                <div key={fi} className="flex items-center justify-between py-1 border-t border-slate-800/50 group cursor-pointer">
                                                    <span className="text-[9px] text-slate-500 font-mono truncate max-w-[140px]">{f.name}</span>
                                                    <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-blue-500" />
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="security" className="h-full m-0">
                        <ScrollArea className="h-full px-4 py-4">
                            <div className="space-y-4">
                                {data.securityIssues.length > 0 ? data.securityIssues.map((iss, i) => (
                                    <Card key={i} className={cn(
                                        "p-3 border transition-colors",
                                        iss.severity === 'high' ? "bg-red-500/5 border-red-500/20" : "bg-orange-500/5 border-orange-500/20"
                                    )}>
                                        <div className="flex items-center justify-between mb-2">
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] uppercase",
                                                iss.severity === 'high' ? "text-red-400 border-red-500/20" : "text-orange-400 border-orange-500/20"
                                            )}>
                                                {iss.severity}
                                            </Badge>
                                            <span className="text-[9px] text-slate-500">line {iss.line}</span>
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-200 mb-1">{iss.title}</h4>
                                        <p className="text-[10px] text-slate-400 mb-3">{iss.desc}</p>
                                        <div className="bg-black/50 p-2 rounded border border-white/5 overflow-x-auto">
                                            <code className="text-[10px] font-mono text-red-300/80 whitespace-pre italic">
                                                {iss.code || '// snippet hidden'}
                                            </code>
                                        </div>
                                    </Card>
                                )) : (
                                    <div className="text-center py-20 text-slate-600">
                                        <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                        <p className="text-sm font-medium">Clear scan</p>
                                        <p className="text-xs opacity-50">No known vulnerabilities found</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="issues" className="h-full m-0 flex flex-col items-center justify-center p-8 text-center text-slate-600">
                        <Bug className="w-12 h-12 opacity-10 mb-4" />
                        <h4 className="text-sm font-bold mb-1">Architecture Debt</h4>
                        <p className="text-xs">Circular dependencies and layer violations will appear here.</p>
                    </TabsContent>
                </div>
            </Tabs>
        </aside>
    );
}

import { Separator } from '@/components/ui/separator';
