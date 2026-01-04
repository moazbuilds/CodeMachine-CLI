/**
 * Cursor engine configuration and model mapping
 */

export interface CursorConfig {
  /**
   * Model to use for Cursor execution
   * Available models: auto, cheetah, sonnet-4.5, sonnet-4.5-thinking, gpt-5, gpt-5-codex, opus-4.1, grok
   */
  model?: string;

  /**
   * Working directory for execution
   */
  workingDir: string;

  /**
   * Optional custom Cursor config directory
   * Defaults to ~/.codemachine/cursor
   */
  cursorConfigDir?: string;
}

/**
 * Available Cursor models
 */
export const CURSOR_MODELS = {
  AUTO: 'auto',
  CHEETAH: 'cheetah',
  SONNET_4_5: 'sonnet-4.5',
  SONNET_4_5_THINKING: 'sonnet-4.5-thinking',
  GPT_5: 'gpt-5',
  GPT_5_CODEX: 'gpt-5-codex',
  OPUS_4_1: 'opus-4.1',
  GROK: 'grok',
} as const;

/**
 * Model mapping from generic model names to Cursor models
 * This allows using config with 'gpt-5-codex' or 'gpt-4' to map to Cursor models
 */
export const MODEL_MAPPING: Record<string, string> = {
  // Map common model names to Cursor equivalents
  'gpt-5-codex': CURSOR_MODELS.GPT_5_CODEX,
  'gpt-4': CURSOR_MODELS.GPT_5,
  'gpt-4-turbo': CURSOR_MODELS.GPT_5,
  'gpt-3.5-turbo': CURSOR_MODELS.CHEETAH,
  'o1-preview': CURSOR_MODELS.OPUS_4_1,
  'o1-mini': CURSOR_MODELS.SONNET_4_5,
  'sonnet': CURSOR_MODELS.SONNET_4_5,
  'claude-sonnet-4.5': CURSOR_MODELS.SONNET_4_5,
  'opus': CURSOR_MODELS.OPUS_4_1,
};

/**
 * Resolves a model name to a Cursor model
 * Returns undefined if the model should use Cursor's default (auto)
 */
export function resolveModel(model?: string): string | undefined {
  if (!model) {
    return undefined;
  }

  // Check if it's in our mapping
  if (model in MODEL_MAPPING) {
    return MODEL_MAPPING[model];
  }

  // If it's already a Cursor model name, return it
  const cursorModelValues = Object.values(CURSOR_MODELS) as string[];
  if (cursorModelValues.includes(model)) {
    return model;
  }

  // Otherwise, return undefined to use Cursor's default (auto)
  return undefined;
}

/**
 * Default timeout for Cursor operations (30 minutes)
 */
export const DEFAULT_TIMEOUT = 1800000;

/**
 * Environment variable names
 */
export const ENV = {
  CURSOR_HOME: 'CODEMACHINE_CURSOR_HOME',
} as const;
