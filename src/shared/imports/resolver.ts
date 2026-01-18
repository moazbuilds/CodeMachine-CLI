/**
 * Source resolution for CodeMachine imports
 * Handles: short names, owner/repo, full URLs
 */

import type { ResolvedSource } from './types.js';
import { hasValidSuffix, getRequiredSuffix } from './manifest.js';

const GITHUB_BASE = 'https://github.com';
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Resolve an import source string to a clone-able URL
 *
 * Supported formats:
 * - Short name: `bmad-workflow-codemachine` (searches GitHub)
 * - Owner/repo: `user/repo-codemachine` (assumes GitHub)
 * - Full URL: `github.com/user/repo-codemachine` or `https://...`
 * - Git URL: `git@github.com:user/repo.git`
 */
export async function resolveSource(input: string): Promise<ResolvedSource> {
  const trimmed = input.trim();

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
    return resolveFullUrl(`https://${trimmed}`);
  }

  // Owner/repo format (e.g., user/repo-codemachine)
  if (trimmed.includes('/') && !trimmed.includes('.')) {
    const [owner, repo] = trimmed.split('/');
    return resolveOwnerRepo(owner, repo);
  }

  // Short name (e.g., bmad-workflow-codemachine) - search GitHub
  return resolveShortName(trimmed);
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

  // Validate suffix
  if (!hasValidSuffix(repoName)) {
    throw new Error(
      `Repository name "${repoName}" must end with "${getRequiredSuffix()}"`
    );
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

  if (!hasValidSuffix(repoName)) {
    throw new Error(
      `Repository name "${repoName}" must end with "${getRequiredSuffix()}"`
    );
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
  if (!hasValidSuffix(repo)) {
    throw new Error(
      `Repository name "${repo}" must end with "${getRequiredSuffix()}"`
    );
  }

  return {
    type: 'github-repo',
    url: `${GITHUB_BASE}/${owner}/${repo}.git`,
    repoName: repo,
    owner,
  };
}

/**
 * Resolve a short name by searching GitHub
 * Uses GitHub search API to find repositories ending with -codemachine
 */
async function resolveShortName(name: string): Promise<ResolvedSource> {
  if (!hasValidSuffix(name)) {
    throw new Error(
      `Package name "${name}" must end with "${getRequiredSuffix()}"`
    );
  }

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
