/**
 * Auto-import / auto-update mechanism for default packages.
 *
 * - `ensureDefaultPackagesSync()` — fast sync check (no I/O beyond registry read)
 * - `ensureDefaultPackages()`     — install any missing defaults
 * - `checkDefaultPackageUpdates()` — fetch remote manifests and re-import on version change
 */

import { metrics } from '@opentelemetry/api';
import { DEFAULT_PACKAGES } from './defaults.js';
import { getInstalledImport } from './registry.js';
import { installPackage, updatePackage } from './installer.js';
import { otel_info, otel_warn } from '../logging/logger.js';
import { LOGGER_NAMES } from '../logging/otel-logger.js';

const cliMeter = metrics.getMeter('codemachine.cli');
const defaultPackageInstallDurationMs = cliMeter.createHistogram('default_package_install_duration_ms', {
  description: 'Duration of default package install attempts in milliseconds',
  unit: 'ms',
});
const defaultPackageManifestFetchDurationMs = cliMeter.createHistogram('default_package_manifest_fetch_duration_ms', {
  description: 'Duration of default package manifest fetch requests in milliseconds',
  unit: 'ms',
});
const defaultPackageUpdateDurationMs = cliMeter.createHistogram('default_package_update_duration_ms', {
  description: 'Duration of default package update attempts in milliseconds',
  unit: 'ms',
});

/**
 * Fast synchronous check — are all *required* default packages present in the registry?
 * Returns `true` if every required package is already registered.
 */
export function ensureDefaultPackagesSync(): boolean {
  for (const pkg of DEFAULT_PACKAGES) {
    if (!pkg.required) continue;
    if (!getInstalledImport(pkg.name)) {
      otel_info(LOGGER_NAMES.CLI, '[AutoImport] Required default package missing: %s', [pkg.name]);
      return false;
    }
  }
  return true;
}

/**
 * Install any missing default packages.
 * Each package is independent — one failure does not block others.
 */
export async function ensureDefaultPackages(onInstalling?: (name: string) => void): Promise<void> {
  for (const pkg of DEFAULT_PACKAGES) {
    const existing = getInstalledImport(pkg.name);
    if (existing) {
      otel_info(LOGGER_NAMES.CLI, '[AutoImport] Default package already installed: %s@%s', [pkg.name, existing.version]);
      continue;
    }

    otel_info(LOGGER_NAMES.CLI, '[AutoImport] Installing missing default package: %s from %s', [pkg.name, pkg.source]);
    onInstalling?.(pkg.name);
    try {
      const installStart = performance.now();
      const result = await installPackage(pkg.source);
      defaultPackageInstallDurationMs.record(Math.round(performance.now() - installStart), {
        'package.name': pkg.name,
        'operation.success': result.success,
      });
      if (result.success) {
        otel_info(LOGGER_NAMES.CLI, '[AutoImport] Installed default package %s@%s', [result.name, result.version]);
      } else {
        const message = result.error || 'unknown error';
        if (pkg.required) {
          otel_warn(LOGGER_NAMES.CLI, '[AutoImport] WARN: Failed to install required package %s: %s', [pkg.name, message]);
          console.warn(`Warning: "${pkg.name}" package could not be installed.`);
        } else {
          otel_info(LOGGER_NAMES.CLI, '[AutoImport] Skipped optional package %s: %s', [pkg.name, message]);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (pkg.required) {
        otel_warn(LOGGER_NAMES.CLI, '[AutoImport] WARN: Exception installing required package %s: %s', [pkg.name, message]);
        console.warn(`Warning: "${pkg.name}" package could not be installed.`);
      } else {
        otel_info(LOGGER_NAMES.CLI, '[AutoImport] Skipped optional package %s (exception): %s', [pkg.name, message]);
      }
    }
  }
}

/**
 * Check all installed default packages for version changes.
 * Fetches the remote manifest for each and re-imports if the version differs.
 */
export async function checkDefaultPackageUpdates(): Promise<void> {
  let checked = 0;
  let updated = 0;
  let failed = 0;

  for (const pkg of DEFAULT_PACKAGES) {
    const installed = getInstalledImport(pkg.name);
    if (!installed) continue; // Not installed yet — ensureDefaultPackages handles that
    checked += 1;

    try {
      const fetchStart = performance.now();
      const response = await fetch(pkg.manifestUrl, {
        signal: AbortSignal.timeout(10000),
      });
      defaultPackageManifestFetchDurationMs.record(Math.round(performance.now() - fetchStart), {
        'package.name': pkg.name,
        'http.status_code': response.status,
      });
      if (!response.ok) {
        otel_warn(LOGGER_NAMES.CLI, '[AutoImport] Failed to fetch manifest for %s: HTTP %s', [pkg.name, response.status]);
        failed += 1;
        continue;
      }

      let remoteManifest: { version?: string };
      try {
        remoteManifest = (await response.json()) as { version?: string };
      } catch {
        otel_warn(LOGGER_NAMES.CLI, '[AutoImport] Invalid JSON in manifest for %s', [pkg.name]);
        failed += 1;
        continue;
      }
      const remoteVersion = remoteManifest?.version;

      if (!remoteVersion) {
        otel_warn(LOGGER_NAMES.CLI, '[AutoImport] Remote manifest for %s has no version field', [pkg.name]);
        failed += 1;
        continue;
      }

      if (remoteVersion === installed.version) {
        otel_info(LOGGER_NAMES.CLI, '[AutoImport] %s is up to date (%s)', [pkg.name, remoteVersion]);
        continue;
      }

      otel_info(LOGGER_NAMES.CLI, '[AutoImport] Updating %s: %s -> %s', [pkg.name, installed.version, remoteVersion]);
      const updateStart = performance.now();
      const result = await updatePackage(pkg.name, pkg.source);
      defaultPackageUpdateDurationMs.record(Math.round(performance.now() - updateStart), {
        'package.name': pkg.name,
        'operation.success': result.success,
      });
      if (result.success) {
        updated += 1;
        otel_info(LOGGER_NAMES.CLI, '[AutoImport] Updated %s to %s', [pkg.name, result.version]);
      } else {
        failed += 1;
        otel_warn(LOGGER_NAMES.CLI, '[AutoImport] Failed to update %s: %s', [pkg.name, result.error]);
      }
    } catch (err) {
      failed += 1;
      otel_warn(
        LOGGER_NAMES.CLI,
        '[AutoImport] Error checking updates for %s: %s',
        [pkg.name, err instanceof Error ? err.message : String(err)]
      );
    }
  }

  otel_info(LOGGER_NAMES.CLI, '[AutoImport] Update scan summary: checked=%d updated=%d failed=%d', [
    checked,
    updated,
    failed,
  ]);
}
