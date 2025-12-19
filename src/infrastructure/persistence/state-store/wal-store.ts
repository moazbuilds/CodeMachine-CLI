/**
 * Write-Ahead Log (WAL) State Store
 *
 * Provides crash-safe state persistence with ACID-like transactions.
 *
 * How it works:
 * 1. All writes go to a WAL file first (append-only)
 * 2. On commit, WAL entry is marked as committed
 * 3. Periodically, WAL is compacted into main state file
 * 4. On recovery, uncommitted entries are discarded
 *
 * File format:
 * - state.json: Main state snapshot
 * - state.wal: Append-only write-ahead log
 *
 * WAL entry format (JSON lines):
 * {"txId":"tx_123","status":"pending","ops":[...]}
 * {"txId":"tx_123","status":"committed"}
 */

import * as fs from 'fs'
import * as path from 'path'
import { err, ok, type Result } from '../../../shared/types'
import { StateCorruptionError, StateRecoveryError, StateWriteError } from '../../../shared/errors'
import type {
  IStateStore,
  RecoveryInfo,
  StateStoreConfig,
  Transaction,
  TransactionOperation,
  defaultConfig,
} from './store.interface'

// ============================================================================
// WAL Entry Types
// ============================================================================

interface WALEntry {
  txId: string
  timestamp: number
  status: 'pending' | 'committed'
  ops?: TransactionOperation[]
}

// ============================================================================
// Transaction Implementation
// ============================================================================

class WALTransaction implements Transaction {
  private operations: TransactionOperation[] = []
  private localChanges = new Map<string, unknown>()
  private deletedKeys = new Set<string>()

  constructor(
    private readonly state: Map<string, unknown>,
    readonly txId: string
  ) {}

  set<T>(key: string, value: T): void {
    this.operations.push({ type: 'set', key, value })
    this.localChanges.set(key, value)
    this.deletedKeys.delete(key)
  }

  delete(key: string): void {
    this.operations.push({ type: 'delete', key })
    this.localChanges.delete(key)
    this.deletedKeys.add(key)
  }

  get<T>(key: string): T | undefined {
    // Check local changes first
    if (this.deletedKeys.has(key)) {
      return undefined
    }
    if (this.localChanges.has(key)) {
      return this.localChanges.get(key) as T
    }
    // Fall back to committed state
    return this.state.get(key) as T | undefined
  }

  has(key: string): boolean {
    if (this.deletedKeys.has(key)) {
      return false
    }
    return this.localChanges.has(key) || this.state.has(key)
  }

  getOperations(): TransactionOperation[] {
    return this.operations
  }
}

// ============================================================================
// WAL Store Implementation
// ============================================================================

export class WALStateStore implements IStateStore {
  private state = new Map<string, unknown>()
  private readonly statePath: string
  private readonly walPath: string
  private readonly config: Required<StateStoreConfig>
  private transactionCounter = 0
  private uncommittedCount = 0
  private isClosing = false
  private writeQueue = Promise.resolve()

  constructor(config: StateStoreConfig) {
    this.config = {
      ...{
        stateFile: 'state.json',
        walFile: 'state.wal',
        autoCompactThreshold: 100,
        fsync: true,
      },
      ...config,
    } as Required<StateStoreConfig>

    this.statePath = path.join(config.dataDir, this.config.stateFile)
    this.walPath = path.join(config.dataDir, this.config.walFile)

    // Ensure directory exists
    fs.mkdirSync(config.dataDir, { recursive: true })
  }

  /**
   * Initialize and recover from any previous crash
   */
  static async create(config: StateStoreConfig): Promise<Result<WALStateStore, Error>> {
    const store = new WALStateStore(config)
    const recoveryResult = await store.recover()

    if (!recoveryResult.ok) {
      return err(recoveryResult.error)
    }

    return ok(store)
  }

  /**
   * Execute a transaction atomically
   */
  async transaction<T>(fn: (tx: Transaction) => T | Promise<T>): Promise<Result<T, Error>> {
    if (this.isClosing) {
      return err(new Error('Store is closing'))
    }

    const txId = `tx_${Date.now()}_${this.transactionCounter++}`
    const tx = new WALTransaction(this.state, txId)

    try {
      // Execute transaction logic
      const result = await fn(tx)
      const operations = tx.getOperations()

      // If no operations, just return the result
      if (operations.length === 0) {
        return ok(result)
      }

      // Queue the write to ensure sequential WAL writes
      await this.queueWrite(async () => {
        // Write pending entry to WAL
        await this.writeWALEntry({
          txId,
          timestamp: Date.now(),
          status: 'pending',
          ops: operations,
        })

        // Apply operations to in-memory state
        for (const op of operations) {
          if (op.type === 'set') {
            this.state.set(op.key, op.value)
          } else {
            this.state.delete(op.key)
          }
        }

        // Write commit marker to WAL
        await this.writeWALEntry({
          txId,
          timestamp: Date.now(),
          status: 'committed',
        })

        this.uncommittedCount++
      })

      // Auto-compact if threshold reached
      if (
        this.config.autoCompactThreshold > 0 &&
        this.uncommittedCount >= this.config.autoCompactThreshold
      ) {
        // Compact in background, don't await
        this.compact().catch(console.error)
      }

      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Get a single value
   */
  async get<T>(key: string): Promise<T | null> {
    const value = this.state.get(key)
    return value === undefined ? null : (value as T)
  }

  /**
   * Get multiple values
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>()
    for (const key of keys) {
      const value = this.state.get(key)
      if (value !== undefined) {
        result.set(key, value as T)
      }
    }
    return result
  }

  /**
   * Get all values with a key prefix
   */
  async getByPrefix<T>(prefix: string): Promise<Map<string, T>> {
    const result = new Map<string, T>()
    for (const [key, value] of this.state) {
      if (key.startsWith(prefix)) {
        result.set(key, value as T)
      }
    }
    return result
  }

  /**
   * Get full state snapshot
   */
  async getSnapshot(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.state)
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    return this.state.has(key)
  }

  /**
   * Recover from crash - replay committed transactions
   */
  async recover(): Promise<Result<RecoveryInfo, Error>> {
    const info: RecoveryInfo = {
      recovered: false,
      transactionsRecovered: 0,
      operationsRecovered: 0,
      warnings: [],
    }

    try {
      // Load main state file if it exists
      if (fs.existsSync(this.statePath)) {
        try {
          const stateData = await fs.promises.readFile(this.statePath, 'utf-8')
          const parsed = JSON.parse(stateData)
          for (const [key, value] of Object.entries(parsed)) {
            this.state.set(key, value)
          }
        } catch (e) {
          info.warnings.push(`Failed to parse state file: ${e}`)
        }
      }

      // Replay WAL if it exists
      if (fs.existsSync(this.walPath)) {
        const walData = await fs.promises.readFile(this.walPath, 'utf-8')
        const lines = walData.trim().split('\n').filter(Boolean)

        // Parse all entries
        const entries = new Map<string, { pending?: WALEntry; committed: boolean }>()

        for (const line of lines) {
          try {
            const entry: WALEntry = JSON.parse(line)

            if (!entries.has(entry.txId)) {
              entries.set(entry.txId, { committed: false })
            }

            const txEntry = entries.get(entry.txId)!

            if (entry.status === 'pending') {
              txEntry.pending = entry
            } else if (entry.status === 'committed') {
              txEntry.committed = true
            }
          } catch (e) {
            info.warnings.push(`Failed to parse WAL line: ${line}`)
          }
        }

        // Apply only committed transactions
        for (const [txId, txEntry] of entries) {
          if (txEntry.committed && txEntry.pending?.ops) {
            info.recovered = true
            info.transactionsRecovered++

            for (const op of txEntry.pending.ops) {
              info.operationsRecovered++
              if (op.type === 'set') {
                this.state.set(op.key, op.value)
              } else {
                this.state.delete(op.key)
              }
            }
          } else if (!txEntry.committed && txEntry.pending) {
            info.warnings.push(`Discarded uncommitted transaction: ${txId}`)
          }
        }

        // Clear WAL after successful recovery
        await this.truncateWAL()
      }

      return ok(info)
    } catch (error) {
      return err(
        new StateRecoveryError(
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined
        )
      )
    }
  }

  /**
   * Compact WAL into main state file
   */
  async compact(): Promise<Result<void, Error>> {
    try {
      await this.queueWrite(async () => {
        // Write current state to main file
        const stateData = JSON.stringify(Object.fromEntries(this.state), null, 2)
        const tempPath = `${this.statePath}.tmp`

        await fs.promises.writeFile(tempPath, stateData, 'utf-8')

        if (this.config.fsync) {
          const fd = await fs.promises.open(tempPath, 'r')
          await fd.sync()
          await fd.close()
        }

        // Atomic rename
        await fs.promises.rename(tempPath, this.statePath)

        // Truncate WAL
        await this.truncateWAL()

        this.uncommittedCount = 0
      })

      return ok(undefined)
    } catch (error) {
      return err(
        new StateWriteError(
          error instanceof Error ? error.message : String(error),
          this.statePath,
          error instanceof Error ? error : undefined
        )
      )
    }
  }

  /**
   * Close the store
   */
  async close(): Promise<void> {
    this.isClosing = true

    // Wait for pending writes
    await this.writeQueue

    // Final compact
    await this.compact()
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async writeWALEntry(entry: WALEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n'
    await fs.promises.appendFile(this.walPath, line, 'utf-8')

    if (this.config.fsync) {
      const fd = await fs.promises.open(this.walPath, 'r')
      await fd.sync()
      await fd.close()
    }
  }

  private async truncateWAL(): Promise<void> {
    await fs.promises.writeFile(this.walPath, '', 'utf-8')
  }

  private queueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(() => {}, () => {})
    return result
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export const createStateStore = async (
  config: StateStoreConfig
): Promise<Result<IStateStore, Error>> => {
  return WALStateStore.create(config)
}
