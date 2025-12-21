/**
 * Loop Behavior Types
 *
 * Type definitions for loop behavior handling.
 */

/** Tracks which steps to skip during an active loop iteration */
export interface ActiveLoop {
  skip: string[];
}

/** Result of loop decision evaluation */
export interface LoopDecision {
  shouldRepeat: boolean;
  stepsBack: number;
  skipList: string[];
  reason?: string;
}
