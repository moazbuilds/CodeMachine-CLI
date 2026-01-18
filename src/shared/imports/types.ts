/**
 * Type definitions for the CodeMachine import system
 */

/**
 * Manifest file structure (codemachine.json)
 * Minimal by default, with optional path overrides
 */
export interface ImportManifest {
  /** Package name (required) */
  name: string;
  /** Package version (required) */
  version: string;
  /** Optional description */
  description?: string;
  /** Optional custom paths (defaults to convention) */
  paths?: {
    /** Config directory (default: 'config/') */
    config?: string;
    /** Workflows directory (default: 'templates/workflows/') */
    workflows?: string;
    /** Prompts directory (default: 'prompts/') */
    prompts?: string;
    /** Agent characters file (default: 'config/agent-characters.json') */
    characters?: string;
  };
}

/**
 * Metadata about an installed import
 */
export interface InstalledImport {
  /** Package name from manifest */
  name: string;
  /** Package version from manifest */
  version: string;
  /** Source URL or repo identifier */
  source: string;
  /** Absolute path to installed location */
  path: string;
  /** When the import was installed */
  installedAt: string;
  /** Resolved paths to resources */
  resolvedPaths: {
    config: string;
    workflows: string;
    prompts: string;
    characters: string;
  };
}

/**
 * Registry file structure (~/.codemachine/imports/registry.json)
 */
export interface ImportRegistry {
  /** Schema version for future migrations */
  schemaVersion: number;
  /** Map of package name to installed import info */
  imports: Record<string, InstalledImport>;
}

/**
 * Result of resolving an import source
 */
export interface ResolvedSource {
  /** Type of resolution */
  type: 'github-search' | 'github-repo' | 'git-url';
  /** Full URL to clone */
  url: string;
  /** Repository name (folder name) */
  repoName: string;
  /** Owner (for GitHub repos) */
  owner?: string;
}

/**
 * Import command options
 */
export interface ImportOptions {
  /** Remove the import instead of installing */
  remove?: boolean;
  /** List installed imports */
  list?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Validation result for an import
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest?: ImportManifest;
}
