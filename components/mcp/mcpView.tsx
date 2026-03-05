'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scrollArea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Cpu, ExternalLink, Loader2, Globe, BookOpen, AlertCircle,
  Search, Send, ChevronRight, ChevronDown, FileText, List,
  Sparkles, Clock, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MCPTab = 'deepwiki' | 'codewiki';
type DWPanel = 'structure' | 'content' | 'ask';

interface WikiTopic { title: string; id: string; children?: WikiTopic[] }
interface ChatMsg { role: 'user' | 'assistant'; text: string }

/* ── Topic Tree Item ── */
function TopicTreeItem({
  topic,
  depth,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
}: {
  topic: WikiTopic;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasChildren = topic.children && topic.children.length > 0;
  const isExpanded = expandedIds.has(topic.id);
  const isSelected = topic.id === selectedId;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) onToggle(topic.id);
          onSelect(topic.id);
        }}
        className={cn(
          'flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-xs transition-all',
          'hover:bg-slate-800/50',
          isSelected && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
          !isSelected && 'text-slate-300'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-3 h-3 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0 text-slate-500" />
          )
        ) : (
          <FileText className="w-3 h-3 shrink-0 text-slate-500" />
        )}
        <span className="truncate">{topic.title}</span>
      </button>
      {hasChildren && isExpanded && topic.children!.map(child => (
        <TopicTreeItem
          key={child.id}
          topic={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

/* ── Markdown Renderer ── */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${i}`} className="my-3 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
            {codeBlockLang && (
              <div className="px-3 py-1 text-[9px] text-slate-500 uppercase bg-slate-900/50 border-b border-slate-800">
                {codeBlockLang}
              </div>
            )}
            <pre className="p-3 text-xs font-mono text-slate-300 overflow-x-auto">
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          </div>
        );
        codeBlockLines = [];
        codeBlockLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-bold text-slate-200 mt-4 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base font-bold text-slate-100 mt-5 mb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-lg font-bold text-slate-100 mt-6 mb-3">{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex items-start gap-2 ml-3 my-0.5">
          <span className="text-blue-400 mt-1.5 text-[6px]">●</span>
          <span className="text-xs text-slate-300 leading-relaxed">{formatInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-xs text-slate-300 leading-relaxed my-1">{formatInline(line)}</p>);
    }
  }

  return <div className="space-y-0">{elements}</div>;
}

function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`(.+?)`/);
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

    const matches = [
      boldMatch && { idx: boldMatch.index!, type: 'bold' as const, match: boldMatch },
      codeMatch && { idx: codeMatch.index!, type: 'code' as const, match: codeMatch },
      linkMatch && { idx: linkMatch.index!, type: 'link' as const, match: linkMatch },
    ].filter(Boolean).sort((a, b) => a!.idx - b!.idx);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0]!;
    if (first.idx > 0) {
      parts.push(remaining.slice(0, first.idx));
    }

    if (first.type === 'bold') {
      parts.push(<strong key={key++} className="font-semibold text-slate-200">{first.match![1]}</strong>);
      remaining = remaining.slice(first.idx + first.match![0].length);
    } else if (first.type === 'code') {
      parts.push(
        <code key={key++} className="px-1 py-0.5 bg-slate-800 rounded text-[11px] font-mono text-blue-300">
          {first.match![1]}
        </code>
      );
      remaining = remaining.slice(first.idx + first.match![0].length);
    } else if (first.type === 'link') {
      parts.push(
        <a key={key++} href={first.match![2]} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
          {first.match![1]}
        </a>
      );
      remaining = remaining.slice(first.idx + first.match![0].length);
    }
  }

  return <>{parts}</>;
}

/* ── Chat Panel ── */
function ChatPanel({
  chat,
  question,
  setQuestion,
  onSend,
  loading,
  placeholder,
}: {
  chat: ChatMsg[];
  question: string;
  setQuestion: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  placeholder?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, loading]);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {chat.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-sm font-medium text-slate-300 mb-1">Ask anything</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Ask questions about this repository&apos;s architecture, code patterns, or implementation details.
            </p>
          </div>
        )}
        {chat.map((m, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[85%] rounded-lg p-3 text-xs leading-relaxed',
              m.role === 'user'
                ? 'ml-auto bg-slate-800/80 text-slate-200 border border-slate-700/50'
                : 'bg-blue-500/5 border border-blue-500/15 text-slate-300'
            )}
          >
            {m.role === 'assistant' ? <MarkdownContent content={m.text} /> : m.text}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
      </div>
      <div className="border-t border-border/50 p-3 flex gap-2 bg-card/20">
        <Input
          placeholder={placeholder || 'Ask a question...'}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="h-8 text-xs flex-1 bg-slate-900/50 border-slate-800"
          disabled={loading}
        />
        <Button
          size="sm"
          className="h-8 px-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20"
          onClick={onSend}
          disabled={loading || !question.trim()}
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ── Main MCP View ──
   ═══════════════════════════════════════════════════ */
export function MCPView() {
  const { owner, repoName, hasDeepWiki, setHasDeepWiki } = useAnalysisStore();
  const [mcpTab, setMcpTab] = useState<MCPTab>('deepwiki');

  // ── DeepWiki state ──
  const [dwChecking, setDwChecking] = useState(false);
  const [dwPanel, setDwPanel] = useState<DWPanel>('structure');
  const [dwStructure, setDwStructure] = useState<WikiTopic[] | null>(null);
  const [dwStructureLoading, setDwStructureLoading] = useState(false);
  const [dwContent, setDwContent] = useState<string | null>(null);
  const [dwContentLoading, setDwContentLoading] = useState(false);
  const [dwSelectedTopic, setDwSelectedTopic] = useState<string | null>(null);
  const [dwExpandedTopics, setDwExpandedTopics] = useState<Set<string>>(new Set());
  const [dwQuestion, setDwQuestion] = useState('');
  const [dwChat, setDwChat] = useState<ChatMsg[]>([]);
  const [dwAskLoading, setDwAskLoading] = useState(false);
  const [dwSearchQuery, setDwSearchQuery] = useState('');

  const deepWikiUrl = `https://deepwiki.com/${owner}/${repoName}`;
  const repoSlug = `${owner}/${repoName}`;

  // ── Check DeepWiki availability ──
  useEffect(() => {
    if (!owner || !repoName) return;
    let cancelled = false;
    setDwChecking(true);
    fetch(deepWikiUrl, { method: 'HEAD', mode: 'no-cors' })
      .then(() => { if (!cancelled) setHasDeepWiki(true); })
      .catch(() => { if (!cancelled) setHasDeepWiki(false); })
      .finally(() => { if (!cancelled) setDwChecking(false); });
    return () => { cancelled = true; };
  }, [owner, repoName, deepWikiUrl, setHasDeepWiki]);

  // Auto-fetch structure
  useEffect(() => {
    if (hasDeepWiki && !dwStructure && !dwStructureLoading) {
      fetchDwStructure();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDeepWiki]);

  // ── DeepWiki MCP calls ──
  const fetchDwStructure = useCallback(async () => {
    setDwStructureLoading(true);
    try {
      const res = await fetch('/api/mcp/deepwiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'read_wiki_structure', args: { repoName: repoSlug } }),
      });
      const data = await res.json();
      setDwStructure(data.topics ?? []);
    } catch {
      setDwStructure([]);
    } finally {
      setDwStructureLoading(false);
    }
  }, [repoSlug]);

  const fetchDwContent = useCallback(async (topicId: string) => {
    setDwContentLoading(true);
    setDwSelectedTopic(topicId);
    setDwPanel('content');
    try {
      const res = await fetch('/api/mcp/deepwiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'read_wiki_contents', args: { repoName: repoSlug, path: topicId } }),
      });
      const data = await res.json();
      setDwContent(data.content ?? 'No content found.');
    } catch {
      setDwContent('Failed to load content.');
    } finally {
      setDwContentLoading(false);
    }
  }, [repoSlug]);

  const askDeepWiki = useCallback(async () => {
    if (!dwQuestion.trim()) return;
    const q = dwQuestion.trim();
    setDwQuestion('');
    setDwChat(prev => [...prev, { role: 'user', text: q }]);
    setDwAskLoading(true);
    try {
      const res = await fetch('/api/mcp/deepwiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'ask_question', args: { repoName: repoSlug, question: q } }),
      });
      const data = await res.json();
      setDwChat(prev => [...prev, { role: 'assistant', text: data.answer ?? 'No answer available.' }]);
    } catch {
      setDwChat(prev => [...prev, { role: 'assistant', text: 'Error contacting DeepWiki. Please try again.' }]);
    } finally {
      setDwAskLoading(false);
    }
  }, [dwQuestion, repoSlug]);

  const toggleTopicExpand = useCallback((id: string) => {
    setDwExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filterTopics = useCallback((topics: WikiTopic[], query: string): WikiTopic[] => {
    if (!query.trim()) return topics;
    const q = query.toLowerCase();
    return topics.reduce<WikiTopic[]>((acc, topic) => {
      const titleMatch = topic.title.toLowerCase().includes(q);
      const filteredChildren = topic.children ? filterTopics(topic.children, query) : [];
      if (titleMatch || filteredChildren.length > 0) {
        acc.push({ ...topic, children: filteredChildren.length > 0 ? filteredChildren : topic.children });
      }
      return acc;
    }, []);
  }, []);

  const filteredStructure = dwStructure ? filterTopics(dwStructure, dwSearchQuery) : null;

  // ── No repo guard ──
  if (!owner || !repoName) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Cpu className="w-10 h-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm text-muted-foreground">No repository loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── MCP Tab Selector ── */}
      <div className="h-11 border-b border-border bg-card/40 flex items-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 p-0.5">
          <button
            type="button"
            onClick={() => setMcpTab('deepwiki')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all',
              mcpTab === 'deepwiki'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            )}
          >
            <BookOpen className="w-3 h-3" /> DeepWiki
          </button>
          <button
            type="button"
            onClick={() => setMcpTab('codewiki')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all',
              mcpTab === 'codewiki'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-sm'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            )}
          >
            <Search className="w-3 h-3" /> CodeWiki
          </button>
        </div>

        <span className="text-[10px] text-muted-foreground font-mono">{owner}/{repoName}</span>

        {/* DeepWiki sub-panel tabs */}
        {mcpTab === 'deepwiki' && hasDeepWiki && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-slate-900/50 p-0.5">
              {([
                { id: 'structure' as const, label: 'Structure', icon: List },
                { id: 'content' as const, label: 'Content', icon: FileText },
                { id: 'ask' as const, label: 'Ask', icon: Sparkles },
              ]).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDwPanel(p.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all',
                    dwPanel === p.id
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  )}
                >
                  <p.icon className="w-3 h-3" />
                  {p.label}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => window.open(deepWikiUrl, '_blank')}
            >
              <ExternalLink className="w-3 h-3" /> Open
            </Button>
          </div>
        )}

        {mcpTab === 'codewiki' && (
          <div className="ml-auto">
            <Badge variant="outline" className="text-[9px] text-green-400 border-green-500/30">
              Coming Soon
            </Badge>
          </div>
        )}
      </div>

      {/* ═══ DeepWiki Tab ═══ */}
      {mcpTab === 'deepwiki' && (
        <div className="flex-1 overflow-hidden">
          {dwChecking ? (
            <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Checking DeepWiki availability...</span>
            </div>
          ) : !hasDeepWiki ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">Not Found on DeepWiki</h3>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono text-blue-400">{repoSlug}</span> is not yet indexed.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => window.open('https://deepwiki.com', '_blank')}
                >
                  <Globe className="w-3.5 h-3.5" /> Visit DeepWiki
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full">
              {/* Sidebar: Topic Structure */}
              <div className="w-64 border-r border-border bg-card/20 flex flex-col shrink-0">
                <div className="p-3 space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Topics
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-slate-400"
                      onClick={fetchDwStructure}
                      disabled={dwStructureLoading}
                    >
                      {dwStructureLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-1.5 h-3 w-3 text-slate-500" />
                    <Input
                      placeholder="Filter topics..."
                      className="pl-7 h-7 bg-slate-900/50 border-slate-800 text-xs"
                      value={dwSearchQuery}
                      onChange={e => setDwSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <Separator className="opacity-30" />
                <ScrollArea className="flex-1 py-1 px-2">
                  {dwStructureLoading && !dwStructure ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                    </div>
                  ) : filteredStructure && filteredStructure.length > 0 ? (
                    <div className="space-y-0.5">
                      {filteredStructure.map(topic => (
                        <TopicTreeItem
                          key={topic.id}
                          topic={topic}
                          depth={0}
                          selectedId={dwSelectedTopic}
                          expandedIds={dwExpandedTopics}
                          onToggle={toggleTopicExpand}
                          onSelect={(id) => fetchDwContent(id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <List className="w-6 h-6 text-slate-600 mb-2" />
                      <p className="text-[10px] text-slate-500">
                        {dwSearchQuery ? 'No matching topics' : 'No topics available'}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {dwPanel === 'structure' && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-3 max-w-sm">
                      <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
                        <BookOpen className="w-6 h-6 text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-200">DeepWiki Documentation</h3>
                      <p className="text-xs text-slate-500">
                        Select a topic from the sidebar to read its documentation,
                        or switch to <strong className="text-blue-400">Ask</strong> to ask questions.
                      </p>
                      {dwStructure && (
                        <Badge variant="outline" className="text-[9px] text-blue-400 border-blue-500/30">
                          {countTopics(dwStructure)} topics indexed
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {dwPanel === 'content' && (
                  <ScrollArea className="flex-1">
                    <div className="max-w-3xl mx-auto p-6">
                      {dwContentLoading ? (
                        <div className="flex items-center gap-3 py-8 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Loading content...</span>
                        </div>
                      ) : dwContent ? (
                        <div>
                          {dwSelectedTopic && (
                            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/50">
                              <FileText className="w-4 h-4 text-blue-400" />
                              <h2 className="text-sm font-semibold text-slate-200">{dwSelectedTopic}</h2>
                            </div>
                          )}
                          <MarkdownContent content={dwContent} />
                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-500">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Select a topic to view its content</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}

                {dwPanel === 'ask' && (
                  <ChatPanel
                    chat={dwChat}
                    question={dwQuestion}
                    setQuestion={setDwQuestion}
                    onSend={askDeepWiki}
                    loading={dwAskLoading}
                    placeholder={`Ask about ${repoSlug}...`}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ CodeWiki Tab — Coming Soon ═══ */}
      {mcpTab === 'codewiki' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6 max-w-md">
            <div className="relative mx-auto w-20 h-20">
              <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-green-900/40 to-emerald-900/40 border border-green-500/20 flex items-center justify-center">
                <Rocket className="w-9 h-9 text-green-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                <Clock className="w-3 h-3 text-green-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100">CodeWiki</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                AI-powered code documentation &amp; analysis by Google.
                CodeWiki integration is currently under development and will be available soon.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-medium text-green-400">Coming Soon</span>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 border-green-500/20 text-green-400 hover:bg-green-500/10"
                onClick={() => window.open('https://codewiki.google', '_blank')}
              >
                <Globe className="w-3.5 h-3.5" /> Visit CodeWiki
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Count total topics including nested */
function countTopics(topics: WikiTopic[]): number {
  return topics.reduce((sum, t) => sum + 1 + (t.children ? countTopics(t.children) : 0), 0);
}
