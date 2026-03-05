// AI-related types for multi-provider support, chatbot, diagrams

export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'gemini'
  | 'deepseek'
  | 'mistral'
  | 'openrouter'
  | 'ollama';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  /** Base URL override — used for Ollama (default http://localhost:11434) or custom endpoints */
  baseUrl?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens?: number;
}

export interface ChatSession {
  id: string;
  messages: AIMessage[];
  repoContext?: string;
  focusMode: 'repo' | 'file' | 'function';
  focusTarget?: string;
  createdAt: number;
}

export interface DiagramType {
  id: string;
  label: string;
  description: string;
  /** Lucide icon name used as a key for the icon mapping */
  icon: string;
  prompt: string;
}

export interface GeneratedDiagram {
  type: string;
  mermaidCode: string;
  title: string;
  description: string;
  generatedAt: number;
  tokens?: number;
}

export interface AIContextChunk {
  type: 'file-tree' | 'dependencies' | 'functions' | 'patterns' | 'security' | 'stats';
  content: string;
  priority: number;
}

export const AI_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest', 'mistral-small-latest'],
  openrouter: ['google/gemini-2.5-flash', 'anthropic/claude-sonnet-4', 'deepseek/deepseek-chat-v3', 'openai/gpt-4o'],
  ollama: ['llama3.1', 'codellama', 'deepseek-coder-v2', 'mistral', 'qwen2.5-coder'],
};

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.5-flash',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-large-latest',
  openrouter: 'google/gemini-2.5-flash',
  ollama: 'llama3.1',
};
