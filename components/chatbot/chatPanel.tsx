'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { AIClient } from '@/lib/ai/client';
import { buildRepoContext, buildChatSystemPrompt } from '@/lib/ai/contextBuilder';
import { AIMessage, ChatSession } from '@/types/ai';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';
import {
  MessageCircle, X, Send, Loader2, Trash2, Sparkles,
  AlertCircle, Minimize2, Maximize2,
  Bot, User, Settings,
} from 'lucide-react';

/* ---------- Markdown Renderer ---------- */
function MessageContent({ content }: { content: string }) {
  // Simple markdown-ish renderer: code blocks, inline code, bold, links
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return (
    <div className="text-xs leading-relaxed whitespace-pre-wrap wrap-break-word space-y-1">
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3);
          const firstNewline = inner.indexOf('\n');
          const code = firstNewline > -1 ? inner.slice(firstNewline + 1) : inner;
          return (
            <pre key={i} className="bg-background/80 rounded-md p-2.5 text-[11px] font-mono overflow-x-auto border border-border my-1.5">
              {code}
            </pre>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="bg-background/80 rounded px-1 py-0.5 text-[11px] font-mono text-blue-300">
              {part.slice(1, -1)}
            </code>
          );
        }
        // Bold
        const boldParsed = part.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i}>
            {boldParsed.map((bp, j) => {
              if (bp.startsWith('**') && bp.endsWith('**')) {
                return <strong key={j} className="font-semibold text-foreground">{bp.slice(2, -2)}</strong>;
              }
              return bp;
            })}
          </span>
        );
      })}
    </div>
  );
}

/* ---------- Chat Panel ---------- */
export function ChatPanel() {
  const {
    data, aiSettings, chatSession, setChatSession, addChatMessage,
  } = useAnalysisStore();

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatSession?.messages, streamBuffer]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const ensureSession = useCallback((): ChatSession => {
    if (chatSession) return chatSession;
    const session: ChatSession = {
      id: `chat-${Date.now()}`,
      messages: [],
      focusMode: 'repo',
      createdAt: Date.now(),
    };
    setChatSession(session);
    return session;
  }, [chatSession, setChatSession]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    if (!aiSettings.apiKey && aiSettings.provider !== 'ollama') {
      setError('Configure your AI API key in Settings to use the chatbot.');
      return;
    }

    setError(null);
    setInput('');

    const session = ensureSession();

    // Add user message
    const userMsg: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);

    // Build messages for API
    const repoContext = data ? buildRepoContext(data, 4000) : '';
    const systemPrompt = buildChatSystemPrompt(repoContext);

    const allMessages = [
      ...session.messages,
      userMsg,
    ].map(m => ({ role: m.role, content: m.content }));

    // Prepend system message
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...allMessages,
    ];

    // Stream response
    setStreaming(true);
    setStreamBuffer('');

    try {
      const client = new AIClient(aiSettings);
      let fullText = '';

      await client.streamText(
        apiMessages.map((m, i) => ({
          id: `api-${i}`,
          role: m.role,
          content: m.content,
          timestamp: Date.now(),
        })),
        {
          onToken: (token) => {
            fullText += token;
            setStreamBuffer(fullText);
          },
          onComplete: (text) => {
            const assistantMsg: AIMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: text || fullText,
              timestamp: Date.now(),
            };
            addChatMessage(assistantMsg);
            setStreamBuffer('');
          },
          onError: (err) => {
            setError(err);
            setStreamBuffer('');
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, aiSettings, data, ensureSession, addChatMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setChatSession(null);
    setStreamBuffer('');
    setError(null);
  };

  const messages = chatSession?.messages || [];
  const hasKey = !!aiSettings.apiKey || aiSettings.provider === 'ollama';

  return (
    <>
      {/* Floating Toggle Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 transition-all flex items-center justify-center group"
        >
          <MessageCircle className="w-5 h-5 group-hover:hidden" />
          <Sparkles className="w-5 h-5 hidden group-hover:block" />
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
              {messages.filter(m => m.role === 'assistant').length}
            </span>
          )}
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className={cn(
            'fixed z-50 bg-card border border-border rounded-xl shadow-2xl shadow-black/30 flex flex-col overflow-hidden transition-all duration-200',
            expanded
              ? 'inset-4'
              : 'bottom-6 right-6 w-96 h-128'
          )}
        >
          {/* Header */}
          <div className="h-11 border-b border-border flex items-center justify-between px-3 bg-card/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold">CodeScope AI</span>
              <Badge variant="secondary" className="text-[9px] h-4">
                {aiSettings.provider}
              </Badge>
            </div>
            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleClearChat} title="Clear chat">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setExpanded(!expanded)}>
                {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && !streamBuffer && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold">Ask about your codebase</h3>
                <p className="text-[11px] text-muted-foreground max-w-60">
                  I have context about your repository structure, functions, dependencies, and patterns.
                </p>
                {/* Quick prompts */}
                <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                  {[
                    'Summarize this codebase',
                    'Find potential issues',
                    'Explain the architecture',
                    'Suggest improvements',
                  ].map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                      className="px-2.5 py-1 rounded-full border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-blue-500/30 hover:bg-blue-500/5 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-linear-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-blue-600/20 border border-blue-500/20 text-blue-50'
                      : 'bg-muted/50 border border-border text-foreground'
                  )}
                >
                  <MessageContent content={msg.content} />
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-blue-600/30 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-blue-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming indicator */}
            {streamBuffer && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-lg bg-linear-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                </div>
                <div className="max-w-[85%] rounded-xl px-3 py-2 bg-muted/50 border border-border">
                  <MessageContent content={streamBuffer} />
                </div>
              </div>
            )}

            {streaming && !streamBuffer && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-lg bg-linear-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="rounded-xl px-3 py-2 bg-muted/50 border border-border">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-3 mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-3 bg-card/80 shrink-0">
            {hasKey ? (
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your codebase..."
                  rows={1}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-muted-foreground max-h-24 min-h-9"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const el = e.target as HTMLTextAreaElement;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
                  }}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className="h-9 w-9 rounded-lg bg-blue-600 hover:bg-blue-500 shrink-0"
                >
                  {streaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  Configure AI key in Settings to chat
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
