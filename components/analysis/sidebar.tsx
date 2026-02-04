'use client';

import { useState, useMemo } from 'react';
import {
    Search,
    ChevronDown,
    FolderTree,
    Activity,
    Network,
    Grid,
    GitBranch,
    Orbit,
    Box,
    Waves,
    Layout,
    BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { TreeView } from './tree-view';
import { StructureOutline } from './structure-outline';
import { DrillDownModal } from '@/components/modals/drill-down-modal';
import { FileNode } from '@/types';
import { cn } from '@/lib/utils';

export function Sidebar() {
    const { viewMode, setViewMode, data, setSelectedFile, setSelectedFunction, selectedFile: selectedFilePath } = useAnalysisStore();
    const [search, setSearch] = useState('');
    const [selectedFileNode, setSelectedFileNode] = useState<FileNode | null>(null);
    const [isDrillOpen, setIsDrillOpen] = useState(false);

    const visModes = [
        { id: 'force', label: 'Force Graph', icon: Network },
        { id: 'cluster', label: 'Cluster Graph', icon: Layout },
        { id: 'treemap', label: 'Treemap', icon: Box },
        { id: 'matrix', label: 'Matrix', icon: Grid },
        { id: 'dendrogram', label: 'Dendrogram', icon: Orbit },
        { id: 'sankey', label: 'Sankey', icon: Waves },
        { id: 'bundle', label: 'Bundle', icon: Activity },
        { id: 'arc', label: 'Arc Diagram', icon: GitBranch }
    ] as const;


    const handleFileSelect = (file: FileNode) => {
        setSelectedFile(file.path);
        setSelectedFileNode(file);
        setIsDrillOpen(true);
    };

    const handleStructureSelect = (file: FileNode) => {
        setSelectedFile(file.path);
        setSelectedFileNode(file);
    };

    const handleFunctionSelect = (file: FileNode, fn: any) => {
        setSelectedFile(file.path);
        setSelectedFileNode(file);
        setSelectedFunction(fn.name);
    };

    return (
        <aside className="w-64 border-r border-border bg-card/50 flex flex-col h-full shrink-0 overflow-hidden">
            <div className="p-4 space-y-4">
                <div className="flex flex-col gap-2">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                        Visualization
                    </h3>
                    <div className="space-y-1">
                        {visModes.map((mode) => (
                            <Button
                                key={mode.id}
                                variant={viewMode === mode.id ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode(mode.id)}
                                className={cn(
                                    "w-full justify-start gap-2 h-8 px-2 text-xs transition-all",
                                    viewMode === mode.id ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <mode.icon className={cn("h-3.5 w-3.5", viewMode === mode.id ? "text-blue-400" : "text-slate-500")} />
                                <span>{mode.label}</span>
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            <Separator className="opacity-50" />

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-4 pt-3 pb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                        Structure
                    </span>
                </div>
                <ScrollArea className="max-h-[220px] px-2">
                    <StructureOutline
                        data={data?.files || []}
                        searchQuery={search}
                        selectedFilePath={selectedFilePath}
                        onSelectFile={handleStructureSelect}
                        onSelectFunction={handleFunctionSelect}
                    />
                </ScrollArea>

                <Separator className="opacity-50 my-2" />

                <div className="p-4 pb-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                        <Input
                            placeholder="Search files..."
                            className="pl-8 h-8 bg-slate-900/50 border-slate-800 text-xs"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-4 pt-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                        Explorer
                    </span>
                    <FolderTree className="h-3 w-3 text-slate-600" />
                </div>

                <ScrollArea className="flex-1 px-2">
                    <TreeView onSelect={handleFileSelect} searchQuery={search} data={data?.files || []} />
                </ScrollArea>
            </div>

            <DrillDownModal
                open={isDrillOpen}
                onOpenChange={setIsDrillOpen}
                file={selectedFileNode}
            />
        </aside>
    );
}
