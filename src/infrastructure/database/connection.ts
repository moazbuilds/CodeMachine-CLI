/**
 * Unified Database Connection Manager
 *
 * Provides a centralized SQLite connection with Drizzle ORM.
 * Replaces the fragmented database connections across the codebase.
 */

import { Database } from 'bun:sqlite'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import * as schema from './schema/index.js'

// Type for the Drizzle database instance with schema
export type DrizzleDB = BunSQLiteDatabase<typeof schema>

// Connection configuration
export interface DatabaseConfig {
  /** Path to the SQLite database file */
  path?: string
  /** Enable WAL mode (default: true) */
  walMode?: boolean
  /** Enable foreign keys (default: true) */
  foreignKeys?: boolean
  /** Busy timeout in ms (default: 5000) */
  busyTimeout?: number
  /** Journal size limit in bytes (default: 67108864 = 64MB) */
  journalSizeLimit?: number
}

const DEFAULT_CONFIG: Required<DatabaseConfig> = {
  path: '.codemachine/data/codemachine.db',
  walMode: true,
  foreignKeys: true,
  busyTimeout: 5000,
  journalSizeLimit: 67108864, // 64MB
}

// Singleton instances
let rawDb: Database | null = null
let drizzleDb: DrizzleDB | null = null
let currentConfig: Required<DatabaseConfig> = DEFAULT_CONFIG

/**
 * Get the Drizzle database instance
 *
 * @param config Optional configuration (only used on first call)
 * @returns Drizzle database instance with schema
 */
export function getDatabase(config?: DatabaseConfig): DrizzleDB {
  if (drizzleDb) return drizzleDb

  currentConfig = { ...DEFAULT_CONFIG, ...config }
  rawDb = createConnection(currentConfig)
  drizzleDb = drizzle(rawDb, { schema })

  return drizzleDb
}

/**
 * Get the raw bun:sqlite Database instance
 * Use this only when Drizzle doesn't support a feature
 */
export function getRawDatabase(): Database {
  if (!rawDb) {
    getDatabase() // Initialize if not already done
  }
  return rawDb!
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (rawDb) {
    rawDb.close()
    rawDb = null
    drizzleDb = null
  }
}

/**
 * Get the current database path
 */
export function getDatabasePath(): string {
  return currentConfig.path
}

/**
 * Create a new SQLite connection with optimal settings
 */
function createConnection(config: Required<DatabaseConfig>): Database {
  // Ensure directory exists
  const dir = dirname(config.path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const db = new Database(config.path)

  // Apply PRAGMA settings for performance and reliability
  if (config.walMode) {
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = NORMAL')
    db.exec(`PRAGMA journal_size_limit = ${config.journalSizeLimit}`)
  }

  if (config.foreignKeys) {
    db.exec('PRAGMA foreign_keys = ON')
  }

  db.exec(`PRAGMA busy_timeout = ${config.busyTimeout}`)

  // Performance optimizations
  db.exec('PRAGMA cache_size = -64000') // 64MB cache
  db.exec('PRAGMA temp_store = MEMORY')
  db.exec('PRAGMA mmap_size = 268435456') // 256MB memory-mapped I/O

  // Initialize schema
  initializeSchema(db)

  return db
}

/**
 * Initialize database schema
 */
function initializeSchema(db: Database): void {
  // Create tables
  db.exec(`
    -- Agents table
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      engine TEXT,
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'paused')),
      parent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      pid INTEGER,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration INTEGER,
      prompt TEXT NOT NULL,
      log_path TEXT NOT NULL,
      error TEXT,
      engine_provider TEXT,
      model_name TEXT,
      session_id TEXT,
      accumulated_duration INTEGER DEFAULT 0,
      last_duration_update INTEGER,
      pause_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_agents_parent_id ON agents(parent_id);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    CREATE INDEX IF NOT EXISTS idx_agents_session_id ON agents(session_id);

    -- Telemetry table
    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      cached_tokens INTEGER DEFAULT 0,
      cost REAL,
      cache_creation_tokens INTEGER,
      cache_read_tokens INTEGER,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_agent_id ON telemetry(agent_id);

    -- Telemetry snapshots (for historical analytics)
    CREATE TABLE IF NOT EXISTS telemetry_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      step_index INTEGER,
      agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
      engine TEXT,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      cached_tokens INTEGER DEFAULT 0,
      cost REAL,
      duration INTEGER,
      timestamp INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_workflow ON telemetry_snapshots(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_timestamp ON telemetry_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_engine ON telemetry_snapshots(engine);

    -- Events table (event sourcing)
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      correlation_id TEXT,
      causation_id TEXT,
      aggregate_id TEXT,
      aggregate_type TEXT,
      payload TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);
    CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_id, aggregate_type);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

    -- Logs table (indexed logs)
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      level TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error')),
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      context TEXT,
      source TEXT,
      correlation_id TEXT,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_logs_agent_id ON logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_correlation ON logs(correlation_id);

    -- Workflow states table (crash recovery)
    CREATE TABLE IF NOT EXISTS workflow_states (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL CHECK(state IN ('idle', 'running', 'waiting', 'completed', 'stopped', 'error')),
      current_step_index INTEGER NOT NULL DEFAULT 0,
      total_steps INTEGER NOT NULL DEFAULT 0,
      auto_mode INTEGER NOT NULL DEFAULT 0,
      context TEXT,
      cm_root TEXT NOT NULL,
      cwd TEXT NOT NULL,
      started_at INTEGER,
      updated_at INTEGER NOT NULL
    );

    -- Workflow checkpoints (recovery points)
    CREATE TABLE IF NOT EXISTS workflow_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
      step_index INTEGER NOT NULL,
      output TEXT,
      session_id TEXT,
      monitoring_id INTEGER,
      timestamp INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_checkpoints_workflow ON workflow_checkpoints(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_step ON workflow_checkpoints(workflow_id, step_index);
  `)

  // Create FTS5 virtual table for full-text search on logs
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(
        message,
        content=logs,
        content_rowid=id,
        tokenize='porter unicode61'
      );

      -- Triggers to keep FTS index in sync
      CREATE TRIGGER IF NOT EXISTS logs_ai AFTER INSERT ON logs BEGIN
        INSERT INTO logs_fts(rowid, message) VALUES (new.id, new.message);
      END;

      CREATE TRIGGER IF NOT EXISTS logs_ad AFTER DELETE ON logs BEGIN
        INSERT INTO logs_fts(logs_fts, rowid, message) VALUES('delete', old.id, old.message);
      END;

      CREATE TRIGGER IF NOT EXISTS logs_au AFTER UPDATE ON logs BEGIN
        INSERT INTO logs_fts(logs_fts, rowid, message) VALUES('delete', old.id, old.message);
        INSERT INTO logs_fts(rowid, message) VALUES (new.id, new.message);
      END;
    `)
  } catch {
    // FTS5 triggers might already exist, ignore
  }
}

/**
 * Run a transaction with automatic rollback on error
 */
export async function transaction<T>(
  fn: (db: DrizzleDB) => Promise<T>
): Promise<T> {
  const db = getDatabase()
  const raw = getRawDatabase()

  raw.exec('BEGIN TRANSACTION')
  try {
    const result = await fn(db)
    raw.exec('COMMIT')
    return result
  } catch (error) {
    raw.exec('ROLLBACK')
    throw error
  }
}

/**
 * Run a synchronous transaction
 */
export function transactionSync<T>(fn: (db: DrizzleDB) => T): T {
  const db = getDatabase()
  const raw = getRawDatabase()

  raw.exec('BEGIN TRANSACTION')
  try {
    const result = fn(db)
    raw.exec('COMMIT')
    return result
  } catch (error) {
    raw.exec('ROLLBACK')
    throw error
  }
}
