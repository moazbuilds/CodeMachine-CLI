/**
 * MCP Workflow Signals
 *
 * Integration between MCP-based signals and the workflow system.
 * Provides detection, control, and orchestration for step transitions.
 */

// Controller
export {
  MCPWorkflowController,
  createMCPWorkflowController,
  runStepWithMCP,
  type StepTransitionResult,
  type ControllerOptions,
  type RunStepWithMCPOptions,
} from './controller.js';

// Detector
export {
  detectMCPSignal,
  detectClaudeMCPSignal,
  detectCodexMCPSignal,
  createMCPSignalProcessor,
  isProposalSignal,
  isApprovalSignal,
  type MCPSignalType,
  type DetectedMCPSignal,
  type ProposalSignal,
  type ApprovalSignal,
  type MCPSignalDetectorOptions,
} from './detector.js';
