import * as path from 'node:path';
import { createRequire } from 'node:module';
import { resolvePackageRoot } from '../../shared/runtime/root.js';

export const packageRoot = resolvePackageRoot(import.meta.url, 'workflow config');

// Config types
export interface AgentConfig {
  id: string;
  name?: string;
  promptPath?: string | string[];
  model?: string;
  modelReasoningEffort?: string;
  engine?: string; // Dynamic engine type from registry
  type?: string;
  [key: string]: unknown;
}

export interface ModuleBehaviorConfig {
  type?: string;
  action?: string;
  steps?: number;
  trigger?: string;
  maxIterations?: number;
  skip?: string[];
  [key: string]: unknown;
}

export interface ModuleConfig extends AgentConfig {
  behavior?: ModuleBehaviorConfig;
}

// Config loaders
const require = createRequire(import.meta.url);

// Lazy-loaded configs to avoid loading during compilation or when not needed
let _mainAgents: AgentConfig[] | null = null;
let _moduleCatalog: ModuleConfig[] | null = null;

// Imported agents storage (merged from external packages)
let _importedMainAgents: AgentConfig[] = [];
let _importedModules: ModuleConfig[] = [];

export function getMainAgents(): AgentConfig[] {
  if (!_mainAgents) {
    _mainAgents = require(path.resolve(packageRoot, 'config', 'main.agents.js')) as AgentConfig[];
  }
  return _mainAgents;
}

export function getModuleCatalog(): ModuleConfig[] {
  if (!_moduleCatalog) {
    _moduleCatalog = require(path.resolve(packageRoot, 'config', 'modules.js')) as ModuleConfig[];
  }
  return _moduleCatalog;
}

/**
 * Get all main agents including imported ones
 * Imported agents take precedence (searched first)
 */
export function getAllMainAgents(): AgentConfig[] {
  return [..._importedMainAgents, ...getMainAgents()];
}

/**
 * Get all modules including imported ones
 * Imported modules take precedence (searched first)
 */
export function getAllModules(): ModuleConfig[] {
  return [..._importedModules, ...getModuleCatalog()];
}

/**
 * Register agents from an imported package
 * @param configPath - Path to the import's config directory
 */
export function registerImportedAgents(configPath: string): void {
  const mainAgentsPath = path.join(configPath, 'main.agents.js');
  const modulesPath = path.join(configPath, 'modules.js');

  try {
    // Clear require cache to ensure fresh load
    try { delete require.cache[require.resolve(mainAgentsPath)]; } catch { /* ignore */ }
    const importedMain = require(mainAgentsPath) as AgentConfig[];
    if (Array.isArray(importedMain)) {
      _importedMainAgents = [...importedMain, ..._importedMainAgents];
    }
  } catch {
    // No main.agents.js or failed to load - that's ok
  }

  try {
    // Clear require cache to ensure fresh load
    try { delete require.cache[require.resolve(modulesPath)]; } catch { /* ignore */ }
    const importedModules = require(modulesPath) as ModuleConfig[];
    if (Array.isArray(importedModules)) {
      _importedModules = [...importedModules, ..._importedModules];
    }
  } catch {
    // No modules.js or failed to load - that's ok
  }
}

/**
 * Clear all imported agents (useful for cleanup between operations)
 */
export function clearImportedAgents(): void {
  _importedMainAgents = [];
  _importedModules = [];
}

// Legacy exports for backwards compatibility (will trigger lazy load)
// Now uses getAllMainAgents/getAllModules to include imported agents
export const mainAgents = new Proxy([] as AgentConfig[], {
  get(_target, prop) {
    return getAllMainAgents()[prop as keyof AgentConfig[]];
  },
  has(_target, prop) {
    return prop in getAllMainAgents();
  },
  ownKeys(_target) {
    return Reflect.ownKeys(getAllMainAgents());
  },
});

export const moduleCatalog = new Proxy([] as ModuleConfig[], {
  get(_target, prop) {
    return getAllModules()[prop as keyof ModuleConfig[]];
  },
  has(_target, prop) {
    return prop in getAllModules();
  },
  ownKeys(_target) {
    return Reflect.ownKeys(getAllModules());
  },
});
