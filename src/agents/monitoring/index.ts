/**
 * Agent Monitoring System
 *
 * Provides comprehensive tracking and logging for all agent executions:
 * - Lifecycle monitoring (start, complete, fail)
 * - Parent-child relationship tracking
 * - Log file management
 * - Query interface for active/offline agents
 * - Graceful cleanup on process termination
 */

export { AgentMonitorService, type AgentTreeNode } from './monitor';
export { AgentLoggerService } from './logger';
export { AgentRegistry } from './registry';
export { MonitoringCleanup } from './cleanup';
export { StatusService } from './status';
export { agentRecordToSubAgentState, convertChildrenToSubAgents } from './converters';
export type {
  AgentRecord,
  AgentStatus,
  RegisterAgentInput,
  AgentRegistryData,
  AgentQueryFilters
} from './types';
