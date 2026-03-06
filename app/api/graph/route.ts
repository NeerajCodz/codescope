import { NextRequest, NextResponse } from 'next/server';
import { getSurrealClient, initSchema, saveAnalysisGraph, loadLatestAnalysis } from '@/lib/db';
import type { SaveGraphInput } from '@/lib/db';

/**
 * POST /api/graph — Save or load analysis graph (server-side, API mode)
 *
 * Body: { action: 'save' | 'load' | 'init', repo, branch?, data? }
 */

// Track DB availability to avoid repeated 503 failures
let _dbAvailable: boolean | null = null;
let _dbLastCheck = 0;
const DB_RETRY_INTERVAL = 60_000; // Only retry DB connection every 60s

export async function POST(request: NextRequest) {
  try {
    // Quick reject if DB is known unavailable (avoid repeated slow failures)
    const now = Date.now();
    if (_dbAvailable === false && now - _dbLastCheck < DB_RETRY_INTERVAL) {
      return NextResponse.json(
        { error: 'SurrealDB not available', available: false },
        { status: 503 },
      );
    }

    const body = await request.json() as {
      action: 'save' | 'load' | 'init';
      repo?: string;
      branch?: string;
      data?: SaveGraphInput;
    };

    // Validate action
    if (!['save', 'load', 'init'].includes(body.action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Server-side: uses API mode (auto-falls back to WASM if config invalid)
    const db = getSurrealClient('api');

    // Check connectivity
    const alive = await db.ping();
    _dbLastCheck = now;
    if (!alive) {
      _dbAvailable = false;
      return NextResponse.json(
        { error: `SurrealDB not available (${db.getMode()} mode). Configure SURREALDB_URL in .env for API mode.`, available: false },
        { status: 503 },
      );
    }
    _dbAvailable = true;

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
    // Mark DB as unavailable on connection errors to prevent repeated failures
    if (err instanceof Error && (err.message.includes('ECONNREFUSED') || err.message.includes('connect'))) {
      _dbAvailable = false;
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
