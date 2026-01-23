/**
 * CodeMachine Import System
 *
 * Provides functionality for importing external workflow packages
 * from GitHub and other git repositories.
 */

// Types
export type {
  ImportManifest,
  InstalledImport,
  ImportRegistry,
  ResolvedSource,
  ImportOptions,
  ValidationResult,
} from './types.js';

// Path utilities
export {
  getCodemachineHomeDir,
  getImportsDir,
  getRegistryPath,
  ensureImportsDir,
  getImportInstallPath,
  isImportInstalled,
  getInstalledImportPaths,
} from './paths.js';

// Manifest parsing
export {
  parseManifest,
  getResolvedPaths,
  validateImport,
  getManifestFilename,
} from './manifest.js';

// Registry management
export {
  loadRegistry,
  saveRegistry,
  registerImport,
  unregisterImport,
  getInstalledImport,
  getAllInstalledImports,
  isImportRegistered,
  getImportRoots,
  getImportRootsWithMetadata,
  buildImportPathToNameMap,
} from './registry.js';
export type { ImportRootWithMetadata } from './registry.js';

// Source resolution
export {
  resolveSource,
  extractRepoName,
} from './resolver.js';

// Import-aware path resolution
export {
  resolvePromptPath,
  resolvePromptPathWithContext,
  resolvePromptFolder,
  resolveWorkflowTemplate,
  resolvePathWithImports,
  getAllWorkflowDirectories,
  getAllPromptDirectories,
} from './resolve.js';
export type { ResolvedPromptPath } from './resolve.js';
