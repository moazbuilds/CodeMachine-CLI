/**
 * Codex engine configuration and model mapping
 */

export interface CodexConfig {
  /**
   * Model to use for Codex execution
   */
  model?: string;

  /**
   * Working directory for execution
   */
  workingDir: string;

  /**
   * Optional custom Codex config directory
   * Defaults to ~/.codemachine/codex
   */
  codexConfigDir?: string;
}

/**
 * Resolve a Codex model name.
 * Currently pass-through to keep the hook for future mapping logic.
 */
export function resolveModel(model?: string): string | undefined {
  const trimmed = model?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Default timeout for Codex operations (30 minutes)
 */
export const DEFAULT_TIMEOUT = 1800000;

/**
 * Environment variable names
 */
export const ENV = {
  CODEX_HOME: 'CODEMACHINE_CODEX_HOME',
} as const;
