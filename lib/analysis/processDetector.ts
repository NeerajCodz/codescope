/**
 * Process Detector Engine v2
 *
 * Enhanced BFS-based process detection with:
 * - Cross-file process detection (spanning multiple modules)
 * - Intra-module process grouping (within a single file/folder)
 * - Layer-aware classification (UI → Service → Data pipelines)
 * - Proper merge/fork detection for process branching
 * - Mermaid-ready output format
 */

import { AnalysisData, ProcessNode, ProcessStep, ProcessDetectionResult } from '@/types';

// ─── Graph Types ─────────────────────────────────────────────────────

interface GraphNode {
    id: string;
    file: string;
    folder: string;
    name: string;
    inDegree: number;
    outDegree: number;
    neighbors: Set<string>;
    isExported: boolean;
    isEntryPoint: boolean;
    layer?: string;
}

// ─── Build Graph ─────────────────────────────────────────────────────

function buildGraph(data: AnalysisData): {
    nodes: Map<string, GraphNode>;
    adjacency: Map<string, Set<string>>;
    reverseAdj: Map<string, Set<string>>;
} {
    const nodes = new Map<string, GraphNode>();
    const adjacency = new Map<string, Set<string>>();
    const reverseAdj = new Map<string, Set<string>>();

    // Create nodes for each function in each file
    for (const file of data.files) {
        const fns = file.functions || [];
        const folder = file.folder || file.path.substring(0, file.path.lastIndexOf('/'));

        for (const fn of fns) {
            const id = `${file.path}::${fn.name}`;
            nodes.set(id, {
                id,
                file: file.path,
                folder,
                name: fn.name,
                inDegree: 0,
                outDegree: 0,
                neighbors: new Set(),
                isExported: fn.isExported ?? false,
                isEntryPoint: false,
                layer: file.layer,
            });
            adjacency.set(id, new Set());
            reverseAdj.set(id, new Set());
        }
    }

    // File-level nodes for files without functions
    for (const file of data.files) {
        if (!file.functions?.length) {
            const id = file.path;
            const folder = file.folder || file.path.substring(0, file.path.lastIndexOf('/'));
            nodes.set(id, {
                id,
                file: file.path,
                folder,
                name: file.name,
                inDegree: 0,
                outDegree: 0,
                neighbors: new Set(),
                isExported: false,
                isEntryPoint: false,
                layer: file.layer,
            });
            adjacency.set(id, new Set());
            reverseAdj.set(id, new Set());
        }
    }

    // Build edges from connections
    for (const conn of data.connections) {
        const sourceNodes = findNodes(nodes, conn.source);
        const targetNodes = findNodes(nodes, conn.target);

        for (const src of sourceNodes) {
            for (const tgt of targetNodes) {
                if (src === tgt) continue;
                adjacency.get(src)?.add(tgt);
                reverseAdj.get(tgt)?.add(src);
                const srcNode = nodes.get(src);
                const tgtNode = nodes.get(tgt);
                if (srcNode) {
                    srcNode.outDegree++;
                    srcNode.neighbors.add(tgt);
                }
                if (tgtNode) tgtNode.inDegree++;
            }
        }
    }

    // Mark entry points: inDegree=0 or exported functions
    for (const [, node] of nodes) {
        if (node.inDegree === 0 || node.isExported) {
            node.isEntryPoint = true;
        }
    }

    return { nodes, adjacency, reverseAdj };
}

function findNodes(nodes: Map<string, GraphNode>, filePath: string): string[] {
    const matches: string[] = [];
    for (const [nodeId] of nodes) {
        if (nodeId.startsWith(filePath + '::') || nodeId === filePath) {
            matches.push(nodeId);
        }
    }
    return matches;
}

// ─── BFS Trace ───────────────────────────────────────────────────────

function bfsTrace(
    startId: string,
    adjacency: Map<string, Set<string>>,
    nodes: Map<string, GraphNode>,
    maxDepth = 50
): ProcessStep[] {
    const steps: ProcessStep[] = [];
    const visited = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id) || depth > maxDepth) continue;
        visited.add(id);

        const node = nodes.get(id);
        if (!node) continue;

        const isTerminal = (adjacency.get(id)?.size || 0) === 0;
        steps.push({
            id,
            label: node.name,
            file: node.file,
            depth,
            isEntry: depth === 0,
            isTerminal,
        });

        const neighbors = adjacency.get(id);
        if (neighbors) {
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push({ id: neighbor, depth: depth + 1 });
                }
            }
        }
    }

    return steps;
}

// ─── Process Classification ──────────────────────────────────────────

function detectProcessType(steps: ProcessStep[], nodes: Map<string, GraphNode>): string {
    const layers = new Set<string>();
    const folders = new Set<string>();

    for (const s of steps) {
        const n = nodes.get(s.id);
        if (n?.layer) layers.add(n.layer);
        if (n?.folder) folders.add(n.folder);
    }

    // Check for API routes
    const hasApiRoute = steps.some(s => s.file.includes('/api/') || s.file.includes('route.'));

    if (hasApiRoute) return 'api-handler';
    if (layers.has('ui') && layers.has('service')) return 'user-flow';
    if (layers.has('data') && layers.has('service')) return 'data-pipeline';
    if (layers.has('service') && !layers.has('ui')) return 'backend-process';
    if (layers.has('ui') && !layers.has('service')) return 'ui-render';
    if (layers.has('util')) return 'utility-chain';
    return 'general';
}

/**
 * Determine if a process crosses file boundaries.
 */
function isCrossFileProcess(steps: ProcessStep[]): boolean {
    const files = new Set(steps.map(s => s.file));
    return files.size > 1;
}

/**
 * Determine if a process crosses folder boundaries.
 */
function isCrossFolderProcess(steps: ProcessStep[], nodes: Map<string, GraphNode>): boolean {
    const folders = new Set<string>();
    for (const s of steps) {
        const n = nodes.get(s.id);
        if (n?.folder) folders.add(n.folder);
    }
    return folders.size > 1;
}

// ─── Clustering ──────────────────────────────────────────────────────

function clusterProcesses(processes: ProcessNode[]): ProcessNode[] {
    const clusters: ProcessNode[][] = [];

    for (const proc of processes) {
        const traceSet = new Set(proc.trace);
        let merged = false;

        for (const cluster of clusters) {
            const clusterTraces = new Set(cluster.flatMap(p => p.trace));
            const overlap = [...traceSet].filter(t => clusterTraces.has(t)).length;
            const overlapRatio = overlap / traceSet.size;

            if (overlapRatio > 0.5) {
                cluster.push(proc);
                merged = true;
                break;
            }
        }

        if (!merged) {
            clusters.push([proc]);
        }
    }

    return processes.map(proc => {
        const clusterIdx = clusters.findIndex(c => c.includes(proc));
        return { ...proc, clusters: [clusterIdx] };
    });
}

// ─── Main Detection ──────────────────────────────────────────────────

export function detectProcesses(data: AnalysisData): ProcessDetectionResult {
    const { nodes, adjacency } = buildGraph(data);

    // Find entry points
    const entryPoints = [...nodes.values()].filter(n => n.isEntryPoint);

    // Trace from each entry point
    const rawProcesses: ProcessNode[] = [];

    for (const entry of entryPoints) {
        const steps = bfsTrace(entry.id, adjacency, nodes);
        if (steps.length < 2) continue;

        const terminals = steps.filter(s => s.isTerminal);
        const traceFiles = [...new Set(steps.map(s => s.file))];
        const crossFile = isCrossFileProcess(steps);
        const crossFolder = isCrossFolderProcess(steps, nodes);

        rawProcesses.push({
            id: entry.id,
            label: entry.name,
            entryPoint: entry.id,
            terminal: terminals.map(t => t.id),
            processType: detectProcessType(steps, nodes),
            stepCount: steps.length,
            clusters: [],
            trace: steps.map(s => s.id),
            traceFiles,
            isCrossFile: crossFile,
            isCrossFolder: crossFolder,
        });
    }

    // Sort by step count descending
    rawProcesses.sort((a, b) => b.stepCount - a.stepCount);

    const processes = clusterProcesses(rawProcesses);

    // Compute cross/intra stats
    const crossFileCount = processes.filter(p => p.isCrossFile).length;
    const intraFileCount = processes.filter(p => !p.isCrossFile).length;

    return {
        processes,
        totalEntryPoints: entryPoints.length,
        totalTerminals: [...nodes.values()].filter(n => (adjacency.get(n.id)?.size || 0) === 0).length,
        avgChainLength: processes.length > 0
            ? Math.round(processes.reduce((sum, p) => sum + p.stepCount, 0) / processes.length)
            : 0,
        crossFileCount,
        intraFileCount,
    };
}

// ─── Mermaid Diagram Generation ──────────────────────────────────────

export function processToMermaid(process: ProcessNode, data: AnalysisData): string {
    const { nodes, adjacency } = buildGraph(data);
    const steps = bfsTrace(process.entryPoint, adjacency, nodes, 20);

    const lines: string[] = ['graph TD'];
    const nodeIds = new Map<string, string>();
    let counter = 0;

    const sanitizeLabel = (value: string): string => {
        const cleaned = value
            .replace(/[\r\n]+/g, ' ')
            .replace(/[\[\]{}<>]/g, ' ')
            .replace(/"/g, "'")
            .replace(/\|/g, '/')
            .trim();
        return cleaned || 'node';
    };

    // Group steps by file for subgraph support
    const fileGroups = new Map<string, ProcessStep[]>();
    for (const step of steps) {
        const existing = fileGroups.get(step.file) || [];
        existing.push(step);
        fileGroups.set(step.file, existing);
    }

    const isCrossFile = fileGroups.size > 1;

    // If cross-file, use subgraphs
    if (isCrossFile) {
        for (const [file, fileSteps] of fileGroups) {
            const shortFile = sanitizeLabel(file.split('/').pop() || file);
            const subId = `sub_${counter++}`;
            lines.push(`    subgraph ${subId}["${shortFile}"]`);

            for (const step of fileSteps) {
                const safeId = `N${counter++}`;
                nodeIds.set(step.id, safeId);
                const label = sanitizeLabel(step.label);

                if (step.isEntry) {
                    lines.push(`        ${safeId}[["${label}"]]`);
                } else if (step.isTerminal) {
                    lines.push(`        ${safeId}(("${label}"))`);
                } else {
                    lines.push(`        ${safeId}["${label}"]`);
                }
            }

            lines.push('    end');
        }
    } else {
        for (const step of steps) {
            const safeId = `N${counter++}`;
            nodeIds.set(step.id, safeId);
            const label = sanitizeLabel(step.label);

            if (step.isEntry) {
                lines.push(`    ${safeId}[["${label}"]]`);
            } else if (step.isTerminal) {
                lines.push(`    ${safeId}(("${label}"))`);
            } else {
                lines.push(`    ${safeId}["${label}"]`);
            }
        }
    }

    // Add edges
    for (const step of steps) {
        const neighbors = adjacency.get(step.id);
        if (!neighbors) continue;
        const srcId = nodeIds.get(step.id);
        if (!srcId) continue;

        for (const neighbor of neighbors) {
            const tgtId = nodeIds.get(neighbor);
            if (tgtId) {
                lines.push(`    ${srcId} --> ${tgtId}`);
            }
        }
    }

    // Style entry and terminal nodes
    const entryIds = steps.filter(s => s.isEntry).map(s => nodeIds.get(s.id)).filter(Boolean);
    const terminalIds = steps.filter(s => s.isTerminal).map(s => nodeIds.get(s.id)).filter(Boolean);

    if (entryIds.length) lines.push(`    style ${entryIds.join(',')} fill:#3b82f6,color:#fff`);
    if (terminalIds.length) lines.push(`    style ${terminalIds.join(',')} fill:#22c55e,color:#fff`);

    return lines.join('\n');
}
