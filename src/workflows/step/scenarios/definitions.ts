/**
 * Scenario Definitions
 *
 * All 8 scenarios as configuration objects.
 * Single source of truth for scenario behavior.
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

import type { ScenarioConfig } from './types.js';

/**
 * All scenario configurations
 */
export const SCENARIOS: readonly ScenarioConfig[] = [
  // Scenario 1: Controller drives with prompts
  {
    id: 1,
    name: 'controller-with-prompts',
    description: 'Controller drives with prompts',
    conditions: { interactive: true, autoMode: true, hasChainedPrompts: true },
    modeType: 'interactive',
    inputSource: 'controller',
    wasForced: false,
  },

  // Scenario 2: Controller drives single step
  {
    id: 2,
    name: 'controller-single-step',
    description: 'Controller drives single step',
    conditions: { interactive: true, autoMode: true, hasChainedPrompts: false },
    modeType: 'interactive',
    inputSource: 'controller',
    wasForced: false,
  },

  // Scenario 3: User drives with prompts
  {
    id: 3,
    name: 'user-with-prompts',
    description: 'User drives with prompts',
    conditions: { interactive: true, autoMode: false, hasChainedPrompts: true },
    modeType: 'interactive',
    inputSource: 'user',
    wasForced: false,
  },

  // Scenario 4: User drives each step
  {
    id: 4,
    name: 'user-single-step',
    description: 'User drives each step',
    conditions: { interactive: true, autoMode: false, hasChainedPrompts: false },
    modeType: 'interactive',
    inputSource: 'user',
    wasForced: false,
  },

  // Scenario 5: Fully autonomous - auto-send ALL prompts
  {
    id: 5,
    name: 'fully-autonomous',
    description: 'FULLY AUTONOMOUS - auto-send ALL prompts',
    conditions: { interactive: false, autoMode: true, hasChainedPrompts: true },
    modeType: 'autonomous',
    inputSource: 'system',
    wasForced: false,
  },

  // Scenario 6: Auto-advance to next step
  {
    id: 6,
    name: 'auto-advance',
    description: 'Auto-advance to next step',
    conditions: { interactive: false, autoMode: true, hasChainedPrompts: false },
    modeType: 'continuous',
    inputSource: 'system',
    wasForced: false,
  },

  // Scenario 7: Forced interactive (was false + manual + prompts)
  {
    id: 7,
    name: 'forced-user-with-prompts',
    description: 'Force interactive:true (was false + manual + prompts)',
    conditions: { interactive: false, autoMode: false, hasChainedPrompts: true },
    modeType: 'interactive',
    inputSource: 'user',
    wasForced: true,
    warningMessage:
      'This step is designed to run automatically. Enable autonomous mode or press Enter to continue.',
  },

  // Scenario 8: Forced interactive (was false + manual + no prompts)
  {
    id: 8,
    name: 'forced-user-single-step',
    description: 'Force interactive:true (was false + manual + no prompts)',
    conditions: { interactive: false, autoMode: false, hasChainedPrompts: false },
    modeType: 'interactive',
    inputSource: 'user',
    wasForced: true,
    warningMessage:
      'This step is designed to run automatically. Enable autonomous mode or press Enter to continue.',
  },
];

/**
 * Find scenario by conditions
 *
 * @param conditions The conditions to match
 * @returns The matching scenario config
 */
export function findScenario(conditions: {
  interactive: boolean;
  autoMode: boolean;
  hasChainedPrompts: boolean;
}): ScenarioConfig {
  const scenario = SCENARIOS.find(
    (s) =>
      s.conditions.interactive === conditions.interactive &&
      s.conditions.autoMode === conditions.autoMode &&
      s.conditions.hasChainedPrompts === conditions.hasChainedPrompts
  );

  if (!scenario) {
    // This should never happen - all 8 combinations are defined
    throw new Error(
      `No scenario found for conditions: ${JSON.stringify(conditions)}`
    );
  }

  return scenario;
}

/**
 * Get scenario by ID
 *
 * @param id Scenario ID (1-8)
 * @returns The scenario config
 */
export function getScenarioById(id: number): ScenarioConfig | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
