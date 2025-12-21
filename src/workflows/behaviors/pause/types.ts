/**
 * Pause Behavior Types
 */

/**
 * Internal pause state
 */
export interface PauseState {
  requested: boolean;
  reason?: string;
}

/**
 * Decision from pause evaluation
 */
export interface PauseDecision {
  shouldPause: boolean;
  reason?: string;
  source: 'user' | 'agent';
}

/**
 * Options for pause evaluation
 */
export interface PauseEvaluationOptions {
  cwd: string;
  pauseRequested: boolean;
}
