import { stat, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import {
  checkCliInstalled,
  displayCliNotInstalledError,
  isCommandNotFoundError,
  ensureAuthDirectory,
  createCredentialFile,
} from '../../core/auth.js';
import { metadata } from './metadata.js';

const SENTINEL_FILE = 'auth.json';

/**
 * Resolves the Auggie home directory
 */
function resolveAuggieHome(customPath?: string): string {
  const configured = customPath ?? process.env.AUGGIE_HOME;
  const target = configured ? expandHomeDir(configured) : path.join(homedir(), '.codemachine', 'auggie');
  return target;
}

function getSentinelPath(auggieHome: string): string {
  return path.join(auggieHome, 'data', SENTINEL_FILE);
}

/**
 * Resolves Auggie's actual data directory (where Auggie stores auth data)
 */
function resolveAuggieDataDir(): string {
  const augmentHome = process.env.AUGMENT_HOME
    ? expandHomeDir(process.env.AUGMENT_HOME)
    : path.join(homedir(), '.augment');
  return augmentHome;
}

async function hasAuggieCredential(): Promise<boolean> {
  // Auggie stores session in ~/.augment/session.json
  const sessionPath = path.join(resolveAuggieDataDir(), 'session.json');
  try {
    await stat(sessionPath);
    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  // Check credential file first (fast file stat)
  const hasCredential = await hasAuggieCredential();
  if (!hasCredential) {
    return false;
  }

  // Credential exists, verify CLI is installed
  return await checkCliInstalled(metadata.cliBinary);
}

export async function ensureAuth(forceLogin = false): Promise<boolean> {
  const auggieHome = resolveAuggieHome();
  const dataDir = path.join(auggieHome, 'data');

  // Check if already authenticated (skip if forceLogin is true)
  const sentinelPath = getSentinelPath(auggieHome);
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
  const cliInstalled = await checkCliInstalled(metadata.cliBinary);
  if (!cliInstalled) {
    displayCliNotInstalledError(metadata);
    throw new Error(`${metadata.name} is not installed.`);
  }

  if (process.env.CODEMACHINE_SKIP_AUTH === '1') {
    await createCredentialFile(sentinelPath, {});
    return true;
  }

  // Run interactive login via Auggie CLI
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  🔐 ${metadata.name} Authentication`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`\nOpening Auggie CLI for authentication...`);
  console.log(`Please complete the OAuth flow in your browser.`);
  console.log(`\n⚠️  Note: After successful authentication, Auggie will open`);
  console.log(`   an interactive session. You can close it by pressing Ctrl+C`);
  console.log(`   or typing 'exit' and pressing Enter.\n`);

  try {
    // Resolve auggie command to handle Windows .cmd files
    const resolvedAuggie = Bun.which('auggie') ?? 'auggie';

    const proc = Bun.spawn([resolvedAuggie, 'login'], {
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    await proc.exited;
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      console.error(`\n────────────────────────────────────────────────────────────`);
      console.error(`  ⚠️  ${metadata.name} Not Found`);
      console.error(`────────────────────────────────────────────────────────────`);
      console.error(`\n'${metadata.cliBinary} login' failed because the CLI is missing.`);
      console.error(`Please install ${metadata.name} before trying again:\n`);
      console.error(`  ${metadata.installCommand}\n`);
      console.error(`────────────────────────────────────────────────────────────\n`);
      throw new Error(`${metadata.name} is not installed.`);
    }

    throw error;
  }

  // Verify that login was successful by checking for session file
  // Give Auggie a moment to write the session file
  await new Promise(resolve => setTimeout(resolve, 500));

  const hasCredential = await hasAuggieCredential();
  if (!hasCredential) {
    console.error(`\n────────────────────────────────────────────────────────────`);
    console.error(`  ⚠️  ${metadata.name} Authentication Failed`);
    console.error(`────────────────────────────────────────────────────────────`);
    console.error(`\nAuthentication was not completed successfully.`);
    console.error(`The session file was not found at ~/.augment/session.json`);
    console.error(`\nPlease try running 'auggie login' manually and complete the OAuth flow.`);
    console.error(`Make sure to complete the authentication in your browser.\n`);
    console.error(`────────────────────────────────────────────────────────────\n`);
    throw new Error(`${metadata.name} authentication failed.`);
  }

  // Create sentinel file after successful login
  await writeFile(sentinelPath, '{}', 'utf8');

  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  ✅ ${metadata.name} Authentication Successful`);
  console.log(`────────────────────────────────────────────────────────────\n`);

  return true;
}

export async function clearAuth(): Promise<void> {
  const auggieHome = resolveAuggieHome();

  try {
    await rm(auggieHome, { recursive: true, force: true });
  } catch {
    // Ignore removal errors
  }

  console.log(`\n${metadata.name} authentication cleared.`);
  console.log(`Removed Auggie home directory at ${auggieHome} (if it existed).\n`);
}

export async function nextAuthMenuAction(): Promise<'login' | 'logout'> {
  // If CLI is missing → login
  const cli = await isAuthenticated();
  if (!cli) return 'login';

  // If sentinel is missing or credential not found → show login guidance
  const auggieHome = resolveAuggieHome();
  const sentinel = getSentinelPath(auggieHome);
  let hasSentinel = false;
  try {
    await stat(sentinel);
    hasSentinel = true;
  } catch {
    hasSentinel = false;
  }

  const hasCredential = await hasAuggieCredential();

  return hasSentinel && hasCredential ? 'logout' : 'login';
}

export { resolveAuggieHome };
