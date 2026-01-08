/**
 * GitHub Copilot Authentication via Device Code Flow
 *
 * This implements the same authentication mechanism used by VS Code and IntelliJ Copilot plugins.
 * The flow is:
 * 1. Request a device code from GitHub
 * 2. User enters code at github.com/login/device
 * 3. Poll GitHub for OAuth token (gho_xxx)
 * 4. Exchange OAuth token for Copilot token (ghu_xxx)
 * 5. Use Copilot token for API calls
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

import {
  COPILOT_CLIENT_ID,
  GITHUB_DEVICE_CODE_URL,
  GITHUB_OAUTH_TOKEN_URL,
  COPILOT_TOKEN_URL,
  OAUTH_SCOPE,
  ENV,
} from './config.js';
import { metadata } from './metadata.js';

/** Directory for storing Copilot credentials */
const CONFIG_DIR = join(homedir(), '.codemachine', 'copilot');
const TOKEN_PATH = join(CONFIG_DIR, 'token.json');

/** Response from GitHub's device code endpoint */
interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/** Response from GitHub's OAuth token endpoint */
interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** Response from Copilot's token exchange endpoint */
interface CopilotTokenResponse {
  token: string;
  expires_at: number;
}

/** Stored token data */
interface StoredTokens {
  github_token: string;
  copilot_token: string;
  expires_at: number;
}

/**
 * Request a device code from GitHub
 * User will need to enter this code at the verification URL
 */
async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: COPILOT_CLIENT_ID,
      scope: OAUTH_SCOPE,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get device code: ${error}`);
  }

  return response.json();
}

/**
 * Poll GitHub for OAuth token after user authorizes
 * Returns the OAuth token (gho_xxx) when user completes authorization
 */
async function pollForOAuthToken(deviceCode: string, interval: number): Promise<string> {
  let pollInterval = interval;

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));

    const response = await fetch(GITHUB_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: COPILOT_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data: OAuthTokenResponse = await response.json();

    if (data.error === 'authorization_pending') {
      // User hasn't authorized yet, keep polling
      continue;
    }

    if (data.error === 'slow_down') {
      // Rate limited, increase interval
      pollInterval += 5;
      continue;
    }

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    if (data.access_token) {
      return data.access_token;
    }

    throw new Error('Unexpected response from GitHub OAuth');
  }
}

/**
 * Exchange GitHub OAuth token for Copilot API token
 * The Copilot token (ghu_xxx) is what's used for actual API calls
 */
async function exchangeForCopilotToken(githubToken: string): Promise<CopilotTokenResponse> {
  const response = await fetch(COPILOT_TOKEN_URL, {
    method: 'GET',
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Copilot token: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Read stored tokens from disk
 */
function readStoredTokens(): StoredTokens | null {
  if (!existsSync(TOKEN_PATH)) {
    return null;
  }

  try {
    const data = readFileSync(TOKEN_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save tokens to disk
 */
function saveTokens(tokens: StoredTokens): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

/**
 * Check if stored Copilot token is expired
 * Includes 5 minute buffer for safety
 */
function isTokenExpired(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const buffer = 5 * 60; // 5 minutes
  return now > expiresAt - buffer;
}

/**
 * Refresh the Copilot token using stored GitHub OAuth token
 */
async function refreshCopilotToken(githubToken: string): Promise<CopilotTokenResponse> {
  return exchangeForCopilotToken(githubToken);
}

/**
 * Get valid Copilot token, refreshing if needed
 */
export function getToken(): string | undefined {
  // Check environment variable first
  if (process.env[ENV.COPILOT_TOKEN]) {
    return process.env[ENV.COPILOT_TOKEN];
  }

  const stored = readStoredTokens();
  if (!stored) {
    return undefined;
  }

  return stored.copilot_token;
}

/**
 * Check if user is authenticated with Copilot
 */
export async function isAuthenticated(): Promise<boolean> {
  const stored = readStoredTokens();
  if (!stored) {
    return false;
  }

  // Check if token is expired
  if (isTokenExpired(stored.expires_at)) {
    // Try to refresh
    try {
      const newToken = await refreshCopilotToken(stored.github_token);
      saveTokens({
        ...stored,
        copilot_token: newToken.token,
        expires_at: newToken.expires_at,
      });
      return true;
    } catch {
      // Refresh failed, need to re-authenticate
      return false;
    }
  }

  return true;
}

/**
 * Open URL in default browser (cross-platform)
 */
async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      Bun.spawn(['open', url], { stdio: ['ignore', 'ignore', 'ignore'] });
    } else if (platform === 'win32') {
      Bun.spawn(['cmd', '/c', 'start', '', url], { stdio: ['ignore', 'ignore', 'ignore'] });
    } else {
      // Linux and others
      Bun.spawn(['xdg-open', url], { stdio: ['ignore', 'ignore', 'ignore'] });
    }
  } catch {
    // Silently fail - user can manually open the URL
  }
}

/**
 * Write directly to stdout for better terminal compatibility
 * After TUI destruction, console.log may not be visible due to terminal state
 */
function write(text: string): void {
  process.stdout.write(text);
}

/**
 * Run the device code flow authentication
 * Shows the user a code to enter at GitHub's website
 */
export async function authenticate(): Promise<string> {
  // Use direct stdout writes for better terminal compatibility after TUI destruction
  write('\n');
  write('============================================================\n');
  write('  GitHub Copilot Authentication\n');
  write('============================================================\n\n');

  // Request device code
  const deviceCodeResponse = await requestDeviceCode();

  // Try to open browser automatically
  await openBrowser(deviceCodeResponse.verification_uri);

  // Display instructions with prominent device code box
  write('  A browser window should open automatically.\n');
  write('  If not, please open this URL:\n\n');
  write(`    ${deviceCodeResponse.verification_uri}\n\n`);
  write('  +---------------------------------------+\n');
  write(`  |  Enter code:  ${deviceCodeResponse.user_code.padEnd(22)}|\n`);
  write('  +---------------------------------------+\n\n');
  write('  Waiting for authorization...\n\n');

  // Poll for OAuth token
  const githubToken = await pollForOAuthToken(
    deviceCodeResponse.device_code,
    deviceCodeResponse.interval
  );

  write('  Authorization received! Getting Copilot access...\n\n');

  // Exchange for Copilot token
  const copilotToken = await exchangeForCopilotToken(githubToken);

  // Save tokens
  saveTokens({
    github_token: githubToken,
    copilot_token: copilotToken.token,
    expires_at: copilotToken.expires_at,
  });

  write('  Authentication successful!\n');
  write('============================================================\n\n');

  return copilotToken.token;
}

/**
 * Ensure user is authenticated.
 *
 * When called with forceLogin=true (from TUI auth menu), it will run the
 * device code flow. Otherwise, it just checks authentication status.
 *
 * This separation is important because the TUI must destroy its renderer
 * before console.log output becomes visible to the user.
 */
export async function ensureAuth(forceLogin = false): Promise<boolean> {
  if (await isAuthenticated()) {
    return true;
  }

  // Only attempt interactive login if explicitly requested (from TUI auth menu)
  if (forceLogin) {
    try {
      await authenticate();
      return true;
    } catch (error) {
      process.stderr.write(`\n  Authentication failed: ${error instanceof Error ? error.message : error}\n`);
      return false;
    }
  }

  // Not authenticated and not forcing login - caller should handle this
  return false;
}

/**
 * Clear stored authentication credentials
 */
export async function clearAuth(): Promise<void> {
  try {
    if (existsSync(TOKEN_PATH)) {
      unlinkSync(TOKEN_PATH);
    }
    process.stdout.write(`\n${metadata.name} authentication cleared.\n`);
  } catch (error) {
    process.stderr.write(`Failed to clear auth: ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Get next auth menu action based on current state
 */
export async function nextAuthMenuAction(): Promise<'login' | 'logout'> {
  return (await isAuthenticated()) ? 'logout' : 'login';
}
