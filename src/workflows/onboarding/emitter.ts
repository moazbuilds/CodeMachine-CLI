/**
 * Onboarding Event Emitter
 *
 * A helper class that provides convenience methods for emitting onboarding events
 * with consistent debug logging. Uses the shared WorkflowEventBus.
 */

import { debug } from '../../shared/logging/logger.js';
import type { WorkflowEventBus } from '../events/event-bus.js';
import type { OnboardConfig, OnboardResult, OnboardStep } from '../events/types.js';

/**
 * OnboardingEmitter - Emits onboarding events with debug logging
 *
 * Usage:
 * ```typescript
 * const bus = new WorkflowEventBus();
 * const emitter = new OnboardingEmitter(bus);
 *
 * emitter.started({ hasTracks: true, hasConditions: false, hasController: true });
 * emitter.stepChanged('tracks', 'Select a track:');
 * emitter.trackSelected('bmad');
 * ```
 */
export class OnboardingEmitter {
  private bus: WorkflowEventBus;

  constructor(bus: WorkflowEventBus) {
    this.bus = bus;
  }

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle Events
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit onboarding started event
   */
  started(config: OnboardConfig): void {
    debug(
      '[Onboarding] started hasTracks=%s hasConditions=%s hasController=%s initialProjectName=%s',
      config.hasTracks,
      config.hasConditions,
      config.hasController,
      config.initialProjectName ?? '(none)'
    );
    this.bus.emit({
      type: 'onboard:started',
      config,
    });
  }

  /**
   * Emit step change event
   */
  stepChanged(step: OnboardStep, question: string): void {
    debug('[Onboarding] step=%s question="%s"', step, question);
    this.bus.emit({
      type: 'onboard:step',
      step,
      question,
    });
  }

  /**
   * Emit onboarding completed event
   */
  completed(result: OnboardResult): void {
    debug(
      '[Onboarding] completed projectName=%s trackId=%s conditions=%o controllerAgentId=%s',
      result.projectName ?? '(none)',
      result.trackId ?? '(none)',
      result.conditions ?? [],
      result.controllerAgentId ?? '(none)'
    );
    this.bus.emit({
      type: 'onboard:completed',
      result,
    });
  }

  /**
   * Emit onboarding cancelled event
   */
  cancelled(): void {
    debug('[Onboarding] cancelled');
    this.bus.emit({
      type: 'onboard:cancelled',
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // User Input Events
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit project name entered event
   */
  projectNameEntered(name: string): void {
    debug('[Onboarding] project_name entered name="%s"', name);
    this.bus.emit({
      type: 'onboard:project_name',
      name,
    });
  }

  /**
   * Emit track selected event
   */
  trackSelected(trackId: string): void {
    debug('[Onboarding] track selected trackId="%s"', trackId);
    this.bus.emit({
      type: 'onboard:track',
      trackId,
    });
  }

  /**
   * Emit condition selected event (for single-select or toggle)
   */
  conditionSelected(conditionId: string, groupIndex: number, isChild: boolean): void {
    debug(
      '[Onboarding] condition selected conditionId="%s" groupIndex=%d isChild=%s',
      conditionId,
      groupIndex,
      isChild
    );
    this.bus.emit({
      type: 'onboard:condition',
      conditionId,
      groupIndex,
      isChild,
    });
  }

  /**
   * Emit conditions confirmed event (for multi-select groups)
   */
  conditionsConfirmed(conditions: string[], groupIndex: number): void {
    debug(
      '[Onboarding] conditions confirmed conditions=%o groupIndex=%d',
      conditions,
      groupIndex
    );
    this.bus.emit({
      type: 'onboard:conditions_confirmed',
      conditions,
      groupIndex,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Controller Launching Events
  // ─────────────────────────────────────────────────────────────────

  /**
   * Emit controller launching started event
   */
  launchingStarted(controllerId: string, controllerName: string): void {
    debug('[Onboarding] launching started controllerId="%s" controllerName="%s"', controllerId, controllerName);
    this.bus.emit({
      type: 'onboard:launching_started',
      controllerId,
      controllerName,
    });
  }

  /**
   * Emit controller launching log message
   */
  launchingLog(message: string): void {
    debug('[Onboarding] launching log message="%s"', message);
    this.bus.emit({
      type: 'onboard:launching_log',
      message,
    });
  }

  /**
   * Emit controller launching monitoring ID (for log file streaming)
   */
  launchingMonitor(monitoringId: number): void {
    debug('[Onboarding] launching monitor monitoringId=%d', monitoringId);
    this.bus.emit({
      type: 'onboard:launching_monitor',
      monitoringId,
    });
  }

  /**
   * Emit controller launching completed event
   */
  launchingCompleted(controllerId: string): void {
    debug('[Onboarding] launching completed controllerId="%s"', controllerId);
    this.bus.emit({
      type: 'onboard:launching_completed',
      controllerId,
    });
  }

  /**
   * Emit controller launching failed event
   */
  launchingFailed(controllerId: string, error: string): void {
    debug('[Onboarding] launching failed controllerId="%s" error="%s"', controllerId, error);
    this.bus.emit({
      type: 'onboard:launching_failed',
      controllerId,
      error,
    });
  }
}

/**
 * Create a new OnboardingEmitter
 */
export function createOnboardingEmitter(bus: WorkflowEventBus): OnboardingEmitter {
  return new OnboardingEmitter(bus);
}
