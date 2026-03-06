/**
 * SurrealDB Seed Script
 *
 * Sets up the database schema, creates tables, indexes, and inserts
 * sample data for development. Run with: npx tsx db/surreal/seed.ts
 *
 * Prerequisites:
 *   - SurrealDB running via Docker:
 *       docker run --rm -p 8000:8000 surrealdb/surrealdb:latest start --user root --pass root memory
 *   - Or set SURREALDB_URL / SURREALDB_USER / SURREALDB_PASS env vars
 */

import { Surreal } from 'surrealdb';
import type {
  DbAnalysis,
  DbGraphNode,
  DbGraphEdge,
  DbProcess,
  DbDiagram,
} from '../../lib/db/types';

// --- Config ------------------------------------------------------------------

const config = {
  url:       process.env.SURREALDB_URL  || 'http://localhost:8000',
  namespace: process.env.SURREALDB_NS   || 'codescope',
  database:  process.env.SURREALDB_DB   || 'analysis',
  username:  process.env.SURREALDB_USER || 'root',
  password:  process.env.SURREALDB_PASS || 'root',
};

// --- Schema DDL --------------------------------------------------------------

const SCHEMA_SQL = `
DEFINE TABLE IF NOT EXISTS analysis SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS repo             ON analysis TYPE string;
DEFINE FIELD IF NOT EXISTS branch           ON analysis TYPE string;
DEFINE FIELD IF NOT EXISTS created_at       ON analysis TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS stats            ON analysis TYPE object;
DEFINE FIELD IF NOT EXISTS file_count       ON analysis TYPE int;
DEFINE FIELD IF NOT EXISTS connection_count ON analysis TYPE int;
DEFINE INDEX IF NOT EXISTS idx_analysis_repo   ON analysis COLUMNS repo;
DEFINE INDEX IF NOT EXISTS idx_analysis_branch ON analysis COLUMNS branch;

DEFINE TABLE IF NOT EXISTS graph_node SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS analysis_id ON graph_node TYPE string;
DEFINE FIELD IF NOT EXISTS node_id     ON graph_node TYPE string;
DEFINE FIELD IF NOT EXISTS label       ON graph_node TYPE string;
DEFINE FIELD IF NOT EXISTS file        ON graph_node TYPE string;
DEFINE FIELD IF NOT EXISTS node_type   ON graph_node TYPE string;
DEFINE FIELD IF NOT EXISTS layer       ON graph_node TYPE option<string>;
DEFINE FIELD IF NOT EXISTS is_exported ON graph_node TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS complexity  ON graph_node TYPE option<int>;
DEFINE INDEX IF NOT EXISTS idx_gn_analysis ON graph_node COLUMNS analysis_id;
DEFINE INDEX IF NOT EXISTS idx_gn_nodeid   ON graph_node COLUMNS node_id;

DEFINE TABLE IF NOT EXISTS graph_edge SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS analysis_id ON graph_edge TYPE string;
DEFINE FIELD IF NOT EXISTS source      ON graph_edge TYPE string;
DEFINE FIELD IF NOT EXISTS target      ON graph_edge TYPE string;
DEFINE FIELD IF NOT EXISTS fn_name     ON graph_edge TYPE string;
DEFINE FIELD IF NOT EXISTS edge_count  ON graph_edge TYPE int DEFAULT 1;
DEFINE INDEX IF NOT EXISTS idx_ge_analysis ON graph_edge COLUMNS analysis_id;

DEFINE TABLE IF NOT EXISTS process SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS analysis_id   ON process TYPE string;
DEFINE FIELD IF NOT EXISTS label         ON process TYPE string;
DEFINE FIELD IF NOT EXISTS process_type  ON process TYPE string;
DEFINE FIELD IF NOT EXISTS entry_point   ON process TYPE string;
DEFINE FIELD IF NOT EXISTS step_count    ON process TYPE int;
DEFINE FIELD IF NOT EXISTS trace         ON process TYPE array;
DEFINE FIELD IF NOT EXISTS trace_files   ON process TYPE array;
DEFINE FIELD IF NOT EXISTS is_cross_file ON process TYPE bool DEFAULT false;
DEFINE INDEX IF NOT EXISTS idx_proc_analysis ON process COLUMNS analysis_id;

DEFINE TABLE IF NOT EXISTS chat_session SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS repo         ON chat_session TYPE string;
DEFINE FIELD IF NOT EXISTS focus_mode   ON chat_session TYPE string DEFAULT 'repo';
DEFINE FIELD IF NOT EXISTS focus_target ON chat_session TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at   ON chat_session TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_cs_repo  ON chat_session COLUMNS repo;

DEFINE TABLE IF NOT EXISTS chat_message SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS session_id ON chat_message TYPE string;
DEFINE FIELD IF NOT EXISTS role       ON chat_message TYPE string;
DEFINE FIELD IF NOT EXISTS content    ON chat_message TYPE string;
DEFINE FIELD IF NOT EXISTS tokens     ON chat_message TYPE option<int>;
DEFINE FIELD IF NOT EXISTS created_at ON chat_message TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_cm_session ON chat_message COLUMNS session_id;

DEFINE TABLE IF NOT EXISTS diagram SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS repo         ON diagram TYPE string;
DEFINE FIELD IF NOT EXISTS diagram_type ON diagram TYPE string;
DEFINE FIELD IF NOT EXISTS title        ON diagram TYPE string;
DEFINE FIELD IF NOT EXISTS description  ON diagram TYPE option<string>;
DEFINE FIELD IF NOT EXISTS mermaid_code ON diagram TYPE string;
DEFINE FIELD IF NOT EXISTS tokens       ON diagram TYPE option<int>;
DEFINE FIELD IF NOT EXISTS created_at   ON diagram TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_diag_repo ON diagram COLUMNS repo;
`;

// --- Typed seed fixtures -----------------------------------------------------

const SEED_ANALYSIS_ID = 'seed';

// Omit id / created_at which SurrealDB generates.
// IMPORTANT: use undefined (not null) for option<T> fields — SurrealDB rejects NULL.
type AnalysisSeed  = Omit<DbAnalysis,   'id' | 'created_at'>;
type GraphNodeSeed = Omit<DbGraphNode,  'id'>;
type GraphEdgeSeed = Omit<DbGraphEdge,  'id'>;
type ProcessSeed   = Omit<DbProcess,    'id'>;
type DiagramSeed   = Omit<DbDiagram,    'id' | 'created_at'>;

// Wrapper: use raw SurrealQL so we're not at the mercy of SDK overload signatures
async function insert(db: Surreal, table: string, data: Record<string, unknown>): Promise<void> {
  await db.query(`CREATE type::table($tb) CONTENT $data`, { tb: table, data });
}

const seedAnalysis: AnalysisSeed = {
  repo:             'github.com/example/demo-app',
  branch:           'main',
  stats:            { files: 42, codeFiles: 35, functions: 128, dead: 8, connections: 96, avgComplexity: 3.2 },
  file_count:       42,
  connection_count: 96,
};

const seedNodes: GraphNodeSeed[] = [
  { analysis_id: SEED_ANALYSIS_ID, node_id: 'src/app.tsx',          label: 'app.tsx',      file: 'src/app.tsx',          node_type: 'file', layer: 'ui',    is_exported: true,  complexity: 4 },
  { analysis_id: SEED_ANALYSIS_ID, node_id: 'src/api/users.ts',     label: 'users.ts',     file: 'src/api/users.ts',     node_type: 'file', layer: 'api',   is_exported: true,  complexity: 6 },
  { analysis_id: SEED_ANALYSIS_ID, node_id: 'src/db/prisma.ts',     label: 'prisma.ts',    file: 'src/db/prisma.ts',     node_type: 'file', layer: 'lib',   is_exported: true,  complexity: 2 },
  { analysis_id: SEED_ANALYSIS_ID, node_id: 'src/utils/format.ts',  label: 'format.ts',    file: 'src/utils/format.ts',  node_type: 'file', layer: 'utils', is_exported: true,  complexity: 1 },
  // layer/complexity intentionally absent (stored as NONE in SurrealDB, not NULL)
  { analysis_id: SEED_ANALYSIS_ID, node_id: 'src/index.ts',         label: 'index.ts',     file: 'src/index.ts',         node_type: 'file', layer: undefined, is_exported: true,  complexity: undefined },
];

const seedEdges: GraphEdgeSeed[] = [
  { analysis_id: SEED_ANALYSIS_ID, source: 'src/app.tsx',      target: 'src/api/users.ts',     fn_name: 'fetchUsers',  edge_count: 3 },
  { analysis_id: SEED_ANALYSIS_ID, source: 'src/api/users.ts', target: 'src/db/prisma.ts',     fn_name: 'prismaQuery', edge_count: 5 },
  { analysis_id: SEED_ANALYSIS_ID, source: 'src/app.tsx',      target: 'src/utils/format.ts',  fn_name: 'formatDate',  edge_count: 2 },
  { analysis_id: SEED_ANALYSIS_ID, source: 'src/index.ts',     target: 'src/app.tsx',          fn_name: 'mountApp',    edge_count: 1 },
];

const seedProcesses: ProcessSeed[] = [
  {
    analysis_id:   SEED_ANALYSIS_ID,
    label:         'User Login Flow',
    process_type:  'user-flow',
    entry_point:   'src/app.tsx::handleLogin',
    step_count:    4,
    trace:         ['src/app.tsx::handleLogin', 'src/api/users.ts::authenticate', 'src/db/prisma.ts::findUser', 'src/app.tsx::setSession'],
    trace_files:   ['src/app.tsx', 'src/api/users.ts', 'src/db/prisma.ts'],
    is_cross_file: true,
  },
];

const seedDiagrams: DiagramSeed[] = [
  {
    repo:         'github.com/example/demo-app',
    diagram_type: 'architecture',
    title:        'Architecture Overview',
    description:  'Auto-generated system architecture',
    mermaid_code: 'graph TD\n  A[Frontend] --> B[API Layer]\n  B --> C[Database]\n  B --> D[Utils]',
    tokens:       150,
  },
];

// --- Main --------------------------------------------------------------------

async function seed() {
  console.log('');
  console.log('CodeScope -- SurrealDB Seed');
  console.log('');
  console.log(`URL:       ${config.url}`);
  console.log(`Namespace: ${config.namespace}`);
  console.log(`Database:  ${config.database}`);
  console.log('');

  const db = new Surreal();

  try {
    console.log('Connecting...');
    await db.connect(config.url);
    await db.signin({ username: config.username, password: config.password });
    await db.query(`USE NS ${config.namespace} DB ${config.database}`);
    console.log('  Connected');

    console.log('\nApplying schema...');
    await db.query(SCHEMA_SQL);
    console.log('  Schema applied');

    console.log('\nClearing existing data...');
    await db.query(`
      DELETE analysis;
      DELETE graph_node;
      DELETE graph_edge;
      DELETE process;
      DELETE chat_session;
      DELETE chat_message;
      DELETE diagram;
    `);
    console.log('  Tables cleared');

    console.log('\nInserting seed data...');

    await insert(db, 'analysis', seedAnalysis as Record<string, unknown>);
    console.log('  analysis:   1 row');

    for (const node of seedNodes) {
      await insert(db, 'graph_node', node as Record<string, unknown>);
    }
    console.log(`  graph_node: ${seedNodes.length} rows`);

    for (const edge of seedEdges) {
      await insert(db, 'graph_edge', edge as Record<string, unknown>);
    }
    console.log(`  graph_edge: ${seedEdges.length} rows`);

    for (const proc of seedProcesses) {
      await insert(db, 'process', proc as Record<string, unknown>);
    }
    console.log(`  process:    ${seedProcesses.length} rows`);

    for (const diagram of seedDiagrams) {
      await insert(db, 'diagram', diagram as Record<string, unknown>);
    }
    console.log(`  diagram:    ${seedDiagrams.length} rows`);

    console.log('\nVerifying counts...');

    const count = async (table: string) => {
      const [rows] = await db.query<[{ count: number }[]]>(
        `SELECT count() FROM ${table} GROUP ALL`,
      );
      return rows?.[0]?.count ?? 0;
    };

    const results = {
      analysis:   await count('analysis'),
      graph_node: await count('graph_node'),
      graph_edge: await count('graph_edge'),
      process:    await count('process'),
      diagram:    await count('diagram'),
    };

    for (const [table, n] of Object.entries(results)) {
      console.log(`  ${table.padEnd(12)} ${n}`);
    }

    console.log('\nDatabase seeded successfully!');
  } catch (e) {
    console.error('Seed failed:', e instanceof Error ? e.message : String(e));
    console.error(e);
    process.exit(1);
  } finally {
    await db.close();
  }
}

seed();
