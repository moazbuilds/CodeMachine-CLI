import { stat } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import {
  checkCliInstalled,
  displayCliNotInstalledError,
  isCommandNotFoundError,
  ensureAuthDirectory,
  createCredentialFile,
  cleanupAuthFiles,
  getNextAuthAction,
} from '../../core/auth.js';
import { metadata } from './metadata.js';
import { ENV } from './config.js';

export interface ClaudeAuthOptions {
  claudeConfigDir?: string;
}

/**
 * Resolves the Claude config directory (shared for authentication)
 */
export function resolveClaudeConfigDir(options?: ClaudeAuthOptions): string {
  if (options?.claudeConfigDir) {
    return expandHomeDir(options.claudeConfigDir);
  }

  if (process.env[ENV.CLAUDE_HOME]) {
    return expandHomeDir(process.env[ENV.CLAUDE_HOME]!);
  }

  // Authentication is shared globally
  return path.join(homedir(), '.codemachine', 'claude');
}

/**
 * Gets the path to the credentials file
 * Claude stores it directly in CLAUDE_CONFIG_DIR
 */
export function getCredentialsPath(configDir: string): string {
  return path.join(configDir, '.credentials.json');
}

/**
 * Gets paths to all Claude-related files that need to be cleaned up
 */
export function getClaudeAuthPaths(configDir: string): string[] {
  return [
    getCredentialsPath(configDir), // .credentials.json
    path.join(configDir, '.claude.json'),
    path.join(configDir, '.claude.json.backup'),
  ];
}

/**
 * Checks if Claude is authenticated
 */
export async function isAuthenticated(options?: ClaudeAuthOptions): Promise<boolean> {
  // Check if token is set via environment variable (CodeMachine or standard)
  if (process.env[ENV.CLAUDE_OAUTH_TOKEN] || process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return true;
  }

  const configDir = resolveClaudeConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  try {
    await stat(credPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures Claude is authenticated, running setup-token if needed
 */
export async function ensureAuth(options?: ClaudeAuthOptions): Promise<boolean> {
  // Check if token is already set via environment variable (CodeMachine or standard)
  if (process.env[ENV.CLAUDE_OAUTH_TOKEN] || process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return true;
  }

  const configDir = resolveClaudeConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  // If already authenticated, nothing to do
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file doesn't exist
  }

  // Check if CLI is installed
  const cliInstalled = await checkCliInstalled(metadata.cliBinary);
  if (!cliInstalled) {
    displayCliNotInstalledError(metadata);
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  // Run interactive setup-token via Claude CLI with proper env
  console.log(`\nRunning Claude authentication...\n`);
  console.log(`Config directory: ${configDir}\n`);

  try {
    // Resolve claude command to handle Windows .cmd files
    const resolvedClaude = Bun.which('claude') ?? 'claude';

    const proc = Bun.spawn([resolvedClaude, 'setup-token'], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    await proc.exited;
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      console.error(`\n────────────────────────────────────────────────────────────`);
      console.error(`  ⚠️  ${metadata.name} CLI Not Found`);
      console.error(`────────────────────────────────────────────────────────────`);
      console.error(`\n'${metadata.cliBinary} setup-token' failed because the CLI is missing.`);
      console.error(`Please install ${metadata.name} CLI before trying again:\n`);
      console.error(`  ${metadata.installCommand}\n`);
      console.error(`────────────────────────────────────────────────────────────\n`);
      throw new Error(`${metadata.name} CLI is not installed.`);
    }

    throw error;
  }

  // Verify the credentials were created
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file wasn't created - Claude CLI returned token instead
    console.error(`\n────────────────────────────────────────────────────────────`);
    console.error(`  ℹ️  Claude CLI Authentication Notice`);
    console.error(`────────────────────────────────────────────────────────────`);
    console.error(`\nYour Claude CLI installation uses token-based authentication.`);
    console.error(`Please set the token you received as an environment variable:\n`);
    console.error(`  export CODEMACHINE_CLAUDE_OAUTH_TOKEN=<your-token>\n`);
    console.error(`For persistence, add this line to your shell configuration:`);
    console.error(`  ~/.bashrc (Bash) or ~/.zshrc (Zsh)\n`);
    console.error(`────────────────────────────────────────────────────────────\n`);

    throw new Error('Authentication incomplete. Please set CODEMACHINE_CLAUDE_OAUTH_TOKEN environment variable.');
  }
}

/**
 * Clears all Claude authentication data
 */
export async function clearAuth(options?: ClaudeAuthOptions): Promise<void> {
  const configDir = resolveClaudeConfigDir(options);
  const authPaths = getClaudeAuthPaths(configDir);
  await cleanupAuthFiles(authPaths);
}

/**
 * Returns the next auth menu action based on current auth state
 */
export async function nextAuthMenuAction(options?: ClaudeAuthOptions): Promise<'login' | 'logout'> {
  return getNextAuthAction(await isAuthenticated(options));
}
