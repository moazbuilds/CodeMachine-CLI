export interface ClaudeCommandOptions {
  workingDir: string;
  resumeSessionId?: string;
  model?: string;
}

export interface ClaudeCommand {
  command: string;
  args: string[];
}

/**
 * Model mapping from config models to Claude model names
 * If model is not in this map, it will be passed as-is to Claude
 */
const MODEL_MAP: Record<string, string> = {
  'gpt-5-codex': 'sonnet', // Map to Claude Sonnet
  'gpt-4': 'sonnet',
  'gpt-3.5-turbo': 'haiku',
};

/**
 * Maps a model name from config to Claude's model naming convention
 * Returns undefined if the model should use Claude's default
 */
function mapModel(model?: string): string | undefined {
  if (!model) {
    return undefined;
  }

  // If it's in our mapping, use the mapped value
  if (model in MODEL_MAP) {
    return MODEL_MAP[model];
  }

  // If it's already a Claude model name, pass it through
  if (model.startsWith('claude-') || model === 'sonnet' || model === 'opus' || model === 'haiku') {
    return model;
  }

  // Otherwise, don't use a model flag and let Claude use its default
  return undefined;
}

export function buildClaudeExecCommand(options: ClaudeCommandOptions): ClaudeCommand {
  const { resumeSessionId, model } = options;

  // Base args: --print for non-interactive mode, bypass permissions, streaming output
  const args: string[] = [
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
    command: 'claude',
    args,
  };
}
