import { stat, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import {
  checkCliInstalled,
  displayCliNotInstalledError,
  isCommandNotFoundError,
  ensureAuthDirectory,
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
 * Gets the path to the settings file
 */
export function getSettingsPath(configDir: string): string {
  return path.join(configDir, 'settings.json');
}

/**
 * Check if settings file contains auth environment variables
 */
async function hasAuthInSettings(settingsPath: string): Promise<boolean> {
  try {
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    // Check if settings has an env object with auth keys
    if (settings.env && typeof settings.env === 'object') {
      const authKeys = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
      for (const key of authKeys) {
        if (settings.env[key]) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
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

  // Check if credentials file exists
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file doesn't exist, check settings.json for auth env vars
  }

  // Check if settings.json has auth env vars
  const settingsPath = getSettingsPath(configDir);
  if (await hasAuthInSettings(settingsPath)) {
    return true;
  }

  return false;
}

/**
 * Polls for credentials file and terminates process when found
 */
function watchForCredentials(
  credPath: string,
  proc: ReturnType<typeof Bun.spawn>,
  timeoutMs: number = 600000,
  pollIntervalMs: number = 500
): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      clearTimeout(timeout);
    };

    const finish = (success: boolean) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(success);
    };

    // Overall timeout
    const timeout = setTimeout(async () => {
      if (resolved) return;
      proc.kill('SIGTERM');
      finish(false);
    }, timeoutMs);

    // Poll for credential file
    pollInterval = setInterval(async () => {
      if (resolved) return;

      try {
        await stat(credPath);
      } catch {
        return; // File doesn't exist yet
      }

      // File exists - wait for it to be fully written
      await new Promise((r) => setTimeout(r, 200));

      // Verify file still exists
      try {
        await stat(credPath);
      } catch {
        return; // File disappeared
      }

      console.log('\nAuthentication detected, closing Claude...\n');
      proc.kill('SIGTERM');

      // Fallback to SIGKILL if process doesn't exit
      const killTimeout = setTimeout(() => proc.kill('SIGKILL'), 2000);
      await proc.exited;
      clearTimeout(killTimeout);

      finish(true);
    }, pollIntervalMs);

    // Also resolve if process exits on its own
    proc.exited.then(async () => {
      if (resolved) return;
      // Check if credentials exist after natural exit
      try {
        await stat(credPath);
        finish(true);
      } catch {
        finish(false);
      }
    });
  });
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

  // If already authenticated via credentials file, nothing to do
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file doesn't exist
  }

  // Check if settings.json has auth env vars
  const settingsPath = getSettingsPath(configDir);
  if (await hasAuthInSettings(settingsPath)) {
    return true;
  }

  // Check if CLI is installed
  const cliInstalled = await checkCliInstalled(metadata.cliBinary);
  if (!cliInstalled) {
    displayCliNotInstalledError(metadata);
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  // Ensure config directory exists for watcher
  await ensureAuthDirectory(configDir);

  console.log(`\nRunning Claude authentication...\n`);
  console.log(`Config directory: ${configDir}\n`);

  try {
    const resolvedClaude = Bun.which('claude') ?? 'claude';

    // Spawn claude (not setup-token) - interactive
    const proc = Bun.spawn([resolvedClaude], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
      stdio: ['inherit', 'inherit', 'inherit'],
    });

    // Poll for credentials and terminate on success
    const success = await watchForCredentials(credPath, proc);

    if (success) {
      return true;
    }

    // Auth failed or timed out
    throw new Error('Authentication timed out or was not completed.');
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      console.error(`\n────────────────────────────────────────────────────────────`);
      console.error(`  ⚠️  ${metadata.name} CLI Not Found`);
      console.error(`────────────────────────────────────────────────────────────`);
      console.error(`\n'${metadata.cliBinary}' failed because the CLI is missing.`);
      console.error(`Please install ${metadata.name} CLI before trying again:\n`);
      console.error(`  ${metadata.installCommand}\n`);
      console.error(`────────────────────────────────────────────────────────────\n`);
      throw new Error(`${metadata.name} CLI is not installed.`);
    }

    throw error;
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
