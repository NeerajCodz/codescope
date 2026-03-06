export { SurrealClient, getSurrealClient } from './client';
export type { SurrealConfig, DbMode } from './client';
export { initSchema, saveAnalysisGraph, loadLatestAnalysis } from './schema';
export type {
  DbAnalysis,
  DbGraphNode,
  DbGraphEdge,
  DbProcess,
  DbChatSession,
  DbChatMessage,
  DbDiagram,
  CreateNodeInput,
  CreateEdgeInput,
  CreateProcessInput,
  SaveGraphInput,
  LoadedGraph,
} from './types';
