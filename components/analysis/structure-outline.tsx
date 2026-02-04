'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileCode, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileNode, FunctionDef } from '@/types';

interface StructureOutlineProps {
    data: FileNode[];
    onSelectFile?: (file: FileNode) => void;
    onSelectFunction?: (file: FileNode, fn: FunctionDef) => void;
    className?: string;
    searchQuery?: string;
    selectedFilePath?: string | null;
}

interface Node {
    name: string;
    path: string;
    type: 'folder' | 'file' | 'function';
    children?: Record<string, Node>;
    file?: FileNode;
    fn?: FunctionDef;
}

export function StructureOutline({
    data,
    onSelectFile,
    onSelectFunction,
    className,
    searchQuery = '',
    selectedFilePath,
}: StructureOutlineProps) {
    const tree = useMemo(() => {
        const root: Node = { name: 'root', path: '', type: 'folder', children: {} };

        data.forEach((file) => {
            const parts = file.path.split('/');
            let current = root;

            parts.forEach((part, i) => {
                if (!current.children![part]) {
                    current.children![part] = {
                        name: part,
                        path: parts.slice(0, i + 1).join('/'),
                        type: i === parts.length - 1 ? 'file' : 'folder',
                        children: {},
                    };
                }
                current = current.children![part];
                if (i === parts.length - 1) {
                    current.file = file;
                    if (file.functions && file.functions.length > 0) {
                        file.functions.forEach((fn) => {
                            current.children![`fn:${fn.name}:${fn.line}`] = {
                                name: fn.name,
                                path: `${file.path}::${fn.name}`,
                                type: 'function',
                                file,
                                fn,
                            };
                        });
                    }
                }
            });
        });

        return root;
    }, [data]);

    const TreeNode = ({ node, level = 0 }: { node: Node; level?: number }) => {
        const hasChildren = node.children && Object.keys(node.children).length > 0;
        const [isOpen, setIsOpen] = useState(level < 1 || !!searchQuery);

        const matchesSearch = useMemo(() => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            if (node.name.toLowerCase().includes(q)) return true;
            if (!node.children) return false;
            const check = (n: Node): boolean => {
                if (n.name.toLowerCase().includes(q)) return true;
                return !!n.children && Object.values(n.children).some(child => check(child));
            };
            return Object.values(node.children).some(child => check(child));
        }, [node, searchQuery]);

        if (!matchesSearch && level > 0) return null;

        const isSelectedFile = node.type === 'file' && node.file?.path === selectedFilePath;

        const icon = node.type === 'folder'
            ? <Folder className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20" />
            : node.type === 'file'
                ? <FileCode className="w-3.5 h-3.5 text-blue-400" />
                : <Code className="w-3.5 h-3.5 text-cyan-300" />;

        const label = node.type === 'function' && node.fn
            ? `${node.fn.name}(${(node.fn.params || []).join(', ')})`
            : node.name;

        return (
            <div className="select-none">
                <div
                    className={cn(
                        "flex items-center gap-1.5 py-1 px-2 hover:bg-slate-800/40 cursor-pointer text-xs rounded-sm transition-colors",
                        node.type === 'folder'
                            ? "text-slate-200 font-medium"
                            : node.type === 'file'
                                ? isSelectedFile ? "text-cyan-300 bg-cyan-500/10" : "text-slate-400 hover:text-slate-200"
                                : "text-emerald-300 hover:text-emerald-200"
                    )}
                    style={{ paddingLeft: `${level * 12 + 8}px` }}
                    onClick={() => {
                        if (hasChildren) setIsOpen(!isOpen);
                        if (node.type === 'file' && node.file) onSelectFile?.(node.file);
                        if (node.type === 'function' && node.file && node.fn) onSelectFunction?.(node.file, node.fn);
                    }}
                >
                    {hasChildren ? (
                        isOpen ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />
                    ) : <div className="w-3" />}
                    {icon}
                    <span className="truncate">{label}</span>
                </div>

                {isOpen && hasChildren && (
                    <div>
                        {Object.values(node.children!)
                            .sort((a, b) => {
                                const aFolder = a.type === 'folder';
                                const bFolder = b.type === 'folder';
                                if (aFolder && !bFolder) return -1;
                                if (!aFolder && bFolder) return 1;
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
                {Object.values(tree.children || {}).map((node, idx) => (
                    <TreeNode key={idx} node={node} />
                ))}
            </div>
        </div>
    );
}
