export interface AuggieCommandOptions {
  /**
   * Model identifier (if supported by Auggie)
   */
  model?: string;
  /**
   * Session ID to resume
   */
  resumeSessionId?: string;
}

export interface AuggieCommand {
  command: string;
  args: string[];
}

export function buildAuggieRunCommand(options: AuggieCommandOptions = {}): AuggieCommand {
  const args: string[] = ['--print', '--quiet', '--output-format', 'json'];

  // Add resume flag if resuming a session
  if (options.resumeSessionId?.trim()) {
    args.push('--resume', options.resumeSessionId.trim());
  }

  // Add model if specified (check Auggie docs for exact flag)
  if (options.model?.trim()) {
    args.push('--model', options.model.trim());
  }

  return {
    command: 'auggie',
    args,
  };
}

