/**
 * Workflow Signals MCP Server - Validation Schemas
 *
 * Strict schema validation for workflow step completion signals.
 * These are NOT magic strings - they're structured objects with required fields.
 */

import { z } from 'zod';

// ============================================================================
// STEP COMPLETION PROPOSAL (Agent A calls this)
// ============================================================================

export const ProposeStepCompletionSchema = z.object({
  /** Step identifier (e.g., "step-01-discovery") */
  step_id: z
    .string()
    .regex(/^step-\d{2}-[\w-]+$/, 'Invalid step_id format. Expected: step-XX-name'),

  /** Path to the generated artifact file */
  artifact_path: z.string().min(1, 'artifact_path is required'),

  /** SHA256 hash of artifact content for verification */
  artifact_hash: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/, 'Invalid hash format. Expected: sha256:<64 hex chars>')
    .optional(),

  /** Map of success criteria to completion status */
  checklist: z
    .record(z.string(), z.boolean())
    .refine((obj) => Object.keys(obj).length > 0, 'checklist must have at least one item'),

  /** Any unresolved questions or uncertainties */
  open_questions: z.array(z.string()).default([]),

  /** Confidence level (0.0 to 1.0) that step is truly complete */
  confidence: z
    .number()
    .min(0, 'confidence must be >= 0')
    .max(1, 'confidence must be <= 1'),
});

export type ProposeStepCompletion = z.infer<typeof ProposeStepCompletionSchema>;

// ============================================================================
// STEP TRANSITION APPROVAL (Agent B calls this)
// ============================================================================

export const ApproveStepTransitionSchema = z.object({
  /** Step identifier being approved */
  step_id: z.string().regex(/^step-\d{2}-[\w-]+$/),

  /** The approval decision */
  decision: z.enum(['approve', 'reject', 'revise']),

  /** Issues that must be resolved (for "revise" decision) */
  blockers: z.array(z.string()).default([]),

  /** Additional context for the decision */
  notes: z.string().optional(),
});

export type ApproveStepTransition = z.infer<typeof ApproveStepTransitionSchema>;

// ============================================================================
// SIGNAL MESSAGE (Internal use)
// ============================================================================

export const SignalMessageSchema = z.object({
  type: z.enum(['proposal', 'approval']),
  timestamp: z.number(),
  payload: z.union([ProposeStepCompletionSchema, ApproveStepTransitionSchema]),
});

export type SignalMessage = z.infer<typeof SignalMessageSchema>;

// ============================================================================
// STEP REQUIREMENTS (For validation)
// ============================================================================

export const StepRequirementsSchema = z.object({
  /** Minimum confidence score required */
  minConfidence: z.number().min(0).max(1).default(0.7),

  /** Checklist items that MUST be true */
  requiredChecklist: z.array(z.string()).default([]),

  /** Maximum allowed open questions */
  maxOpenQuestions: z.number().int().min(0).default(2),

  /** Timeout in milliseconds for waiting on signals */
  timeoutMs: z.number().int().min(1000).default(300000),
});

export type StepRequirements = z.infer<typeof StepRequirementsSchema>;

// ============================================================================
// VALIDATION RESULT
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Validate a proposal against step requirements
 */
export function validateProposal(
  proposal: ProposeStepCompletion,
  requirements: StepRequirements
): ValidationResult {
  const issues: string[] = [];

  // Check minimum confidence
  if (proposal.confidence < requirements.minConfidence) {
    issues.push(
      `Confidence ${(proposal.confidence * 100).toFixed(0)}% below minimum ${(requirements.minConfidence * 100).toFixed(0)}%`
    );
  }

  // Check required checklist items
  for (const required of requirements.requiredChecklist) {
    if (!proposal.checklist[required]) {
      issues.push(`Required checklist item not complete: ${required}`);
    }
  }

  // Check max open questions
  if (proposal.open_questions.length > requirements.maxOpenQuestions) {
    issues.push(
      `Too many open questions: ${proposal.open_questions.length} > ${requirements.maxOpenQuestions}`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
