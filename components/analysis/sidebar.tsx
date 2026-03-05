'use client';

import { useState, useCallback } from 'react';
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
    Cuboid,
    FileCode,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { Separator } from '@/components/ui/separator';
import { StructureOutline } from './structureOutline';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { FileNode, FunctionDef } from '@/types';
import { cn } from '@/lib/utils';

const visModes = [
    { id: 'force', label: 'Force Graph', icon: Network },
    { id: 'force3d', label: 'Force 3D', icon: Cuboid },
    { id: 'cluster', label: 'Cluster', icon: Layout },
    { id: 'treemap', label: 'Treemap', icon: Box },
    { id: 'matrix', label: 'Matrix', icon: Grid },
    { id: 'dendrogram', label: 'Dendrogram', icon: Orbit },
    { id: 'sankey', label: 'Sankey', icon: Waves },
    { id: 'bundle', label: 'Bundle', icon: Activity },
    { id: 'arc', label: 'Arc', icon: GitBranch },
] as const;

export function Sidebar() {
    const { viewMode, setViewMode, data, setSelectedFile, setSelectedFunction, selectedFile: selectedFilePath } = useAnalysisStore();
    const [search, setSearch] = useState('');
    const [sheetFile, setSheetFile] = useState<FileNode | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [vizPickerOpen, setVizPickerOpen] = useState(false);

    const currentVis = visModes.find(m => m.id === viewMode) || visModes[0];

    // Click = locate file in graph (no popup)
    const handleFileSelect = useCallback((file: FileNode) => {
        setSelectedFile(file.path);
    }, [setSelectedFile]);

    // Right-click = open IDE sheet
    const handleFileRightClick = useCallback((file: FileNode) => {
        setSheetFile(file);
        setIsSheetOpen(true);
    }, []);

    const handleFunctionSelect = useCallback((_file: FileNode, fn: FunctionDef) => {
        setSelectedFunction(fn.name);
    }, [setSelectedFunction]);

    return (
        <aside className="w-64 border-r border-border bg-card/50 flex flex-col h-full shrink-0 overflow-hidden">
            {/* Compact Viz Picker */}
            <div className="p-3 space-y-2">
                <div className="relative">
                    <button
                        onClick={() => setVizPickerOpen(!vizPickerOpen)}
                        className={cn(
                            'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border',
                            'bg-slate-900/50 border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-900/80'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {(() => { const Icon = currentVis.icon; return <Icon className="w-3.5 h-3.5 text-blue-400" />; })()}
                            <span className="text-slate-200">{currentVis.label}</span>
                        </div>
                        <ChevronDown className={cn(
                            'w-3.5 h-3.5 text-slate-500 transition-transform',
                            vizPickerOpen && 'rotate-180'
                        )} />
                    </button>

                    {vizPickerOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-900 border border-slate-700/50 rounded-lg shadow-xl overflow-hidden">
                            <div className="grid grid-cols-3 gap-0.5 p-1">
                                {visModes.map(mode => (
                                    <button
                                        key={mode.id}
                                        onClick={() => {
                                            setViewMode(mode.id);
                                            setVizPickerOpen(false);
                                        }}
                                        className={cn(
                                            'flex flex-col items-center gap-1 px-2 py-2 rounded-md text-[10px] transition-all',
                                            viewMode === mode.id
                                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                        )}
                                    >
                                        {(() => { const ModeIcon = mode.icon; return <ModeIcon className="w-3.5 h-3.5" />; })()}
                                        <span className="truncate w-full text-center">{mode.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Separator className="opacity-50" />

            {/* Unified file tree */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Search */}
                <div className="p-3 pb-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                        <Input
                            placeholder="Search files & functions..."
                            className="pl-8 h-8 bg-slate-900/50 border-slate-800 text-xs"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="px-4 pb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                        Explorer
                    </span>
                    <FolderTree className="h-3 w-3 text-slate-600" />
                </div>

                <ScrollArea className="flex-1 px-2">
                    <StructureOutline
                        data={data?.files || []}
                        searchQuery={search}
                        selectedFilePath={selectedFilePath}
                        onSelectFile={handleFileSelect}
                        onSelectFunction={handleFunctionSelect}
                        onRightClickFile={handleFileRightClick}
                    />
                </ScrollArea>
            </div>

            {/* IDE Sheet — right-click opens file details as a side sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="right" className="w-150 sm:max-w-150 flex flex-col overflow-hidden p-0">
                    {sheetFile && (
                        <>
                            <SheetHeader className="shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                        <FileCode className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <SheetTitle className="text-base truncate">{sheetFile.name}</SheetTitle>
                                        <SheetDescription className="font-mono text-[10px] truncate">
                                            {sheetFile.path}
                                        </SheetDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-700">
                                        {sheetFile.lines || 0} lines
                                    </Badge>
                                    <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-700">
                                        {sheetFile.size || 0} bytes
                                    </Badge>
                                    {sheetFile.layer && (
                                        <Badge variant="outline" className="text-[9px] text-blue-400 border-blue-500/30">
                                            {sheetFile.layer}
                                        </Badge>
                                    )}
                                    {sheetFile.complexity?.level && (
                                        <Badge variant="outline" className={cn(
                                            'text-[9px]',
                                            sheetFile.complexity.level === 'high' ? 'text-red-400 border-red-500/30' :
                                            sheetFile.complexity.level === 'medium' ? 'text-orange-400 border-orange-500/30' :
                                            'text-green-400 border-green-500/30'
                                        )}>
                                            {sheetFile.complexity.level} complexity
                                        </Badge>
                                    )}
                                </div>
                            </SheetHeader>

                            <ScrollArea className="flex-1">
                                {/* Functions */}
                                {(sheetFile.functions || []).length > 0 && (
                                    <div className="p-4 border-b border-border">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                                            Functions ({sheetFile.functions!.length})
                                        </span>
                                        <div className="space-y-1">
                                            {sheetFile.functions!.map((fn, i) => (
                                                <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-slate-900/40 rounded border border-slate-800/30 text-xs">
                                                    <div className={cn(
                                                        'w-1.5 h-1.5 rounded-full shrink-0',
                                                        fn.isDead ? 'bg-red-400' : 'bg-blue-400'
                                                    )} />
                                                    <span className="text-blue-400 font-mono truncate">{fn.name}</span>
                                                    <span className="text-slate-600 shrink-0 text-[10px]">:{fn.line}</span>
                                                    <div className="ml-auto flex items-center gap-1 shrink-0">
                                                        {fn.totalCalls !== undefined && (
                                                            <Badge variant="outline" className="text-[8px] h-3.5 text-slate-500 border-slate-700">
                                                                {fn.totalCalls} calls
                                                            </Badge>
                                                        )}
                                                        {fn.isDead && (
                                                            <Badge variant="outline" className="text-[8px] h-3.5 text-red-400 border-red-500/30">
                                                                unused
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Code preview */}
                                {sheetFile.content && (
                                    <div className="p-4">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                                            Source
                                        </span>
                                        <div className="font-mono text-[10px] leading-4 bg-slate-950/50 rounded-lg border border-slate-800/50 overflow-auto max-h-96">
                                            {sheetFile.content.split('\n').map((ln, i) => (
                                                <div key={i} className="flex hover:bg-slate-800/30">
                                                    <span className="w-10 shrink-0 text-right pr-2 text-slate-700 select-none border-r border-slate-800/30">
                                                        {i + 1}
                                                    </span>
                                                    <pre className="flex-1 px-3 whitespace-pre text-slate-400 overflow-hidden">
                                                        {ln}
                                                    </pre>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Variables */}
                                {(sheetFile.variables || []).length > 0 && (
                                    <div className="p-4 border-t border-border">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                                            Variables ({sheetFile.variables!.length})
                                        </span>
                                        <div className="space-y-1">
                                            {sheetFile.variables!.map((v, i) => (
                                                <div key={i} className="flex items-center gap-2 px-2 py-1 bg-slate-900/40 rounded border border-slate-800/30 text-xs">
                                                    <span className="text-purple-400 font-mono truncate">{v.name}</span>
                                                    {v.valueType && (
                                                        <span className="text-slate-600 text-[10px]">{v.valueType}</span>
                                                    )}
                                                    <span className="text-slate-700 shrink-0 ml-auto text-[10px]">:{v.line}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Security Issues */}
                                {(sheetFile.securityIssues || []).length > 0 && (
                                    <div className="p-4 border-t border-border">
                                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block mb-2">
                                            Security Issues ({sheetFile.securityIssues!.length})
                                        </span>
                                        <div className="space-y-1">
                                            {sheetFile.securityIssues!.map((issue, i) => (
                                                <div key={i} className="px-2 py-1.5 bg-red-500/5 rounded border border-red-500/10 text-xs">
                                                    <span className="text-red-400">{issue.title}</span>
                                                    <p className="text-slate-500 text-[10px] mt-0.5">{issue.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </ScrollArea>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </aside>
    );
}
