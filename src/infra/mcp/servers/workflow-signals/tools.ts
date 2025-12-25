/**
 * Workflow Signals MCP Server - Tool Definitions
 *
 * Defines the MCP tools that agents can call for workflow step transitions.
 * These tools use JSON Schema for validation (MCP standard).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool: propose_step_completion
 *
 * Called by Agent A when they have completed a workflow step.
 * Signals to the system that the step is ready for review.
 */
export const proposeStepCompletionTool: Tool = {
  name: 'propose_step_completion',
  description: `Signal that you have completed the current workflow step.

Call this tool when you have:
1. Gathered all required information through conversation
2. Produced the artifact/content for this step
3. Validated your work against the step's success criteria

The workflow will wait for approval from the reviewing agent before proceeding to the next step.`,
  inputSchema: {
    type: 'object',
    properties: {
      step_id: {
        type: 'string',
        description: 'The step identifier (e.g., "step-01-discovery", "step-02-success")',
        pattern: '^step-\\d{2}-[\\w-]+$',
      },
      artifact_path: {
        type: 'string',
        description: 'Path to the generated artifact file (e.g., ".codemachine/artifacts/prd.md")',
        minLength: 1,
      },
      artifact_hash: {
        type: 'string',
        description: 'Optional SHA256 hash of artifact content for verification (format: sha256:<64 hex chars>)',
        pattern: '^sha256:[a-f0-9]{64}$',
      },
      checklist: {
        type: 'object',
        description: `Map of success criteria to completion status. Each key is a criterion name, value is true/false.
Example: { "classification_data_loaded": true, "differentiator_identified": true, "executive_summary_present": true }`,
        additionalProperties: { type: 'boolean' },
        minProperties: 1,
      },
      open_questions: {
        type: 'array',
        description: 'Any unresolved questions or uncertainties that remain after completing the step',
        items: { type: 'string' },
        default: [],
      },
      confidence: {
        type: 'number',
        description: 'Your confidence level (0.0 to 1.0) that this step is truly complete and meets all requirements',
        minimum: 0,
        maximum: 1,
      },
    },
    required: ['step_id', 'artifact_path', 'checklist', 'confidence'],
  },
};

/**
 * Tool: approve_step_transition
 *
 * Called by Agent B to approve or reject a step completion proposal.
 * This is the gate that controls workflow progression.
 */
export const approveStepTransitionTool: Tool = {
  name: 'approve_step_transition',
  description: `Approve or reject a step completion proposal.

Call this tool after reviewing:
1. The proposed artifact content at the specified path
2. The completion checklist and whether items are truly complete
3. Any open questions and whether they block progress

Decisions:
- "approve": The step is complete, proceed to next step
- "reject": The step has critical issues, workflow should stop
- "revise": Send back to the other agent with specific blockers to address

IMPORTANT: Do NOT output text signals like "ACTION: NEXT".
Instead, call this tool with your structured decision.`,
  inputSchema: {
    type: 'object',
    properties: {
      step_id: {
        type: 'string',
        description: 'The step identifier being approved (must match the proposal)',
        pattern: '^step-\\d{2}-[\\w-]+$',
      },
      decision: {
        type: 'string',
        description: 'Your decision: "approve" to proceed, "reject" to stop, "revise" to request changes',
        enum: ['approve', 'reject', 'revise'],
      },
      blockers: {
        type: 'array',
        description: 'Issues that must be resolved before approval (required if decision is "revise")',
        items: { type: 'string' },
        default: [],
      },
      notes: {
        type: 'string',
        description: 'Additional context explaining your decision',
      },
    },
    required: ['step_id', 'decision'],
  },
};

/**
 * Tool: get_pending_proposal
 *
 * Utility tool for Agent B to retrieve the current pending proposal.
 */
export const getPendingProposalTool: Tool = {
  name: 'get_pending_proposal',
  description: `Get the current pending step completion proposal for review.

Call this tool to see what the other agent has proposed before making your approval decision.
Returns the full proposal including step_id, artifact_path, checklist, open_questions, and confidence.`,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

/**
 * All workflow signal tools
 */
export const workflowSignalTools: Tool[] = [
  proposeStepCompletionTool,
  approveStepTransitionTool,
  getPendingProposalTool,
];

/**
 * Get tool by name
 */
export function getToolByName(name: string): Tool | undefined {
  return workflowSignalTools.find((t) => t.name === name);
}
