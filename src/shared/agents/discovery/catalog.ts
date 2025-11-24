import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveAgentsModulePath } from '../config/paths.js';
import { collectAgentsFromWorkflows } from './steps.js';
import type { AgentDefinition } from '../config/types.js';
import { AGENT_MODULE_FILENAMES } from '../config/types.js';
import { resolvePackageRoot } from '../../runtime/root.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Resolve package root using centralized logic
const CLI_BUNDLE_DIR = path.resolve(__dirname);
const CLI_PACKAGE_ROOT = (() => {
  try {
    return resolvePackageRoot(import.meta.url, 'agents discovery catalog');
  } catch {
    // If resolution fails, return undefined (legacy behavior)
    return undefined;
  }
})();

const envRootCandidates = [
  CLI_PACKAGE_ROOT,
  CLI_BUNDLE_DIR
].filter((root): root is string => Boolean(root));

const CLI_ROOT_CANDIDATES = Array.from(
  new Set(
    envRootCandidates.flatMap((root) => (root ? [root, path.join(root, 'dist')] : []))
  )
);

export function resolveProjectRoot(projectRoot?: string): string {
  if (projectRoot) {
    return projectRoot;
  }

  // Prefer the current working directory if it contains agent catalog modules so local overrides win
  const cwd = process.cwd();
  if (resolveAgentsModulePath({ projectRoot: cwd })) {
    return cwd;
  }

  // Fallback to the CLI install roots if no local config is present.
  for (const root of CLI_ROOT_CANDIDATES) {
    if (resolveAgentsModulePath({ projectRoot: root })) {
      return root;
    }
  }

  return CLI_ROOT_CANDIDATES[0];
}

export function loadAgentsFromModule(modulePath: string): AgentDefinition[] {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch {
    // ignore cache miss
  }

  const loadedAgents = require(modulePath);
  return Array.isArray(loadedAgents) ? (loadedAgents as AgentDefinition[]) : [];
}

export async function collectAgentDefinitions(projectRoot: string): Promise<AgentDefinition[]> {
  const candidates = new Set<string>();
  const roots = [projectRoot, ...CLI_ROOT_CANDIDATES.filter((root) => root && root !== projectRoot)];

  for (const root of roots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);
    for (const filename of AGENT_MODULE_FILENAMES) {
      const moduleCandidate = path.join(resolvedRoot, 'config', filename);
      const distCandidate = path.join(resolvedRoot, 'dist', 'config', filename);

      if (existsSync(moduleCandidate)) {
        candidates.add(moduleCandidate);
      }
      if (existsSync(distCandidate)) {
        candidates.add(distCandidate);
      }
    }
  }

  const byId = new Map<string, AgentDefinition>();

  for (const modulePath of candidates) {
    const agents = loadAgentsFromModule(modulePath);
    for (const agent of agents) {
      if (!agent || typeof agent.id !== 'string') {
        continue;
      }
      const id = agent.id.trim();
      if (!id || byId.has(id)) {
        continue;
      }
      byId.set(id, { ...agent, id });
    }
  }

  const workflowAgents = await collectAgentsFromWorkflows(roots);
  for (const agent of workflowAgents) {
    if (!agent || typeof agent.id !== 'string') continue;
    const id = agent.id.trim();
    if (!id) continue;

    const existing = byId.get(id);
    if (existing) {
      byId.set(id, { ...existing, ...agent, id });
    } else {
      byId.set(id, { ...agent, id });
    }
  }

  return Array.from(byId.values());
}

export function mergeAdditionalAgents(
  agents: AgentDefinition[],
  additionalAgents?: AgentDefinition[]
): AgentDefinition[] {
  if (!additionalAgents || additionalAgents.length === 0) {
    return agents;
  }

  const byId = new Map<string, AgentDefinition>();

  for (const agent of agents) {
    if (agent && typeof agent.id === 'string' && agent.id.trim()) {
      byId.set(agent.id, { ...agent });
    }
  }

  for (const candidate of additionalAgents) {
    if (!candidate || typeof candidate.id !== 'string') {
      continue;
    }
    const id = candidate.id.trim();
    if (!id) continue;
    const existing = byId.get(id) ?? {};
    byId.set(id, { ...existing, ...candidate, id });
  }

  return Array.from(byId.values());
}
