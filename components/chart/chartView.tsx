'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { AIClient } from '@/lib/ai/client';
import { DIAGRAM_SYSTEM_PROMPT, DIAGRAM_TYPES } from '@/lib/ai/prompts';
import { buildRepoContext } from '@/lib/ai/contextBuilder';
import { getFallbackMermaidDiagram, sanitizeMermaidCode } from '@/lib/analysis/mermaidGenerator';
import { GeneratedDiagram } from '@/types/ai';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scrollArea';
import { cn } from '@/lib/utils';
import {
  Sparkles, Download, Copy, Check, RefreshCw, Loader2,
  AlertCircle, Code2, Maximize2, Minimize2, Trash2, Clock,
  Building2, RefreshCcw, Workflow, Layers, GitFork, Database, Rocket,
  ZoomIn, ZoomOut, RotateCcw,
  type LucideIcon,
} from 'lucide-react';

/* ---------- Icon map for diagram types ---------- */
const DIAGRAM_ICON_MAP: Record<string, LucideIcon> = {
  'building-2': Building2,
  'refresh-ccw': RefreshCcw,
  'workflow': Workflow,
  'layers': Layers,
  'git-fork': GitFork,
  'database': Database,
  'rocket': Rocket,
};

function DiagramIcon({ name, className }: { name: string; className?: string }) {
  const Icon = DIAGRAM_ICON_MAP[name] || Sparkles;
  return <Icon className={className} />;
}

/* ---------- Mermaid Renderer ---------- */
function MermaidRenderer({ code, id }: { code: string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Zoom / pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const translateRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const zoomIn = useCallback(() => setScale(s => Math.min(+(s + 0.25).toFixed(2), 5)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(+(s - 0.25).toFixed(2), 0.1)), []);
  const zoomReset = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    translateRef.current = { x: 0, y: 0 };
  }, []);

  // Keyboard shortcuts (Ctrl+= zoom in, Ctrl+- zoom out, Ctrl+0 reset)
  useEffect(() => {
    if (!svg) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-') { e.preventDefault(); zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); zoomReset(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [svg, zoomIn, zoomOut, zoomReset]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - translateRef.current.x, y: e.clientY - translateRef.current.y };
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const next = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y };
    translateRef.current = next;
    setTranslate(next);
  }, []);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          maxEdges: 10000,
          themeVariables: {
            darkMode: true,
            background: '#0f172a',
            primaryColor: '#3b82f6',
            primaryTextColor: '#e2e8f0',
            primaryBorderColor: '#1e40af',
            secondaryColor: '#1e293b',
            tertiaryColor: '#334155',
            lineColor: '#64748b',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
          },
          securityLevel: 'loose',
          flowchart: { curve: 'basis', padding: 15 },
        });

        const uniqueId = `mermaid-${id}-${Date.now()}`;
        const { svg: rendered } = await mermaid.render(uniqueId, sanitizeMermaidCode(code));
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        try {
          const mermaid = (await import('mermaid')).default;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            maxEdges: 10000,
            securityLevel: 'loose',
          });
          const { svg: recovered } = await mermaid.render(
            `mermaid-fallback-${id}-${Date.now()}`,
            getFallbackMermaidDiagram('AI Mermaid Fallback')
          );
          if (!cancelled) {
            setSvg(recovered);
            setError(err instanceof Error ? err.message : 'Failed to render diagram');
          }
        } catch (fallbackErr) {
          if (!cancelled) {
            setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to render diagram');
            setSvg('');
          }
        }
      }
    }

    if (code.trim()) render();
    return () => { cancelled = true; };
  }, [code, id]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-300">Render Error</p>
        <p className="text-xs text-muted-foreground max-w-md">{error}</p>
        <pre className="text-[10px] text-muted-foreground mt-2 max-h-32 overflow-auto bg-background/50 rounded p-2 max-w-full break-all whitespace-pre-wrap">
          {code}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 bg-background/80 backdrop-blur-sm border border-border/50"
          onClick={zoomIn} title="Zoom in (Ctrl+=)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 bg-background/80 backdrop-blur-sm border border-border/50"
          onClick={zoomOut} title="Zoom out (Ctrl+-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          className="h-7 px-2 text-[10px] font-mono bg-background/80 backdrop-blur-sm border border-border/50"
          onClick={zoomReset} title="Reset zoom (Ctrl+0)"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          {Math.round(scale * 100)}%
        </Button>
      </div>

      {/* Diagram (transformed layer) */}
      <div
        className="w-full h-full flex items-center justify-center p-4 [&_svg]:max-w-none [&_svg]:h-auto"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

/* ---------- Main ChartView ---------- */
export function ChartView({ mode = 'all' }: { mode?: 'all' | 'ai' }) {
  const { data, aiSettings, diagrams, addDiagram, setDiagrams } = useAnalysisStore();
  const availableTypes = DIAGRAM_TYPES.filter((type) => (mode === 'ai' ? !('local' in type && type.local) : true));
  const [selectedType, setSelectedType] = useState(availableTypes[0]?.id || DIAGRAM_TYPES[0].id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeDiagram, setActiveDiagram] = useState<GeneratedDiagram | null>(null);

  // Find current diagram
  const currentDiagram = activeDiagram || diagrams.find(d => d.type === selectedType) || null;

  useEffect(() => {
    if (!availableTypes.some((type) => type.id === selectedType)) {
      setSelectedType(availableTypes[0]?.id || DIAGRAM_TYPES[0].id);
    }
  }, [availableTypes, selectedType]);

  const selectedDiagramType = availableTypes.find(t => t.id === selectedType);
  const isLocalType = selectedDiagramType && 'local' in selectedDiagramType && (selectedDiagramType as Record<string, unknown>).local;
  const needsApiKey = !isLocalType && !aiSettings.apiKey && aiSettings.provider !== 'ollama';

  const handleGenerate = useCallback(async () => {
    const diagramType = availableTypes.find(t => t.id === selectedType)!;
    const isLocal = 'local' in diagramType && diagramType.local;

    if (!data) {
      setError('No analysis data available.');
      return;
    }

    if (isLocal) {
      setError('This diagram type is available in Graph tab.');
      return;
    }

    const needsKey = aiSettings.provider !== 'ollama';
    if (needsKey && !aiSettings.apiKey) {
      setError('Configure your AI API key in Settings first.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const client = new AIClient(aiSettings);
      const repoContext = buildRepoContext(data, 6000);

      const userPrompt = `${diagramType.prompt}\n\n## Repository Context:\n${repoContext}`;
      const mermaidCode = await client.generateMermaid(DIAGRAM_SYSTEM_PROMPT, userPrompt);

      const diagram: GeneratedDiagram = {
        type: selectedType,
        mermaidCode,
        title: diagramType.label,
        description: diagramType.description,
        generatedAt: Date.now(),
      };

      addDiagram(diagram);
      setActiveDiagram(diagram);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate diagram');
    } finally {
      setGenerating(false);
    }
  }, [data, aiSettings, selectedType, addDiagram]);

  const handleCopy = useCallback(() => {
    if (!currentDiagram) return;
    navigator.clipboard.writeText(currentDiagram.mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentDiagram]);

  const handleDownloadSVG = useCallback(() => {
    const svgEl = document.querySelector('.mermaid-display svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDiagram?.type || 'diagram'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentDiagram]);

  const handleDelete = useCallback((type: string) => {
    setDiagrams(diagrams.filter(d => d.type !== type));
    if (activeDiagram?.type === type) setActiveDiagram(null);
  }, [diagrams, setDiagrams, activeDiagram]);

  return (
    <div className={cn(
      'flex h-full',
      fullscreen && 'fixed inset-0 z-100 bg-background'
    )}>
      {/* Sidebar - Diagram Types */}
      <div className="w-64 border-r border-border bg-card/40 flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AI Diagram Generator
          </h2>
          <p className="text-[10px] text-muted-foreground mt-1">
            Select a type and generate with AI
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {availableTypes.map(type => {
              const existing = diagrams.find(d => d.type === type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => {
                    setSelectedType(type.id);
                    if (existing) setActiveDiagram(existing);
                    else setActiveDiagram(null);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg transition-all group',
                    selectedType === type.id
                      ? 'bg-blue-500/10 border border-blue-500/30'
                      : 'hover:bg-muted/50 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <DiagramIcon name={type.icon} className="w-4 h-4" />
                    <span className={cn(
                      'text-xs font-medium',
                      selectedType === type.id ? 'text-blue-400' : 'text-foreground'
                    )}>
                      {type.label}
                    </span>
                    {existing && (
                      <Badge variant="secondary" className="ml-auto text-[9px] h-4 bg-green-500/10 text-green-400 border-green-500/20">
                        <Check className="w-2.5 h-2.5 mr-0.5" />
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 ml-6">{type.description}</p>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Generate Button */}
        <div className="p-3 border-t border-border space-y-2">
          {needsApiKey && (
            <p className="text-[10px] text-yellow-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Set API key in Settings
            </p>
          )}
          <Button
            onClick={handleGenerate}
            disabled={generating || needsApiKey}
            className="w-full h-9 text-xs gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate {availableTypes.find(t => t.id === selectedType)?.label}
              </>
            )}
          </Button>
        </div>

        {/* History */}
        {diagrams.length > 0 && (
          <div className="border-t border-border">
            <div className="p-3 pb-1">
              <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Generated ({diagrams.length})
              </h3>
            </div>
            <ScrollArea className="max-h-40">
              <div className="px-2 pb-2 space-y-0.5">
                {diagrams.map((d) => (
                  <div
                    key={`${d.type}-${d.generatedAt}`}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded text-[11px] cursor-pointer group',
                      activeDiagram?.generatedAt === d.generatedAt
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'hover:bg-muted/50 text-muted-foreground'
                    )}
                    onClick={() => {
                      setActiveDiagram(d);
                      setSelectedType(d.type);
                    }}
                  >
                    <DiagramIcon name={availableTypes.find(t => t.id === d.type)?.icon || 'workflow'} className="w-3.5 h-3.5" />
                    <span className="flex-1 truncate">{d.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(d.type); }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Main Content - Diagram Display */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentDiagram ? (
          <>
            {/* Toolbar */}
            <div className="h-10 border-b border-border flex items-center px-4 justify-between bg-card/40">
              <div className="flex items-center gap-2">
                <DiagramIcon name={availableTypes.find(t => t.id === currentDiagram.type)?.icon || 'workflow'} className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium">{currentDiagram.title}</span>
                <Badge variant="secondary" className="text-[9px] h-4">
                  {new Date(currentDiagram.generatedAt).toLocaleTimeString()}
                </Badge>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => setShowCode(!showCode)}
                  title="Toggle code"
                >
                  <Code2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={handleCopy}
                  title="Copy Mermaid code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={handleDownloadSVG}
                  title="Download SVG"
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={handleGenerate}
                  disabled={generating}
                  title="Regenerate"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => setFullscreen(!fullscreen)}
                  title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Diagram + Code Split */}
            <div className="flex-1 flex overflow-hidden">
              <div className={cn('flex-1 overflow-hidden mermaid-display', showCode && 'w-1/2')}>
                <MermaidRenderer code={currentDiagram.mermaidCode} id={currentDiagram.type} />
              </div>

              {showCode && (
                <div className="w-1/2 border-l border-border bg-background/50 overflow-auto">
                  <div className="p-1 border-b border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground px-2">Mermaid Source</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
                    {currentDiagram.mermaidCode}
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">AI Architecture Diagrams</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Select a diagram type from the sidebar and click Generate to create
                AI-powered Mermaid diagrams from your codebase analysis.
              </p>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300">
                  {error}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                {availableTypes.map(t => (
                  <Badge key={t.id} variant="secondary" className="text-[10px] flex items-center gap-1">
                    <DiagramIcon name={t.icon} className="w-3 h-3" /> {t.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
