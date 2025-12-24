#!/usr/bin/env node

/**
 * Shell wrapper for CodeMachine CLI
 *
 * This wrapper detects the user's platform and spawns the correct
 * platform-specific binary from the appropriate optional dependency.
 *
 * The actual binaries are distributed as separate packages:
 * - codemachine-linux-x64
 * - codemachine-darwin-arm64
 * - codemachine-darwin-x64
 * - codemachine-windows-x64
 */

import { spawn } from 'node:child_process';
import { join, dirname, isAbsolute, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { platform, arch } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_FALLBACK = join(__dirname, '..');

function findPackageRoot(startDir) {
  let current = startDir;
  const maxDepth = 10;
  let depth = 0;

  while (current && depth < maxDepth) {
    const candidate = join(current, 'package.json');
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8'));
        if (pkg?.name === 'codemachine') {
          return current;
        }
      } catch {
        // ignore malformed package.json
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
    depth++;
  }
  return undefined;
}

const DEFAULT_PACKAGE_ROOT = findPackageRoot(ROOT_FALLBACK) ?? ROOT_FALLBACK;

function runBinary(binaryPath, packageRoot) {
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
    windowsHide: false,
    env: {
      ...process.env,
      CODEMACHINE_PACKAGE_ROOT: packageRoot,
      CODEMACHINE_PACKAGE_JSON: join(packageRoot, 'package.json'),
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });

  child.on('error', (error) => {
    console.error('Error spawning binary:', error.message);
    process.exit(1);
  });
}

// Map Node.js platform/arch to our package names
const platformMap = {
  'linux-x64': { pkg: 'codemachine-linux-x64', bin: 'codemachine' },
  'linux-arm64': { pkg: 'codemachine-linux-arm64', bin: 'codemachine' },
  'darwin-arm64': { pkg: 'codemachine-darwin-arm64', bin: 'codemachine' },
  'darwin-x64': { pkg: 'codemachine-darwin-x64', bin: 'codemachine' },
  'win32-x64': { pkg: 'codemachine-windows-x64', bin: 'codemachine.exe' },
};

const envBinary = process.env.CODEMACHINE_BIN_PATH;
if (envBinary) {
  const resolvedEnvBinary = isAbsolute(envBinary) ? envBinary : resolve(process.cwd(), envBinary);
  if (!existsSync(resolvedEnvBinary)) {
    console.error(`Error: CODEMACHINE_BIN_PATH target not found (${resolvedEnvBinary})`);
    process.exit(1);
  }
  const envRoot = findPackageRoot(dirname(resolvedEnvBinary)) ?? DEFAULT_PACKAGE_ROOT;
  runBinary(resolvedEnvBinary, envRoot);
} else {
  const currentPlatform = platform();
  const currentArch = arch();
  const platformKey = `${currentPlatform}-${currentArch}`;
  const platformConfig = platformMap[platformKey];

  if (!platformConfig) {
    console.error(`Error: Unsupported platform ${platformKey}`);
    console.error(`Supported platforms: ${Object.keys(platformMap).join(', ')}`);
    process.exit(1);
  }

  // Try to find the platform-specific binary in multiple locations
  const searchPaths = [
    // 1. Nested node_modules (npm < 7 behavior)
    join(ROOT_FALLBACK, 'node_modules', platformConfig.pkg, platformConfig.bin),
    // 2. Hoisted to parent node_modules (npm >= 7 behavior, pnpm, yarn)
    join(ROOT_FALLBACK, '..', platformConfig.pkg, platformConfig.bin),
    // 3. Global install location (try to resolve from parent of codemachine)
    join(dirname(ROOT_FALLBACK), platformConfig.pkg, platformConfig.bin),
  ];

  let binaryPath = null;
  for (const path of searchPaths) {
    if (existsSync(path)) {
      binaryPath = path;
      break;
    }
  }

  if (!binaryPath) {
    console.error(`Error: Platform binary not found. Searched:`);
    searchPaths.forEach((p) => console.error(`  - ${p}`));
    console.error(`\nThe ${platformConfig.pkg} package may not be installed.`);
    console.error(`This is likely because your platform is not supported as an optional dependency.`);
    console.error(`\nTry reinstalling: npm install -g codemachine`);
    console.error(`\nPlease report this issue at: https://github.com/moazbuilds/CodeMachine-CLI/issues`);
    process.exit(1);
  }

  runBinary(binaryPath, DEFAULT_PACKAGE_ROOT);
}
