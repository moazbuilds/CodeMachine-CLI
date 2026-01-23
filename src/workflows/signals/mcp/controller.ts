/**
 * MCP Workflow Controller
 *
 * Orchestrates workflow step transitions using MCP signals instead of text-based
 * signals like "ACTION: NEXT" or "SIGNAL: READY".
 *
 * The controller:
 * 1. Waits for Agent A to call propose_step_completion
 * 2. Validates the proposal against step requirements
 * 3. Waits for Agent B to call approve_step_transition
 * 4. Returns the decision for workflow progression
 */

import {
  SignalQueue,
  validateProposal,
  type ProposeStepCompletion,
  type ApproveStepTransition,
  type StepRequirements,
  type ValidationResult,
} from '../../../infra/mcp/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface StepTransitionResult {
  /** The proposal from Agent A */
  proposal: ProposeStepCompletion;
  /** Validation result of the proposal */
  validation: ValidationResult;
  /** The approval decision from Agent B */
  approval: ApproveStepTransition;
  /** Final status of the step */
  status: 'approved' | 'rejected' | 'revision_needed';
}

export interface ControllerOptions {
  /** Workflow directory */
  workflowDir: string;
  /** Default timeout for waiting on proposals (ms) */
  proposalTimeout?: number;
  /** Default timeout for waiting on approvals (ms) */
  approvalTimeout?: number;
  /** Callback when proposal is received */
  onProposal?: (proposal: ProposeStepCompletion) => void;
  /** Callback when approval is received */
  onApproval?: (approval: ApproveStepTransition) => void;
  /** Callback for validation issues */
  onValidationIssues?: (issues: string[]) => void;
}

// ============================================================================
// CONTROLLER CLASS
// ============================================================================

export class MCPWorkflowController {
  private signalQueue: SignalQueue;
  private options: Required<ControllerOptions>;

  constructor(options: ControllerOptions) {
    this.signalQueue = new SignalQueue(options.workflowDir);
    this.options = {
      proposalTimeout: 900000, // 15 minutes
      approvalTimeout: 900000, // 15 minutes
      onProposal: () => {},
      onApproval: () => {},
      onValidationIssues: () => {},
      ...options,
    };
  }

  /**
   * Initialize the controller (call before workflow starts)
   */
  async init(): Promise<void> {
    await this.signalQueue.init();
    await this.signalQueue.clear();
  }

  /**
   * Wait for and validate a step completion proposal
   */
  async waitForProposal(
    stepId: string,
    requirements: StepRequirements,
    timeout?: number
  ): Promise<{ proposal: ProposeStepCompletion; validation: ValidationResult }> {
    const proposal = await this.signalQueue.waitForProposal(
      stepId,
      timeout || this.options.proposalTimeout
    );

    this.options.onProposal(proposal);

    // Validate the proposal
    const validation = validateProposal(proposal, requirements);

    if (!validation.valid) {
      this.options.onValidationIssues(validation.issues);
    }

    return { proposal, validation };
  }

  /**
   * Wait for an approval decision
   */
  async waitForApproval(
    stepId: string,
    timeout?: number
  ): Promise<ApproveStepTransition> {
    const approval = await this.signalQueue.waitForApproval(
      stepId,
      timeout || this.options.approvalTimeout
    );

    this.options.onApproval(approval);

    return approval;
  }

  /**
   * Complete workflow: wait for proposal, validate, wait for approval
   *
   * This is the main method to use for step transitions.
   */
  async waitForStepTransition(
    stepId: string,
    requirements: StepRequirements
  ): Promise<StepTransitionResult> {
    // Wait for proposal from Agent A
    const { proposal, validation } = await this.waitForProposal(stepId, requirements);

    // Wait for approval from Agent B
    const approval = await this.waitForApproval(stepId);

    // Determine final status
    let status: StepTransitionResult['status'];
    switch (approval.decision) {
      case 'approve':
        status = 'approved';
        break;
      case 'reject':
        status = 'rejected';
        break;
      case 'revise':
        status = 'revision_needed';
        break;
    }

    return {
      proposal,
      validation,
      approval,
      status,
    };
  }

  /**
   * Get the signal queue for direct access
   */
  getSignalQueue(): SignalQueue {
    return this.signalQueue;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new MCP workflow controller
 */
export function createMCPWorkflowController(
  options: ControllerOptions
): MCPWorkflowController {
  return new MCPWorkflowController(options);
}

// ============================================================================
// STEP RUNNER INTEGRATION
// ============================================================================

export interface RunStepWithMCPOptions {
  /** Step ID (e.g., "step-01-discovery") */
  stepId: string;
  /** Workflow directory */
  workflowDir: string;
  /** Step requirements for validation */
  requirements: StepRequirements;
  /** Function to run Agent A */
  runAgentA: () => Promise<void>;
  /** Function to run Agent B with review context */
  runAgentB: (proposal: ProposeStepCompletion) => Promise<void>;
  /** Timeout for proposal (ms) */
  proposalTimeout?: number;
  /** Timeout for approval (ms) */
  approvalTimeout?: number;
}

/**
 * Run a workflow step using MCP signals
 *
 * This is a high-level helper that:
 * 1. Initializes the MCP controller
 * 2. Runs Agent A (which should call propose_step_completion)
 * 3. Waits for the proposal and validates it
 * 4. Runs Agent B with the proposal context (which should call approve_step_transition)
 * 5. Waits for the approval
 * 6. Returns the result
 */
export async function runStepWithMCP(
  options: RunStepWithMCPOptions
): Promise<StepTransitionResult> {
  const {
    stepId,
    workflowDir,
    requirements,
    runAgentA,
    runAgentB,
    proposalTimeout = 900000,
    approvalTimeout = 900000,
  } = options;

  const controller = createMCPWorkflowController({
    workflowDir,
    proposalTimeout,
    approvalTimeout,
  });

  await controller.init();

  // Run Agent A and wait for proposal concurrently
  const [, { proposal, validation }] = await Promise.all([
    runAgentA(),
    controller.waitForProposal(stepId, requirements),
  ]);

  // Run Agent B with proposal context and wait for approval concurrently
  const [, approval] = await Promise.all([
    runAgentB(proposal),
    controller.waitForApproval(stepId),
  ]);

  // Determine final status
  let status: StepTransitionResult['status'];
  switch (approval.decision) {
    case 'approve':
      status = 'approved';
      break;
    case 'reject':
      status = 'rejected';
      break;
    case 'revise':
      status = 'revision_needed';
      break;
  }

  return {
    proposal,
    validation,
    approval,
    status,
  };
}
