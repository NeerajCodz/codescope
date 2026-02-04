'use client';

import React, { useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileNode, FunctionDef, VariableDef } from '@/types';
import { ChevronDown, Code, GitBranch, Layers } from 'lucide-react';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { FunctionDetailsModal } from './function-details-modal';
import { VariableDetailsModal } from './variable-details-modal';
import { Button } from '@/components/ui/button';

interface NodeDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file: FileNode | null;
    connections?: { imports: number; exports: number };
}

export function NodeDetailsModal({ open, onOpenChange, file, connections }: NodeDetailsModalProps) {
    const { data } = useAnalysisStore();
    const [selectedFunction, setSelectedFunction] = useState<FunctionDef | null>(null);
    const [selectedVariable, setSelectedVariable] = useState<VariableDef | null>(null);
    const [functionModalOpen, setFunctionModalOpen] = useState(false);
    const [variableModalOpen, setVariableModalOpen] = useState(false);
    const [openFunction, setOpenFunction] = useState<string | null>(null);
    const [openVariable, setOpenVariable] = useState<string | null>(null);
    const filePath = file?.path ?? '';

    const computedConnections = useMemo(() => {
        if (!data || !filePath) return { imports: 0, exports: 0 };
        const importsCount = data.connections.filter(c => c.target === filePath).length;
        const exportsCount = data.connections.filter(c => c.source === filePath).length;
        return { imports: importsCount, exports: exportsCount };
    }, [data, filePath]);

    const resolvedConnections = data ? computedConnections : (connections || { imports: 0, exports: 0 });

    const getSnippet = (filePath: string, lineNumber: number) => {
        const targetFile = data?.files.find((f) => f.path === filePath);
        if (!targetFile?.content) return null;
        const lines = targetFile.content.split('\n');
        const idx = Math.max(0, Math.min(lines.length - 1, lineNumber - 1));
        const line = lines[idx] ?? '';
        return {
            lineNumber,
            line: line.trim() || line,
        };
    };

    if (!file) return null;

    const complexityColor = 
        file.complexity?.level === 'high' ? 'bg-red-500' :
        file.complexity?.level === 'medium' ? 'bg-orange-500' : 'bg-green-500';

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Code className="w-5 h-5" />
                            {file.name}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-125 pr-4">
                        <div className="space-y-6">
                        {/* File Info */}
                        <div>
                            <h3 className="text-sm font-semibold mb-2 text-primary">File Information</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Path:</span>
                                    <p className="text-foreground break-all">{file.path}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Size:</span>
                                    <p className="text-foreground">{file.size} bytes</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Lines:</span>
                                    <p className="text-foreground">{file.lines ?? 0}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Type:</span>
                                    <p className="text-foreground">{file.isCode ? 'Code' : 'Asset'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Complexity */}
                        {file.complexity && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-primary flex items-center gap-2">
                                    <Layers className="w-4 h-4" />
                                    Complexity
                                </h3>
                                <div className="flex items-center gap-3">
                                    <Badge className={`${complexityColor} text-white`}>
                                        {file.complexity.level?.toUpperCase()}
                                    </Badge>
                                    <span className="text-foreground/80">Score: {file.complexity.score}</span>
                                </div>
                            </div>
                        )}

                        {/* Functions */}
                        {file.functions && file.functions.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-primary flex items-center gap-2">
                                    <Code className="w-4 h-4" />
                                    Functions ({file.functions.length})
                                </h3>
                                <div className="space-y-2">
                                    {file.functions.map((fn, idx) => (
                                        <div key={idx} className="rounded border border-border/50 bg-card/60 px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => setOpenFunction(openFunction === fn.name ? null : fn.name)}
                                                className="flex w-full items-start justify-between gap-4 text-left"
                                            >
                                                <div>
                                                    <p className="font-mono text-sm text-primary">
                                                        {fn.name}({(fn.params || []).join(', ')})
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Line {fn.line} · Returns {fn.returnType || (fn.returnsValue ? 'value' : 'void')}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {fn.totalCalls || 0} calls
                                                    </Badge>
                                                    <ChevronDown className={openFunction === fn.name ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'} />
                                                </div>
                                            </button>
                                            {openFunction === fn.name && (
                                                <div className="mt-2 space-y-2">
                                                    {(fn.callSites || []).length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">No call sites recorded.</p>
                                                    ) : (
                                                        (fn.callSites || []).slice(0, 12).map((site, index) => {
                                                            const snippet = site.file ? getSnippet(site.file, site.line) : null;
                                                            return (
                                                                <div key={`${fn.name}-site-${index}`} className="rounded border border-border/40 bg-card/40 p-2">
                                                                    <div className="text-[10px] text-muted-foreground">
                                                                        Line {site.line} · {site.file || file.path}
                                                                    </div>
                                                                    <pre className="mt-1 whitespace-pre-wrap wrap-break-word rounded bg-background/50 p-2 font-mono text-[11px] text-foreground">
                                                                        {snippet?.line || 'Snippet unavailable'}
                                                                    </pre>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs"
                                                        onClick={() => {
                                                            setSelectedFunction(fn);
                                                            setFunctionModalOpen(true);
                                                        }}
                                                    >
                                                        Open function details
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {file.variables && file.variables.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-primary flex items-center gap-2">
                                    <Code className="w-4 h-4" />
                                    Variables ({file.variables.length})
                                </h3>
                                <div className="space-y-2">
                                    {file.variables.map((variable, idx) => (
                                        <div key={idx} className="rounded border border-border/50 bg-card/60 px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => setOpenVariable(openVariable === variable.name ? null : variable.name)}
                                                className="flex w-full items-start justify-between gap-4 text-left"
                                            >
                                                <div>
                                                    <p className="font-mono text-sm text-emerald-400">{variable.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Line {variable.line} · {variable.kind}{variable.valueType ? ` · ${variable.valueType}` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {variable.totalUsages || 0} uses
                                                    </Badge>
                                                    <ChevronDown className={openVariable === variable.name ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'} />
                                                </div>
                                            </button>
                                            {openVariable === variable.name && (
                                                <div className="mt-2 space-y-2">
                                                    {(variable.usageLines || []).length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">No usage lines recorded.</p>
                                                    ) : (
                                                        (variable.usageLines || []).slice(0, 12).map((lineNumber, index) => {
                                                            const snippet = getSnippet(file.path, lineNumber);
                                                            return (
                                                                <div key={`${variable.name}-usage-${index}`} className="rounded border border-border/40 bg-card/40 p-2">
                                                                    <div className="text-[10px] text-muted-foreground">Line {lineNumber}</div>
                                                                    <pre className="mt-1 whitespace-pre-wrap wrap-break-word rounded bg-background/50 p-2 font-mono text-[11px] text-foreground">
                                                                        {snippet?.line || 'Snippet unavailable'}
                                                                    </pre>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs"
                                                        onClick={() => {
                                                            setSelectedVariable(variable);
                                                            setVariableModalOpen(true);
                                                        }}
                                                    >
                                                        Open variable details
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dependencies */}
                        {resolvedConnections && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-primary flex items-center gap-2">
                                    <GitBranch className="w-4 h-4" />
                                    Dependencies
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-card/60 rounded p-3 border border-border/50">
                                        <p className="text-xs text-muted-foreground">Imports</p>
                                        <p className="text-2xl font-bold text-primary">{resolvedConnections.imports}</p>
                                    </div>
                                    <div className="bg-card/60 rounded p-3 border border-border/50">
                                        <p className="text-xs text-muted-foreground">Exports</p>
                                        <p className="text-2xl font-bold text-blue-400">{resolvedConnections.exports}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
            
            <FunctionDetailsModal
                open={functionModalOpen}
                onOpenChange={setFunctionModalOpen}
                fn={selectedFunction}
            />
            <VariableDetailsModal
                open={variableModalOpen}
                onOpenChange={setVariableModalOpen}
                variable={selectedVariable}
            />
        </>
    );
}
