import { stat, rm, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import { metadata } from './metadata.js';

/**
 * Check if CLI is installed
 */
async function isCliInstalled(command: string): Promise<boolean> {
  try {
    // Resolve command using Bun.which() to handle Windows .cmd files
    const resolvedCommand = Bun.which(command);
    
    // If command is not found in PATH, it's not installed
    if (!resolvedCommand) {
      return false;
    }

    const proc = Bun.spawn([resolvedCommand, '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
    });

    // Set a timeout
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 3000)
    );

    const exitCode = await Promise.race([proc.exited, timeout]);
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const out = `${stdout}\n${stderr}`;

    // Check for error messages indicating command not found
    if (/not recognized as an internal or external command/i.test(out)) return false;
    if (/command not found/i.test(out)) return false;
    if (/No such file or directory/i.test(out)) return false;

    // If exit code is 0 or we get help output, CLI is installed
    if (typeof exitCode === 'number' && exitCode === 0) return true;
    // Even if exit code is non-zero, if we got help output, CLI exists
    if (/usage:|vibe \[-h\]/i.test(out)) return true;

    return false;
  } catch {
    return false;
  }
}

export interface MistralAuthOptions {
  mistralConfigDir?: string;
}

export function resolveMistralConfigDir(options?: MistralAuthOptions): string {
  if (options?.mistralConfigDir) {
    return expandHomeDir(options.mistralConfigDir);
  }

  if (process.env.MISTRAL_CONFIG_DIR) {
    return expandHomeDir(process.env.MISTRAL_CONFIG_DIR);
  }

  // Authentication is shared globally
  return path.join(homedir(), '.codemachine', 'mistral');
}

/**
 * Gets the path to the credentials file
 * Mistral Vibe stores it at ~/.vibe/.env
 */
export function getCredentialsPath(configDir: string): string {
  // Mistral Vibe uses ~/.vibe/.env for API key
  const vibeDir = path.join(homedir(), '.vibe');
  return path.join(vibeDir, '.env');
}

/**
 * Gets paths to all Mistral-related files that need to be cleaned up
 * CodeMachine should not manage Vibe's credentials - it only checks if they exist.
 */
export function getMistralAuthPaths(configDir: string): string[] {
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

  const credPath = getCredentialsPath(resolveMistralConfigDir(options));

  try {
    await stat(credPath);
    return true;
  } catch (_error) {
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

  const configDir = resolveMistralConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  // If already authenticated, nothing to do
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file doesn't exist
  }

  if (process.env.CODEMACHINE_SKIP_AUTH === '1') {
    // Create a placeholder for testing/dry-run mode
    const vibeDir = path.dirname(credPath);
    await mkdir(vibeDir, { recursive: true });
    await writeFile(credPath, 'MISTRAL_API_KEY=placeholder', { encoding: 'utf8' });
    return true;
  }

  // Check if CLI is installed
  const cliInstalled = await isCliInstalled(metadata.cliBinary);
  if (!cliInstalled) {
    console.error(`\n────────────────────────────────────────────────────────────`);
    console.error(`  ⚠️  ${metadata.name} CLI Not Installed`);
    console.error(`────────────────────────────────────────────────────────────`);
    console.error(`\nThe '${metadata.cliBinary}' command is not available.`);
    console.error(`Please install ${metadata.name} CLI first:\n`);
    console.error(`  ${metadata.installCommand}\n`);
    console.error(`────────────────────────────────────────────────────────────\n`);
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  // Mistral Vibe CLI manages its own authentication
  // We should not interfere with its credentials file (~/.vibe/.env)
  // Instead, guide the user to authenticate via Vibe CLI directly
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  🔐 ${metadata.name} Authentication`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`\n${metadata.name} CLI manages its own authentication.`);
  console.log(`\nTo authenticate with ${metadata.name}:\n`);
  console.log(`1. Run the Vibe CLI directly to set up your API key:`);
  console.log(`   vibe\n`);
  console.log(`2. When prompted, enter your API key from: https://console.mistral.ai/api-keys`);
  console.log(`3. Vibe will store your credentials at ~/.vibe/.env`);
  console.log(`4. After authentication, CodeMachine will automatically detect it.\n`);
  console.log(`Alternatively, you can set the MISTRAL_API_KEY environment variable:\n`);
  console.log(`   export MISTRAL_API_KEY=<your-api-key>\n`);
  console.log(`────────────────────────────────────────────────────────────\n`);

  throw new Error('Authentication incomplete. Please authenticate via Vibe CLI or set MISTRAL_API_KEY environment variable.');
}

/**
 * Clears all Mistral authentication data
 * CodeMachine does not manage Vibe's credentials - it only checks if they exist.
 * To clear Vibe's credentials, users should do so directly via the Vibe CLI or manually.
 */
export async function clearAuth(options?: MistralAuthOptions): Promise<void> {
  const configDir = resolveMistralConfigDir(options);
  const authPaths = getMistralAuthPaths(configDir);

  // Remove only CodeMachine-specific auth files (if any)
  // We do NOT delete ~/.vibe/.env as that belongs to Mistral Vibe CLI
  await Promise.all(
    authPaths.map(async (authPath) => {
      try {
        await rm(authPath, { force: true });
      } catch (_error) {
        // Ignore removal errors; treat as cleared
      }
    }),
  );
}

/**
 * Returns the next auth menu action based on current auth state
 */
export async function nextAuthMenuAction(options?: MistralAuthOptions): Promise<'login' | 'logout'> {
  return (await isAuthenticated(options)) ? 'logout' : 'login';
}

