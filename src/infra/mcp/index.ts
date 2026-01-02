/**
 * MCP (Model Context Protocol) Infrastructure
 *
 * Provides MCP servers and utilities for agent-to-system communication.
 * MCP allows AI agents to call structured tools instead of outputting magic strings.
 *
 * Directory Structure:
 *   src/infra/mcp/
 *   ├── index.ts       - This file (public exports)
 *   ├── types.ts       - Shared type definitions
 *   ├── errors.ts      - Custom error classes
 *   ├── registry.ts    - Adapter registry
 *   ├── setup.ts       - Setup orchestration
 *   └── servers/       - MCP server implementations
 *       └── workflow-signals/
 *           ├── index.ts   - Server entry point
 *           ├── config.ts  - Self-contained launcher config
 *           └── ...
 *
 * Engine-specific adapters live in their respective engine folders:
 *   src/infra/engines/providers/{engine}/mcp/
 */

// ============================================================================
// TYPES
// ============================================================================

export type { ConfigScope, MCPServerConfig, MCPSetupResult, MCPAdapter } from './types.js';

// ============================================================================
// ERRORS
// ============================================================================

export { MCPConfigError, MCPPathError } from './errors.js';

// ============================================================================
// WORKFLOW SIGNALS SERVER - Config
// ============================================================================

export {
  SERVER_ID as WORKFLOW_SIGNALS_SERVER_ID,
  SERVER_NAME as WORKFLOW_SIGNALS_SERVER_NAME,
  getServerPath as getWorkflowSignalsServerPath,
  getServerDir as getWorkflowSignalsServerDir,
  getMCPInfraDir as getWorkflowSignalsMCPInfraDir,
} from './servers/workflow-signals/config.js';

// ============================================================================
// REGISTRY
// ============================================================================

export { adapterRegistry } from './registry.js';

// ============================================================================
// SETUP (Main API)
// ============================================================================

export { configureMCP, cleanupMCP, isMCPConfigured } from './setup.js';

// ============================================================================
// WORKFLOW SIGNALS SERVER - Schemas
// ============================================================================

export {
  ProposeStepCompletionSchema,
  ApproveStepTransitionSchema,
  SignalMessageSchema,
  StepRequirementsSchema,
  validateProposal,
  type ProposeStepCompletion,
  type ApproveStepTransition,
  type SignalMessage,
  type StepRequirements,
  type ValidationResult,
} from './servers/workflow-signals/schemas.js';

// ============================================================================
// WORKFLOW SIGNALS SERVER - Queue
// ============================================================================

export { SignalQueue } from './servers/workflow-signals/queue.js';

// ============================================================================
// WORKFLOW SIGNALS SERVER - Tools
// ============================================================================

export {
  workflowSignalTools,
  proposeStepCompletionTool,
  approveStepTransitionTool,
  getPendingProposalTool,
  getToolByName,
} from './servers/workflow-signals/tools.js';
