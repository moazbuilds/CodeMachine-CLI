/**
 * Mistral engine configuration and model mapping
 */

export interface MistralConfig {
  /**
   * Model to use for Mistral execution
   * Can be a Mistral model name (devstral-2, mistral-large, mistral-medium, etc.)
   * or a generic model name that will be mapped (gpt-5-codex, gpt-4, etc.)
   */
  model?: string;

  /**
   * Working directory for execution
   */
  workingDir: string;

  /**
   * Optional custom Mistral config directory
   * Defaults to ~/.codemachine/mistral
   */
  mistralConfigDir?: string;
}

/**
 * Available Mistral models
 */
export const MISTRAL_MODELS = {
  DEVSTRAL_2: 'devstral-2',
  MISTRAL_LARGE: 'mistral-large',
  MISTRAL_MEDIUM: 'mistral-medium',
  MISTRAL_SMALL: 'mistral-small',
} as const;

/**
 * Model mapping from generic model names to Mistral models
 * This allows using config with 'gpt-5-codex' or 'gpt-4' to map to Mistral models
 */
export const MODEL_MAPPING: Record<string, string> = {
  // Map common model names to Mistral equivalents
  'gpt-5-codex': MISTRAL_MODELS.DEVSTRAL_2,
  'gpt-4': MISTRAL_MODELS.MISTRAL_LARGE,
  'gpt-4-turbo': MISTRAL_MODELS.MISTRAL_LARGE,
  'gpt-3.5-turbo': MISTRAL_MODELS.MISTRAL_SMALL,
  'o1-preview': MISTRAL_MODELS.DEVSTRAL_2,
  'o1-mini': MISTRAL_MODELS.MISTRAL_LARGE,
};

/**
 * Resolves a model name to a Mistral model
 * Returns undefined if the model should use Mistral's default
 */
export function resolveModel(model?: string): string | undefined {
  if (!model) {
    return undefined;
  }

  // Check if it's in our mapping
  if (model in MODEL_MAPPING) {
    return MODEL_MAPPING[model];
  }

  // If it's already a Mistral model name, return it
  if (model.startsWith('mistral-') || model.startsWith('devstral-')) {
    return model;
  }

  // Otherwise, return undefined to use Mistral's default
  return undefined;
}

/**
 * Default timeout for Mistral operations (30 minutes)
 */
export const DEFAULT_TIMEOUT = 1800000;

/**
 * Environment variable names
 */
export const ENV = {
  MISTRAL_HOME: 'CODEMACHINE_MISTRAL_HOME',
} as const;

