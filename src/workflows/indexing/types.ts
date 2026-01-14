/**
 * Step Indexing Types
 *
 * All types related to step indexing, tracking, and resume functionality.
 */

/**
 * Data stored for each workflow step in template.json
 */
export interface StepData {
  /** Session ID for resuming the agent conversation */
  sessionId: string;
  /** Monitoring ID for log file access */
  monitoringId: number;
  /** Completed chain indices (only present while step has incomplete chains) */
  completedChains?: number[];
  /** ISO timestamp when step fully completed (presence indicates step is done) */
  completedAt?: string;
}

/**
 * Queued prompt for chained step execution
 * Note: Re-exports from state/types.ts for consistency
 */
export type { QueuedPrompt } from '../state/types.js';

/**
 * Step lifecycle phases
 */
export enum StepLifecyclePhase {
  /** Step execution has not started */
  NOT_STARTED = 'NOT_STARTED',
  /** Step marked as started (for crash recovery) */
  STARTED = 'STARTED',
  /** Step session initialized with sessionId and monitoringId */
  SESSION_INITIALIZED = 'SESSION_INITIALIZED',
  /** Step is progressing through chained prompts */
  CHAIN_IN_PROGRESS = 'CHAIN_IN_PROGRESS',
  /** Step fully completed */
  COMPLETED = 'COMPLETED',
}

/**
 * Resume decision type
 */
export enum ResumeDecision {
  /** Start from the beginning (step 0) */
  START_FRESH = 'START_FRESH',
  /** Resume from step with incomplete chains */
  RESUME_FROM_CHAIN = 'RESUME_FROM_CHAIN',
  /** Resume step that started but didn't complete (crash recovery) */
  RESUME_FROM_CRASH = 'RESUME_FROM_CRASH',
  /** Continue after last completed step */
  CONTINUE_AFTER_COMPLETED = 'CONTINUE_AFTER_COMPLETED',
}

/**
 * Information needed to resume a workflow
 */
export interface ResumeInfo {
  /** Step index to start from */
  startIndex: number;
  /** How the start index was determined */
  decision: ResumeDecision;
  /** Chain index to resume from (only for RESUME_FROM_CHAIN) */
  chainIndex?: number;
  /** Session ID for resuming (if available) */
  sessionId?: string;
  /** Monitoring ID for resuming (if available) */
  monitoringId?: number;
}

/**
 * Template tracking data structure (stored in template.json)
 */
export interface TemplateTracking {
  activeTemplate: string;
  lastUpdated: string;
  completedSteps?: Record<string, StepData>;
  notCompletedSteps?: number[];
  resumeFromLastStep?: boolean;
  selectedTrack?: string;
  selectedConditions?: string[];
  projectName?: string;
  autonomousMode?: string;
  controllerConfig?: ControllerConfig;
}

/**
 * Controller configuration for autonomous mode
 */
export interface ControllerConfig {
  agentId: string;
  sessionId: string;
  monitoringId: number;
}
