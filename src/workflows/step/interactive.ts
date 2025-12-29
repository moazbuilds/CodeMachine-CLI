/**
 * Interactive Behavior Resolution
 *
 * Single source of truth for determining step interactive behavior.
 * Handles all 8 scenarios defined in the interactive flag specification.
 *
 * VALID SCENARIOS:
 * | # | interactive | autoMode | chainedPrompts | Behavior                                    |
 * |---|-------------|----------|----------------|---------------------------------------------|
 * | 1 | true        | true     | yes            | Controller drives with prompts              |
 * | 2 | true        | true     | no             | Controller drives single step               |
 * | 3 | true        | false    | yes            | User drives with prompts                    |
 * | 4 | true        | false    | no             | User drives each step                       |
 * | 5 | false       | true     | yes            | FULLY AUTONOMOUS - auto-send ALL prompts    |
 * | 6 | false       | true     | no             | Auto-advance to next step                   |
 *
 * INVALID SCENARIOS (force interactive:true + log warning):
 * | # | interactive | autoMode | chainedPrompts | Handling                                    |
 * |---|-------------|----------|----------------|---------------------------------------------|
 * | 7 | false       | false    | yes            | Force interactive:true, warn, -> case 3    |
 * | 8 | false       | false    | no             | Force interactive:true, warn, -> case 4    |
 */

import { debug } from '../../shared/logging/logger.js';
import type { ModuleStep } from '../templates/types.js';

export type InteractiveScenario = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface InteractiveBehavior {
  /** The resolved scenario number (1-8) */
  scenario: InteractiveScenario;
  /** Whether to wait for input (user or controller) */
  shouldWait: boolean;
  /** Whether to run autonomous prompt loop (Scenario 5) */
  runAutonomousLoop: boolean;
  /** Whether interactive was forced due to invalid config */
  wasForced: boolean;
}

export interface ResolveInteractiveOptions {
  step: ModuleStep;
  autoMode: boolean;
  hasChainedPrompts: boolean;
  stepIndex: number;
}

/**
 * Resolve interactive behavior for a workflow step
 *
 * Determines the correct behavior based on:
 * - step.interactive value (true, false, or undefined)
 * - autoMode state (controller available or manual mode)
 * - hasChainedPrompts (whether step has prompts to process)
 *
 * For invalid cases (interactive:false + manual mode), forces interactive:true
 * and logs a warning since manual mode requires user interaction.
 */
export function resolveInteractiveBehavior(
  options: ResolveInteractiveOptions
): InteractiveBehavior {
  const { step, autoMode, hasChainedPrompts, stepIndex } = options;
  const interactive = step.interactive;

  // Handle undefined interactive (default behavior based on chainedPrompts)
  if (interactive === undefined) {
    const effectiveInteractive = hasChainedPrompts;
    return resolveInteractiveBehavior({
      step: { ...step, interactive: effectiveInteractive },
      autoMode,
      hasChainedPrompts,
      stepIndex,
    });
  }

  // interactive === true
  if (interactive === true) {
    if (autoMode) {
      // Scenarios 1-2: Controller drives
      return {
        scenario: hasChainedPrompts ? 1 : 2,
        shouldWait: true,
        runAutonomousLoop: false,
        wasForced: false,
      };
    } else {
      // Scenarios 3-4: User drives
      return {
        scenario: hasChainedPrompts ? 3 : 4,
        shouldWait: true,
        runAutonomousLoop: false,
        wasForced: false,
      };
    }
  }

  // interactive === false
  if (autoMode) {
    // Valid: Scenarios 5-6
    if (hasChainedPrompts) {
      // Scenario 5: Fully autonomous - auto-send ALL prompts
      return {
        scenario: 5,
        shouldWait: false,
        runAutonomousLoop: true,
        wasForced: false,
      };
    } else {
      // Scenario 6: Auto-advance to next step
      return {
        scenario: 6,
        shouldWait: false,
        runAutonomousLoop: false,
        wasForced: false,
      };
    }
  } else {
    // Invalid: Scenarios 7-8 - force interactive:true
    debug(
      '[interactive] Step %d has interactive:false in manual mode. ' +
        'Forcing interactive:true. Use auto mode for non-interactive steps.',
      stepIndex
    );
    return {
      scenario: hasChainedPrompts ? 7 : 8,
      shouldWait: true,
      runAutonomousLoop: false,
      wasForced: true,
    };
  }
}
