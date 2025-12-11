import * as path from 'node:path';
import { createRequire } from 'node:module';
import { resolvePackageRoot } from '../../shared/runtime/pkg.js';

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

// Legacy exports for backwards compatibility (will trigger lazy load)
export const mainAgents = new Proxy([] as AgentConfig[], {
  get(_target, prop) {
    return getMainAgents()[prop as keyof AgentConfig[]];
  },
  has(_target, prop) {
    return prop in getMainAgents();
  },
  ownKeys(_target) {
    return Reflect.ownKeys(getMainAgents());
  },
});

export const moduleCatalog = new Proxy([] as ModuleConfig[], {
  get(_target, prop) {
    return getModuleCatalog()[prop as keyof ModuleConfig[]];
  },
  has(_target, prop) {
    return prop in getModuleCatalog();
  },
  ownKeys(_target) {
    return Reflect.ownKeys(getModuleCatalog());
  },
});
