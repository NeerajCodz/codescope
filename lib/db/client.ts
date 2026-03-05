/**
 * SurrealDB Unified Client
 *
 * Supports two modes:
 *  - **API mode** (advanced): Connects to SurrealDB Cloud or self-hosted via HTTP
 *  - **WASM mode** (simple): Runs SurrealDB in-browser via WebAssembly with IndexedDB storage
 *
 * No Docker dependency required.
 */

import { Surreal } from 'surrealdb';

export interface SurrealConfig {
  url: string;
  namespace: string;
  database: string;
  /** JWT token for SurrealDB Cloud JWT access method (JWKS-verified) */
  token?: string;
  /** Root username for SurrealDB (fallback when token is not a JWT) */
  username?: string;
  /** Root password for SurrealDB */
  password?: string;
}

export type DbMode = 'api' | 'wasm';

const DEFAULT_CONFIG: SurrealConfig = {
  url: process.env.NEXT_PUBLIC_SURREALDB_URL || process.env.SURREALDB_URL || 'http://localhost:8000',
  namespace: process.env.NEXT_PUBLIC_SURREALDB_NS || process.env.SURREALDB_NS || 'codescope',
  database: process.env.NEXT_PUBLIC_SURREALDB_DB || process.env.SURREALDB_DB || 'analysis',
  token: process.env.SURREALDB_TOKEN || process.env.NEXT_PUBLIC_SURREALDB_TOKEN,
  username: process.env.SURREALDB_USER,
  password: process.env.SURREALDB_PASS,
};

export class SurrealClient {
  private config: SurrealConfig;
  private db: Surreal | null = null;
  private connected = false;
  private mode: DbMode;
  private connectPromise: Promise<boolean> | null = null;

  constructor(mode: DbMode = 'wasm', config?: Partial<SurrealConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mode = mode;
  }

  /**
   * Connect to SurrealDB in the configured mode.
   */
  async connect(): Promise<boolean> {
    if (this.connected && this.db) return true;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this._connect();
    const result = await this.connectPromise;
    this.connectPromise = null;
    return result;
  }

  private async _connect(): Promise<boolean> {
    try {
      this.db = new Surreal();

      if (this.mode === 'wasm') {
        // In-browser embedded SurrealDB using IndexedDB
        await this.db.connect('indxdb://codescope');
      } else {
        // HTTP connection to SurrealDB Cloud or self-hosted
        await this.db.connect(this.config.url);
      }

      // Authenticate for API mode
      if (this.mode === 'api') {
        if (this.config.token && this.config.token.includes('.')) {
          // Looks like a JWT (has dot-separated segments) — use authenticate
          await this.db.authenticate(this.config.token);
        } else if (this.config.username && this.config.password) {
          // Root credentials signin
          await this.db.signin({
            username: this.config.username,
            password: this.config.password,
          });
        }
        // If neither JWT nor creds, connect without auth (e.g. public namespace)
      }

      // Select namespace and database
      await this.db.use({
        namespace: this.config.namespace,
        database: this.config.database,
      });

      this.connected = true;
      return true;
    } catch (err) {
      console.warn(`SurrealDB (${this.mode}) connection failed:`, err);
      this.db = null;
      this.connected = false;
      return false;
    }
  }

  /**
   * Test connection health.
   */
  async ping(): Promise<boolean> {
    if (!this.db || !this.connected) {
      return this.connect();
    }
    try {
      await this.db.query('RETURN true');
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  /**
   * Execute a SurrealQL query.
   */
  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]> {
    if (!this.connected) {
      const alive = await this.connect();
      if (!alive) return [];
    }

    try {
      const result = await this.db!.query<T[][]>(sql, vars);
      // SurrealDB SDK returns an array of statement results
      return (result as T[][]).flat();
    } catch (err) {
      console.warn('SurrealDB query error:', err);
      return [];
    }
  }

  /**
   * Create a record in a table.
   */
  async create<T>(table: string, data: Record<string, unknown>): Promise<T | null> {
    if (!this.connected) {
      const alive = await this.connect();
      if (!alive) return null;
    }

    try {
      const results = await this.query<T>(
        `CREATE type::table($table) CONTENT $data`,
        { table, data },
      );
      return results[0] ?? null;
    } catch (err) {
      console.warn('SurrealDB create error:', err);
      return null;
    }
  }

  /**
   * Select all records from a table, optionally with a WHERE clause.
   */
  async select<T>(table: string, where?: string): Promise<T[]> {
    const sql = where
      ? `SELECT * FROM ${table} WHERE ${where}`
      : `SELECT * FROM ${table}`;
    return this.query<T>(sql);
  }

  /**
   * Delete records from a table.
   */
  async deleteTable(table: string, where?: string): Promise<void> {
    const sql = where
      ? `DELETE FROM ${table} WHERE ${where}`
      : `DELETE ${table}`;
    await this.query(sql);
  }

  /**
   * Close the connection.
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getMode(): DbMode {
    return this.mode;
  }
}

// ── Singleton instances per mode ──

let _apiClient: SurrealClient | null = null;
let _wasmClient: SurrealClient | null = null;

/**
 * Get a SurrealDB client instance.
 * - `'api'` mode: For advanced/server-side use (SurrealDB Cloud or self-hosted)
 * - `'wasm'` mode: For simple/client-side use (in-browser via IndexedDB)
 */
export function getSurrealClient(mode: DbMode = 'wasm', config?: Partial<SurrealConfig>): SurrealClient {
  if (mode === 'api') {
    if (!_apiClient) _apiClient = new SurrealClient('api', config);
    return _apiClient;
  }
  if (!_wasmClient) _wasmClient = new SurrealClient('wasm', config);
  return _wasmClient;
}
