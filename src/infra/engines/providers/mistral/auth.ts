import { stat, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import {
  checkCliInstalled,
  displayCliNotInstalledError,
  ensureAuthDirectory,
  cleanupAuthFiles,
  getNextAuthAction,
} from '../../core/auth.js';
import { metadata } from './metadata.js';

export interface MistralAuthOptions {
  mistralConfigDir?: string;
}

export function resolveMistralConfigDir(options?: MistralAuthOptions): string {
  // Keep for backward compatibility; prefer resolveVibeHome below
  if (options?.mistralConfigDir) {
    return expandHomeDir(options.mistralConfigDir);
  }

  if (process.env.MISTRAL_CONFIG_DIR) {
    return expandHomeDir(process.env.MISTRAL_CONFIG_DIR);
  }

  return path.join(homedir(), '.codemachine', 'mistral');
}

function resolveVibeHome(options?: MistralAuthOptions): string {
  if (options?.mistralConfigDir) {
    return expandHomeDir(options.mistralConfigDir);
  }
  if (process.env.VIBE_HOME) {
    return expandHomeDir(process.env.VIBE_HOME);
  }
  // default under codemachine
  return path.join(homedir(), '.codemachine', 'vibe');
}

/**
 * Gets the path to the credentials file
 * Mistral Vibe stores it at ~/.vibe/.env
 */
export function getCredentialsPath(configDir: string): string {
  // Use VIBE_HOME override or fallback to ~/.codemachine/vibe/.env
  const vibeDir = resolveVibeHome({ mistralConfigDir: configDir });
  return path.join(vibeDir, '.env');
}

async function promptForApiKey(): Promise<string | null> {
  try {
    const rl = createInterface({ input, output });
    const answer = await rl.question('Enter MISTRAL_API_KEY: ');
    rl.close();
    const key = answer.trim();
    return key ? key : null;
  } catch {
    return null;
  }
}

/**
 * Gets paths to all Mistral-related files that need to be cleaned up
 * CodeMachine should not manage Vibe's credentials - it only checks if they exist.
 */
export function getMistralAuthPaths(_configDir: string): string[] {
  // Only return CodeMachine-specific paths, not Vibe's actual credentials
  // Mistral Vibe manages its own credentials at ~/.vibe/.env
  return [
    // Add any CodeMachine-specific auth files here if needed in the future
    // For now, we don't manage any CodeMachine-specific Mistral auth files
  ];
}

/**
 * Checks if Mistral is authenticated
 */
export async function isAuthenticated(options?: MistralAuthOptions): Promise<boolean> {
  // Check if token is set via environment variable
  if (process.env.MISTRAL_API_KEY) {
    return true;
  }

  const credPath = getCredentialsPath(resolveVibeHome(options));

  try {
    await stat(credPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures Mistral is authenticated, running setup-token if needed
 */
export async function ensureAuth(options?: MistralAuthOptions): Promise<boolean> {
  // Check if token is already set via environment variable
  if (process.env.MISTRAL_API_KEY) {
    return true;
  }

  const _configDir = resolveMistralConfigDir(options);
  const vibeHome = resolveVibeHome(options);
  const credPath = getCredentialsPath(vibeHome);

  // If already authenticated, nothing to do
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file doesn't exist
  }

  if (process.env.CODEMACHINE_SKIP_AUTH === '1') {
    // Create a placeholder for testing/dry-run mode
    await ensureAuthDirectory(vibeHome);
    await writeFile(credPath, 'MISTRAL_API_KEY=placeholder', { encoding: 'utf8' });
    return true;
  }

  // Check if CLI is installed (Mistral uses --help instead of --version)
  const cliInstalled = await checkCliInstalled(metadata.cliBinary, { versionFlag: '--help' });
  if (!cliInstalled) {
    displayCliNotInstalledError(metadata);
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  // CLI is present but no API key - run setup or prompt and persist to VIBE_HOME/.env
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  🔐 ${metadata.name} Authentication`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`\n${metadata.name} CLI requires the MISTRAL_API_KEY.`);
  console.log(`VIBE_HOME will be used to store credentials: ${vibeHome}`);
  console.log(`(override with VIBE_HOME env)\n`);

  // Try interactive setup via vibe-acp --setup with VIBE_HOME set
  try {
    const resolvedSetup = Bun.which('vibe-acp') ?? 'vibe-acp';
    const proc = Bun.spawn([resolvedSetup, '--setup'], {
      env: { ...process.env, VIBE_HOME: vibeHome },
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    await proc.exited;
    // After setup, check again
    try {
      await stat(credPath);
      return true;
    } catch {
      // fall through to manual prompt
    }
  } catch {
    // ignore and fall back to manual prompt
  }

  console.log(`You can paste the API key here and we'll save it to ${path.join(vibeHome, '.env')} for you.\n`);

  const apiKey = await promptForApiKey();
  if (apiKey) {
    await ensureAuthDirectory(vibeHome);
    const envPath = path.join(vibeHome, '.env');
    await writeFile(envPath, `MISTRAL_API_KEY=${apiKey}\n`, { encoding: 'utf8' });
    process.env.MISTRAL_API_KEY = apiKey; // make available for this process
    console.log(`\nSaved API key to ${envPath}\n`);
    return true;
  }

  console.log(`\nNo API key provided. You can also set it manually:\n`);
  console.log(`  export MISTRAL_API_KEY=<your-api-key>\n`);
  console.log(`or create ~/.vibe/.env with:\n`);
  console.log(`  MISTRAL_API_KEY=<your-api-key>\n`);
  console.log(`────────────────────────────────────────────────────────────\n`);

  throw new Error('Authentication incomplete. Please set MISTRAL_API_KEY.');
}

/**
 * Clears all Mistral authentication data
 * CodeMachine does not manage Vibe's credentials - it only checks if they exist.
 * To clear Vibe's credentials, users should do so directly via the Vibe CLI or manually.
 */
export async function clearAuth(options?: MistralAuthOptions): Promise<void> {
  const configDir = resolveMistralConfigDir(options);
  const vibeHome = resolveVibeHome(options);
  const authPaths = getMistralAuthPaths(configDir);

  // Remove CodeMachine-specific auth files (if any)
  await cleanupAuthFiles(authPaths);

  // Also remove the Vibe credentials file to fully sign out
  const vibeEnv = path.join(vibeHome, '.env');
  try {
    await rm(vibeEnv, { force: true });
  } catch {
    // Ignore removal errors
  }
}

/**
 * Returns the next auth menu action based on current auth state
 */
export async function nextAuthMenuAction(options?: MistralAuthOptions): Promise<'login' | 'logout'> {
  return getNextAuthAction(await isAuthenticated(options));
}
