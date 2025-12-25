/**
 * MCP (Model Context Protocol) Infrastructure
 *
 * Provides MCP servers and utilities for agent-to-system communication.
 * MCP allows AI agents to call structured tools instead of outputting magic strings.
 */

// Setup utilities
export {
  setupWorkflowMCP,
  cleanupWorkflowMCP,
  configureClaudeMCP,
  configureCodexMCP,
  removeClaudeMCP,
  isClaudeMCPConfigured,
  getWorkflowSignalsMCPPath,
  getWorkflowSignalsMCPConfig,
  getClaudeSettingsPath,
  getCodexSettingsPath,
  type SetupOptions,
} from './setup.js';

// Re-export schemas for consumers
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

// Re-export signal queue
export { SignalQueue } from './servers/workflow-signals/queue.js';

// Re-export tools for reference
export {
  workflowSignalTools,
  proposeStepCompletionTool,
  approveStepTransitionTool,
  getPendingProposalTool,
  getToolByName,
} from './servers/workflow-signals/tools.js';
