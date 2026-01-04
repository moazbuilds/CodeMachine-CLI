export interface AuggieConfig {
  /**
   * Optional Auggie model identifier
   */
  model?: string;
  /**
   * Optional configuration directory override
   */
  configDir?: string;
}

/**
 * Resolve an Auggie model name.
 * Currently pass-through to keep the hook for future mapping logic.
 */
export function resolveModel(model?: string): string | undefined {
  const trimmed = model?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Default timeout for Auggie operations (30 minutes)
 */
export const DEFAULT_TIMEOUT = 1800000;

/**
 * Environment variable names
 */
export const ENV = {
  AUGGIE_HOME: 'CODEMACHINE_AUGGIE_HOME',
} as const;
