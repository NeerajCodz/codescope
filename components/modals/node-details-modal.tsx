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
import { Code, GitBranch, Layers } from 'lucide-react';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { FunctionDetailsModal } from './function-details-modal';
import { VariableDetailsModal } from './variable-details-modal';

interface NodeDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file: FileNode | null;
    connections?: { imports: number; exports: number };
}

export function NodeDetailsModal({ open, onOpenChange, file, connections }: NodeDetailsModalProps) {
    if (!file) return null;

    const { data } = useAnalysisStore();
    const [selectedFunction, setSelectedFunction] = useState<FunctionDef | null>(null);
    const [selectedVariable, setSelectedVariable] = useState<VariableDef | null>(null);
    const [functionModalOpen, setFunctionModalOpen] = useState(false);
    const [variableModalOpen, setVariableModalOpen] = useState(false);

    const computedConnections = useMemo(() => {
        if (!data) return { imports: 0, exports: 0 };
        const importsCount = data.connections.filter(c => c.target === file.path).length;
        const exportsCount = data.connections.filter(c => c.source === file.path).length;
        return { imports: importsCount, exports: exportsCount };
    }, [data, file.path]);

    const resolvedConnections = data ? computedConnections : (connections || { imports: 0, exports: 0 });

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
                    
                    <ScrollArea className="max-h-[500px] pr-4">
                        <div className="space-y-6">
                        {/* File Info */}
                        <div>
                            <h3 className="text-sm font-semibold mb-2 text-cyan-400">File Information</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-gray-400">Path:</span>
                                    <p className="text-gray-200 break-all">{file.path}</p>
                                </div>
                                <div>
                                    <span className="text-gray-400">Size:</span>
                                    <p className="text-gray-200">{file.size} bytes</p>
                                </div>
                                <div>
                                    <span className="text-gray-400">Lines:</span>
                                    <p className="text-gray-200">{file.lines ?? 0}</p>
                                </div>
                                <div>
                                    <span className="text-gray-400">Type:</span>
                                    <p className="text-gray-200">{file.isCode ? 'Code' : 'Asset'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Complexity */}
                        {file.complexity && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-cyan-400 flex items-center gap-2">
                                    <Layers className="w-4 h-4" />
                                    Complexity
                                </h3>
                                <div className="flex items-center gap-3">
                                    <Badge className={`${complexityColor} text-white`}>
                                        {file.complexity.level?.toUpperCase()}
                                    </Badge>
                                    <span className="text-gray-300">Score: {file.complexity.score}</span>
                                </div>
                            </div>
                        )}

                        {/* Functions */}
                        {file.functions && file.functions.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-cyan-400 flex items-center gap-2">
                                    <Code className="w-4 h-4" />
                                    Functions ({file.functions.length})
                                </h3>
                                <div className="space-y-2">
                                    {file.functions.map((fn, idx) => (
                                        <button
                                            key={idx}
                                            className="w-full text-left bg-slate-800 rounded p-3 border border-slate-700 hover:border-cyan-500/40 hover:bg-slate-800/70 transition"
                                            onClick={() => {
                                                setSelectedFunction(fn);
                                                setFunctionModalOpen(true);
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-mono text-sm text-cyan-300">
                                                        {fn.name}({(fn.params || []).join(', ')})
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Line {fn.line} · Returns {fn.returnType || (fn.returnsValue ? 'value' : 'void')}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {fn.totalCalls || 0} calls
                                                </Badge>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {file.variables && file.variables.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-cyan-400 flex items-center gap-2">
                                    <Code className="w-4 h-4" />
                                    Variables ({file.variables.length})
                                </h3>
                                <div className="space-y-2">
                                    {file.variables.map((variable, idx) => (
                                        <button
                                            key={idx}
                                            className="w-full text-left bg-slate-800 rounded p-3 border border-slate-700 hover:border-cyan-500/40 hover:bg-slate-800/70 transition"
                                            onClick={() => {
                                                setSelectedVariable(variable);
                                                setVariableModalOpen(true);
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-mono text-sm text-emerald-300">{variable.name}</p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Line {variable.line} · {variable.kind}{variable.valueType ? ` · ${variable.valueType}` : ''}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {variable.totalUsages || 0} uses
                                                </Badge>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dependencies */}
                        {resolvedConnections && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 text-cyan-400 flex items-center gap-2">
                                    <GitBranch className="w-4 h-4" />
                                    Dependencies
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-800 rounded p-3 border border-slate-700">
                                        <p className="text-xs text-gray-400">Imports</p>
                                        <p className="text-2xl font-bold text-cyan-400">{resolvedConnections.imports}</p>
                                    </div>
                                    <div className="bg-slate-800 rounded p-3 border border-slate-700">
                                        <p className="text-xs text-gray-400">Exports</p>
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
