#!/usr/bin/env bun
import '../src/shared/runtime/suppress-baseline-warning.js';
import { mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, arch } from 'node:os';
import { $ } from 'bun';

// Simple ANSI colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

// Host platform (used for defaults and for installing a local binary)
const hostPlatform = platform();
const hostArch = arch();

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// Force temp/cache into repo-local .tmp to avoid permission issues on shared runners
const localTmp = join(repoRoot, '.tmp', 'tmp');
const localCache = join(repoRoot, '.tmp', 'cache');
const bunInstallCache = join(repoRoot, '.tmp', 'bun-install-cache');
const bunInstallRoot = join(repoRoot, '.tmp', 'bun');
mkdirSync(localTmp, { recursive: true });
mkdirSync(localCache, { recursive: true });
mkdirSync(bunInstallCache, { recursive: true });
mkdirSync(bunInstallRoot, { recursive: true });
process.env.TMPDIR = process.env.TMPDIR || localTmp;
process.env.XDG_CACHE_HOME = process.env.XDG_CACHE_HOME || localCache;
process.env.BUN_TMPDIR = process.env.BUN_TMPDIR || localTmp;
process.env.BUN_INSTALL_CACHE_DIR = process.env.BUN_INSTALL_CACHE_DIR || bunInstallCache;
process.env.BUN_INSTALL_CACHE = process.env.BUN_INSTALL_CACHE || bunInstallCache;
process.env.BUN_INSTALL = process.env.BUN_INSTALL || bunInstallRoot;
const packageJsonPath = join(repoRoot, 'package.json');
const mainPackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const mainVersion = mainPackage.version;

console.log(`\n${bold}${cyan}╭────────────────────────────────────────╮${reset}`);
console.log(`${bold}${cyan}│${reset}  Building ${bold}CodeMachine${reset} v${mainVersion}  ${bold}${cyan}│${reset}`);
console.log(`${bold}${cyan}╰────────────────────────────────────────╯${reset}\n`);

// Collect resource files for embedding and generate a manifest that imports them.
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  const stack: string[] = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const absPath = join(repoRoot, current);
    const entries = readdirSync(absPath, { withFileTypes: true });

    for (const entry of entries) {
      const relPath = join(current, entry.name);
      const absEntry = join(repoRoot, relPath);

      if (entry.isDirectory()) {
        stack.push(relPath);
      } else if (entry.isFile()) {
        results.push(absEntry);
      }
    }
  }

  return results;
}

const resourceFiles = [
  ...collectFiles('config'),
  ...collectFiles('prompts'),
  ...collectFiles('templates'),
  join(repoRoot, 'package.json'),
];

// Generate simple imports file (no exports/mapping needed with --asset-naming)
const manifestDir = join(repoRoot, 'src', 'shared', 'runtime');
const imports = resourceFiles.map((abs) => {
  // Use path.relative for cross-platform compatibility, then normalize to forward slashes
  const rel = relative(manifestDir, abs).replace(/\\/g, '/');
  return `import "${rel}" with { type: "file" };`;
});

const manifestContent = `// Auto-generated: tells Bun which files to embed\n${imports.join('\n')}\n`;
const manifestPath = join(repoRoot, 'src', 'shared', 'runtime', 'resource-manifest.ts');
writeFileSync(manifestPath, manifestContent);

console.log(`${green}✓${reset} ${dim}Collected ${resourceFiles.length} resource files for embedding${reset}`);

// Auto-sync platform package versions before building
if (mainPackage.optionalDependencies) {
  let needsSync = false;
  const outdated = [];

  for (const [pkgName, version] of Object.entries(mainPackage.optionalDependencies)) {
    if (version !== mainVersion) {
      needsSync = true;
      outdated.push(`${pkgName}: ${version} → ${mainVersion}`);
    }
  }

  if (needsSync) {
    console.log(`${yellow}⟳${reset} Syncing platform package versions...`);
    for (const update of outdated) {
      console.log(`  ${dim}${update}${reset}`);
    }

    for (const pkgName of Object.keys(mainPackage.optionalDependencies)) {
      mainPackage.optionalDependencies[pkgName] = mainVersion;
    }

    writeFileSync(packageJsonPath, JSON.stringify(mainPackage, null, 2) + '\n');
    console.log(`${green}✓${reset} ${dim}Version sync complete${reset}\n`);
  } else {
    console.log(`${green}✓${reset} ${dim}Platform package versions synced${reset}`);
  }
}

// Load OpenTUI solid plugin for JSX transformation
const solidPluginPath = resolve(repoRoot, 'node_modules/@opentui/solid/scripts/solid-plugin.ts');
const solidPlugin = (await import(solidPluginPath)).default;

// Ensure platform-specific deps are installed for all targets (mirrors opencode flow)
const coreVersion = mainPackage.dependencies?.['@opentui/core'];
if (coreVersion) {
  console.log(`${cyan}→${reset} Installing cross-platform @opentui/core (${coreVersion})`);
  await $`bun install --os="*" --cpu="*" --ignore-scripts --silent @opentui/core@${coreVersion}`;
}
const watcherVersion = mainPackage.dependencies?.['@parcel/watcher'];
if (watcherVersion) {
  console.log(`${cyan}→${reset} Installing cross-platform @parcel/watcher (${watcherVersion})`);
  await $`bun install --os="*" --cpu="*" --ignore-scripts --silent @parcel/watcher@${watcherVersion}`;
}

// Map platform/arch to target names
const platformMap = {
  'linux-x64': { target: 'bun-linux-x64', pkgOs: 'linux', npmOs: 'linux', arch: 'x64', ext: '' },
  'linux-arm64': { target: 'bun-linux-arm64', pkgOs: 'linux', npmOs: 'linux', arch: 'arm64', ext: '' },
  'darwin-arm64': { target: 'bun-darwin-arm64', pkgOs: 'darwin', npmOs: 'darwin', arch: 'arm64', ext: '' },
  'darwin-x64': { target: 'bun-darwin-x64', pkgOs: 'darwin', npmOs: 'darwin', arch: 'x64', ext: '' },
  // NOTE: npm expects `win32` in the package.json `os` field; using `windows` causes the
  // optional dependency to be skipped entirely on Windows. Keep the package name as
  // `codemachine-windows-x64`, but set the npm metadata to `win32` so it installs.
  'win32-x64': {
    target: 'bun-windows-x64',
    pkgOs: 'windows',
    npmOs: 'win32',
    arch: 'x64',
    ext: '.exe',
  },
};

// Determine which targets to build
const args = process.argv.slice(2);
const argTargetIndex = args.findIndex((arg) => arg === '--target' || arg === '-t');
const flagAll = args.includes('--all') || process.env.TARGETS === 'all';
const requestedTargets =
  argTargetIndex !== -1 && args[argTargetIndex + 1]
    ? args[argTargetIndex + 1].split(',').map((t) => t.trim()).filter(Boolean)
    : process.env.TARGETS && process.env.TARGETS !== 'all'
      ? process.env.TARGETS.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

const defaultTarget = `${hostPlatform}-${hostArch}`;
const targetKeys = flagAll
  ? Object.keys(platformMap)
  : requestedTargets.length
    ? requestedTargets
    : [defaultTarget];

type PlatformKey = keyof typeof platformMap;

const targets = targetKeys.map((key) => {
  const cfg = platformMap[key as PlatformKey];
  if (!cfg) {
    console.error(`${red}✗${reset} Unsupported target: ${bold}${key}${reset}`);
    console.error(`${dim}Supported:${reset} ${Object.keys(platformMap).join(', ')}`);
    process.exit(1);
  }
  return { key, ...cfg };
});

console.log(`\n${dim}Targets:${reset} ${bold}${targets.map((t) => t.key).join(', ')}${reset}\n`);

const outputRoot = process.env.OUTPUT_DIR || process.env.OUTPUT_ROOT || './binaries';

try {
  for (const targetConfig of targets) {
    const {
      target,
      pkgOs,
      npmOs,
      arch: archName,
      ext,
      key,
    } = targetConfig;
    const outdir = join(outputRoot, `codemachine-${pkgOs}-${archName}`);

    console.log(`${cyan}→${reset} Building ${dim}${target}${reset}...`);
    mkdirSync(outdir, { recursive: true });

    const binaryPath = join(outdir, `codemachine${ext}`);

    const result = await Bun.build({
      conditions: ['browser'],
      tsconfig: './tsconfig.json',
      plugins: [solidPlugin], // SolidJS transform for TUI
      minify: true,
      define: {
        __CODEMACHINE_VERSION__: JSON.stringify(mainVersion),
      },
      naming: {
        asset: '[dir]/[name].[ext]', // Preserve original filenames (no hashing)
      },
      compile: {
        target: target as 'bun-linux-x64' | 'bun-linux-arm64' | 'bun-darwin-arm64' | 'bun-darwin-x64' | 'bun-windows-x64',
        outfile: binaryPath,
      },
      entrypoints: ['./src/runtime/index.ts', manifestPath],
    });

    if (!result.success) {
      console.error(`${red}✗${reset} Build failed for ${target}:`);
      for (const log of result.logs) {
        console.error(`  ${dim}${log}${reset}`);
      }
      if (result.logs.length === 0) {
        console.error(`  ${dim}No build logs available. Result:${reset}`, result);
      }
      process.exit(1);
    }

    // Create package.json for the platform-specific package
    const pkgName = `codemachine-${pkgOs}-${archName}`;

    const pkg = {
      name: pkgName,
      version: mainVersion,
      description: `${mainPackage.description} (prebuilt ${pkgOs}-${archName} binary)`,
      os: [npmOs],
      cpu: [archName],
      files: [`codemachine${ext}`],
      bin: {
        codemachine: `codemachine${ext}`,
        cm: `codemachine${ext}`,
      },
    };

    await Bun.write(join(outdir, 'package.json'), JSON.stringify(pkg, null, 2));

    // Only install the host platform binary locally for development ergonomics
    if (key === `${hostPlatform}-${hostArch}`) {
      const localPkgDir = join(repoRoot, 'node_modules', pkgName);
      rmSync(localPkgDir, { recursive: true, force: true });
      mkdirSync(join(repoRoot, 'node_modules'), { recursive: true });
      cpSync(outdir, localPkgDir, { recursive: true });
      console.log(`${dim}  • Installed host binary to${reset} ${localPkgDir}`);
    }

    console.log(`${green}✓${reset} ${bold}Built ${pkgName}${reset}`);
    console.log(`${dim}  • ${outdir}/codemachine${ext}${reset}\n`);
  }

  console.log(`\n${green}✓${reset} ${bold}Build complete for ${targets.length} target(s)${reset}\n`);
} catch (err) {
  const error = err as Error;
  console.error(`\n${red}✗${reset} ${bold}Build failed${reset}`);
  console.error(`${dim}Error type: ${error?.constructor?.name}${reset}`);
  console.error(`${dim}Error message: ${error?.message || 'No message'}${reset}`);
  console.error(`${dim}Full error:${reset}`, error);
  if (error.stack) {
    console.error(`\n${dim}Stack:${reset}`);
    console.error(`${dim}${error.stack}${reset}`);
  }
  process.exit(1);
}
