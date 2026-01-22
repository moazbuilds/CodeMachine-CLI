import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectAgentsFromWorkflows } from '../../../shared/agents/index.js';
import { resolvePackageRoot } from '../../../shared/runtime/root.js';
import { getImportRootsWithMetadata } from '../../../shared/imports/index.js';
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

/**
 * Module candidate with metadata for namespacing
 */
interface ModuleCandidate {
  source: 'main' | 'sub' | 'legacy';
  packageName: string | null;
}

export async function loadAgents(
  candidateRoots: string[],
  filterIds?: string[],
  sourcePackage?: string
): Promise<{ allAgents: AgentDefinition[]; subAgents: AgentDefinition[] }> {
  appDebug('[loadAgents] Called with candidateRoots=%O, filterIds=%O, sourcePackage=%s', candidateRoots, filterIds, sourcePackage);

  // Build a map from import path to package name for namespacing
  const importedRootsWithMeta = getImportRootsWithMetadata();
  appDebug('[loadAgents] importedRootsWithMeta=%O', importedRootsWithMeta);

  const importPathToPackage = new Map<string, string>();
  for (const imp of importedRootsWithMeta) {
    importPathToPackage.set(path.resolve(imp.path), imp.packageName);
  }
  appDebug('[loadAgents] importPathToPackage map size=%d', importPathToPackage.size);

  const candidateModules = new Map<string, ModuleCandidate>();

  for (const root of candidateRoots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);

    // Determine if this root is from an import
    const packageName = importPathToPackage.get(resolvedRoot) ?? null;
    appDebug('[loadAgents] Scanning root=%s, packageName=%s', resolvedRoot, packageName);

    for (const filename of AGENT_MODULE_FILENAMES) {
      const moduleCandidate = path.join(resolvedRoot, 'config', filename);
      const distCandidate = path.join(resolvedRoot, 'dist', 'config', filename);

      const source = filename === 'main.agents.js' ? 'main' : filename === 'sub.agents.js' ? 'sub' : 'legacy';

      if (existsSync(moduleCandidate)) {
        appDebug('[loadAgents] Found module: %s (source=%s, pkg=%s)', moduleCandidate, source, packageName);
        candidateModules.set(moduleCandidate, { source, packageName });
      }
      if (existsSync(distCandidate)) {
        appDebug('[loadAgents] Found module: %s (source=%s, pkg=%s)', distCandidate, source, packageName);
        candidateModules.set(distCandidate, { source, packageName });
      }
    }
  }

  appDebug('[loadAgents] Total candidate modules found: %d', candidateModules.size);

  const byId = new Map<string, LoadedAgent>();

  for (const [modulePath, { source, packageName }] of candidateModules.entries()) {
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
      const rawId = agent.id.trim();
      if (!rawId) {
        continue;
      }

      // Namespace the ID if from an imported package
      const id = packageName ? `${packageName}:${rawId}` : rawId;
      appDebug('[loadAgents] Processing agent rawId=%s -> id=%s, source=%s, mirrorPath=%s', rawId, id, source, agent.mirrorPath);

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

  // Pass import path map for workflow agent namespacing
  appDebug('[loadAgents] Collecting agents from workflows...');
  const workflowAgents = await collectAgentsFromWorkflows(candidateRoots, importPathToPackage);
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
  // Note: filterIds may use raw IDs (without namespace) for agents from imported packages
  // We check both the full namespaced ID and the raw ID (part after the colon)
  // When sourcePackage is provided, we prefer agents from that package for raw ID matches
  const subAgents = Array.from(byId.values())
    .filter((agent) => {
      if (agent.source !== 'sub') {
        appDebug('[loadAgents] Filtering out agent %s: source=%s (not sub)', agent.id, agent.source);
        return false;
      }
      if (!filterIds) return true;

      // Check if full ID matches (exact match always wins)
      if (filterIds.includes(agent.id)) {
        appDebug('[loadAgents] Agent %s: source=sub, matched by full ID', agent.id);
        return true;
      }

      // Check if raw ID (without namespace prefix) matches
      // e.g., for 'codemachine-one:founder-architect', check if 'founder-architect' is in filterIds
      const colonIndex = agent.id.indexOf(':');
      if (colonIndex > 0) {
        const agentPackage = agent.id.slice(0, colonIndex);
        const rawId = agent.id.slice(colonIndex + 1);

        if (filterIds.includes(rawId)) {
          // If sourcePackage is provided, only match agents from that package
          // This prevents conflicts when multiple packages have agents with the same raw ID
          if (sourcePackage) {
            if (agentPackage === sourcePackage) {
              appDebug('[loadAgents] Agent %s: source=sub, matched by raw ID=%s (same package as workflow)', agent.id, rawId);
              return true;
            } else {
              appDebug('[loadAgents] Agent %s: source=sub, raw ID=%s matches but different package (agent=%s, workflow=%s)', agent.id, rawId, agentPackage, sourcePackage);
              return false;
            }
          } else {
            // No sourcePackage specified, match any agent with the raw ID (backward compatible)
            appDebug('[loadAgents] Agent %s: source=sub, matched by raw ID=%s (no sourcePackage filter)', agent.id, rawId);
            return true;
          }
        }
      }

      appDebug('[loadAgents] Agent %s: source=sub, not included in filterIds', agent.id);
      return false;
    })
    .map(({ source: _source, ...agent }) => ({ ...agent }));

  appDebug('[loadAgents] Returning %d allAgents, %d subAgents', allAgents.length, subAgents.length);
  return { allAgents, subAgents };
}
