import { NextRequest, NextResponse } from 'next/server';

const CODEWIKI_BASE = 'https://codewiki.google';
const BATCH_ENDPOINT = `${CODEWIKI_BASE}/_/BoqAngularSdlcAgentsUi/data/batchexecute`;

// RPC IDs for each tool
const RPC_IDS: Record<string, string> = {
  codewiki_search_repos: 'vyWDAf',
  codewiki_fetch_repo: 'VSX6ub',
  codewiki_ask_repo: 'EgIxfe',
};

/**
 * Build the Google batchexecute envelope for a single RPC call.
 */
function buildBatchBody(rpcId: string, payload: unknown[]): string {
  const inner = JSON.stringify(payload);
  const envelope = [[rpcId, inner, null, 'generic']];
  return `f.req=${encodeURIComponent(JSON.stringify([envelope]))}`;
}

/**
 * Parse the batchexecute response — strip the )]}\'\n prefix and extract JSON.
 */
function parseBatchResponse(raw: string): unknown {
  // Google prefixes responses with )]}' or similar
  const cleaned = raw.replace(/^\)]\}'\s*\n?/, '');
  try {
    // The outer array wraps multiple results
    const outer = JSON.parse(cleaned);
    // First result: [0][2] holds the data JSON string
    if (Array.isArray(outer) && outer[0]?.[2]) {
      return JSON.parse(outer[0][2]);
    }
    return outer;
  } catch {
    // Try line-by-line: batchexecute sometimes has length-prefixed lines
    const lines = cleaned.split('\n').filter(l => l.trim() && !/^\d+$/.test(l.trim()));
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (Array.isArray(parsed) && parsed[0]?.[2]) {
          return JSON.parse(parsed[0][2]);
        }
        return parsed;
      } catch { /* try next line */ }
    }
    return { raw: cleaned };
  }
}

/**
 * Proxy for CodeWiki Google (codewiki.google batchexecute RPC).
 * Tools: codewiki_search_repos, codewiki_fetch_repo, codewiki_ask_repo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, args } = body as { tool: string; args: Record<string, unknown> };

    if (!tool || !args) {
      return NextResponse.json({ error: 'Missing tool or args' }, { status: 400 });
    }

    const rpcId = RPC_IDS[tool];
    if (!rpcId) {
      return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    let payload: unknown[];

    switch (tool) {
      case 'codewiki_search_repos':
        payload = [args.query ?? '', args.limit ?? 10];
        break;
      case 'codewiki_fetch_repo':
        payload = [args.repo ?? '', args.mode ?? 'aggregate'];
        break;
      case 'codewiki_ask_repo': {
        const history = Array.isArray(args.history) ? args.history : [];
        payload = [args.repo ?? '', args.question ?? '', history];
        break;
      }
      default:
        return NextResponse.json({ error: 'Invalid tool' }, { status: 400 });
    }

    const res = await fetch(BATCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        Origin: CODEWIKI_BASE,
        Referer: `${CODEWIKI_BASE}/`,
      },
      body: buildBatchBody(rpcId, payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[CodeWiki proxy] upstream error:', res.status, text.slice(0, 200));
      return NextResponse.json({ error: 'CodeWiki request failed', status: res.status }, { status: 502 });
    }

    const raw = await res.text();
    const parsed = parseBatchResponse(raw);

    // Normalize output to { answer, content, repos } shape
    if (tool === 'codewiki_ask_repo') {
      // The answer is usually the first string element in the result array
      const answer = typeof parsed === 'string' ? parsed
        : Array.isArray(parsed) ? (parsed[0] ?? JSON.stringify(parsed))
        : JSON.stringify(parsed);
      return NextResponse.json({ answer });
    }

    return NextResponse.json(typeof parsed === 'object' ? parsed : { content: parsed });
  } catch (err) {
    console.error('[CodeWiki proxy]', err);
    return NextResponse.json({ error: 'CodeWiki proxy request failed' }, { status: 502 });
  }
}
