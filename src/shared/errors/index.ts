/**
 * Custom error classes for domain-specific errors
 * Following the pattern of extending Error with additional context
 */

// ============================================================================
// Base Error Class
// ============================================================================

export abstract class CodeMachineError extends Error {
  abstract readonly code: string
  readonly timestamp: number = Date.now()
  readonly context?: Record<string, unknown>

  constructor(message: string, context?: Record<string, unknown>) {
    super(message)
    this.name = this.constructor.name
    this.context = context
    Error.captureStackTrace?.(this, this.constructor)
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    }
  }
}

// ============================================================================
// Workflow Errors
// ============================================================================

export class WorkflowNotFoundError extends CodeMachineError {
  readonly code = 'WORKFLOW_NOT_FOUND'

  constructor(workflowId: string) {
    super(`Workflow not found: ${workflowId}`, { workflowId })
  }
}

export class WorkflowAlreadyRunningError extends CodeMachineError {
  readonly code = 'WORKFLOW_ALREADY_RUNNING'

  constructor(workflowId: string) {
    super(`Workflow is already running: ${workflowId}`, { workflowId })
  }
}

export class WorkflowInvalidStateError extends CodeMachineError {
  readonly code = 'WORKFLOW_INVALID_STATE'

  constructor(currentState: string, expectedStates: string[], action: string) {
    super(
      `Cannot ${action} workflow in state '${currentState}'. Expected: ${expectedStates.join(', ')}`,
      { currentState, expectedStates, action }
    )
  }
}

export class WorkflowExecutionError extends CodeMachineError {
  readonly code = 'WORKFLOW_EXECUTION_ERROR'

  constructor(message: string, stepIndex: number, cause?: Error) {
    super(message, { stepIndex, cause: cause?.message })
    if (cause) {
      this.cause = cause
    }
  }
}

// ============================================================================
// Step Errors
// ============================================================================

export class StepNotFoundError extends CodeMachineError {
  readonly code = 'STEP_NOT_FOUND'

  constructor(stepIndex: number) {
    super(`Step not found at index: ${stepIndex}`, { stepIndex })
  }
}

export class StepExecutionError extends CodeMachineError {
  readonly code = 'STEP_EXECUTION_ERROR'

  constructor(stepIndex: number, agentId: string, reason: string, cause?: Error) {
    super(`Step ${stepIndex} (${agentId}) failed: ${reason}`, { stepIndex, agentId, reason })
    if (cause) {
      this.cause = cause
    }
  }
}

export class StepTimeoutError extends CodeMachineError {
  readonly code = 'STEP_TIMEOUT'

  constructor(stepIndex: number, timeoutMs: number) {
    super(`Step ${stepIndex} timed out after ${timeoutMs}ms`, { stepIndex, timeoutMs })
  }
}

// ============================================================================
// Agent Errors
// ============================================================================

export class AgentNotFoundError extends CodeMachineError {
  readonly code = 'AGENT_NOT_FOUND'

  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`, { agentId })
  }
}

export class AgentExecutionError extends CodeMachineError {
  readonly code = 'AGENT_EXECUTION_ERROR'

  constructor(agentId: string, reason: string, cause?: Error) {
    super(`Agent ${agentId} execution failed: ${reason}`, { agentId, reason })
    if (cause) {
      this.cause = cause
    }
  }
}

// ============================================================================
// Engine Errors
// ============================================================================

export class EngineNotFoundError extends CodeMachineError {
  readonly code = 'ENGINE_NOT_FOUND'

  constructor(engineName: string) {
    super(`Engine not found: ${engineName}`, { engineName })
  }
}

export class EngineInitializationError extends CodeMachineError {
  readonly code = 'ENGINE_INIT_ERROR'

  constructor(engineName: string, reason: string, cause?: Error) {
    super(`Failed to initialize engine ${engineName}: ${reason}`, { engineName, reason })
    if (cause) {
      this.cause = cause
    }
  }
}

export class EngineExecutionError extends CodeMachineError {
  readonly code = 'ENGINE_EXECUTION_ERROR'

  constructor(engineName: string, sessionId: string, reason: string, cause?: Error) {
    super(`Engine ${engineName} execution failed: ${reason}`, { engineName, sessionId, reason })
    if (cause) {
      this.cause = cause
    }
  }
}

// ============================================================================
// State Persistence Errors
// ============================================================================

export class StateCorruptionError extends CodeMachineError {
  readonly code = 'STATE_CORRUPTION'

  constructor(reason: string, filePath?: string) {
    super(`State corruption detected: ${reason}`, { filePath })
  }
}

export class StateWriteError extends CodeMachineError {
  readonly code = 'STATE_WRITE_ERROR'

  constructor(reason: string, filePath: string, cause?: Error) {
    super(`Failed to write state: ${reason}`, { filePath })
    if (cause) {
      this.cause = cause
    }
  }
}

export class StateRecoveryError extends CodeMachineError {
  readonly code = 'STATE_RECOVERY_ERROR'

  constructor(reason: string, cause?: Error) {
    super(`State recovery failed: ${reason}`)
    if (cause) {
      this.cause = cause
    }
  }
}

// ============================================================================
// Input/Provider Errors
// ============================================================================

export class InputProviderError extends CodeMachineError {
  readonly code = 'INPUT_PROVIDER_ERROR'

  constructor(providerType: 'user' | 'autopilot', reason: string, cause?: Error) {
    super(`Input provider (${providerType}) error: ${reason}`, { providerType })
    if (cause) {
      this.cause = cause
    }
  }
}

export class InputTimeoutError extends CodeMachineError {
  readonly code = 'INPUT_TIMEOUT'

  constructor(timeoutMs: number) {
    super(`Input timed out after ${timeoutMs}ms`, { timeoutMs })
  }
}

export class InputAbortedError extends CodeMachineError {
  readonly code = 'INPUT_ABORTED'

  constructor(reason: string) {
    super(`Input aborted: ${reason}`, { reason })
  }
}

// ============================================================================
// Streaming Errors
// ============================================================================

export class StreamError extends CodeMachineError {
  readonly code = 'STREAM_ERROR'

  constructor(streamId: string, reason: string, cause?: Error) {
    super(`Stream ${streamId} error: ${reason}`, { streamId })
    if (cause) {
      this.cause = cause
    }
  }
}

export class StreamClosedError extends CodeMachineError {
  readonly code = 'STREAM_CLOSED'

  constructor(streamId: string) {
    super(`Stream ${streamId} is already closed`, { streamId })
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

export class ConfigurationError extends CodeMachineError {
  readonly code = 'CONFIG_ERROR'

  constructor(key: string, reason: string) {
    super(`Configuration error for '${key}': ${reason}`, { key })
  }
}

export class ValidationError extends CodeMachineError {
  readonly code = 'VALIDATION_ERROR'
  readonly validationErrors: Array<{ field: string; message: string }>

  constructor(message: string, errors: Array<{ field: string; message: string }>) {
    super(message, { errors })
    this.validationErrors = errors
  }
}

// ============================================================================
// Error Type Guards
// ============================================================================

export const isCodeMachineError = (error: unknown): error is CodeMachineError => {
  return error instanceof CodeMachineError
}

export const isWorkflowError = (error: unknown): boolean => {
  return (
    error instanceof WorkflowNotFoundError ||
    error instanceof WorkflowAlreadyRunningError ||
    error instanceof WorkflowInvalidStateError ||
    error instanceof WorkflowExecutionError
  )
}

export const isRecoverable = (error: unknown): boolean => {
  if (!isCodeMachineError(error)) return false

  const nonRecoverableCodes = [
    'STATE_CORRUPTION',
    'CONFIG_ERROR',
    'VALIDATION_ERROR',
  ]

  return !nonRecoverableCodes.includes(error.code)
}
