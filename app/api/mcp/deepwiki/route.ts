import { NextRequest, NextResponse } from 'next/server';

const DEEPWIKI_MCP_URL = 'https://mcp.deepwiki.com/mcp';

/**
 * Proxy for DeepWiki MCP server (Streamable HTTP).
 * Tools: read_wiki_structure, read_wiki_contents, ask_question
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, args } = body as { tool: string; args: Record<string, unknown> };

    if (!tool || !args) {
      return NextResponse.json({ error: 'Missing tool or args' }, { status: 400 });
    }

    // Build JSON-RPC request for MCP Streamable HTTP
    const rpcBody = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: tool,
        arguments: args,
      },
    };

    const res = await fetch(DEEPWIKI_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(rpcBody),
    });

    const contentType = res.headers.get('content-type') ?? '';

    // Handle SSE stream response
    if (contentType.includes('text/event-stream')) {
      const text = await res.text();
      // Parse SSE events — look for the data payload
      const lines = text.split('\n');
      let resultData = '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          resultData = line.slice(6);
        }
      }
      if (resultData) {
        try {
          const parsed = JSON.parse(resultData);
          const content = parsed?.result?.content;
          if (Array.isArray(content)) {
            const textContent = content.find((c: { type: string }) => c.type === 'text');
            if (textContent?.text) {
              try {
                return NextResponse.json(JSON.parse(textContent.text));
              } catch {
                return NextResponse.json({ content: textContent.text });
              }
            }
          }
          return NextResponse.json(parsed?.result ?? parsed);
        } catch {
          return NextResponse.json({ content: resultData });
        }
      }
      return NextResponse.json({ content: text });
    }

    // Handle JSON response
    if (contentType.includes('application/json')) {
      const data = await res.json();
      const content = data?.result?.content;
      if (Array.isArray(content)) {
        const textContent = content.find((c: { type: string }) => c.type === 'text');
        if (textContent?.text) {
          try {
            return NextResponse.json(JSON.parse(textContent.text));
          } catch {
            return NextResponse.json({ content: textContent.text });
          }
        }
      }
      return NextResponse.json(data?.result ?? data);
    }

    const raw = await res.text();
    return NextResponse.json({ content: raw });
  } catch (err) {
    console.error('[DeepWiki MCP proxy]', err);
    return NextResponse.json({ error: 'DeepWiki MCP request failed' }, { status: 502 });
  }
}
