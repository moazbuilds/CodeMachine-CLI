export interface CodexCommandOptions {
  workingDir: string;
  resumeSessionId?: string;
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
}

export interface CodexCommand {
  command: string;
  args: string[];
}

export function buildCodexCommand(options: CodexCommandOptions): CodexCommand {
  const { workingDir, resumeSessionId, model, modelReasoningEffort } = options;

  // Resume command has different flags than exec
  if (resumeSessionId) {
    const args = ['exec', 'resume', resumeSessionId];

    // Only -c/--config is valid for resume
    if (modelReasoningEffort) {
      args.push('--config', `model_reasoning_effort="${modelReasoningEffort}"`);
    }

    // Add continuation prompt
    args.push('Continue from where you left off.');

    return { command: 'codex', args };
  }

  // Normal exec command
  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    'danger-full-access',
    '--dangerously-bypass-approvals-and-sandbox',
    '-C',
    workingDir,
  ];

  // Add model if specified
  if (model) {
    args.push('--model', model);
  }

  // Add reasoning effort if specified
  if (modelReasoningEffort) {
    args.push('--config', `model_reasoning_effort="${modelReasoningEffort}"`);
  }

  // Read prompt from stdin
  args.push('-');

  return { command: 'codex', args };
}
