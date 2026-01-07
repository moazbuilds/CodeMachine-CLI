import { embeddedFiles } from 'bun';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { appDebug } from '../logging/logger.js';

const METADATA_FILE = '.embedded.json';

// Debug helper - logs to app-debug.log via the logger
function embedDebug(msg: string, ...args: unknown[]): void {
  appDebug(`[Embed] ${msg}`, ...args);
}

type EmbeddedMetadata = {
  version: string;
  generatedAt: string;
  source: 'embedded';
};

function getResourcesBaseDir(): string {
  const override = process.env.CODEMACHINE_RESOURCES_DIR;
  if (override && override.length > 0) return override;
  return join(os.homedir(), '.codemachine', 'resources');
}

function setEnvVars(targetDir: string, force = false): void {
  const pkgJsonPath = join(targetDir, 'package.json');
  if (force) {
    // For compiled binaries: force overwrite any stale env vars from dev sessions
    embedDebug('Force setting env vars to: %s', targetDir);
    process.env.CODEMACHINE_PACKAGE_ROOT = targetDir;
    process.env.CODEMACHINE_INSTALL_DIR = targetDir;
    process.env.CODEMACHINE_PACKAGE_JSON = pkgJsonPath;
  } else {
    // For dev mode: only set if not already set
    process.env.CODEMACHINE_PACKAGE_ROOT ??= targetDir;
    process.env.CODEMACHINE_INSTALL_DIR ??= targetDir;
    process.env.CODEMACHINE_PACKAGE_JSON ??= pkgJsonPath;
  }
}

/**
 * Ensures embedded resources are extracted for compiled binaries.
 *
 * - Dev mode (`bun run dev`): Returns undefined immediately (reads repo directly)
 * - Compiled binary: Extracts files to ~/.codemachine/resources/<version>/
 *
 * Returns the package root directory if resources are installed, or undefined in dev mode.
 */
export async function ensure(): Promise<string | undefined> {
  embedDebug('ensure() called');
  embedDebug('embeddedFiles.length: %s', embeddedFiles.length);
  embedDebug('process.argv[1]: %s', process.argv[1]);

  // Bun's embedded files are Blobs; cast to include name/text helpers for type safety
  const files = embeddedFiles as Array<Blob & { name: string; text: () => Promise<string> }>;

  // Log first few embedded file names for debugging
  if (files.length > 0) {
    embedDebug('First 5 embedded files: %s', files.slice(0, 5).map(f => f.name).join(', '));
  }

  // Dev mode: no embedded files, return early (reads repo directly via package root resolver)
  if (embeddedFiles.length === 0) {
    embedDebug('No embedded files detected (dev mode), returning undefined');
    return undefined;
  }

  embedDebug('Compiled binary detected (has %s embedded files)', embeddedFiles.length);

  // Log env vars for debugging
  embedDebug('CODEMACHINE_PACKAGE_ROOT: %s', process.env.CODEMACHINE_PACKAGE_ROOT ?? '(not set)');
  embedDebug('CODEMACHINE_INSTALL_DIR: %s', process.env.CODEMACHINE_INSTALL_DIR ?? '(not set)');
  embedDebug('CODEMACHINE_PACKAGE_JSON: %s', process.env.CODEMACHINE_PACKAGE_JSON ?? '(not set)');

  // Compiled binary: check for existing installation via env vars
  // IMPORTANT: For compiled binaries, we should NOT use env vars that might be left over
  // from dev mode. Only check the resources directory.
  const existingRoot =
    process.env.CODEMACHINE_PACKAGE_ROOT ??
    process.env.CODEMACHINE_INSTALL_DIR ??
    (process.env.CODEMACHINE_PACKAGE_JSON && dirname(process.env.CODEMACHINE_PACKAGE_JSON));

  embedDebug('existingRoot resolved to: %s', existingRoot ?? '(none)');

  if (existingRoot) {
    const exists = existsSync(existingRoot);
    embedDebug('existingRoot exists: %s', exists);

    // Check if this looks like a valid resources directory (has .embedded.json)
    // or if it's just a stale env var pointing to dev directory
    const metadataInExisting = join(existingRoot, METADATA_FILE);
    const hasMetadata = existsSync(metadataInExisting);
    embedDebug('existingRoot has .embedded.json: %s', hasMetadata);

    if (exists && hasMetadata) {
      embedDebug('Using existing installation at: %s', existingRoot);
      return existingRoot;
    } else if (exists && !hasMetadata) {
      embedDebug('existingRoot exists but has no .embedded.json - likely stale dev env var, continuing to extract');
    }
  }

  // Get version from embedded package.json (may have ./ prefix)
  const pkgFile = files.find((f) =>
    f.name === 'package.json' || f.name === './package.json'
  );
  embedDebug('Found embedded package.json: %s', pkgFile ? pkgFile.name : '(not found)');

  let version = process.env.CODEMACHINE_VERSION;
  embedDebug('CODEMACHINE_VERSION env var: %s', version ?? '(not set)');

  if (!version && pkgFile) {
    try {
      const pkgText = await pkgFile.text();
      const pkg = JSON.parse(pkgText);
      version = pkg.version;
      embedDebug('Version from embedded package.json: %s', version);
    } catch (err) {
      embedDebug('Failed to parse embedded package.json: %s', err);
      version = 'unknown';
    }
  }

  const baseDir = getResourcesBaseDir();
  const targetRoot = join(baseDir, version || 'unknown');
  const metadataPath = join(targetRoot, METADATA_FILE);

  embedDebug('Resources base dir: %s', baseDir);
  embedDebug('Target root: %s', targetRoot);
  embedDebug('Metadata path: %s', metadataPath);

  // Already installed?
  const metadataExists = existsSync(metadataPath);
  embedDebug('Metadata file exists: %s', metadataExists);

  if (metadataExists) {
    embedDebug('Resources already installed, setting env vars and returning');
    setEnvVars(targetRoot, true);  // force=true for compiled binary
    return targetRoot;
  }

  // First-time install: extract all resources
  embedDebug('First-time install: extracting %s files to %s', files.length, targetRoot);

  let extractedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    // Remove leading ./ if present
    const cleanName = file.name.startsWith('./') ? file.name.slice(2) : file.name;
    const destPath = join(targetRoot, cleanName);

    try {
      mkdirSync(dirname(destPath), { recursive: true });
      await Bun.write(destPath, file);
      extractedCount++;
      embedDebug('Extracted: %s', cleanName);
    } catch (err) {
      errorCount++;
      embedDebug('Failed to extract %s: %s', cleanName, err);
    }
  }

  embedDebug('Extraction complete: %s succeeded, %s failed', extractedCount, errorCount);

  // Write metadata
  const metadata: EmbeddedMetadata = {
    version: version || 'unknown',
    generatedAt: new Date().toISOString(),
    source: 'embedded',
  };

  embedDebug('Writing metadata file');
  mkdirSync(targetRoot, { recursive: true });
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  embedDebug('Metadata written successfully');

  setEnvVars(targetRoot, true);  // force=true for compiled binary
  embedDebug('Env vars set (forced), returning targetRoot: %s', targetRoot);
  return targetRoot;
}
