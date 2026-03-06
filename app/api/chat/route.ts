import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { messages, provider, apiKey, model, stream, baseUrl } = await request.json();

    if (!apiKey && provider !== 'ollama') {
      return Response.json({ error: 'API key is required. Configure it in Settings.' }, { status: 400 });
    }

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Route to appropriate provider handler
    switch (provider) {
      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'mistral':
      case 'openrouter':
      case 'ollama':
        return handleOpenAICompatible(messages, apiKey, model, stream, provider, baseUrl);
      case 'anthropic':
        return handleAnthropic(messages, apiKey, model, stream);
      case 'gemini':
        return handleGemini(messages, apiKey, model, stream);
      default:
        return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Chat request failed' },
      { status: 500 }
    );
  }
}

/* ---------- Provider base URLs ---------- */
const PROVIDER_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434/v1',
};

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-large-latest',
  openrouter: 'google/gemini-2.5-flash',
  ollama: 'llama3.1',
};

/* ---------- OpenAI-compatible handler ---------- */
async function handleOpenAICompatible(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string,
  stream: boolean,
  provider: string,
  baseUrl?: string,
) {
  const url = baseUrl || PROVIDER_URLS[provider] || PROVIDER_URLS.openai;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Ollama doesn't require auth; others need Bearer token
  if (provider !== 'ollama') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // OpenRouter requires extra headers
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://codescope.dev';
    headers['X-Title'] = 'CodeScope';
  }

  const response = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || PROVIDER_DEFAULT_MODELS[provider],
      messages,
      stream,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return Response.json({ error: `${provider} API error: ${err}` }, { status: response.status });
  }

  if (stream) {
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const data = await response.json();
  return Response.json({ text: data.choices?.[0]?.message?.content || '' });
}

/* ---------- Anthropic handler ---------- */
async function handleAnthropic(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string,
  stream: boolean
) {
  // Extract system message
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: model || 'claude-3-5-haiku-20241022',
    max_tokens: 4096,
    messages: chatMessages,
  };
  if (systemMsg) body.system = systemMsg.content;
  if (stream) body.stream = true;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    return Response.json({ error: `Anthropic API error: ${err}` }, { status: response.status });
  }

  if (stream) {
    // Transform Anthropic SSE to our format
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content_block_delta' && data.delta?.text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data.delta.text })}\n\n`));
              } else if (data.type === 'message_stop') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
            } catch { /* skip */ }
          }
        }
      },
    });

    return new Response(response.body!.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const data = await response.json();
  const text = data.content?.map((b: { text: string }) => b.text).join('') || '';
  return Response.json({ text });
}

/* ---------- Google Gemini handler ---------- */
async function handleGemini(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string,
  stream: boolean,
) {
  const geminiModel = model || 'gemini-2.5-flash';

  // Extract system instruction
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  // Convert to Gemini format
  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 4096 },
  };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const endpoint = stream ? 'streamGenerateContent' : 'generateContent';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:${endpoint}?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    return Response.json({ error: `Gemini API error: ${err}` }, { status: response.status });
  }

  if (stream) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        // Gemini streams JSON array chunks; extract text parts
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim().replace(/^[\[,\]]+/, '');
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            const t = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (t) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: t })}\n\n`));
            }
          } catch { /* skip partial JSON */ }
        }
      },
      flush(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      },
    });

    return new Response(response.body!.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join('') || '';
  return Response.json({ text });
}
