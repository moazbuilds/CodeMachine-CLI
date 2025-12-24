export interface MistralCommandOptions {
  workingDir: string;
  prompt: string;
  model?: string;
}

export interface MistralCommand {
  command: string;
  args: string[];
}

/**
 * Model mapping from config models to Mistral model names
 * If model is not in this map, it will be passed as-is to Mistral
 */
const MODEL_MAP: Record<string, string> = {
  'gpt-5-codex': 'devstral-2', // Map to Devstral 2
  'gpt-4': 'mistral-large', // Map to Mistral Large
  'gpt-4-turbo': 'mistral-large',
  'gpt-3.5-turbo': 'mistral-small',
  'o1-preview': 'devstral-2',
  'o1-mini': 'mistral-large',
};

/**
 * Maps a model name from config to Mistral's model naming convention
 * Returns undefined if the model should use Mistral's default
 */
function _mapModel(model?: string): string | undefined {
  if (!model) {
    return undefined;
  }

  // If it's in our mapping, use the mapped value
  if (model in MODEL_MAP) {
    return MODEL_MAP[model];
  }

  // If it's already a Mistral model name, pass it through
  if (model.startsWith('mistral-') || model.startsWith('devstral-')) {
    return model;
  }

  // Otherwise, don't use a model flag and let Mistral use its default
  return undefined;
}

export function buildMistralExecCommand(options: MistralCommandOptions): MistralCommand {
  // Mistral Vibe CLI doesn't support --model flag
  // Model selection is done via agent configuration files at ~/.vibe/agents/
  // For now, we'll use the default model configured in Vibe
  
  // Base args for Mistral Vibe CLI in programmatic mode
  // -p: programmatic mode (send prompt, auto-approve tools, output response, exit)
  //     The prompt will be passed as an argument to -p
  // --auto-approve: automatically approve all tool executions
  // --output streaming: output newline-delimited JSON per message
  const args: string[] = [
    '-p',
    options.prompt, // Pass prompt as argument to -p (required by Mistral Vibe)
    '--auto-approve',
    '--output',
    'streaming',
  ];

  // Note: Model selection is not supported via CLI flags in Mistral Vibe
  // Users need to configure models via agent config files at ~/.vibe/agents/NAME.toml
  // or use the default model configured in ~/.vibe/config.toml

  // Call vibe directly - prompt is passed as argument to -p flag
  return {
    command: 'vibe',
    args,
  };
}

