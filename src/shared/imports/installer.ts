/**
 * Shared install/update logic for CodeMachine imports.
 *
 * Used by both the CLI `import` command and the TUI import dialog,
 * as well as the auto-import system for default packages.
 */

import { existsSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { otel_debug, otel_info, otel_warn } from '../logging/logger.js';
import { LOGGER_NAMES } from '../logging/otel-logger.js';
import {
  resolveSource,
  ensureImportsDir,
  getImportInstallPath,
  isImportInstalled,
  validateImport,
  parseManifest,
  registerImport,
} from './index.js';

export interface InstallResult {
  success: boolean;
  name?: string;
  version?: string;
  location?: string;
  error?: string;
  errorDetails?: string;
}

/**
 * Clone a git repository (shallow, depth 1).
 */
function cloneRepo(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['clone', '--depth', '1', url, destPath];
    const proc = spawn('git', args, { stdio: 'pipe' });

    let stderr = '';
    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git clone failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to run git: ${err.message}`));
    });
  });
}

/**
 * Remove .git directory from a cloned repo.
 */
function removeGitDir(repoPath: string): void {
  const gitDir = join(repoPath, '.git');
  if (existsSync(gitDir)) {
    rmSync(gitDir, { recursive: true, force: true });
  }
}

/**
 * Copy a local folder to the imports directory.
 */
function copyLocalFolder(sourcePath: string, destPath: string): void {
  cpSync(sourcePath, destPath, { recursive: true });
  removeGitDir(destPath);
}

/**
 * Install a package from a source string (GitHub owner/repo, URL, or local path).
 * Handles resolution, cloning/copying, validation, and registry registration.
 */
export async function installPackage(source: string): Promise<InstallResult> {
  otel_info(LOGGER_NAMES.CLI, '[installer] Installing package from source: %s', [source]);
  try {
    const installStart = performance.now();
    const resolved = await resolveSource(source);
    const installPath = getImportInstallPath(resolved.repoName);
    otel_debug(
      LOGGER_NAMES.CLI,
      '[installer] Resolved source for %s: type=%s, url=%s, repo=%s',
      [source, resolved.type, resolved.url, resolved.repoName]
    );

    // Remove existing installation if present
    if (isImportInstalled(resolved.repoName)) {
      otel_info(LOGGER_NAMES.CLI, '[installer] Existing install found for %s, replacing in %s', [resolved.repoName, installPath]);
      rmSync(installPath, { recursive: true, force: true });
    }

    ensureImportsDir();

    if (resolved.type === 'local-path') {
      otel_info(LOGGER_NAMES.CLI, '[installer] Copying local package into %s', [installPath]);
      copyLocalFolder(resolved.url, installPath);
    } else {
      otel_info(LOGGER_NAMES.CLI, '[installer] Cloning remote package %s into %s', [resolved.url, installPath]);
      await cloneRepo(resolved.url, installPath);
      removeGitDir(installPath);
    }

    // Validate
    const validation = validateImport(installPath);
    if (!validation.valid) {
      otel_warn(
        LOGGER_NAMES.CLI,
        '[installer] Validation failed for %s: %s',
        [resolved.repoName, validation.errors.join('; ')]
      );
      rmSync(installPath, { recursive: true, force: true });

      const hasMissingManifest = validation.errors.some((e) =>
        e.includes('codemachine.json'),
      );

      if (hasMissingManifest) {
        return {
          success: false,
          error: 'Missing manifest file',
          errorDetails:
            resolved.type === 'local-path'
              ? 'The folder must contain a .codemachine.json or codemachine.json manifest file.'
              : 'The repository must contain a codemachine.json manifest file in the root directory.',
        };
      }

      return {
        success: false,
        error: 'Validation failed',
        errorDetails: validation.errors.join('\n'),
      };
    }

    // Register
    const manifest = parseManifest(installPath);
    if (!manifest) {
      otel_warn(LOGGER_NAMES.CLI, '[installer] Manifest parse failed for %s', [resolved.repoName]);
      rmSync(installPath, { recursive: true, force: true });
      return {
        success: false,
        error: 'Failed to parse manifest',
        errorDetails: 'The codemachine.json file could not be parsed.',
      };
    }

    registerImport(resolved.repoName, manifest, source);
    otel_info(
      LOGGER_NAMES.CLI,
      '[installer] Installed %s@%s in %dms',
      [manifest.name, manifest.version, Math.round(performance.now() - installStart)]
    );

    return {
      success: true,
      name: manifest.name,
      version: manifest.version,
      location: installPath,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    otel_warn(LOGGER_NAMES.CLI, '[installer] Install failed for source %s: %s', [source, msg]);

    // Network / DNS
    if (
      msg.includes('Could not resolve host') ||
      msg.includes('getaddrinfo') ||
      msg.includes('ENETUNREACH') ||
      msg.includes('Network is unreachable') ||
      msg.includes('ENOTFOUND')
    ) {
      otel_warn(LOGGER_NAMES.CLI, '[installer] Classified install failure: Network unreachable', []);
      return { success: false, error: 'Network unreachable' };
    }
    // Timeout
    if (msg.includes('timed out') || msg.includes('Timeout')) {
      otel_warn(LOGGER_NAMES.CLI, '[installer] Classified install failure: Connection timed out', []);
      return { success: false, error: 'Connection timed out' };
    }
    // Git not installed
    if (
      msg.includes('spawn git ENOENT') ||
      (msg.includes('Failed to run git') && msg.includes('ENOENT'))
    ) {
      otel_warn(LOGGER_NAMES.CLI, '[installer] Classified install failure: Git is not installed', []);
      return { success: false, error: 'Git is not installed' };
    }
    // Rate limiting / access denied
    if (msg.includes('403') && (msg.includes('rate') || msg.includes('limit'))) {
      otel_warn(LOGGER_NAMES.CLI, '[installer] Classified install failure: Access denied', []);
      return { success: false, error: 'Access denied' };
    }
    // Repository not found
    if (msg.includes('Could not find repository')) {
      otel_warn(LOGGER_NAMES.CLI, '[installer] Classified install failure: Repository not found', []);
      return { success: false, error: 'Repository not found' };
    }
    // Clone failure (generic)
    if (msg.includes('git clone failed')) {
      otel_warn(LOGGER_NAMES.CLI, '[installer] Classified install failure: Failed to clone repository', []);
      return { success: false, error: 'Failed to clone repository' };
    }
    // Local path not found
    if (msg.includes('ENOENT') || msg.includes('no such file')) {
      otel_warn(LOGGER_NAMES.CLI, '[installer] Classified install failure: Local folder not found', []);
      return { success: false, error: 'Local folder not found' };
    }
    // Permission denied
    if (msg.includes('EACCES') || msg.includes('permission denied')) {
      otel_warn(LOGGER_NAMES.CLI, '[installer] Classified install failure: Permission denied', []);
      return { success: false, error: 'Permission denied' };
    }

    otel_warn(LOGGER_NAMES.CLI, '[installer] Classified install failure: Unmapped (%s)', [msg]);
    return { success: false, error: msg };
  }
}

/**
 * Update an already-installed package by re-installing from its source.
 * Equivalent to a fresh install that overwrites the existing version.
 */
export async function updatePackage(name: string, source: string): Promise<InstallResult> {
  otel_info(LOGGER_NAMES.CLI, '[installer] Updating package %s from source: %s', [name, source]);
  return installPackage(source);
}
