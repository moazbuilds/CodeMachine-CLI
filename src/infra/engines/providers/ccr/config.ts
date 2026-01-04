/**
 * CCR (Claude Code Router) engine configuration and model mapping
 */

export interface CCRConfig {
  /**
   * Model to use for CCR execution
   */
  model?: string;

  /**
   * Working directory for execution
   */
  workingDir: string;

  /**
   * Optional custom CCR config directory
   * Defaults to ~/.codemachine/ccr
   */
  ccrConfigDir?: string;
}

/**
 * Resolve a CCR model name.
 * Currently pass-through to keep the hook for future mapping logic.
 */
export function resolveModel(model?: string): string | undefined {
  const trimmed = model?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Default timeout for CCR operations (30 minutes)
 */
export const DEFAULT_TIMEOUT = 1800000;

/**
 * Environment variable names
 */
export const ENV = {
  CCR_HOME: 'CODEMACHINE_CCR_HOME',
} as const;
