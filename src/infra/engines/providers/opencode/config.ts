export interface OpenCodeConfig {
  /**
   * Optional OpenCode model identifier (provider/model)
   */
  model?: string;
  /**
   * Optional agent name to run (defaults to 'build')
   */
  agent?: string;
  /**
   * Optional configuration directory override
   */
  configDir?: string;
}

/**
 * Resolve an OpenCode model name.
 * Currently pass-through to keep the hook for future mapping logic.
 */
export function resolveModel(model?: string): string | undefined {
  const trimmed = model?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Default timeout for OpenCode operations (30 minutes)
 */
export const DEFAULT_TIMEOUT = 1800000;

/**
 * Environment variable names
 */
export const ENV = {
  OPENCODE_HOME: 'CODEMACHINE_OPENCODE_HOME',
} as const;
