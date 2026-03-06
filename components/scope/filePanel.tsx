'use client';

import { useState, useMemo } from 'react';
import { Search, File, Folder, ChevronRight, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scrollArea';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { FileNode } from '@/types';
import { cn } from '@/lib/utils';

interface FileTreeItemProps {
    file: FileNode;
    depth: number;
    searchQuery: string;
    selectedPath: string | null;
    onSelect: (file: FileNode) => void;
    onViewCode: (file: FileNode) => void;
}

function FileTreeItem({ file, depth, searchQuery, selectedPath, onSelect, onViewCode }: FileTreeItemProps) {
    const [expanded, setExpanded] = useState(depth < 1);
    const isFolder = file.children && file.children.length > 0;
    const isSelected = file.path === selectedPath;
    const fileName = file.path.split('/').pop() || file.path;
    const matchesSearch = !searchQuery || file.path.toLowerCase().includes(searchQuery.toLowerCase());

    const filteredChildren = useMemo(() => {
        if (!file.children) return [];
        if (!searchQuery) return file.children;
        return file.children.filter(c =>
            c.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.children?.some(gc => gc.path.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [file.children, searchQuery]);

    if (!matchesSearch && filteredChildren.length === 0) return null;

    return (
        <div>
            <button
                onClick={() => {
                    if (isFolder) setExpanded(!expanded);
                    onSelect(file);
                }}
                className={cn(
                    'w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-all group',
                    isSelected
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
                )}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
                {isFolder ? (
                    <ChevronRight className={cn(
                        'w-3 h-3 shrink-0 transition-transform',
                        expanded && 'rotate-90'
                    )} />
                ) : (
                    <File className="w-3 h-3 shrink-0 text-slate-500" />
                )}
                {isFolder ? (
                    <Folder className="w-3 h-3 shrink-0 text-yellow-500/70" />
                ) : null}
                <span className="truncate flex-1 text-left">{fileName}</span>
                {!isFolder && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewCode(file);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-blue-500/20 transition-all"
                        title="View code"
                    >
                        <ArrowRight className="w-3 h-3 text-blue-400" />
                    </button>
                )}
            </button>
            {isFolder && expanded && filteredChildren.map(child => (
                <FileTreeItem
                    key={child.path}
                    file={child}
                    depth={depth + 1}
                    searchQuery={searchQuery}
                    selectedPath={selectedPath}
                    onSelect={onSelect}
                    onViewCode={onViewCode}
                />
            ))}
        </div>
    );
}

interface FilePanelProps {
    onViewCode: (file: FileNode) => void;
}

export function FilePanel({ onViewCode }: FilePanelProps) {
    const { data, selectedFile, setSelectedFile } = useAnalysisStore();
    const [search, setSearch] = useState('');

    const files = useMemo(() => data?.files || [], [data]);

    const stats = useMemo(() => {
        let totalFiles = 0;
        let totalFunctions = 0;
        const countFiles = (nodes: FileNode[]) => {
            nodes.forEach(n => {
                if (n.children?.length) countFiles(n.children);
                else {
                    totalFiles++;
                    totalFunctions += n.functions?.length || 0;
                }
            });
        };
        countFiles(files);
        return { totalFiles, totalFunctions };
    }, [files]);

    const handleSelect = (file: FileNode) => {
        setSelectedFile(file.path);
    };

    return (
        <div className="w-56 border-r border-border bg-card/30 flex flex-col h-full shrink-0 overflow-hidden">
            {/* Header */}
            <div className="p-3 pb-2 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Files
                    </span>
                    <div className="flex gap-2">
                        <span className="text-[10px] text-slate-500">{stats.totalFiles} files</span>
                        <span className="text-[10px] text-slate-600">•</span>
                        <span className="text-[10px] text-slate-500">{stats.totalFunctions} fn</span>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground opacity-50" />
                    <Input
                        placeholder="Filter..."
                        className="pl-7 h-7 bg-slate-900/50 border-slate-800 text-xs"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Tree */}
            <ScrollArea className="flex-1 px-1">
                {files.map(file => (
                    <FileTreeItem
                        key={file.path}
                        file={file}
                        depth={0}
                        searchQuery={search}
                        selectedPath={selectedFile}
                        onSelect={handleSelect}
                        onViewCode={onViewCode}
                    />
                ))}
            </ScrollArea>
        </div>
    );
}
