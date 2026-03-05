'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import {
  generateSurrealGraphDiagram,
  getFallbackMermaidDiagram,
  getMermaidConfig,
  sanitizeMermaidCode,
} from '@/lib/analysis/mermaidGenerator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scrollArea';
import {
  AlertCircle, Copy, Download, Loader2, RefreshCw,
  ZoomIn, ZoomOut, Maximize2, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/*  Mermaid SVG renderer with zoom/pan  */

function MermaidGraphRenderer({ code }: { code: string }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // zoom / pan state
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize(getMermaidConfig('dark'));
        const firstPass = sanitizeMermaidCode(code);
        const { svg: rendered } = await mermaid.render(
          `graph-${Date.now()}`,
          firstPass,
        );
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (primaryErr) {
        try {
          const mermaid = (await import('mermaid')).default;
          mermaid.initialize(getMermaidConfig('dark'));
          const fallback = getFallbackMermaidDiagram('Graph Mermaid Fallback');
          const { svg: fb } = await mermaid.render(
            `graph-fallback-${Date.now()}`,
            fallback,
          );
          if (!cancelled) {
            setSvg(fb);
            setError(
              primaryErr instanceof Error
                ? primaryErr.message
                : 'Mermaid render failed',
            );
          }
        } catch (err) {
          if (!cancelled) {
            setSvg('');
            setError(
              err instanceof Error ? err.message : 'Mermaid render failed',
            );
          }
        }
      }
    }

    if (code.trim()) run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Reset view when new SVG arrives
  useEffect(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, [svg]);

  // Mouse-wheel zoom
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.12 : 0.88;
      setScale((s) => Math.min(Math.max(s * delta, 0.1), 8));
    },
    [],
  );

  // Drag-to-pan
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const fitView = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  if (!svg && !error) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {error && (
        <div className="px-4 py-2 text-xs text-amber-300 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5" />
          Mermaid syntax auto-recovered: {error}
        </div>
      )}

      {/* Zoom/pan toolbar */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-0.5 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg overflow-hidden shadow-lg">
        {[
          { icon: ZoomIn, title: 'Zoom in', action: () => setScale((s) => Math.min(s * 1.3, 8)) },
          { icon: ZoomOut, title: 'Zoom out', action: () => setScale((s) => Math.max(s * 0.7, 0.1)) },
          { icon: Maximize2, title: 'Fit view', action: fitView },
          { icon: RotateCcw, title: 'Reset', action: () => { setScale(1); setPos({ x: 0, y: 0 }); } },
        ].map(({ icon: Icon, title, action }, i, arr) => (
          <div key={title}>
            <button
              onClick={action}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
              title={title}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
            {i < arr.length - 1 && <div className="h-px bg-slate-700/50" />}
          </div>
        ))}
      </div>

      {/* Canvas hint */}
      <div className="absolute bottom-3 right-3 z-20 text-[10px] text-slate-600 bg-slate-900/70 backdrop-blur px-2 py-1 rounded border border-slate-700/30">
        Scroll to zoom &middot; Drag to pan
      </div>

      {/* Zoomable SVG canvas */}
      <div
        ref={wrapRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          ref={containerRef}
          className="origin-top-left [&_svg]:max-w-none [&_svg]:h-auto select-none"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: dragging.current ? 'none' : 'transform 0.1s ease-out',
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}

/*  Root Graph View (Mermaid full-project diagram)  */

export function GraphView() {
  const { data, addDiagram } = useAnalysisStore();
  const [code, setCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    if (!data) return;
    setGenerating(true);
    try {
      const mermaidCode = generateSurrealGraphDiagram(data, { maxNodes: 100 });
      setCode(mermaidCode);
      addDiagram({
        type: 'graph',
        mermaidCode,
        title: 'Surreal Graph',
        description: 'Graph generated from code graph, issues and notes',
        generatedAt: Date.now(),
      });
    } finally {
      setGenerating(false);
    }
  }, [data, addDiagram]);

  useEffect(() => {
    if (data && !code) generate();
  }, [data, code, generate]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  const handleDownloadSvg = useCallback(() => {
    const svgEl = document.querySelector('.graph-view svg');
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'codescope-graph.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Analyze a repository first
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-border bg-card/40 flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Root</h2>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[9px]">
                {data.files.filter((f) => f.isCode).length} Files
              </Badge>
              <Badge variant="secondary" className="text-[9px]">
                {data.connections.length} Edges
              </Badge>
              {(data.issues?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[9px]">
                  {(data.issues?.length ?? 0) + (data.securityIssues?.length ?? 0)} Notes
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px] gap-1"
              onClick={generate}
              disabled={generating}
            >
              <RefreshCw className={cn('w-3 h-3', generating && 'animate-spin')} />
              Regenerate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1"
              onClick={handleCopy}
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Done' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1"
              onClick={handleDownloadSvg}
            >
              <Download className="w-3 h-3" /> SVG
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <pre className="p-3 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
            {code}
          </pre>
        </ScrollArea>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden graph-view">
        <MermaidGraphRenderer code={code} />
      </div>
    </div>
  );
}
