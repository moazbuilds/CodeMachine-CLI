/**
 * Claude engine configuration and model mapping
 */

export interface ClaudeConfig {
  /**
   * Model to use for Claude execution
   * Can be a Claude model name (sonnet, opus, haiku, claude-3-5-sonnet-latest, etc.)
   * or a generic model name that will be mapped (gpt-5-codex, gpt-4, etc.)
   */
  model?: string;

  /**
   * Working directory for execution
   */
  workingDir: string;

  /**
   * Optional custom Claude config directory
   * Defaults to ~/.codemachine/claude
   */
  claudeConfigDir?: string;
}

/**
 * Available Claude models
 */
export const CLAUDE_MODELS = {
  SONNET: 'sonnet',
  OPUS: 'opus',
  HAIKU: 'haiku',
  SONNET_3_5: 'claude-3-5-sonnet-latest',
  OPUS_3: 'claude-3-opus-latest',
  HAIKU_3: 'claude-3-haiku-latest',
} as const;

/**
 * Model mapping from generic model names to Claude models
 * This allows using config with 'gpt-5-codex' or 'gpt-4' to map to Claude models
 */
export const MODEL_MAPPING: Record<string, string> = {
  // Map common model names to Claude equivalents
  'gpt-5-codex': CLAUDE_MODELS.SONNET,
  'gpt-4': CLAUDE_MODELS.SONNET,
  'gpt-4-turbo': CLAUDE_MODELS.SONNET,
  'gpt-3.5-turbo': CLAUDE_MODELS.HAIKU,
  'o1-preview': CLAUDE_MODELS.OPUS,
  'o1-mini': CLAUDE_MODELS.SONNET,
};

/**
 * Resolves a model name to a Claude model
 * Returns undefined if the model should use Claude's default
 */
export function resolveModel(model?: string): string | undefined {
  if (!model) {
    return undefined;
  }

  // Check if it's in our mapping
  if (model in MODEL_MAPPING) {
    return MODEL_MAPPING[model];
  }

  // If it's already a Claude model name, return it
  if (
    model.startsWith('claude-')
    || model === 'sonnet'
    || model === 'opus'
    || model === 'haiku'
  ) {
    return model;
  }

  // Otherwise, return undefined to use Claude's default
  return undefined;
}

/**
 * Default timeout for Claude operations (30 minutes)
 */
export const DEFAULT_TIMEOUT = 1800000;

/**
 * Environment variable names
 */
export const ENV = {
  CLAUDE_HOME: 'CODEMACHINE_CLAUDE_HOME',
  ANTHROPIC_BASE_URL: 'CODEMACHINE_ANTHROPIC_BASE_URL',
  ANTHROPIC_AUTH_TOKEN: 'CODEMACHINE_ANTHROPIC_AUTH_TOKEN',
  ANTHROPIC_API_KEY: 'CODEMACHINE_ANTHROPIC_API_KEY',
  CLAUDE_OAUTH_TOKEN: 'CODEMACHINE_CLAUDE_OAUTH_TOKEN',
} as const;
