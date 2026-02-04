'use client';

import React, { useState, useMemo } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Folder,
    FileCode,
    FileJson,
    FileText,
    Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileNode } from '@/types';

interface TreeViewProps {
    data: FileNode[];
    onSelect?: (file: FileNode) => void;
    className?: string;
    searchQuery?: string;
}

interface Node {
    name: string;
    path: string;
    children: Record<string, Node>;
    file?: FileNode;
}

export function TreeView({ data, onSelect, className, searchQuery = '' }: TreeViewProps) {
    // Build hierarchical structure from flat file list
    const tree = useMemo(() => {
        const root: Node = { name: 'root', path: '', children: {} };

        data.forEach(file => {
            const parts = file.path.split('/');
            let current = root;

            parts.forEach((part, i) => {
                if (!current.children[part]) {
                    current.children[part] = {
                        name: part,
                        path: parts.slice(0, i + 1).join('/'),
                        children: {}
                    };
                }
                current = current.children[part];
                if (i === parts.length - 1) {
                    current.file = file;
                }
            });
        });

        return root;
    }, [data]);

    const TreeNode = ({ node, level = 0 }: { node: Node; level?: number }) => {
        const hasChildren = Object.keys(node.children).length > 0;
        const isFile = !!node.file;
        const [isOpen, setIsOpen] = useState(level < 1 || !!searchQuery);

        // Filter based on search query
        const matchesSearch = useMemo(() => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            if (node.name.toLowerCase().includes(q)) return true;
            // Check if any child matches
            const checkChildren = (n: Node): boolean => {
                if (n.name.toLowerCase().includes(q)) return true;
                return Object.values(n.children).some(c => checkChildren(c));
            };
            return Object.values(node.children).some(c => checkChildren(c));
        }, [node, searchQuery]);

        if (!matchesSearch && level > 0) return null;

        const icon = isFile ? (
            node.name.endsWith('.json') ? <FileJson className="w-3.5 h-3.5 text-yellow-500/80" /> :
                node.name.endsWith('.md') ? <FileText className="w-3.5 h-3.5 text-blue-400" /> :
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
        ) : (
            <Folder className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20" />
        );

        return (
            <div className="select-none">
                <div
                    className={cn(
                        "flex items-center gap-1.5 py-1 px-2 hover:bg-slate-800/40 cursor-pointer text-xs rounded-sm transition-colors",
                        isFile ? "text-slate-400 hover:text-slate-200" : "text-slate-200 font-medium"
                    )}
                    style={{ paddingLeft: `${level * 12 + 8}px` }}
                    onClick={() => {
                        if (hasChildren) setIsOpen(!isOpen);
                        if (isFile && node.file) onSelect?.(node.file);
                    }}
                >
                    {hasChildren ? (
                        isOpen ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />
                    ) : <div className="w-3" />}
                    {icon}
                    <span className="truncate">{node.name}</span>
                </div>

                {isOpen && hasChildren && (
                    <div>
                        {Object.values(node.children)
                            .sort((a, b) => {
                                const aIsFolder = Object.keys(a.children).length > 0;
                                const bIsFolder = Object.keys(b.children).length > 0;
                                if (aIsFolder && !bIsFolder) return -1;
                                if (!aIsFolder && bIsFolder) return 1;
                                return a.name.localeCompare(b.name);
                            })
                            .map((child, idx) => (
                                <TreeNode key={idx} node={child} level={level + 1} />
                            ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="flex-1 overflow-visible py-1">
                {Object.values(tree.children).map((node, idx) => (
                    <TreeNode key={idx} node={node} />
                ))}
            </div>
        </div>
    );
}
