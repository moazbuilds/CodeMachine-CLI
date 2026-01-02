/**
 * Scenario Configuration Types
 *
 * Captures all 8 scenarios as configuration objects.
 * Single source of truth for scenario behavior definitions.
 */

/**
 * Scenario identifier (1-8)
 */
export type ScenarioId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Input source for the scenario
 */
export type InputSource = 'user' | 'controller' | 'system';

/**
 * Mode handler type
 */
export type ModeType = 'interactive' | 'autonomous' | 'continuous';

/**
 * Conditions that determine which scenario applies
 */
export interface ScenarioConditions {
  /** Step's interactive flag (true or false after resolution) */
  interactive: boolean;
  /** Whether auto mode is enabled */
  autoMode: boolean;
  /** Whether step has chained prompts */
  hasChainedPrompts: boolean;
}

/**
 * Complete scenario configuration
 */
export interface ScenarioConfig {
  /** Unique scenario identifier (1-8) */
  id: ScenarioId;

  /** Human-readable name for logging */
  name: string;

  /** Description of behavior */
  description: string;

  /** Conditions that match this scenario */
  conditions: ScenarioConditions;

  /** Which mode handler to use */
  modeType: ModeType;

  /** Where input comes from */
  inputSource: InputSource;

  /** Whether this scenario was forced (invalid config) */
  wasForced: boolean;

  /** Warning message if scenario was forced */
  warningMessage?: string;
}

/**
 * Resolved scenario with runtime context
 */
export interface ResolvedScenario extends ScenarioConfig {
  /** Step index for debugging */
  stepIndex: number;

  /** Step name for debugging */
  stepName: string;
}

/**
 * Options for resolving a scenario
 */
export interface ResolveScenarioOptions {
  /** Whether the step is interactive (after undefined resolution) */
  interactive: boolean;
  /** Whether auto mode is enabled */
  autoMode: boolean;
  /** Whether step has chained prompts */
  hasChainedPrompts: boolean;
  /** Step index for debugging */
  stepIndex: number;
  /** Step name for debugging */
  stepName: string;
}
