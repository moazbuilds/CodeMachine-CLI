/**
 * Database Module
 *
 * Unified database layer with Drizzle ORM and SQLite.
 */

// Connection management
export {
  getDatabase,
  getRawDatabase,
  closeDatabase,
  getDatabasePath,
  transaction,
  transactionSync,
  type DrizzleDB,
  type DatabaseConfig,
} from './connection.js'

// Schema exports
export * from './schema/index.js'

// Repository exports
export { AgentRepository } from './repositories/agent.repository.js'
export type {
  AgentWithTelemetry,
  RegisterAgentInput,
  UpdateAgentInput,
  UpdateTelemetryInput,
} from './repositories/agent.repository.js'

export { EventRepository } from './repositories/event.repository.js'

export { LogRepository } from './repositories/log.repository.js'

export { TelemetryRepository } from './repositories/telemetry.repository.js'

export { WorkflowRepository } from './repositories/workflow.repository.js'

// Write buffer exports
export {
  WriteBuffer,
  createLogWriteBuffer,
  createTelemetryWriteBuffer,
  createEventWriteBuffer,
  createBatchedWriter,
  type WriteBufferConfig,
  type WriteBufferStats,
} from './write-buffer.js'
