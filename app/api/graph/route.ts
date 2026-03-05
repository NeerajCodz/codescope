import { NextRequest, NextResponse } from 'next/server';
import { getSurrealClient, initSchema, saveAnalysisGraph, loadLatestAnalysis } from '@/lib/db';
import type { SaveGraphInput } from '@/lib/db';

/**
 * POST /api/graph — Save or load analysis graph (server-side, API mode)
 *
 * Body: { action: 'save' | 'load' | 'init', repo, branch?, data? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      action: 'save' | 'load' | 'init';
      repo?: string;
      branch?: string;
      data?: SaveGraphInput;
    };

    // Server-side always uses API mode (SurrealDB Cloud / self-hosted)
    const db = getSurrealClient('api');

    // Check connectivity
    const alive = await db.ping();
    if (!alive) {
      return NextResponse.json(
        { error: 'SurrealDB not available. Configure SURREALDB_URL in .env for API mode.', available: false },
        { status: 503 },
      );
    }

    switch (body.action) {
      case 'init': {
        const ok = await initSchema('api');
        return NextResponse.json({ success: ok });
      }

      case 'save': {
        if (!body.repo || !body.data) {
          return NextResponse.json({ error: 'Missing repo or data' }, { status: 400 });
        }
        const id = await saveAnalysisGraph(body.repo, body.branch || 'main', body.data, 'api');
        return NextResponse.json({ success: !!id, id });
      }

      case 'load': {
        if (!body.repo) {
          return NextResponse.json({ error: 'Missing repo' }, { status: 400 });
        }
        const result = await loadLatestAnalysis(body.repo, 'api');
        if (!result) {
          return NextResponse.json({ found: false });
        }
        return NextResponse.json({ found: true, data: result });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err) {
    console.error('Graph API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
