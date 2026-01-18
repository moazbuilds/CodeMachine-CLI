/**
 * Import command for CodeMachine
 *
 * Usage:
 *   codemachine import <source>           Install/update an import
 *   codemachine import --list             List installed imports
 *   codemachine import --remove <name>    Remove an import
 */

import type { Command } from 'commander';
import { existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import {
  resolveSource,
  extractRepoName,
  ensureImportsDir,
  getImportInstallPath,
  isImportInstalled,
  validateImport,
  parseManifest,
  registerImport,
  unregisterImport,
  getAllInstalledImports,
  getInstalledImport,
  getRequiredSuffix,
} from '../../shared/imports/index.js';

interface ImportCommandOptions {
  list?: boolean;
  remove?: boolean;
  verbose?: boolean;
}

/**
 * Clone a git repository
 */
async function cloneRepo(
  url: string,
  destPath: string,
  verbose: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['clone', '--depth', '1', url, destPath];

    if (verbose) {
      console.log(`  Running: git ${args.join(' ')}`);
    }

    const proc = spawn('git', args, {
      stdio: verbose ? 'inherit' : 'pipe',
    });

    let stderr = '';

    if (!verbose && proc.stderr) {
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
 * Remove .git directory from cloned repo
 */
function removeGitDir(repoPath: string): void {
  const gitDir = join(repoPath, '.git');
  if (existsSync(gitDir)) {
    rmSync(gitDir, { recursive: true, force: true });
  }
}

/**
 * Install an import from a source
 */
async function installImport(source: string, verbose: boolean): Promise<void> {
  console.log(`\nResolving source: ${source}`);

  // Resolve the source to a clone URL
  const resolved = await resolveSource(source);

  if (verbose) {
    console.log(`  Type: ${resolved.type}`);
    console.log(`  URL: ${resolved.url}`);
    console.log(`  Repo: ${resolved.repoName}`);
    if (resolved.owner) {
      console.log(`  Owner: ${resolved.owner}`);
    }
  }

  const installPath = getImportInstallPath(resolved.repoName);

  // Check if already installed
  if (isImportInstalled(resolved.repoName)) {
    console.log(`\nUpdating existing import: ${resolved.repoName}`);
    // Remove existing installation
    rmSync(installPath, { recursive: true, force: true });
  } else {
    console.log(`\nInstalling: ${resolved.repoName}`);
  }

  // Ensure imports directory exists
  ensureImportsDir();

  // Clone the repository
  console.log('  Cloning repository...');
  await cloneRepo(resolved.url, installPath, verbose);

  // Remove .git directory (we don't need version control for imports)
  removeGitDir(installPath);

  // Validate the import
  console.log('  Validating...');
  const validation = validateImport(installPath);

  if (!validation.valid) {
    // Invalid import, remove it
    rmSync(installPath, { recursive: true, force: true });
    console.error('\n❌ Validation failed:');
    validation.errors.forEach((err) => console.error(`   - ${err}`));
    throw new Error('Import validation failed');
  }

  // Show warnings if any
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach((warn) => console.log(`   - ${warn}`));
  }

  // Register the import
  const manifest = parseManifest(installPath);
  if (!manifest) {
    rmSync(installPath, { recursive: true, force: true });
    throw new Error('Failed to parse manifest after validation');
  }

  registerImport(resolved.repoName, manifest, source);

  console.log(`\n✅ Successfully installed: ${manifest.name} v${manifest.version}`);
  console.log(`   Location: ${installPath}`);
}

/**
 * Remove an installed import
 */
async function removeImport(name: string): Promise<void> {
  // Try to find by package name first
  let installed = getInstalledImport(name);

  // If not found, try to find by repo name
  if (!installed) {
    const allImports = getAllInstalledImports();
    installed = allImports.find(
      (imp) => imp.path.endsWith(name) || imp.path.endsWith(`/${name}`)
    );
  }

  if (!installed) {
    console.error(`\n❌ Import not found: ${name}`);
    console.log('\nUse "codemachine import --list" to see installed imports.');
    return;
  }

  console.log(`\nRemoving: ${installed.name}`);

  // Remove from filesystem
  if (existsSync(installed.path)) {
    rmSync(installed.path, { recursive: true, force: true });
  }

  // Unregister
  unregisterImport(installed.name);

  console.log(`✅ Successfully removed: ${installed.name}`);
}

/**
 * List all installed imports
 */
function listImports(): void {
  const imports = getAllInstalledImports();

  if (imports.length === 0) {
    console.log('\nNo imports installed.');
    console.log(`\nTo install an import, use:`);
    console.log(`  codemachine import <package-name${getRequiredSuffix()}>`);
    console.log(`  codemachine import <owner>/<repo${getRequiredSuffix()}>`);
    console.log(`  codemachine import <https://github.com/...>`);
    return;
  }

  console.log('\nInstalled imports:\n');

  for (const imp of imports) {
    console.log(`  ${imp.name} v${imp.version}`);
    console.log(`    Source: ${imp.source}`);
    console.log(`    Path: ${imp.path}`);
    console.log(`    Installed: ${new Date(imp.installedAt).toLocaleDateString()}`);
    console.log('');
  }

  console.log(`Total: ${imports.length} import(s)`);
}

/**
 * Run the import command
 */
async function runImportCommand(
  source: string | undefined,
  options: ImportCommandOptions
): Promise<void> {
  try {
    // List mode
    if (options.list) {
      listImports();
      return;
    }

    // Remove mode
    if (options.remove) {
      if (!source) {
        console.error('❌ Please specify an import to remove.');
        console.log('Usage: codemachine import --remove <name>');
        return;
      }
      await removeImport(source);
      return;
    }

    // Install mode (default)
    if (!source) {
      console.error('❌ Please specify a source to import.');
      console.log('\nUsage:');
      console.log(`  codemachine import <package-name${getRequiredSuffix()}>`);
      console.log(`  codemachine import <owner>/<repo${getRequiredSuffix()}>`);
      console.log(`  codemachine import <https://github.com/...>`);
      console.log('\nOther options:');
      console.log('  codemachine import --list            List installed imports');
      console.log('  codemachine import --remove <name>   Remove an import');
      return;
    }

    await installImport(source, options.verbose ?? false);
  } catch (error) {
    console.error(
      '\n❌ Error:',
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  }
}

/**
 * Register the import command with Commander
 */
export function registerImportCommand(program: Command): void {
  program
    .command('import [source]')
    .description('Import external workflow packages')
    .option('-l, --list', 'List installed imports')
    .option('-r, --remove', 'Remove an import')
    .option('-v, --verbose', 'Verbose output')
    .action(async (source: string | undefined, options: ImportCommandOptions) => {
      await runImportCommand(source, options);
    });
}
