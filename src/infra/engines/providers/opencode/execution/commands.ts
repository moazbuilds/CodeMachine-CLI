export interface OpenCodeCommandOptions {
  /**
   * Provider/model identifier (e.g., anthropic/claude-3.7-sonnet)
   */
  model?: string;
  /**
   * Agent name to run (defaults to 'build')
   */
  agent?: string;
  /**
   * Session ID to resume (uses -s flag)
   */
  resumeSessionId?: string;
}

export interface OpenCodeCommand {
  command: string;
  args: string[];
}

export function buildOpenCodeRunCommand(options: OpenCodeCommandOptions = {}): OpenCodeCommand {
  const args: string[] = ['run', '--format', 'json'];

  // Add session resume flag if provided
  if (options.resumeSessionId?.trim()) {
    args.push('--session', options.resumeSessionId.trim());
  }

  const agentName = options.agent?.trim() || 'build';
  if (agentName) {
    args.push('--agent', agentName);
  }

  if (options.model?.trim()) {
    args.push('--model', options.model.trim());
  }

  return {
    command: 'opencode',
    args,
  };
}
