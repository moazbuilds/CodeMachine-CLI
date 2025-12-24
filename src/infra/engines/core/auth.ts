/**
 * Shared authentication helpers for engine providers
 * Eliminates code duplication across engine auth.ts files
 */

import { stat, rm, writeFile, mkdir } from 'node:fs/promises';
import type { EngineMetadata } from './base.js';

/**
 * Check if a CLI is installed using hybrid approach:
 * 1. Quick Bun.which() check (instant)
 * 2. Verify CLI runs with configurable timeout (10s default)
 */
export async function checkCliInstalled(
  command: string,
  options?: { versionFlag?: string; timeout?: number }
): Promise<boolean> {
  const { versionFlag = '--version', timeout = 10000 } = options ?? {};

  try {
    // Step 1: Quick PATH check (instant)
    const resolvedCommand = Bun.which(command);
    if (!resolvedCommand) {
      return false;
    }

    // Step 2: Verify CLI actually runs
    const proc = Bun.spawn([resolvedCommand, versionFlag], {
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const exitCode = await Promise.race([proc.exited, timeoutPromise]);
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const out = `${stdout}\n${stderr}`;

    if (typeof exitCode === 'number' && exitCode === 0) return true;
    if (/not recognized as an internal or external command/i.test(out)) return false;
    if (/command not found/i.test(out)) return false;
    if (/No such file or directory/i.test(out)) return false;
    return false;
  } catch {
    return false;
  }
}

/**
 * Display standardized "CLI not installed" error message
 */
export function displayCliNotInstalledError(metadata: EngineMetadata): void {
  console.error(`\n────────────────────────────────────────────────────────────`);
  console.error(`  ⚠️  ${metadata.name} CLI Not Installed`);
  console.error(`────────────────────────────────────────────────────────────`);
  console.error(`\nThe '${metadata.cliBinary}' command is not available.`);
  console.error(`Please install ${metadata.name} CLI first:\n`);
  console.error(`  ${metadata.installCommand}\n`);
  console.error(`────────────────────────────────────────────────────────────\n`);
}

/**
 * Check if an error is a "command not found" error
 */
export function isCommandNotFoundError(error: unknown): boolean {
  const err = error as { code?: string; stderr?: string; message?: string };
  const stderr = err?.stderr ?? '';
  const message = err?.message ?? '';
  return (
    err?.code === 'ENOENT' ||
    /not recognized as an internal or external command/i.test(stderr || message) ||
    /command not found/i.test(stderr || message) ||
    /No such file or directory/i.test(stderr || message)
  );
}

/**
 * Ensure auth directory exists
 */
export async function ensureAuthDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Check if credential file exists
 */
export async function checkCredentialExists(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Create credential/placeholder file
 */
export async function createCredentialFile(
  filePath: string,
  content: string | object
): Promise<void> {
  const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  await writeFile(filePath, data, { encoding: 'utf8' });
}

/**
 * Clean up auth files
 */
export async function cleanupAuthFiles(filePaths: string[]): Promise<void> {
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await rm(filePath, { force: true, recursive: true });
      } catch {
        /* ignore */
      }
    })
  );
}

/**
 * Get next auth menu action based on authentication state
 */
export function getNextAuthAction(isAuthed: boolean): 'login' | 'logout' {
  return isAuthed ? 'logout' : 'login';
}
