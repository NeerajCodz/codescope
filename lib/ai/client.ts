// Unified AI client that supports multiple providers
// All API calls go through our server-side route to keep keys secure

import { AIProvider, AISettings, AIMessage, DEFAULT_MODELS } from '@/types/ai';

export interface AIStreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: string) => void;
}

export class AIClient {
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  get provider(): AIProvider {
    return this.settings.provider;
  }

  get model(): string {
    return this.settings.model || DEFAULT_MODELS[this.settings.provider];
  }

  async generateText(messages: AIMessage[]): Promise<string> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        provider: this.settings.provider,
        apiKey: this.settings.apiKey,
        model: this.model,
        stream: false,
        baseUrl: this.settings.baseUrl,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `AI request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
  }

  async streamText(
    messages: AIMessage[],
    callbacks: AIStreamCallbacks
  ): Promise<void> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        provider: this.settings.provider,
        apiKey: this.settings.apiKey,
        model: this.model,
        stream: true,
        baseUrl: this.settings.baseUrl,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      callbacks.onError?.(err.error || `AI request failed: ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError?.('No response stream');
      return;
    }

    const decoder = new TextDecoder();
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const token = parsed.text || parsed.delta || '';
            if (token) {
              fullText += token;
              callbacks.onToken?.(token);
            }
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    callbacks.onComplete?.(fullText);
  }

  async generateMermaid(systemPrompt: string, userPrompt: string): Promise<string> {
    const messages: AIMessage[] = [
      { id: 'sys', role: 'system', content: systemPrompt, timestamp: Date.now() },
      { id: 'user', role: 'user', content: userPrompt, timestamp: Date.now() },
    ];

    const text = await this.generateText(messages);

    // Extract mermaid code block if wrapped in ```mermaid ... ```
    const mermaidMatch = text.match(/```mermaid\s*([\s\S]*?)```/);
    if (mermaidMatch) return mermaidMatch[1].trim();

    // Try plain code block
    const codeMatch = text.match(/```\s*([\s\S]*?)```/);
    if (codeMatch) return codeMatch[1].trim();

    return text.trim();
  }
}

// Singleton-like factory
let currentClient: AIClient | null = null;

export function getAIClient(settings: AISettings): AIClient {
  if (
    !currentClient ||
    currentClient.provider !== settings.provider ||
    currentClient.model !== (settings.model || DEFAULT_MODELS[settings.provider])
  ) {
    currentClient = new AIClient(settings);
  }
  return currentClient;
}
