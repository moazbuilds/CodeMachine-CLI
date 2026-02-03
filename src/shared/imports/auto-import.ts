/**
 * Auto-import / auto-update mechanism for default packages.
 *
 * - `ensureDefaultPackagesSync()` — fast sync check (no I/O beyond registry read)
 * - `ensureDefaultPackages()`     — install any missing defaults
 * - `checkDefaultPackageUpdates()` — fetch remote manifests and re-import on version change
 */

import { DEFAULT_PACKAGES } from './defaults.js';
import { getInstalledImport } from './registry.js';
import { installPackage, updatePackage } from './installer.js';
import { appDebug } from '../logging/logger.js';

/**
 * Fast synchronous check — are all *required* default packages present in the registry?
 * Returns `true` if every required package is already registered.
 */
export function ensureDefaultPackagesSync(): boolean {
  for (const pkg of DEFAULT_PACKAGES) {
    if (!pkg.required) continue;
    if (!getInstalledImport(pkg.name)) {
      appDebug('[AutoImport] Required default package missing: %s', pkg.name);
      return false;
    }
  }
  return true;
}

/**
 * Install any missing default packages.
 * Each package is independent — one failure does not block others.
 */
export async function ensureDefaultPackages(): Promise<void> {
  for (const pkg of DEFAULT_PACKAGES) {
    const existing = getInstalledImport(pkg.name);
    if (existing) {
      appDebug('[AutoImport] Default package already installed: %s@%s', pkg.name, existing.version);
      continue;
    }

    appDebug('[AutoImport] Installing missing default package: %s from %s', pkg.name, pkg.source);
    try {
      const result = await installPackage(pkg.source);
      if (result.success) {
        appDebug('[AutoImport] Installed %s@%s', result.name, result.version);
      } else {
        const message = result.errorDetails || result.error || 'unknown error';
        if (pkg.required) {
          appDebug('[AutoImport] WARN: Failed to install required package %s: %s', pkg.name, message);
          console.warn(`[CodeMachine] Could not install required package "${pkg.name}": ${message}`);
        } else {
          appDebug('[AutoImport] Skipped optional package %s: %s', pkg.name, message);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (pkg.required) {
        appDebug('[AutoImport] WARN: Exception installing required package %s: %s', pkg.name, message);
        console.warn(`[CodeMachine] Could not install required package "${pkg.name}": ${message}`);
      } else {
        appDebug('[AutoImport] Skipped optional package %s (exception): %s', pkg.name, message);
      }
    }
  }
}

/**
 * Check all installed default packages for version changes.
 * Fetches the remote manifest for each and re-imports if the version differs.
 */
export async function checkDefaultPackageUpdates(): Promise<void> {
  for (const pkg of DEFAULT_PACKAGES) {
    const installed = getInstalledImport(pkg.name);
    if (!installed) continue; // Not installed yet — ensureDefaultPackages handles that

    try {
      const response = await fetch(pkg.manifestUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        appDebug('[AutoImport] Failed to fetch manifest for %s: HTTP %s', pkg.name, response.status);
        continue;
      }

      const remoteManifest = (await response.json()) as { version?: string };
      const remoteVersion = remoteManifest?.version;

      if (!remoteVersion) {
        appDebug('[AutoImport] Remote manifest for %s has no version field', pkg.name);
        continue;
      }

      if (remoteVersion === installed.version) {
        appDebug('[AutoImport] %s is up to date (%s)', pkg.name, remoteVersion);
        continue;
      }

      appDebug('[AutoImport] Updating %s: %s -> %s', pkg.name, installed.version, remoteVersion);
      const result = await updatePackage(pkg.name, pkg.source);
      if (result.success) {
        appDebug('[AutoImport] Updated %s to %s', pkg.name, result.version);
      } else {
        appDebug('[AutoImport] Failed to update %s: %s', pkg.name, result.error);
      }
    } catch (err) {
      appDebug('[AutoImport] Error checking updates for %s: %s', pkg.name, err instanceof Error ? err.message : String(err));
    }
  }
}
