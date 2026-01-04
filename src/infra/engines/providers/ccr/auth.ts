import { stat } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import {
  checkCliInstalled,
  displayCliNotInstalledError,
  ensureAuthDirectory,
  createCredentialFile,
  cleanupAuthFiles,
  getNextAuthAction,
} from '../../core/auth.js';
import { metadata } from './metadata.js';
import { ENV } from './config.js';

export interface CcrAuthOptions {
  ccrConfigDir?: string;
}

/**
 * Resolves the CCR config directory (shared for authentication)
 */
export function resolveCcrConfigDir(options?: CcrAuthOptions): string {
  if (options?.ccrConfigDir) {
    return expandHomeDir(options.ccrConfigDir);
  }

  if (process.env[ENV.CCR_HOME]) {
    return expandHomeDir(process.env[ENV.CCR_HOME]!);
  }

  // Authentication is shared globally
  return path.join(homedir(), '.codemachine', 'ccr');
}

/**
 * Gets the path to the .enable file
 * This simple marker file indicates CCR is enabled in codemachine
 */
export function getCredentialsPath(configDir: string): string {
  return path.join(configDir, '.enable');
}

/**
 * Gets paths to all CCR-related files that need to be cleaned up
 */
export function getCcrAuthPaths(configDir: string): string[] {
  return [
    getCredentialsPath(configDir), // .enable
  ];
}

/**
 * Checks if CCR is authenticated
 * For CCR, we check if the .enable file exists
 */
export async function isAuthenticated(options?: CcrAuthOptions): Promise<boolean> {
  const configDir = resolveCcrConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  try {
    await stat(credPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures CCR is authenticated
 * Creates the .enable file to mark CCR as enabled in codemachine
 */
export async function ensureAuth(options?: CcrAuthOptions): Promise<boolean> {
  const configDir = resolveCcrConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  // If already authenticated, nothing to do
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file doesn't exist
  }

  // Check if CLI is installed (CCR uses -v instead of --version)
  const cliInstalled = await checkCliInstalled(metadata.cliBinary, { versionFlag: '-v' });
  if (!cliInstalled) {
    displayCliNotInstalledError(metadata);
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  // Create the .enable marker file
  const ccrDir = path.dirname(credPath);
  await ensureAuthDirectory(ccrDir);
  await createCredentialFile(credPath, '');

  // Show configuration tip
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  ✅  ${metadata.name} CLI Detected`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`\n💡 Tip: CCR is installed but you might still need to configure it`);
  console.log(`       (if you haven't already).\n`);
  console.log(`To configure CCR:`);
  console.log(`  1. Run: ccr ui`);
  console.log(`     Opens the web UI to add your providers\n`);
  console.log(`  2. Or manually edit: ~/.claude-code-router/config.json\n`);
  console.log(`🚀 Easiest way to use CCR inside Codemachine:`);
  console.log(`   Logout from all other engines using:`);
  console.log(`     codemachine auth logout`);
  console.log(`   This will run CCR by default for all engines.\n`);
  console.log(`   Or modify the template by adding ccr engine.`);
  console.log(`   For full guide, check:`);
  console.log(`   https://github.com/moazbuilds/CodeMachine-CLI/blob/main/docs/customizing-workflows.md\n`);
  console.log(`For more help, visit:`);
  console.log(`  https://github.com/musistudio/claude-code-router\n`);
  console.log(`────────────────────────────────────────────────────────────\n`);

  return true;
}

/**
 * Clears all CCR authentication data
 * Removes the .enable file to disable CCR usage in codemachine
 */
export async function clearAuth(options?: CcrAuthOptions): Promise<void> {
  const configDir = resolveCcrConfigDir(options);
  const authPaths = getCcrAuthPaths(configDir);
  await cleanupAuthFiles(authPaths);
}

/**
 * Returns the next auth menu action based on current auth state
 */
export async function nextAuthMenuAction(options?: CcrAuthOptions): Promise<'login' | 'logout'> {
  return getNextAuthAction(await isAuthenticated(options));
}
