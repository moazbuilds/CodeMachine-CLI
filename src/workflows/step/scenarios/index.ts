/**
 * Scenario Resolution
 *
 * Single source of truth for resolving which scenario applies to a step.
 * Used by mode handlers to determine behavior.
 */

import { debug } from '../../../shared/logging/logger.js';
import type {
  ScenarioConfig,
  ResolvedScenario,
  ResolveScenarioOptions,
  ScenarioId,
  ModeType,
  InputSource,
} from './types.js';
import { findScenario, SCENARIOS, getScenarioById } from './definitions.js';

// Re-export types
export type {
  ScenarioConfig,
  ResolvedScenario,
  ResolveScenarioOptions,
  ScenarioId,
  ModeType,
  InputSource,
};

// Re-export definitions
export { SCENARIOS, findScenario, getScenarioById };

/**
 * Resolve scenario for a step
 *
 * Determines the correct scenario based on:
 * - step interactive value (after undefined resolution)
 * - autoMode state
 * - hasChainedPrompts
 *
 * @param options Resolution options
 * @returns Resolved scenario with runtime context
 */
export function resolveScenario(options: ResolveScenarioOptions): ResolvedScenario {
  const { interactive, autoMode, hasChainedPrompts, stepIndex, stepName } = options;

  // Find matching scenario
  const scenario = findScenario({ interactive, autoMode, hasChainedPrompts });

  // Log warning for forced scenarios
  if (scenario.wasForced && scenario.warningMessage) {
    debug('[scenarios] Step %d (%s): %s', stepIndex, stepName, scenario.warningMessage);
  }

  debug(
    '[scenarios] Step %d (%s): Scenario %d (%s) - mode=%s, input=%s',
    stepIndex,
    stepName,
    scenario.id,
    scenario.name,
    scenario.modeType,
    scenario.inputSource
  );

  return {
    ...scenario,
    stepIndex,
    stepName,
  };
}

