/**
 * SurrealDB Schema — Graph Persistence
 *
 * Defines the schema for storing code analysis graphs,
 * process detection results, and branch graph data in SurrealDB.
 */

import { getSurrealClient, type DbMode } from './client';
import type { SaveGraphInput, DbAnalysis, DbGraphNode, DbGraphEdge, DbProcess, LoadedGraph } from './types';

/**
 * Initialize the SurrealDB schema.
 * Creates tables and indexes if they don't exist.
 */
export async function initSchema(mode: DbMode = 'wasm'): Promise<boolean> {
  const db = getSurrealClient(mode);
  const alive = await db.ping();
  if (!alive) return false;

  const jwksUrl = process.env.SURREALDB_JWKS_URL;
  const jwksAud = process.env.SURREALDB_JWKS_AUD;
  const accessSql = jwksUrl && jwksAud
    ? `
    -- JWT access method (JWKS-verified via SurrealDB Cloud)
    DEFINE ACCESS IF NOT EXISTS cloud ON DATABASE TYPE JWT
      ALGORITHM JWKS
      URL '${jwksUrl}'
      AUTHENTICATE {
        IF $token.aud != '${jwksAud}' { THROW 'Invalid token aud' }
      };
    `
    : '';

  const schema = `
    ${accessSql}

    -- Analysis snapshots
    DEFINE TABLE IF NOT EXISTS analysis SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS repo ON analysis TYPE string;
    DEFINE FIELD IF NOT EXISTS branch ON analysis TYPE string;
    DEFINE FIELD IF NOT EXISTS created_at ON analysis TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS stats ON analysis TYPE object;
    DEFINE FIELD IF NOT EXISTS file_count ON analysis TYPE int;
    DEFINE FIELD IF NOT EXISTS connection_count ON analysis TYPE int;
    DEFINE INDEX IF NOT EXISTS idx_analysis_repo ON analysis COLUMNS repo;

    -- Graph nodes (files + functions)
    DEFINE TABLE IF NOT EXISTS graph_node SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS analysis_id ON graph_node TYPE string;
    DEFINE FIELD IF NOT EXISTS node_id ON graph_node TYPE string;
    DEFINE FIELD IF NOT EXISTS label ON graph_node TYPE string;
    DEFINE FIELD IF NOT EXISTS file ON graph_node TYPE string;
    DEFINE FIELD IF NOT EXISTS node_type ON graph_node TYPE string;
    DEFINE FIELD IF NOT EXISTS layer ON graph_node TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS is_exported ON graph_node TYPE bool DEFAULT false;
    DEFINE FIELD IF NOT EXISTS complexity ON graph_node TYPE option<int>;
    DEFINE INDEX IF NOT EXISTS idx_gn_analysis ON graph_node COLUMNS analysis_id;

    -- Graph edges (connections)
    DEFINE TABLE IF NOT EXISTS graph_edge SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS analysis_id ON graph_edge TYPE string;
    DEFINE FIELD IF NOT EXISTS source ON graph_edge TYPE string;
    DEFINE FIELD IF NOT EXISTS target ON graph_edge TYPE string;
    DEFINE FIELD IF NOT EXISTS fn_name ON graph_edge TYPE string;
    DEFINE FIELD IF NOT EXISTS edge_count ON graph_edge TYPE int DEFAULT 1;
    DEFINE INDEX IF NOT EXISTS idx_ge_analysis ON graph_edge COLUMNS analysis_id;

    -- Detected processes
    DEFINE TABLE IF NOT EXISTS process SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS analysis_id ON process TYPE string;
    DEFINE FIELD IF NOT EXISTS label ON process TYPE string;
    DEFINE FIELD IF NOT EXISTS process_type ON process TYPE string;
    DEFINE FIELD IF NOT EXISTS entry_point ON process TYPE string;
    DEFINE FIELD IF NOT EXISTS step_count ON process TYPE int;
    DEFINE FIELD IF NOT EXISTS trace ON process TYPE array;
    DEFINE FIELD IF NOT EXISTS trace_files ON process TYPE array;
    DEFINE FIELD IF NOT EXISTS is_cross_file ON process TYPE bool DEFAULT false;
    DEFINE INDEX IF NOT EXISTS idx_proc_analysis ON process COLUMNS analysis_id;
  `;

  await db.query(schema);
  return true;
}

/**
 * Save an analysis graph to SurrealDB.
 */
export async function saveAnalysisGraph(
  repo: string,
  branch: string,
  data: SaveGraphInput,
  mode: DbMode = 'wasm',
): Promise<string | null> {
  const db = getSurrealClient(mode);
  if (!db.isConnected()) return null;

  // Create analysis record
  const analysis = await db.create<DbAnalysis>('analysis', {
    repo,
    branch,
    stats: data.stats,
    file_count: data.nodes.length,
    connection_count: data.edges.length,
  });

  if (!analysis) return null;
  const rawAnalysisId = typeof analysis.id === 'string' ? analysis.id : String(analysis.id);
  const analysisId = rawAnalysisId.includes(':') ? rawAnalysisId.split(':').pop()! : rawAnalysisId;

  // Batch insert nodes
  // IMPORTANT: pass `undefined` (not `null`) for option<T> fields.
  // SurrealDB rejects NULL for option<string> — only NONE (undefined) is valid.
  for (const node of data.nodes) {
    await db.create<DbGraphNode>('graph_node', {
      analysis_id: analysisId,
      node_id: node.id,
      label: node.label,
      file: node.file,
      node_type: node.type,
      layer: node.layer ?? undefined,
      is_exported: node.isExported ?? false,
      complexity: node.complexity ?? undefined,
    });
  }

  // Batch insert edges
  for (const edge of data.edges) {
    await db.create<DbGraphEdge>('graph_edge', {
      analysis_id: analysisId,
      source: edge.source,
      target: edge.target,
      fn_name: edge.fn,
      edge_count: edge.count,
    });
  }

  // Batch insert processes
  for (const proc of data.processes) {
    await db.create<DbProcess>('process', {
      analysis_id: analysisId,
      label: proc.label,
      process_type: proc.processType,
      entry_point: proc.entryPoint,
      step_count: proc.stepCount,
      trace: proc.trace,
      trace_files: proc.traceFiles,
      is_cross_file: proc.isCrossFile,
    });
  }

  return analysisId;
}

/**
 * Load the most recent analysis for a repo.
 */
export async function loadLatestAnalysis(repo: string, mode: DbMode = 'wasm'): Promise<LoadedGraph | null> {
  const db = getSurrealClient(mode);
  if (!db.isConnected()) return null;

  const analyses = await db.select<DbAnalysis>('analysis', `repo = '${repo}' ORDER BY created_at DESC LIMIT 1`);
  if (!analyses.length) return null;
  const analysis = analyses[0];
  const rawId = typeof analysis.id === 'string' ? analysis.id : String(analysis.id);
  const analysisId = rawId.includes(':') ? rawId.split(':').pop()! : rawId;

  const [nodes, edges, processes] = await Promise.all([
    db.select<DbGraphNode>('graph_node', `analysis_id = '${analysisId}'`),
    db.select<DbGraphEdge>('graph_edge', `analysis_id = '${analysisId}'`),
    db.select<DbProcess>('process', `analysis_id = '${analysisId}'`),
  ]);

  return {
    analysisId,
    repo: analysis.repo,
    branch: analysis.branch,
    createdAt: analysis.created_at,
    stats: analysis.stats,
    nodes,
    edges,
    processes,
  };
}
