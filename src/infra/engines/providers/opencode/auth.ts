import { stat, rm, writeFile, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import {
  displayCliNotInstalledError,
  isCommandNotFoundError,
  ensureAuthDirectory,
  createCredentialFile,
} from '../../core/auth.js';
import { metadata } from './metadata.js';
import { ENV } from './config.js';

const SENTINEL_FILE = 'auth.json';

/**
 * Resolves the OpenCode home directory (base for all XDG paths)
 */
function resolveOpenCodeHome(customPath?: string): string {
  const configured = customPath ?? process.env[ENV.OPENCODE_HOME];
  const target = configured ? expandHomeDir(configured) : path.join(homedir(), '.codemachine', 'opencode');
  return target;
}

function getSentinelPath(opencodeHome: string): string {
  return path.join(opencodeHome, 'data', SENTINEL_FILE);
}

/**
 * Check if CLI binary exists in PATH (instant, no subprocess)
 * OpenCode works with zero config - just needs to be installed
 */
function isCliInstalled(command: string): boolean {
  return Bun.which(command) !== null;
}

export async function isAuthenticated(): Promise<boolean> {
  // OpenCode works with zero config - just needs to be installed
  // No auth check required; users can optionally login for specific APIs
  return isCliInstalled(metadata.cliBinary);
}

/**
 * Resolves OpenCode's actual data directory (where OpenCode stores auth.json)
 * This uses XDG_DATA_HOME if set, otherwise falls back to standard XDG path
 */
function resolveOpenCodeDataDir(): string {
  const xdgData = process.env.XDG_DATA_HOME
    ? expandHomeDir(process.env.XDG_DATA_HOME)
    : path.join(homedir(), '.local', 'share');
  return path.join(xdgData, 'opencode');
}

async function hasOpenCodeCredential(providerId: string = 'opencode'): Promise<boolean> {
  const authPath = path.join(resolveOpenCodeDataDir(), 'auth.json');
  try {
    const raw = await readFile(authPath, 'utf8');
    const json = JSON.parse(raw);
    return !!json && typeof json === 'object' && providerId in json;
  } catch {
    return false;
  }
}

export async function ensureAuth(forceLogin = false): Promise<boolean> {
  const opencodeHome = resolveOpenCodeHome();
  const dataDir = path.join(opencodeHome, 'data');

  // Check if already authenticated (skip if forceLogin is true)
  const sentinelPath = getSentinelPath(opencodeHome);
  if (!forceLogin) {
    try {
      await stat(sentinelPath);
      return true; // Already authenticated
    } catch {
      // Sentinel doesn't exist, need to authenticate
    }
  }

  // Ensure data directory exists before proceeding
  await ensureAuthDirectory(dataDir);

  // Check if CLI is installed
  if (!isCliInstalled(metadata.cliBinary)) {
    displayCliNotInstalledError(metadata);
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  // Set up XDG environment variables for OpenCode
  const xdgEnv = {
    ...process.env,
    XDG_CONFIG_HOME: path.join(opencodeHome, 'config'),
    XDG_CACHE_HOME: path.join(opencodeHome, 'cache'),
    XDG_DATA_HOME: path.join(opencodeHome, 'data'),
  };

  // Run interactive login via OpenCode CLI
  try {
    // Resolve opencode command to handle Windows .cmd files
    const resolvedOpenCode = Bun.which('opencode') ?? 'opencode';

    const proc = Bun.spawn([resolvedOpenCode, 'auth', 'login'], {
      env: xdgEnv,
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    await proc.exited;
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      console.error(`\n────────────────────────────────────────────────────────────`);
      console.error(`  ⚠️  ${metadata.name} CLI Not Found`);
      console.error(`────────────────────────────────────────────────────────────`);
      console.error(`\n'${metadata.cliBinary} auth login' failed because the CLI is missing.`);
      console.error(`Please install ${metadata.name} CLI before trying again:\n`);
      console.error(`  ${metadata.installCommand}\n`);
      console.error(`────────────────────────────────────────────────────────────\n`);
      throw new Error(`${metadata.name} CLI is not installed.`);
    }

    throw error;
  }

  // Create sentinel file after successful login
  try {
    await stat(sentinelPath);
  } catch {
    await writeFile(sentinelPath, '{}', 'utf8');
  }

  return true;
}

export async function clearAuth(): Promise<void> {
  const opencodeHome = resolveOpenCodeHome();

  try {
    await rm(opencodeHome, { recursive: true, force: true });
  } catch {
    // Ignore removal errors
  }

  console.log(`\n${metadata.name} authentication cleared.`);
  console.log(`Removed OpenCode home directory at ${opencodeHome} (if it existed).\n`);
}

export async function nextAuthMenuAction(): Promise<'login' | 'logout'> {
  // If CLI is missing → login
  const cli = await isAuthenticated();
  if (!cli) return 'login';

  // If sentinel is missing or membership credential not found → show login guidance
  const opencodeHome = resolveOpenCodeHome();
  const sentinel = getSentinelPath(opencodeHome);
  let hasSentinel = false;
  try {
    await stat(sentinel);
    hasSentinel = true;
  } catch {
    hasSentinel = false;
  }

  const hasMembership = await hasOpenCodeCredential('opencode');

  return hasSentinel && hasMembership ? 'logout' : 'login';
}

export { resolveOpenCodeHome };
