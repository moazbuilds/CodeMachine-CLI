import { embeddedFiles } from 'bun';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';

const METADATA_FILE = '.embedded.json';

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

function setEnvVars(targetDir: string): void {
  const pkgJsonPath = join(targetDir, 'package.json');
  process.env.CODEMACHINE_PACKAGE_ROOT ??= targetDir;
  process.env.CODEMACHINE_INSTALL_DIR ??= targetDir;
  process.env.CODEMACHINE_PACKAGE_JSON ??= pkgJsonPath;
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
  if (process.env.DEBUG_EMBED) {
    console.error('[DEBUG] embeddedFiles.length:', embeddedFiles.length);
  }

  // Bun's embedded files are Blobs; cast to include name/text helpers for type safety
  const files = embeddedFiles as Array<Blob & { name: string; text: () => Promise<string> }>;

  // Dev mode: no embedded files, return early (reads repo directly via package root resolver)
  if (embeddedFiles.length === 0) {
    return undefined;
  }

  // Compiled binary: check for existing installation via env vars
  const existingRoot =
    process.env.CODEMACHINE_PACKAGE_ROOT ??
    process.env.CODEMACHINE_INSTALL_DIR ??
    (process.env.CODEMACHINE_PACKAGE_JSON && dirname(process.env.CODEMACHINE_PACKAGE_JSON));

  if (existingRoot && existsSync(existingRoot)) {
    return existingRoot;
  }

  // Get version from embedded package.json (may have ./ prefix)
  const pkgFile = files.find((f) =>
    f.name === 'package.json' || f.name === './package.json'
  );
  let version = process.env.CODEMACHINE_VERSION;

  if (!version && pkgFile) {
    try {
      const pkgText = await pkgFile.text();
      const pkg = JSON.parse(pkgText);
      version = pkg.version;
    } catch {
      version = 'unknown';
    }
  }

  const baseDir = getResourcesBaseDir();
  const targetRoot = join(baseDir, version || 'unknown');
  const metadataPath = join(targetRoot, METADATA_FILE);

  // Already installed?
  if (existsSync(metadataPath)) {
    setEnvVars(targetRoot);
    return targetRoot;
  }

  // First-time install: extract all resources
  for (const file of files) {
    // Remove leading ./ if present
    const cleanName = file.name.startsWith('./') ? file.name.slice(2) : file.name;
    const destPath = join(targetRoot, cleanName);

    if (process.env.DEBUG_EMBED) {
      console.error(`[DEBUG] Extracting ${cleanName}`);
    }

    mkdirSync(dirname(destPath), { recursive: true });
    await Bun.write(destPath, file);
  }

  // Write metadata
  const metadata: EmbeddedMetadata = {
    version: version || 'unknown',
    generatedAt: new Date().toISOString(),
    source: 'embedded',
  };

  mkdirSync(targetRoot, { recursive: true });
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  setEnvVars(targetRoot);
  return targetRoot;
}
