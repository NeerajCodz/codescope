'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, FileCode, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scrollArea';
import { cn } from '@/lib/utils';
import type { BundledLanguage } from 'shiki';

interface CodeViewerProps {
    filePath: string;
    content: string;
    onClose: () => void;
    language?: string;
}

function detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
        py: 'python', rs: 'rust', go: 'go', java: 'java',
        rb: 'ruby', php: 'php', css: 'css', scss: 'scss',
        html: 'html', json: 'json', yaml: 'yaml', yml: 'yaml',
        md: 'markdown', sql: 'sql', sh: 'bash', bash: 'bash',
        c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
        swift: 'swift', kt: 'kotlin', dart: 'dart',
        vue: 'vue', svelte: 'svelte',
    };
    return langMap[ext] || 'text';
}

export function CodeViewer({ filePath, content, onClose, language }: CodeViewerProps) {
    const [copied, setCopied] = useState(false);
    const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(true);

    const lang = language || detectLanguage(filePath);
    const fileName = filePath.split('/').pop() || filePath;
    const lines = content.split('\n');

    useEffect(() => {
        let cancelled = false;

        async function highlight() {
            try {
                const shiki = await import('shiki');
                const highlighter = await shiki.createHighlighter({
                    themes: ['github-dark-default'],
                    langs: [lang as BundledLanguage],
                });
                if (!cancelled) {
                    const html = highlighter.codeToHtml(content, {
                        lang,
                        theme: 'github-dark-default',
                    });
                    setHighlightedHtml(html);
                    highlighter.dispose();
                }
            } catch {
                // Fallback to plain text if shiki fails for this language
                if (!cancelled) setHighlightedHtml(null);
            }
        }

        highlight();
        return () => { cancelled = true; };
    }, [content, lang]);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [content]);

    return (
        <div className={cn(
            'absolute bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-700/50 transition-all duration-300',
            expanded ? 'h-[45%]' : 'h-10'
        )}>
            {/* Header bar */}
            <div className="h-10 flex items-center justify-between px-3 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm">
                <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs font-medium text-slate-300 truncate">{fileName}</span>
                    <span className="text-[10px] text-slate-500 uppercase font-mono shrink-0">{lang}</span>
                    <span className="text-[10px] text-slate-600 shrink-0">{lines.length} lines</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleCopy}
                    >
                        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:text-red-400"
                        onClick={onClose}
                    >
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Code content */}
            {expanded && (
                <ScrollArea className="h-[calc(100%-2.5rem)]">
                    {highlightedHtml ? (
                        <div
                            className="text-xs font-mono p-4 [&_pre]:bg-transparent! [&_code]:bg-transparent!
                                        [&_.line]:before:content-[attr(data-line)] [&_.line]:before:text-slate-600
                                        [&_.line]:before:inline-block [&_.line]:before:w-8 [&_.line]:before:text-right
                                        [&_.line]:before:mr-4"
                            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                        />
                    ) : (
                        <div className="text-xs font-mono p-4">
                            {lines.map((line, i) => (
                                <div key={i} className="flex">
                                    <span className="text-slate-600 select-none inline-block w-8 text-right mr-4 shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="text-slate-300 whitespace-pre">{line}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            )}
        </div>
    );
}
