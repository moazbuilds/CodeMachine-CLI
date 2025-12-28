/**
 * Step Indexing Debug Logging
 *
 * Centralized debug logging for all step indexing operations.
 * All logs use the [Indexing:*] prefix for easy filtering.
 */

import { debug as baseDebug } from '../../shared/logging/logger.js';
import type { StepData, ResumeInfo, StepLifecyclePhase, ResumeDecision } from './types.js';

/**
 * Log a step lifecycle event
 */
export function logLifecycle(
  phase: StepLifecyclePhase | string,
  stepIndex: number,
  data?: Record<string, unknown>
): void {
  const dataStr = data
    ? ' ' + Object.entries(data).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
    : '';
  baseDebug(`[Indexing:lifecycle] ${phase} stepIndex=${stepIndex}${dataStr}`);
}

/**
 * Log a resume decision
 */
export function logResume(
  message: string,
  info?: Partial<ResumeInfo> | Record<string, unknown>
): void {
  const dataStr = info
    ? ' ' + Object.entries(info).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
    : '';
  baseDebug(`[Indexing:resume] ${message}${dataStr}`);
}

/**
 * Log a persistence operation
 */
export function logPersistence(
  operation: 'READ' | 'WRITE',
  details?: string | Record<string, unknown>
): void {
  if (typeof details === 'string') {
    baseDebug(`[Indexing:persistence] ${operation} ${details}`);
  } else if (details) {
    const dataStr = Object.entries(details).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
    baseDebug(`[Indexing:persistence] ${operation} ${dataStr}`);
  } else {
    baseDebug(`[Indexing:persistence] ${operation}`);
  }
}

/**
 * Log queue state changes
 */
export function logQueue(
  operation: 'INIT' | 'ADVANCE' | 'RESET' | 'SYNC',
  stepIndex: number,
  queueIndex: number,
  queueLength: number
): void {
  baseDebug(
    `[Indexing:queue] ${operation} stepIndex=${stepIndex} queueIndex=${queueIndex} queueLength=${queueLength}`
  );
}

/**
 * Log general debug info with indexing prefix
 */
export function logDebug(category: string, message: string, data?: Record<string, unknown>): void {
  const dataStr = data
    ? ' ' + Object.entries(data).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
    : '';
  baseDebug(`[Indexing:${category}] ${message}${dataStr}`);
}

/**
 * Log step data state
 */
export function logStepData(stepIndex: number, stepData: StepData | null): void {
  if (stepData) {
    baseDebug(
      `[Indexing:stepData] stepIndex=${stepIndex} sessionId=${stepData.sessionId} monitoringId=${stepData.monitoringId} completedChains=${JSON.stringify(stepData.completedChains)} completedAt=${stepData.completedAt}`
    );
  } else {
    baseDebug(`[Indexing:stepData] stepIndex=${stepIndex} data=null`);
  }
}
