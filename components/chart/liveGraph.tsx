'use client';

import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeProps,
  MarkerType,
  ReactFlowProvider,
  BackgroundVariant,
} from 'reactflow';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Database, Loader2, RefreshCw, AlertCircle, CheckCircle2, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Layer palette ─────────────────────────────────────────────────

const LAYER_COLORS: Record<string, string> = {
  api:        '#3b82f6',
  ui:         '#8b5cf6',
  components: '#8b5cf6',
  lib:        '#22c55e',
  utils:      '#f59e0b',
  config:     '#64748b',
  test:       '#ec4899',
  tests:      '#ec4899',
  hooks:      '#06b6d4',
  store:      '#f97316',
  types:      '#84cc16',
  pages:      '#a78bfa',
  app:        '#a78bfa',
  default:    '#94a3b8',
};

function getLayerColor(layer: string | null | undefined): string {
  if (!layer) return LAYER_COLORS.default;
  return LAYER_COLORS[layer.toLowerCase()] ?? LAYER_COLORS.default;
}

function guessLayer(path: string): string {
  const lower = path.toLowerCase();
  for (const key of Object.keys(LAYER_COLORS)) {
    if (lower.includes(`/${key}/`) || lower.startsWith(`${key}/`)) return key;
  }
  const first = lower.split('/')[0] ?? '';
  return LAYER_COLORS[first] ? first : 'default';
}

// ─── Custom node ───────────────────────────────────────────────────

interface FileNodeData {
  label: string;
  fullPath: string;
  layer: string;
  connectionCount: number;
  isExported?: boolean;
  complexity?: number;
}

function FileNodeComponent({ data, selected }: NodeProps<FileNodeData>) {
  const color = getLayerColor(data.layer);
  const cx = data.complexity ?? 0;
  const cxColor = cx > 30 ? '#ef4444' : cx > 15 ? '#f59e0b' : '#22c55e';

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg text-center min-w-30 max-w-55 transition-all',
        selected ? 'scale-110' : '',
      )}
      style={{
        border: `2px solid ${selected ? color : `${color}55`}`,
        backgroundColor: `${color}${selected ? '25' : '12'}`,
        boxShadow: selected ? `0 0 0 3px ${color}30` : undefined,
      }}
    >
      <div className="text-[11px] font-semibold truncate leading-tight" style={{ color }}>
        {data.label}
      </div>
      <div className="flex items-center justify-center gap-2 mt-0.5">
        <span className="text-[9px] text-slate-400">{data.connectionCount}↔</span>
        {cx > 0 && (
          <span className="text-[9px] font-mono" style={{ color: cxColor }}>cx{cx}</span>
        )}
      </div>
      {data.isExported && (
        <div
          className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-green-400"
          title="Exported"
        />
      )}
    </div>
  );
}

const NODE_TYPES = { file: FileNodeComponent };

// ─── Types ─────────────────────────────────────────────────────────

interface RawNode {
  id: string;
  label: string;
  layer: string;
  connectionCount: number;
  isExported?: boolean;
  complexity?: number;
  fullPath?: string;
}

interface RawEdge {
  source: string;
  target: string;
  label?: string;
  weight: number;
}

// ─── D3 force layout (async – doesn't block render) ────────────────

async function applyForceLayout(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
): Promise<{ nodes: RFNode<FileNodeData>[]; edges: RFEdge[] }> {
  const {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceCenter,
    forceCollide,
  } = await import('d3');

  const validEdges = rawEdges.filter(
    e => e.source !== e.target &&
    rawNodes.some(n => n.id === e.source) &&
    rawNodes.some(n => n.id === e.target)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simNodes: any[] = rawNodes.map(n => ({
    ...n,
    x: (Math.random() - 0.5) * 1600,
    y: (Math.random() - 0.5) * 1200,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simLinks: any[] = validEdges.map(e => ({ source: e.source, target: e.target }));

  const sim = forceSimulation(simNodes)
    .force(
      'link',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      forceLink(simLinks).id((d: any) => d.id).distance(200).strength(0.4),
    )
    .force('charge', forceManyBody().strength(-450))
    .force('center', forceCenter(0, 0))
    .force('collision', forceCollide(80));

  for (let i = 0; i < 300; i++) sim.tick();
  sim.stop();

  const rfNodes: RFNode<FileNodeData>[] = simNodes.map(n => ({
    id: n.id,
    type: 'file',
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    data: {
      label: n.label,
      fullPath: n.fullPath ?? n.id,
      layer: n.layer,
      connectionCount: n.connectionCount,
      isExported: n.isExported,
      complexity: n.complexity,
    },
  }));

  const rfEdges: RFEdge[] = validEdges.map((e, i) => {
    const w = Math.max(1, Math.min(e.weight, 6));
    const isStrong = e.weight >= 4;
    const sourceLayer = rawNodes.find(n => n.id === e.source)?.layer;
    const edgeColor = sourceLayer ? `${getLayerColor(sourceLayer)}88` : '#47556988';
    return {
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: edgeColor },
      animated: isStrong,
      style: {
        strokeWidth: w,
        stroke: edgeColor,
        opacity: isStrong ? 0.7 : 0.4,
        strokeDasharray: e.weight === 1 ? '5 5' : undefined,
      },
      label: e.label && e.weight > 2 ? `${e.label} ×${e.weight}` : e.weight > 3 ? `×${e.weight}` : undefined,
      labelStyle: { fill: '#94a3b8', fontSize: 9, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
      labelBgPadding: [4, 2] as [number, number],
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}

// ─── Load from SurrealDB ────────────────────────────────────────────

interface SurrealLoadResult {
  nodes: RawNode[];
  edges: RawEdge[];
}

async function loadFromSurreal(repo: string): Promise<SurrealLoadResult | null> {
  try {
    const cleanRepo = repo.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/\/$/, '');
    const res = await fetch('/api/graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load', repo: cleanRepo }),
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      found: boolean;
      data?: {
        nodes: Array<{ node_id: string; label: string; node_type: string; layer: string | null; is_exported: boolean; complexity?: number | null }>;
        edges: Array<{ source: string; target: string; fn_name: string; edge_count: number }>;
      };
    };
    if (!json.found || !json.data?.nodes?.length) return null;

    const connCount = new Map<string, number>();
    for (const e of json.data.edges) {
      connCount.set(e.source, (connCount.get(e.source) ?? 0) + 1);
      connCount.set(e.target, (connCount.get(e.target) ?? 0) + 1);
    }

    const nodes: RawNode[] = json.data.nodes.map(n => ({
      id: n.node_id,
      label: n.label,
      layer: n.layer ?? 'default',
      connectionCount: connCount.get(n.node_id) ?? 0,
      isExported: n.is_exported,
      complexity: n.complexity ?? undefined,
      fullPath: n.node_id,
    }));
    const edges: RawEdge[] = json.data.edges.map(e => ({
      source: e.source,
      target: e.target,
      label: e.fn_name,
      weight: e.edge_count,
    }));
    return { nodes, edges };
  } catch {
    return null;
  }
}

// ─── Main component ────────────────────────────────────────────────

const MAX_NODES = 300;
type LoadStatus = 'loading' | 'surreal' | 'memory' | 'error' | 'empty';

function SurrealLiveGraphInner() {
  const { data, repo } = useAnalysisStore();
  const [rfNodes, setNodes, onNodesChange] = useNodesState<FileNodeData>([]);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<FileNodeData | null>(null);

  // Find connected nodes for selected node
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return { incoming: [] as string[], outgoing: [] as string[] };
    const nodeId = selectedNode.fullPath;
    const incomingSet = new Set<string>();
    const outgoingSet = new Set<string>();
    for (const e of rfEdges) {
      if (e.source === nodeId) outgoingSet.add(e.target);
      if (e.target === nodeId) incomingSet.add(e.source);
    }
    return { incoming: [...incomingSet], outgoing: [...outgoingSet] };
  }, [selectedNode, rfEdges]);

  // Graph statistics
  const graphStats = useMemo(() => {
    const layerCounts: Record<string, number> = {};
    for (const n of rfNodes) {
      const layer = (n.data as FileNodeData).layer;
      layerCounts[layer] = (layerCounts[layer] || 0) + 1;
    }
    const avgConnections = rfNodes.length > 0
      ? Math.round(rfNodes.reduce((sum, n) => sum + ((n.data as FileNodeData).connectionCount || 0), 0) / rfNodes.length)
      : 0;
    const hubNodes = rfNodes.filter(n => ((n.data as FileNodeData).connectionCount || 0) > avgConnections * 2).length;
    return { layerCounts, avgConnections, hubNodes };
  }, [rfNodes]);

  // Build from in-memory store
  const buildFromMemory = useCallback(async () => {
    if (!data?.files?.length) { setStatus('empty'); return; }

    const connCount = new Map<string, number>();
    for (const c of data.connections) {
      connCount.set(c.source, (connCount.get(c.source) ?? 0) + 1);
      connCount.set(c.target, (connCount.get(c.target) ?? 0) + 1);
    }

    const codeFiles = data.files
      .filter(f => f.isCode)
      .sort((a, b) => (connCount.get(b.path) ?? 0) - (connCount.get(a.path) ?? 0))
      .slice(0, MAX_NODES);
    const fileSet = new Set(codeFiles.map(f => f.path));

    const rawNodes: RawNode[] = codeFiles.map(f => ({
      id: f.path,
      label: f.name,
      layer: f.layer ?? guessLayer(f.path),
      connectionCount: connCount.get(f.path) ?? 0,
      complexity: f.complexity?.score,
      fullPath: f.path,
    }));

    const edgeMap = new Map<string, RawEdge>();
    for (const c of data.connections) {
      if (!fileSet.has(c.source) || !fileSet.has(c.target)) continue;
      const key = `${c.source}||${c.target}`;
      const ex = edgeMap.get(key);
      if (ex) { ex.weight += c.count; }
      else { edgeMap.set(key, { source: c.source, target: c.target, label: c.fn, weight: c.count }); }
    }

    const { nodes, edges } = await applyForceLayout(rawNodes, Array.from(edgeMap.values()));
    setNodes(nodes);
    setEdges(edges);
    setStatus('memory');
  }, [data, setNodes, setEdges]);

  // Try SurrealDB first, then in-memory
  const loadGraph = useCallback(async () => {
    setStatus('loading');
    setError(null);

    if (repo) {
      const surrealData = await loadFromSurreal(repo);
      if (surrealData?.nodes.length) {
        const capped = surrealData.nodes
          .sort((a, b) => b.connectionCount - a.connectionCount)
          .slice(0, MAX_NODES);
        const cappedIds = new Set(capped.map(n => n.id));
        const cappedEdges = surrealData.edges.filter(e => cappedIds.has(e.source) && cappedIds.has(e.target));
        const { nodes, edges } = await applyForceLayout(capped, cappedEdges);
        setNodes(nodes);
        setEdges(edges);
        setStatus('surreal');
        return;
      }
    }
    await buildFromMemory();
  }, [repo, buildFromMemory, setNodes, setEdges]);

  // Save in-memory data to SurrealDB then reload
  const syncToDb = useCallback(async () => {
    if (!data || !repo) return;
    setStatus('loading');
    try {
      const initRes = await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init' }),
      });
      if (initRes.status === 503) {
        setError('SurrealDB not reachable. Is Docker running on port 8000?');
        setStatus('error');
        return;
      }

      const cleanRepo = repo.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/\/$/, '');
      const codeFiles = data.files.filter(f => f.isCode).slice(0, MAX_NODES);
      const nodeIds = new Set(codeFiles.map(f => f.path));

      const nodes = codeFiles.map(f => ({
        id: f.path, label: f.name, file: f.path, type: 'file' as const,
        layer: f.layer ?? guessLayer(f.path),
        isExported: f.functions?.some(fn => fn.isExported) ?? false,
        complexity: f.complexity?.score,
      }));
      const edges = data.connections
        .filter(c => nodeIds.has(c.source) && nodeIds.has(c.target))
        .map(c => ({ source: c.source, target: c.target, fn: c.fn, count: c.count }));

      const saveRes = await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save', repo: cleanRepo,
          data: { stats: data.stats, nodes, edges, processes: [] },
        }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Save failed: ${saveRes.status}`);
      }
      await loadGraph();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setStatus('error');
    }
  }, [data, repo, loadGraph]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Layer legend
  const layers = useMemo(() => {
    const seen = new Set<string>();
    for (const n of rfNodes) seen.add((n.data as FileNodeData).layer);
    return Array.from(seen).filter(l => l && l !== 'default').sort();
  }, [rfNodes]);

  const statusBadge = useMemo(() => {
    if (status === 'loading') return (
      <Badge variant="outline" className="text-[10px] gap-1 text-slate-400 border-slate-600 bg-slate-900/80">
        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Computing layout...
      </Badge>
    );
    if (status === 'surreal') return (
      <Badge variant="outline" className="text-[10px] gap-1 text-green-400 border-green-500/40 bg-green-500/5">
        <CheckCircle2 className="w-2.5 h-2.5" /> SurrealDB
      </Badge>
    );
    if (status === 'memory') return (
      <Badge variant="outline" className="text-[10px] gap-1 text-amber-400 border-amber-500/40 bg-amber-500/5">
        <Database className="w-2.5 h-2.5" /> In-memory
        <button
          className="ml-1 underline text-blue-400 hover:text-blue-300 transition-colors"
          onClick={syncToDb}
        >
          Sync to DB
        </button>
      </Badge>
    );
    if (status === 'error') return (
      <Badge variant="outline" className="text-[10px] gap-1 text-red-400 border-red-500/40 bg-red-500/5">
        <AlertCircle className="w-2.5 h-2.5" /> {error ?? 'Error'}
      </Badge>
    );
    return (
      <Badge variant="outline" className="text-[10px] gap-1 text-slate-500 border-slate-700">
        <WifiOff className="w-2.5 h-2.5" /> No data
      </Badge>
    );
  }, [status, error, syncToDb]);

  return (
    <div className="relative w-full h-full bg-slate-950">

      {/* Toolbar — top-left */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 flex-wrap pointer-events-auto">
        {statusBadge}
        {rfNodes.length > 0 && (
          <Badge variant="secondary" className="text-[10px] bg-slate-800/80 border-slate-700">
            {rfNodes.length} nodes · {rfEdges.length} edges
          </Badge>
        )}
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 bg-slate-900/80 backdrop-blur border border-slate-700 hover:bg-slate-800"
          onClick={loadGraph}
          disabled={status === 'loading'}
          title="Reload graph"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', status === 'loading' && 'animate-spin')} />
        </Button>
      </div>

      {/* Layer legend — top-right */}
      {layers.length > 0 && (
        <div className="absolute top-3 right-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-lg px-3 py-2 max-h-64 overflow-y-auto pointer-events-auto">
          <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Layers</div>
          <div className="space-y-1">
            {layers.map(layer => (
              <div key={layer} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getLayerColor(layer) }} />
                {layer}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-950/80">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-9 h-9 animate-spin text-blue-400" />
            <p className="text-sm text-slate-400">Running D3 force simulation…</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {status === 'empty' && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-center space-y-3">
            <Database className="w-12 h-12 mx-auto text-slate-700" />
            <p className="text-sm text-slate-400">No graph data available</p>
            <p className="text-xs text-slate-500">Analyze a repository first</p>
          </div>
        </div>
      )}

      {/* Node details panel — bottom-right */}
      {selectedNode && (
        <div className="absolute bottom-4 right-3 z-10 bg-slate-900/96 backdrop-blur border border-slate-700 rounded-xl p-3 w-72 max-w-[320px] max-h-[60%] overflow-y-auto pointer-events-auto">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: getLayerColor(selectedNode.layer) }}>
                {selectedNode.label}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 break-all leading-relaxed">
                {selectedNode.fullPath}
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-500 hover:text-slate-300 transition-colors text-sm leading-none shrink-0 mt-0.5"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[
              { label: 'Layer', value: selectedNode.layer },
              { label: 'Connections', value: selectedNode.connectionCount },
              { label: 'Complexity', value: selectedNode.complexity ?? '—' },
            ].map(item => (
              <div key={item.label} className="bg-slate-800/80 rounded-lg p-2 text-center">
                <div className="text-[12px] font-bold text-slate-200">{item.value}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
          {/* Connected nodes */}
          {(connectedNodes.incoming.length > 0 || connectedNodes.outgoing.length > 0) && (
            <div className="space-y-1.5 border-t border-slate-800 pt-2">
              {connectedNodes.incoming.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-slate-600 mb-1">Imported by ({connectedNodes.incoming.length})</div>
                  <div className="space-y-0.5 max-h-20 overflow-y-auto">
                    {connectedNodes.incoming.slice(0, 8).map(id => (
                      <div key={id} className="text-[10px] text-blue-400 font-mono truncate">{id.split('/').pop()}</div>
                    ))}
                  </div>
                </div>
              )}
              {connectedNodes.outgoing.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-slate-600 mb-1">Imports ({connectedNodes.outgoing.length})</div>
                  <div className="space-y-0.5 max-h-20 overflow-y-auto">
                    {connectedNodes.outgoing.slice(0, 8).map(id => (
                      <div key={id} className="text-[10px] text-green-400 font-mono truncate">{id.split('/').pop()}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Graph stats — bottom-left */}
      {rfNodes.length > 0 && !selectedNode && (
        <div className="absolute bottom-4 left-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-lg px-3 py-2 pointer-events-auto">
          <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Graph Stats</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            <span className="text-slate-500">Avg connections</span>
            <span className="text-slate-300 font-mono">{graphStats.avgConnections}</span>
            <span className="text-slate-500">Hub nodes</span>
            <span className="text-slate-300 font-mono">{graphStats.hubNodes}</span>
            <span className="text-slate-500">Layers</span>
            <span className="text-slate-300 font-mono">{Object.keys(graphStats.layerCounts).length}</span>
          </div>
        </div>
      )}

      {/* ReactFlow canvas */}
      {(status === 'surreal' || status === 'memory' || status === 'error') && (
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          onNodeClick={(_, node) => setSelectedNode(node.data as FileNodeData)}
          onPaneClick={() => setSelectedNode(null)}
          fitView
          fitViewOptions={{ padding: 0.12, minZoom: 0.05, maxZoom: 1 }}
          minZoom={0.02}
          maxZoom={4}
          defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
          proOptions={{ hideAttribution: true }}
          className="bg-slate-950"
        >
          <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={28} size={1} />
          <Controls
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 8,
            }}
          />
          <MiniMap
            nodeColor={n => getLayerColor((n.data as FileNodeData)?.layer)}
            style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
            maskColor="rgba(0,0,0,0.45)"
            pannable
            zoomable
          />
        </ReactFlow>
      )}
    </div>
  );
}

export function SurrealLiveGraph() {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <SurrealLiveGraphInner />
    </ReactFlowProvider>
  );
}
