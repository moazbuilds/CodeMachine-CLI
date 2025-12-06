export interface CodexCommandOptions {
  workingDir: string;
  resumeSessionId?: string;
  resumePrompt?: string;
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
}

export interface CodexCommand {
  command: string;
  args: string[];
}

/**
 * Build the final resume prompt combining steering instruction with user message
 */
function buildResumePrompt(userPrompt?: string): string {
  const defaultPrompt = 'Continue from where you left off.';

  if (!userPrompt) {
    return defaultPrompt;
  }

  // Combine steering instruction with user's message
  return `[USER STEERING] The user paused this session to give you new direction. Continue from where you left off, but prioritize the user's request: "${userPrompt}"`;
}

export function buildCodexCommand(options: CodexCommandOptions): CodexCommand {
  const { workingDir, resumeSessionId, resumePrompt, model, modelReasoningEffort } = options;

  // Base args shared by both normal exec and resume
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

  // Add model if specified (only for new exec, not resume)
  if (model && !resumeSessionId) {
    args.push('--model', model);
  }

  // Add reasoning effort if specified
  if (modelReasoningEffort) {
    args.push('--config', `model_reasoning_effort="${modelReasoningEffort}"`);
  }

  if (resumeSessionId) {
    // Resume: add resume subcommand with session ID and combined prompt
    const finalPrompt = buildResumePrompt(resumePrompt);
    args.push('resume', resumeSessionId, finalPrompt);
  } else {
    // Normal exec: read prompt from stdin
    args.push('-');
  }

  return { command: 'codex', args };
}
