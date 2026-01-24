import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectAgentsFromWorkflows } from '../../../shared/agents/index.js';
import { resolvePackageRoot } from '../../../shared/runtime/root.js';
import { appDebug } from '../../../shared/logging/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export const CLI_BUNDLE_DIR = path.resolve(__dirname);
export const CLI_PACKAGE_ROOT = (() => {
  try {
    return resolvePackageRoot(import.meta.url, 'workspace discovery');
  } catch {
    // If resolution fails, return undefined (legacy behavior)
    return undefined;
  }
})();

export const CLI_ROOT_CANDIDATES = Array.from(
  new Set([
    CLI_BUNDLE_DIR,
    CLI_PACKAGE_ROOT,
    CLI_PACKAGE_ROOT ? path.join(CLI_PACKAGE_ROOT, 'dist') : undefined
  ].filter((root): root is string => Boolean(root)))
);

export const AGENT_MODULE_FILENAMES = ['main.agents.js', 'sub.agents.js', 'agents.js'];
export const SHOULD_DEBUG_BOOTSTRAP = process.env.CODEMACHINE_DEBUG_BOOTSTRAP === '1';

export function debugLog(...args: unknown[]): void {
  if (SHOULD_DEBUG_BOOTSTRAP) {
    console.debug('[workspace-bootstrap]', ...args);
  }
}

export type AgentDefinition = Record<string, unknown> & { mirrorPath?: string };
export type LoadedAgent = AgentDefinition & { id: string; source?: 'main' | 'sub' | 'legacy' | 'workflow' };

export async function loadAgents(
  candidateRoots: string[],
  filterIds?: string[]
): Promise<{ allAgents: AgentDefinition[]; subAgents: AgentDefinition[] }> {
  appDebug('[loadAgents] Called with candidateRoots=%O, filterIds=%O', candidateRoots, filterIds);

  const candidateModules = new Map<string, 'main' | 'sub' | 'legacy'>();

  for (const root of candidateRoots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);
    appDebug('[loadAgents] Scanning root=%s', resolvedRoot);

    for (const filename of AGENT_MODULE_FILENAMES) {
      const moduleCandidate = path.join(resolvedRoot, 'config', filename);
      const distCandidate = path.join(resolvedRoot, 'dist', 'config', filename);

      const tag = filename === 'main.agents.js' ? 'main' : filename === 'sub.agents.js' ? 'sub' : 'legacy';

      if (existsSync(moduleCandidate)) {
        appDebug('[loadAgents] Found module: %s (source=%s)', moduleCandidate, tag);
        candidateModules.set(moduleCandidate, tag);
      }
      if (existsSync(distCandidate)) {
        appDebug('[loadAgents] Found module: %s (source=%s)', distCandidate, tag);
        candidateModules.set(distCandidate, tag);
      }
    }
  }

  appDebug('[loadAgents] Total candidate modules found: %d', candidateModules.size);

  const byId = new Map<string, LoadedAgent>();

  for (const [modulePath, source] of candidateModules.entries()) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // ignore cache miss
    }

    const loadedAgents = require(modulePath);
    const agents = Array.isArray(loadedAgents) ? (loadedAgents as AgentDefinition[]) : [];
    appDebug('[loadAgents] Loaded %d agents from %s', agents.length, modulePath);

    for (const agent of agents) {
      if (!agent || typeof agent.id !== 'string') {
        continue;
      }
      const id = agent.id.trim();
      if (!id) {
        continue;
      }

      appDebug('[loadAgents] Processing agent id=%s, source=%s, mirrorPath=%s', id, source, agent.mirrorPath);

      const existing = byId.get(id);
      const sourceTag = existing?.source ?? source;
      const merged: LoadedAgent = {
        ...(existing ?? {}),
        ...agent,
        id,
        source: sourceTag,
      };
      byId.set(id, merged);
    }
  }

  appDebug('[loadAgents] Collecting agents from workflows...');
  const workflowAgents = await collectAgentsFromWorkflows(candidateRoots);
  appDebug('[loadAgents] Got %d workflow agents', workflowAgents.length);

  for (const agent of workflowAgents) {
    if (!agent || typeof agent.id !== 'string') continue;
    const id = agent.id.trim();
    if (!id) continue;

    appDebug('[loadAgents] Processing workflow agent id=%s', id);

    const existing = byId.get(id);
    const merged: LoadedAgent = {
      ...(existing ?? {}),
      ...agent,
      id,
      source: existing?.source ?? 'workflow',
    };
    byId.set(id, merged);
  }

  appDebug('[loadAgents] Total agents in byId map: %d', byId.size);
  appDebug('[loadAgents] All agent IDs: %O', Array.from(byId.keys()));

  const allAgents = Array.from(byId.values()).map(({ source: _source, ...agent }) => ({ ...agent }));

  // Filter sub-agents by IDs if filterIds is provided
  const subAgents = Array.from(byId.values())
    .filter((agent) => {
      if (agent.source !== 'sub') {
        appDebug('[loadAgents] Filtering out agent %s: source=%s (not sub)', agent.id, agent.source);
        return false;
      }
      if (!filterIds) return true;
      if (filterIds.includes(agent.id)) {
        appDebug('[loadAgents] Agent %s: source=sub, included in filterIds', agent.id);
        return true;
      }
      appDebug('[loadAgents] Agent %s: source=sub, not included in filterIds', agent.id);
      return false;
    })
    .map(({ source: _source, ...agent }) => ({ ...agent }));

  appDebug('[loadAgents] Returning %d allAgents, %d subAgents', allAgents.length, subAgents.length);
  return { allAgents, subAgents };
}
