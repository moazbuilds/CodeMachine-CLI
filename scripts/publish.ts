#!/usr/bin/env bun
import { $ } from 'bun';
import { join } from 'node:path';
import { arch, platform } from 'node:os';
import { chmodSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(repoRoot);

const pkg = JSON.parse(await Bun.file('package.json').text());
const version = pkg.version;
const hostKey = `${platform()}-${arch()}`;

// CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipBuild = args.includes('--skip-build');
const tagArgIndex = args.findIndex((arg) => arg === '--tag');
const tag =
  tagArgIndex !== -1 && args[tagArgIndex + 1]
    ? args[tagArgIndex + 1]
    : process.env.NPM_TAG ||
      process.env.CODEMACHINE_TAG ||
      (process.env.GITHUB_REF_NAME?.startsWith('v') ? 'latest' : 'latest');

const npmToken = process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN || process.env.NPM_CONFIG_TOKEN;
if (!npmToken) {
  console.error('❌ NPM token not provided (NPM_TOKEN or NODE_AUTH_TOKEN)');
  process.exit(1);
}

const npmrcPath = join(repoRoot, '.npmrc.publish');
await Bun.write(npmrcPath, `//registry.npmjs.org/:_authToken=${npmToken}\n`);
chmodSync(npmrcPath, 0o600);

const log = (msg: string) => console.log(`[publish] ${msg}`);
const run = async (cmd: string, cwd = repoRoot, captureStderr = false) => {
  log(cmd);
  // Invoke via bash -lc to support full command strings while still streaming output.
  const proc = Bun.spawn(['bash', '-lc', cmd], {
    cwd,
    stdout: 'inherit',
    stderr: captureStderr ? 'pipe' : 'inherit',
  });

  let stderrOutput = '';
  if (captureStderr && proc.stderr) {
    const decoder = new TextDecoder();
    const reader = proc.stderr.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      process.stderr.write(text); // Still show it to user
      stderrOutput += text;
    }
  }

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const error: any = new Error(`Command failed with exit code ${exitCode}: ${cmd}`);
    error.stderr = stderrOutput;
    throw error;
  }
};

log(`version: ${version}`);
log(`tag: ${tag}`);
log(`dry run: ${dryRun ? 'yes' : 'no'}`);
log(`build: ${skipBuild ? 'skip' : 'run'}`);

// Always ensure the embedded archive is fresh before any build/publish step.
// This avoids stale templates/resources in platform binaries produced during tagging.
await run('bun scripts/generate-embedded-resources.mjs --quiet || bun scripts/generate-embedded-resources.mjs');

if (!skipBuild) {
  // Build all targets so we can publish all platform packages from a single runner.
  await run('bun run build -- --all');
}

const platformPackages = Object.keys(pkg.optionalDependencies ?? {}).map((name) => ({
  name,
  dir: join(repoRoot, 'binaries', name),
}));

for (const { name, dir } of platformPackages) {
  if (!existsSync(dir)) {
    console.error(`❌ Missing built package at ${dir}. Did the build step succeed?`);
    process.exit(1);
  }

  // Best-effort: make binary executable on Unix targets so npm keeps the bit.
  try {
    if (!name.includes('windows')) {
      chmodSync(join(dir, 'codemachine'), 0o755);
    }
  } catch {
    // ignore chmod failures (e.g., cross-platform artifacts not present)
  }
}

// Smoke test the host binary (only for the current platform).
const hostPkg = platformPackages.find(({ name }) => name.includes(hostKey.replace('win32', 'windows')));
if (hostPkg) {
  const binName = hostPkg.name.includes('windows') ? 'codemachine.exe' : 'codemachine';
  const binPath = join(hostPkg.dir, binName);
  if (existsSync(binPath)) {
    try {
      await run(`${binPath} --version`, repoRoot);
    } catch {
      console.warn(`[publish] ⚠️  Host binary smoke test failed for ${binPath}`);
    }
  }
}

const publishPackage = async (dir: string, displayName: string): Promise<'published' | 'skipped'> => {
  // Check if this version is already published
  const pkgJson = JSON.parse(await Bun.file(join(dir, 'package.json')).text());
  const pkgName = pkgJson.name;
  const pkgVersion = pkgJson.version;

  try {
    const { stdout } = await $`npm view ${pkgName}@${pkgVersion} version 2>/dev/null`.quiet().nothrow();
    const publishedVersion = stdout.toString().trim();

    if (publishedVersion === pkgVersion) {
      log(`⏭️  Skipping ${displayName}@${pkgVersion} (already published)`);
      return 'skipped';
    }
  } catch {
    // Package not published yet, continue
  }

  const publishCmd = [
    'npm publish',
    `--access public`,
    `--tag ${tag}`,
    `--userconfig ${npmrcPath}`,
    dryRun ? '--dry-run' : '',
  ]
    .filter(Boolean)
    .join(' ');

  log(`📦 Publishing ${displayName}@${pkgVersion}...`);

  try {
    await run(publishCmd, dir, true); // Capture stderr
    log(`✅ ${dryRun ? 'Dry-run' : 'Published'} ${displayName}@${pkgVersion}`);
    return 'published';
  } catch (error: any) {
    // Check if it's an "already published" error
    const errorStr = String(error);
    const stderr = error.stderr || '';

    if (errorStr.includes('Cannot publish over previously published version') ||
        stderr.includes('Cannot publish over previously published version') ||
        stderr.includes('You cannot publish over the previously published versions')) {
      log(`⏭️  Skipping ${displayName}@${pkgVersion} (already published - detected during publish attempt)`);
      return 'skipped';
    }

    console.error(`❌ Failed to publish ${displayName}@${pkgVersion}`);
    console.error(`Error details:`, error);
    throw error; // Re-throw to stop the script
  }
};

const publishResults = { published: [] as string[], skipped: [] as string[], failed: [] as string[] };

log('Publishing platform packages...');
for (const { name, dir } of platformPackages) {
  try {
    const result = await publishPackage(dir, name);
    if (result === 'skipped') {
      publishResults.skipped.push(name);
    } else {
      publishResults.published.push(name);
    }
  } catch (error) {
    publishResults.failed.push(name);
    throw error; // Stop on first failure
  }
}

log('Publishing meta package...');
try {
  const result = await publishPackage(repoRoot, pkg.name);
  if (result === 'skipped') {
    publishResults.skipped.push(pkg.name);
  } else {
    publishResults.published.push(pkg.name);
  }
} catch (error) {
  publishResults.failed.push(pkg.name);
  throw error;
}

if (!dryRun) {
  const major = version.split('.')[0];
  const majorTag = `latest-${major}`;
  const tagCmd = (name: string) =>
    ['npm dist-tag add', `${name}@${version}`, majorTag, `--userconfig ${npmrcPath}`].join(' ');

  for (const { name } of platformPackages) {
    await run(tagCmd(name));
  }
  await run(tagCmd(pkg.name));
  log(`Applied dist-tag ${majorTag} to all packages`);
}

log('Done');
