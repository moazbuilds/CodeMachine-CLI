/**
 * State Store Interface
 * Defines the contract for state persistence implementations
 */

import type { Result } from '../../../shared/types'

// ============================================================================
// Transaction Types
// ============================================================================

export interface Transaction {
  /** Set a value by key */
  set<T>(key: string, value: T): void

  /** Delete a key */
  delete(key: string): void

  /** Get a value (reads uncommitted changes in this transaction) */
  get<T>(key: string): T | undefined

  /** Check if key exists */
  has(key: string): boolean
}

export type TransactionOperation =
  | { type: 'set'; key: string; value: unknown }
  | { type: 'delete'; key: string }

// ============================================================================
// Store Interface
// ============================================================================

export interface IStateStore {
  /**
   * Execute operations atomically within a transaction
   * All operations either succeed together or are rolled back
   */
  transaction<T>(fn: (tx: Transaction) => T | Promise<T>): Promise<Result<T, Error>>

  /**
   * Get a value by key
   */
  get<T>(key: string): Promise<T | null>

  /**
   * Get multiple values by keys
   */
  getMany<T>(keys: string[]): Promise<Map<string, T>>

  /**
   * Get all keys matching a prefix
   */
  getByPrefix<T>(prefix: string): Promise<Map<string, T>>

  /**
   * Get the entire state snapshot
   */
  getSnapshot(): Promise<Record<string, unknown>>

  /**
   * Check if a key exists
   */
  has(key: string): Promise<boolean>

  /**
   * Recover from any incomplete transactions (called on startup)
   */
  recover(): Promise<Result<RecoveryInfo, Error>>

  /**
   * Compact the store (merge WAL into main file)
   */
  compact(): Promise<Result<void, Error>>

  /**
   * Close the store and release resources
   */
  close(): Promise<void>
}

export interface RecoveryInfo {
  /** Whether recovery was needed */
  recovered: boolean
  /** Number of transactions recovered */
  transactionsRecovered: number
  /** Number of operations recovered */
  operationsRecovered: number
  /** Any warnings during recovery */
  warnings: string[]
}

// ============================================================================
// Store Configuration
// ============================================================================

export interface StateStoreConfig {
  /** Directory for state files */
  dataDir: string

  /** Main state file name */
  stateFile?: string

  /** WAL file name */
  walFile?: string

  /** Auto-compact after N transactions (0 = disabled) */
  autoCompactThreshold?: number

  /** Sync writes to disk (slower but safer) */
  fsync?: boolean
}

export const defaultConfig: Required<Omit<StateStoreConfig, 'dataDir'>> = {
  stateFile: 'state.json',
  walFile: 'state.wal',
  autoCompactThreshold: 100,
  fsync: true,
}
