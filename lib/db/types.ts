/**
 * SurrealDB entity types for CodeScope.
 *
 * Row types mirror the SCHEMAFULL table definitions exactly.
 * Input types (Create*) are used for insert payloads — optional fields use
 * `undefined` (mapped to SurrealDB NONE) NOT null (which SurrealDB rejects
 * for `option<T>` fields).
 */

// ─── Row types (as returned from db.query / db.select) ───────────────────────

export interface DbAnalysis {
  id: string;
  repo: string;
  branch: string;
  created_at: string;
  stats: Record<string, unknown>;
  file_count: number;
  connection_count: number;
}

export interface DbGraphNode {
  id: string;
  analysis_id: string;
  node_id: string;
  label: string;
  file: string;
  node_type: string;
  /** option<string> — undefined when not set */
  layer?: string;
  is_exported: boolean;
  /** option<int> — undefined when not set */
  complexity?: number;
}

export interface DbGraphEdge {
  id: string;
  analysis_id: string;
  source: string;
  target: string;
  fn_name: string;
  edge_count: number;
}

export interface DbProcess {
  id: string;
  analysis_id: string;
  label: string;
  process_type: string;
  entry_point: string;
  step_count: number;
  trace: string[];
  trace_files: string[];
  is_cross_file: boolean;
}

export interface DbChatSession {
  id: string;
  repo: string;
  focus_mode: string;
  /** option<string> */
  focus_target?: string;
  created_at: string;
}

export interface DbChatMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  /** option<int> */
  tokens?: number;
  created_at: string;
}

export interface DbDiagram {
  id: string;
  repo: string;
  diagram_type: string;
  title: string;
  /** option<string> */
  description?: string;
  mermaid_code: string;
  /** option<int> */
  tokens?: number;
  created_at: string;
}

// ─── Insert payload types ─────────────────────────────────────────────────────

/** Payload for a single graph node insert. */
export interface CreateNodeInput {
  /** Logical key (file path or function id) */
  id: string;
  label: string;
  file: string;
  type: string;
  /** Pass undefined (not null) to store as NONE */
  layer?: string;
  isExported?: boolean;
  /** Pass undefined (not null) to store as NONE */
  complexity?: number;
}

export interface CreateEdgeInput {
  source: string;
  target: string;
  /** Function name that creates this dependency */
  fn: string;
  count: number;
}

export interface CreateProcessInput {
  label: string;
  processType: string;
  entryPoint: string;
  stepCount: number;
  trace: string[];
  traceFiles: string[];
  isCrossFile: boolean;
}

/** Full payload sent to saveAnalysisGraph / POST /api/graph */
export interface SaveGraphInput {
  stats: Record<string, unknown>;
  nodes: CreateNodeInput[];
  edges: CreateEdgeInput[];
  processes: CreateProcessInput[];
}

/** Shape returned by loadLatestAnalysis */
export interface LoadedGraph {
  analysisId: string;
  repo: string;
  branch: string;
  createdAt: string;
  stats: Record<string, unknown>;
  nodes: DbGraphNode[];
  edges: DbGraphEdge[];
  processes: DbProcess[];
}
