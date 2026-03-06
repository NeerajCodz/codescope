'use client';

import React, { useState, useMemo } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { detectCreatedAPIs, detectUsedAPIs, groupByService, getAPIStats } from '@/lib/apiAnalyzer';
import { CreatedAPI, UsedAPI, APIResponseBody } from '@/types/apiAnalysis';
import {
  ArrowUpRight, ArrowDownLeft, Globe, ChevronDown, ChevronRight,
  FileText, ExternalLink, Server, Layers, Copy, Hash,
  ArrowRight, Braces, Send, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type APITab = 'created' | 'used';

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET:    { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20' },
  POST:   { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20' },
  PUT:    { bg: 'bg-yellow-500/10',  text: 'text-yellow-400', border: 'border-yellow-500/20' },
  DELETE: { bg: 'bg-red-500/10',     text: 'text-red-400',    border: 'border-red-500/20' },
  PATCH:  { bg: 'bg-purple-500/10',  text: 'text-purple-400', border: 'border-purple-500/20' },
  ALL:    { bg: 'bg-gray-500/10',    text: 'text-gray-400',   border: 'border-gray-500/20' },
};

function getMethodStyle(method: string) {
  return METHOD_COLORS[method.toUpperCase()] || METHOD_COLORS.ALL;
}

export function APIView() {
  const { data } = useAnalysisStore();
  const [activeTab, setActiveTab] = useState<APITab>('created');

  const { created, used, stats, services } = useMemo(() => {
    if (!data) return { created: [], used: [], stats: null, services: [] };
    const created = detectCreatedAPIs(data);
    const used = detectUsedAPIs(data);
    const stats = getAPIStats(created, used);
    const services = groupByService(used);
    return { created, used, stats, services };
  }, [data]);

  // Group created APIs by path prefix
  const groupedCreated = useMemo(() => {
    const groups = new Map<string, CreatedAPI[]>();
    for (const api of created) {
      const prefix = api.path.split('/').slice(0, 3).join('/') || '/';
      const arr = groups.get(prefix) || [];
      arr.push(api);
      groups.set(prefix, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [created]);

  // Method distribution
  const methodDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const api of created) counts[api.method] = (counts[api.method] || 0) + 1;
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [created]);

  if (!data) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      {stats && (
        <div className="px-4 py-3 border-b border-border bg-slate-900/30">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
                <span className="text-muted-foreground">Created:</span>
                <span className="font-bold text-green-400">{stats.totalCreated}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-muted-foreground">Used:</span>
                <span className="font-bold text-blue-400">{stats.totalUsed}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-muted-foreground">Services:</span>
                <span className="font-bold text-purple-400">{stats.uniqueServices}</span>
              </div>
            </div>
            {/* Method distribution pills */}
            <div className="flex items-center gap-1.5 ml-auto">
              {methodDist.map(([method, count]) => {
                const style = getMethodStyle(method);
                return (
                  <Badge key={method} variant="outline" className={cn('text-[9px] h-5 font-mono', style.text, style.border, style.bg)}>
                    {method} {count}
                  </Badge>
                );
              })}
              {stats.frameworks.length > 0 && (
                <div className="flex items-center gap-1 ml-2">
                  <Layers className="w-3 h-3 text-cyan-400" />
                  {stats.frameworks.map(f => (
                    <Badge key={f} variant="secondary" className="text-[9px] h-4">{f}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="px-4 pt-3 flex items-center gap-2">
        <Button
          variant={activeTab === 'created' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('created')}
          className={cn('h-8 text-xs gap-1.5', activeTab === 'created' && 'bg-green-500/10 text-green-400 border border-green-500/20')}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          Created ({created.length})
        </Button>
        <Button
          variant={activeTab === 'used' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('used')}
          className={cn('h-8 text-xs gap-1.5', activeTab === 'used' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20')}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          Used ({used.length})
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {activeTab === 'created' ? (
          <SwaggerCreatedView apis={created} groups={groupedCreated} />
        ) : (
          <SwaggerUsedView apis={used} services={services} />
        )}
      </ScrollArea>
    </div>
  );
}

// ─── Swagger-style Created APIs ─────────────────────────────

function SwaggerCreatedView({ apis, groups }: { apis: CreatedAPI[]; groups: [string, CreatedAPI[]][] }) {
  if (apis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Server className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No API endpoints detected in this codebase.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">We look for Express, Next.js, Flask, FastAPI route definitions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([prefix, groupApis]) => (
        <div key={prefix}>
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">{prefix}</span>
            <Badge variant="outline" className="text-[8px] text-slate-600 border-slate-800">{groupApis.length}</Badge>
          </div>
          <div className="space-y-2">
            {groupApis.map((api, i) => (
              <EndpointCard key={`${api.path}-${api.method}-${i}`} api={api} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EndpointCard({ api }: { api: CreatedAPI }) {
  const [expanded, setExpanded] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const style = getMethodStyle(api.method);
  const hasDetails = (api.queryParams?.length ?? 0) > 0 || (api.bodyFields?.length ?? 0) > 0 || (api.responseFields?.length ?? 0) > 0 || (api.responseBodies?.length ?? 0) > 0 || (api.params?.length ?? 0) > 0;

  return (
    <>
    <Card className={cn('border overflow-hidden transition-all', expanded && 'ring-1 ring-slate-700', style.border)}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
        className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors cursor-pointer', style.bg)}
      >
        <Badge variant="secondary" className={cn('text-[10px] h-5 font-mono min-w-14 justify-center font-bold', style.text, style.border, style.bg)}>
          {api.method}
        </Badge>
        <code className="text-xs font-mono text-foreground flex-1 text-left truncate">{api.path}</code>
        {api.description && (
          <span className="text-[10px] text-slate-500 truncate max-w-48">{api.description}</span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-[8px] h-4">{api.framework}</Badge>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetailPopup(true); }}
            className="text-slate-500 hover:text-blue-400 transition-colors"
            title="View endpoint details"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          {hasDetails && (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-3 bg-slate-950/50">
          {/* Source file */}
          <div className="flex items-center gap-2 text-[10px]">
            <FileText className="w-3 h-3 text-slate-500" />
            <span className="text-slate-500">Source:</span>
            <code className="text-slate-300 font-mono">{api.file}</code>
            <span className="text-slate-600">L{api.line}</span>
            <button
              onClick={() => navigator.clipboard.writeText(api.path)}
              className="ml-auto text-slate-600 hover:text-slate-400 transition-colors"
              title="Copy path"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* Route params */}
          {api.params && api.params.length > 0 && (
            <DetailSection title="Path Parameters" icon={<ArrowRight className="w-3 h-3 text-orange-400" />}>
              {api.params.map(p => (
                <ParamRow key={p} name={p} location="path" type="string" required />
              ))}
            </DetailSection>
          )}

          {/* Query params */}
          {api.queryParams && api.queryParams.length > 0 && (
            <DetailSection title="Query Parameters" icon={<Hash className="w-3 h-3 text-yellow-400" />}>
              {api.queryParams.map(p => (
                <ParamRow key={p} name={p} location="query" type="string" />
              ))}
            </DetailSection>
          )}

          {/* Request body */}
          {api.bodyFields && api.bodyFields.length > 0 && (
            <DetailSection title="Request Body" icon={<Send className="w-3 h-3 text-blue-400" />}>
              <div className="bg-slate-900 rounded border border-slate-800 p-2 font-mono text-[10px]">
                <span className="text-slate-500">{'{'}</span>
                {api.bodyFields.map((f, i) => (
                  <div key={f} className="pl-4">
                    <span className="text-blue-400">{f}</span>
                    <span className="text-slate-600">: </span>
                    <span className="text-green-400">any</span>
                    {i < api.bodyFields!.length - 1 && <span className="text-slate-600">,</span>}
                  </div>
                ))}
                <span className="text-slate-500">{'}'}</span>
              </div>
            </DetailSection>
          )}

          {/* Response Bodies - all detected responses with status codes */}
          {api.responseBodies && api.responseBodies.length > 0 ? (
            <DetailSection title="Responses" icon={<Braces className="w-3 h-3 text-green-400" />}>
              <div className="space-y-2">
                {api.responseBodies.map((rb) => (
                  <div key={rb.status} className="bg-slate-900 rounded border border-slate-800 p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[8px] h-4 font-mono',
                          rb.status >= 200 && rb.status < 300 ? 'text-green-400 border-green-500/30' :
                          rb.status >= 400 && rb.status < 500 ? 'text-yellow-400 border-yellow-500/30' :
                          rb.status >= 500 ? 'text-red-400 border-red-500/30' :
                          'text-slate-400 border-slate-600'
                        )}
                      >
                        {rb.status}
                      </Badge>
                      <span className="text-[9px] text-slate-500">{rb.label}</span>
                    </div>
                    {rb.fields.length > 0 && (
                      <div className="font-mono text-[10px]">
                        <span className="text-slate-500">{'{'}</span>
                        {rb.fields.map((f, i) => (
                          <div key={f} className="pl-4">
                            <span className="text-emerald-400">{f}</span>
                            <span className="text-slate-600">: </span>
                            <span className="text-cyan-400">any</span>
                            {i < rb.fields.length - 1 && <span className="text-slate-600">,</span>}
                          </div>
                        ))}
                        <span className="text-slate-500">{'}'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </DetailSection>
          ) : api.responseFields && api.responseFields.length > 0 ? (
            <DetailSection title="Response" icon={<Braces className="w-3 h-3 text-green-400" />}>
              <div className="bg-slate-900 rounded border border-slate-800 p-2 font-mono text-[10px]">
                <span className="text-slate-500">{'{'}</span>
                {api.responseFields.map((f, i) => (
                  <div key={f} className="pl-4">
                    <span className="text-emerald-400">{f}</span>
                    <span className="text-slate-600">: </span>
                    <span className="text-cyan-400">any</span>
                    {i < api.responseFields!.length - 1 && <span className="text-slate-600">,</span>}
                  </div>
                ))}
                <span className="text-slate-500">{'}'}</span>
              </div>
            </DetailSection>
          ) : null}

          {/* Middleware */}
          {api.middleware && api.middleware.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 uppercase">Middleware:</span>
              {api.middleware.map(m => (
                <Badge key={m} variant="outline" className="text-[8px] text-cyan-400 border-cyan-500/30">{m}</Badge>
              ))}
            </div>
          )}

          {/* No details extracted */}
          {!hasDetails && (
            <p className="text-[10px] text-slate-600 italic">No additional parameters or response details detected from source code.</p>
          )}
        </div>
      )}
    </Card>

    {/* Detail Popup Modal */}
    {showDetailPopup && (
      <EndpointDetailPopup api={api} onClose={() => setShowDetailPopup(false)} />
    )}
    </>
  );
}

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ParamRow({ name, location, type, required }: { name: string; location: string; type: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded bg-slate-900/50 border border-slate-800/50 text-[10px]">
      <code className="text-blue-400 font-mono font-medium">{name}</code>
      <Badge variant="outline" className="text-[7px] h-3.5 text-slate-500 border-slate-700">{location}</Badge>
      <span className="text-slate-600">{type}</span>
      {required && <Badge variant="outline" className="text-[7px] h-3.5 text-red-400 border-red-500/30">required</Badge>}
    </div>
  );
}

// ─── Endpoint Detail Popup ──────────────────────────────────────────

function EndpointDetailPopup({ api, onClose }: { api: CreatedAPI; onClose: () => void }) {
  const style = getMethodStyle(api.method);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-slate-950 border border-slate-800/50 rounded-xl shadow-2xl w-[90vw] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/50">
          <Badge variant="secondary" className={cn('text-xs h-6 font-mono min-w-16 justify-center font-bold', style.text, style.border, style.bg)}>
            {api.method}
          </Badge>
          <code className="text-sm font-mono text-foreground flex-1 truncate">{api.path}</code>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 p-5">
          <div className="space-y-4">
            {/* Description */}
            {api.description && (
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Description</span>
                <p className="text-xs text-slate-300">{api.description}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block mb-0.5">Framework</span>
                <span className="text-xs font-medium text-slate-200">{api.framework}</span>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block mb-0.5">Source</span>
                <span className="text-xs font-mono text-slate-200 truncate block" title={api.file}>{api.file.split('/').pop()}</span>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block mb-0.5">Line</span>
                <span className="text-xs font-mono text-slate-200">{api.line}</span>
              </div>
            </div>

            {/* Parameters */}
            {api.params && api.params.length > 0 && (
              <DetailSection title="Path Parameters" icon={<ArrowRight className="w-3 h-3 text-orange-400" />}>
                {api.params.map(p => <ParamRow key={p} name={p} location="path" type="string" required />)}
              </DetailSection>
            )}
            {api.queryParams && api.queryParams.length > 0 && (
              <DetailSection title="Query Parameters" icon={<Hash className="w-3 h-3 text-yellow-400" />}>
                {api.queryParams.map(p => <ParamRow key={p} name={p} location="query" type="string" />)}
              </DetailSection>
            )}
            {api.bodyFields && api.bodyFields.length > 0 && (
              <DetailSection title="Request Body" icon={<Send className="w-3 h-3 text-blue-400" />}>
                <div className="bg-slate-900 rounded border border-slate-800 p-3 font-mono text-[11px]">
                  <span className="text-slate-500">{'{'}</span>
                  {api.bodyFields.map((f, i) => (
                    <div key={f} className="pl-4">
                      <span className="text-blue-400">{f}</span>
                      <span className="text-slate-600">: </span>
                      <span className="text-green-400">any</span>
                      {i < api.bodyFields!.length - 1 && <span className="text-slate-600">,</span>}
                    </div>
                  ))}
                  <span className="text-slate-500">{'}'}</span>
                </div>
              </DetailSection>
            )}

            {/* All Response Bodies */}
            {api.responseBodies && api.responseBodies.length > 0 ? (
              <DetailSection title="Responses" icon={<Braces className="w-3 h-3 text-green-400" />}>
                <div className="space-y-2">
                  {api.responseBodies.map((rb) => (
                    <ResponseBodyCard key={rb.status} response={rb} />
                  ))}
                </div>
              </DetailSection>
            ) : api.responseFields && api.responseFields.length > 0 ? (
              <DetailSection title="Response (200)" icon={<Braces className="w-3 h-3 text-green-400" />}>
                <div className="bg-slate-900 rounded border border-slate-800 p-3 font-mono text-[11px]">
                  <span className="text-slate-500">{'{'}</span>
                  {api.responseFields.map((f, i) => (
                    <div key={f} className="pl-4">
                      <span className="text-emerald-400">{f}</span>
                      <span className="text-slate-600">: </span>
                      <span className="text-cyan-400">any</span>
                      {i < api.responseFields!.length - 1 && <span className="text-slate-600">,</span>}
                    </div>
                  ))}
                  <span className="text-slate-500">{'}'}</span>
                </div>
              </DetailSection>
            ) : null}

            {/* Middleware */}
            {api.middleware && api.middleware.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Middleware</span>
                <div className="flex flex-wrap gap-1.5">
                  {api.middleware.map(m => (
                    <Badge key={m} variant="outline" className="text-[9px] text-cyan-400 border-cyan-500/30">{m}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Full file path */}
            <div className="pt-2 border-t border-slate-800/50">
              <span className="text-[10px] text-slate-500 block mb-1">Full Path</span>
              <code className="text-[11px] font-mono text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded border border-slate-800/50 block">
                {api.file}:{api.line}
              </code>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ResponseBodyCard({ response }: { response: APIResponseBody }) {
  return (
    <div className="bg-slate-900 rounded border border-slate-800 p-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <Badge
          variant="outline"
          className={cn(
            'text-[9px] h-4.5 font-mono',
            response.status >= 200 && response.status < 300 ? 'text-green-400 border-green-500/30' :
            response.status >= 400 && response.status < 500 ? 'text-yellow-400 border-yellow-500/30' :
            response.status >= 500 ? 'text-red-400 border-red-500/30' :
            'text-slate-400 border-slate-600'
          )}
        >
          {response.status}
        </Badge>
        <span className="text-[10px] text-slate-500">{response.label}</span>
      </div>
      {response.fields.length > 0 && (
        <div className="font-mono text-[10px]">
          <span className="text-slate-500">{'{'}</span>
          {response.fields.map((f, i) => (
            <div key={f} className="pl-4">
              <span className="text-emerald-400">{f}</span>
              <span className="text-slate-600">: </span>
              <span className="text-cyan-400">any</span>
              {i < response.fields.length - 1 && <span className="text-slate-600">,</span>}
            </div>
          ))}
          <span className="text-slate-500">{'}'}</span>
        </div>
      )}
    </div>
  );
}

// ─── Used APIs View ─────────────────────────────────────────

function SwaggerUsedView({ apis, services }: { apis: UsedAPI[]; services: ReturnType<typeof groupByService> }) {
  if (apis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <ExternalLink className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No external API calls detected.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">We look for fetch(), axios, XMLHttpRequest calls.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {services.map(service => (
        <ServiceCard key={service.baseUrl} service={service} />
      ))}
    </div>
  );
}

function ServiceCard({ service }: { service: ReturnType<typeof groupByService>[0] }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 border-b border-border bg-slate-900/30 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-slate-200">{service.name}</span>
          <Badge variant="outline" className="text-[8px] text-slate-500 border-slate-700">{service.endpoints.length} calls</Badge>
          <Badge variant="outline" className="text-[8px] text-slate-600 border-slate-800">{service.files.length} files</Badge>
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      {expanded && (
        <div className="divide-y divide-slate-800/50">
          {service.endpoints.map((ep, i) => {
            const style = getMethodStyle(ep.method);
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800/20 transition-colors">
                <Badge variant="secondary" className={cn('text-[9px] h-4 font-mono min-w-10 justify-center', style.text, style.border, style.bg)}>
                  {ep.method}
                </Badge>
                <code className="text-[11px] font-mono text-slate-300 flex-1 truncate">{ep.url}</code>
                <div className="flex items-center gap-2 shrink-0 text-[9px]">
                  <Badge variant="outline" className="text-[8px] h-3.5 text-slate-600 border-slate-800">{ep.library}</Badge>
                  {ep.isAuthenticated && <Badge variant="outline" className="text-[8px] h-3.5 text-amber-400 border-amber-500/30">auth</Badge>}
                  <span className="text-slate-600 font-mono truncate max-w-24">{ep.file.split('/').pop()}</span>
                  <span className="text-slate-700">:{ep.line}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
