export interface CcrCommandOptions {
  workingDir: string;
  resumeSessionId?: string;
  model?: string;
}

export interface CcrCommand {
  command: string;
  args: string[];
}

/**
 * Model mapping from config models to CCR model names
 * If model is not in this map, it will be passed as-is to CCR
 */
const MODEL_MAP: Record<string, string> = {
  'gpt-5-codex': 'sonnet', // Map to Claude Sonnet equivalent
  'gpt-4': 'sonnet',
  'gpt-3.5-turbo': 'haiku',
};

/**
 * Maps a model name from config to CCR's model naming convention
 * Returns undefined if the model should use CCR's default
 */
function mapModel(model?: string): string | undefined {
  if (!model) {
    return undefined;
  }

  // If it's in our mapping, use the mapped value
  if (model in MODEL_MAP) {
    return MODEL_MAP[model];
  }

  // If it's already a Claude model name (which CCR uses), pass it through
  if (model.startsWith('claude-') || model === 'sonnet' || model === 'opus' || model === 'haiku') {
    return model;
  }

  // Otherwise, don't use a model flag and let CCR use its default
  return undefined;
}

export function buildCcrExecCommand(options: CcrCommandOptions): CcrCommand {
  const { resumeSessionId, model } = options;

  // Base args: --print for non-interactive mode, similar to Claude but using ccr code
  const args: string[] = [
    'code',
    '--print',
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--permission-mode',
    'bypassPermissions',
  ];

  // Add resume flag if resuming a session
  if (resumeSessionId?.trim()) {
    args.push('--resume', resumeSessionId.trim());
  }

  // Add model if specified and valid
  const mappedModel = mapModel(model);
  if (mappedModel) {
    args.push('--model', mappedModel);
  }

  // Prompt is passed via stdin
  return {
    command: 'ccr',
    args,
  };
}