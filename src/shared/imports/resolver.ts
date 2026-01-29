/**
 * Source resolution for CodeMachine imports
 * Handles: short names, owner/repo, full URLs, local paths
 */

import { existsSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import type { ResolvedSource } from './types.js';

const GITHUB_BASE = 'https://github.com';
const GITHUB_API_BASE = 'https://api.github.com';
const LOCAL_MANIFEST_FILENAME = '.codemachine.json';
const STANDARD_MANIFEST_FILENAME = 'codemachine.json';

/**
 * Check if a directory has a valid manifest file
 */
function hasManifestFile(dirPath: string): boolean {
  return existsSync(resolve(dirPath, LOCAL_MANIFEST_FILENAME)) ||
         existsSync(resolve(dirPath, STANDARD_MANIFEST_FILENAME));
}

/**
 * Resolve an import source string to a clone-able URL
 *
 * Supported formats:
 * - Local path: `/path/to/folder` or `./relative/path` (with .codemachine.json)
 * - Short name: `package-name` (searches GitHub)
 * - Owner/repo: `user/repo` (assumes GitHub)
 * - Full URL: `github.com/user/repo` or `https://...`
 * - Git URL: `git@github.com:user/repo.git`
 */
export async function resolveSource(input: string): Promise<ResolvedSource> {
  const trimmed = input.trim();

  // Check for local path first (absolute or relative starting with ./ or ../)
  const localResult = resolveLocalPath(trimmed);
  if (localResult) {
    return localResult;
  }

  // Full HTTPS URL
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return resolveFullUrl(trimmed);
  }

  // Git SSH URL
  if (trimmed.startsWith('git@')) {
    return resolveGitUrl(trimmed);
  }

  // Domain prefix without protocol (e.g., github.com/user/repo)
  if (trimmed.includes('.') && trimmed.includes('/')) {
    // Check if it's a local path that exists before treating as URL
    const absolutePath = resolve(trimmed);
    if (existsSync(absolutePath)) {
      const localCheck = resolveLocalPath(absolutePath);
      if (localCheck) {
        return localCheck;
      }
    }
    return resolveFullUrl(`https://${trimmed}`);
  }

  // Owner/repo format (e.g., user/repo)
  if (trimmed.includes('/') && !trimmed.includes('.')) {
    // Check if it's a local path first
    const absolutePath = resolve(trimmed);
    if (existsSync(absolutePath)) {
      const localCheck = resolveLocalPath(absolutePath);
      if (localCheck) {
        return localCheck;
      }
    }
    const [owner, repo] = trimmed.split('/');
    return resolveOwnerRepo(owner, repo);
  }

  // Short name (e.g., package-name) - search GitHub
  return resolveShortName(trimmed);
}

/**
 * Resolve a local folder path with .codemachine.json or codemachine.json
 */
function resolveLocalPath(path: string): ResolvedSource | null {
  // Handle absolute paths
  if (isAbsolute(path)) {
    if (existsSync(path) && hasManifestFile(path)) {
      return {
        type: 'local-path',
        url: path,
        repoName: basename(path),
      };
    }
    return null;
  }

  // Handle relative paths starting with ./ or ../
  if (path.startsWith('./') || path.startsWith('../') || path.startsWith('~')) {
    const absolutePath = path.startsWith('~')
      ? path.replace('~', process.env.HOME || '')
      : resolve(path);

    if (existsSync(absolutePath) && hasManifestFile(absolutePath)) {
      return {
        type: 'local-path',
        url: absolutePath,
        repoName: basename(absolutePath),
      };
    }
    return null;
  }

  return null;
}

/**
 * Resolve a full HTTPS URL
 */
function resolveFullUrl(url: string): ResolvedSource {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  // Extract repo name (remove .git suffix if present)
  let repoName = pathParts[pathParts.length - 1] || 'unknown';
  if (repoName.endsWith('.git')) {
    repoName = repoName.slice(0, -4);
  }

  // Determine if it's GitHub
  const isGitHub = parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com';

  return {
    type: isGitHub ? 'github-repo' : 'git-url',
    url: url.endsWith('.git') ? url : `${url}.git`,
    repoName,
    owner: pathParts.length >= 2 ? pathParts[0] : undefined,
  };
}

/**
 * Resolve a Git SSH URL (git@github.com:user/repo.git)
 */
function resolveGitUrl(url: string): ResolvedSource {
  // Parse git@host:owner/repo.git
  const match = url.match(/^git@([^:]+):(.+)$/);
  if (!match) {
    throw new Error(`Invalid git URL format: ${url}`);
  }

  const [, host, path] = match;
  const pathParts = path.split('/').filter(Boolean);

  let repoName = pathParts[pathParts.length - 1] || 'unknown';
  if (repoName.endsWith('.git')) {
    repoName = repoName.slice(0, -4);
  }

  return {
    type: 'git-url',
    url,
    repoName,
    owner: pathParts.length >= 2 ? pathParts[0] : undefined,
  };
}

/**
 * Resolve owner/repo format to GitHub URL
 */
function resolveOwnerRepo(owner: string, repo: string): ResolvedSource {
  return {
    type: 'github-repo',
    url: `${GITHUB_BASE}/${owner}/${repo}.git`,
    repoName: repo,
    owner,
  };
}

/**
 * Resolve a short name by searching GitHub
 * Uses GitHub search API to find repositories
 */
async function resolveShortName(name: string): Promise<ResolvedSource> {
  // Search GitHub for the exact repo name
  const searchUrl = `${GITHUB_API_BASE}/search/repositories?q=${encodeURIComponent(name)}+in:name`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CodeMachine-CLI',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      items: Array<{ full_name: string; name: string; clone_url: string }>;
    };

    // Find exact match
    const exactMatch = data.items.find(
      (repo) => repo.name.toLowerCase() === name.toLowerCase()
    );

    if (exactMatch) {
      return {
        type: 'github-search',
        url: exactMatch.clone_url,
        repoName: exactMatch.name,
        owner: exactMatch.full_name.split('/')[0],
      };
    }

    // No exact match found
    throw new Error(
      `Could not find repository "${name}" on GitHub. ` +
      `Try using the full format: owner/${name}`
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Could not find')) {
      throw error;
    }
    throw new Error(
      `Failed to search GitHub for "${name}". ` +
      `Try using the full format: owner/${name}`
    );
  }
}

/**
 * Extract repo name from a source string (for display purposes)
 */
export function extractRepoName(source: string): string {
  const trimmed = source.trim();

  // Already just a name
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }

  // Owner/repo format
  if (trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed.split('/').pop() || trimmed;
  }

  // URL format
  try {
    const url = trimmed.startsWith('http')
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    const parts = url.pathname.split('/').filter(Boolean);
    let name = parts.pop() || trimmed;
    if (name.endsWith('.git')) {
      name = name.slice(0, -4);
    }
    return name;
  } catch {
    return trimmed;
  }
}
