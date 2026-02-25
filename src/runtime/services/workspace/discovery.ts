import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectAgentsFromWorkflows } from '../../../shared/agents/index.js';
import { getDevRoot } from '../../../shared/runtime/dev.js';
import { getImportRoots } from '../../../shared/imports/index.js';
import { otel_debug, otel_warn } from '../../../shared/logging/logger.js';
import { LOGGER_NAMES } from '../../../shared/logging/otel-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export const CLI_BUNDLE_DIR = path.resolve(__dirname);
export const CLI_PACKAGE_ROOT = getDevRoot() ?? undefined;

export const CLI_ROOT_CANDIDATES = Array.from(
  new Set([
    CLI_BUNDLE_DIR,
    CLI_PACKAGE_ROOT,
    CLI_PACKAGE_ROOT ? path.join(CLI_PACKAGE_ROOT, 'dist') : undefined,
    ...getImportRoots(),
  ].filter((root): root is string => Boolean(root)))
);

export const AGENT_MODULE_FILENAMES = ['main.agents.js', 'sub.agents.js', 'agents.js'];
export const SHOULD_DEBUG_BOOTSTRAP = process.env.CODEMACHINE_DEBUG_BOOTSTRAP === '1';

export function debugLog(...args: unknown[]): void {
  if (!SHOULD_DEBUG_BOOTSTRAP) return;
  if (typeof args[0] === 'string') {
    otel_debug(LOGGER_NAMES.BOOT, args[0], args.slice(1));
    return;
  }
  otel_debug(LOGGER_NAMES.BOOT, '[workspace-bootstrap] debugLog event: %O', [args.length === 1 ? args[0] : args]);
}

export type AgentDefinition = Record<string, unknown> & { mirrorPath?: string };
export type LoadedAgent = AgentDefinition & { id: string; source?: 'main' | 'sub' | 'legacy' | 'workflow' };

export async function loadAgents(
  candidateRoots: string[],
  filterIds?: string[]
): Promise<{ allAgents: AgentDefinition[]; subAgents: AgentDefinition[] }> {
  otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Called with candidateRoots=%O, filterIds=%O', [candidateRoots, filterIds]);

  const candidateModules = new Map<string, 'main' | 'sub' | 'legacy'>();

  for (const root of candidateRoots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);
    otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Scanning root=%s', [resolvedRoot]);

    for (const filename of AGENT_MODULE_FILENAMES) {
      const moduleCandidate = path.join(resolvedRoot, 'config', filename);
      const distCandidate = path.join(resolvedRoot, 'dist', 'config', filename);

      const tag = filename === 'main.agents.js' ? 'main' : filename === 'sub.agents.js' ? 'sub' : 'legacy';

      if (existsSync(moduleCandidate)) {
        otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Found module: %s (source=%s)', [moduleCandidate, tag]);
        candidateModules.set(moduleCandidate, tag);
      }
      if (existsSync(distCandidate)) {
        otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Found module: %s (source=%s)', [distCandidate, tag]);
        candidateModules.set(distCandidate, tag);
      }
    }
  }

  otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Total candidate modules found: %d', [candidateModules.size]);

  const byId = new Map<string, LoadedAgent>();

  for (const [modulePath, source] of candidateModules.entries()) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // ignore cache miss
    }

    let loadedAgents: unknown;
    try {
      loadedAgents = require(modulePath);
    } catch (err) {
      otel_warn(LOGGER_NAMES.BOOT, '[loadAgents] Failed loading module %s (source=%s): %s', [
        modulePath,
        source,
        err instanceof Error ? err.message : String(err),
      ]);
      continue;
    }
    const agents = Array.isArray(loadedAgents) ? (loadedAgents as AgentDefinition[]) : [];
    otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Loaded %d agents from %s', [agents.length, modulePath]);

    for (const agent of agents) {
      if (!agent || typeof agent.id !== 'string') {
        continue;
      }
      const id = agent.id.trim();
      if (!id) {
        continue;
      }

      otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Processing agent id=%s, source=%s, mirrorPath=%s', [id, source, agent.mirrorPath]);

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

  otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Collecting agents from workflows...', []);
  let workflowAgents: AgentDefinition[] = [];
  try {
    workflowAgents = await collectAgentsFromWorkflows(candidateRoots);
    otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Got %d workflow agents', [workflowAgents.length]);
  } catch (err) {
    otel_warn(LOGGER_NAMES.BOOT, '[loadAgents] Workflow collection failed: %s', [
      err instanceof Error ? err.message : String(err),
    ]);
  }

  for (const agent of workflowAgents) {
    if (!agent || typeof agent.id !== 'string') continue;
    const id = agent.id.trim();
    if (!id) continue;

    otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Processing workflow agent id=%s', [id]);

    const existing = byId.get(id);
    const merged: LoadedAgent = {
      ...(existing ?? {}),
      ...agent,
      id,
      source: existing?.source ?? 'workflow',
    };
    byId.set(id, merged);
  }

  otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Total agents in byId map: %d', [byId.size]);
  otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] All agent IDs: %O', [Array.from(byId.keys())]);

  const allAgents = Array.from(byId.values()).map(({ source: _source, ...agent }) => ({ ...agent }));

  // Filter sub-agents by IDs if filterIds is provided
  const subAgents = Array.from(byId.values())
    .filter((agent) => {
      if (agent.source !== 'sub') {
        otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Filtering out agent %s: source=%s (not sub)', [agent.id, agent.source]);
        return false;
      }
      if (!filterIds) return true;
      if (filterIds.includes(agent.id)) {
        otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Agent %s: source=sub, included in filterIds', [agent.id]);
        return true;
      }
      otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Agent %s: source=sub, not included in filterIds', [agent.id]);
      return false;
    })
    .map(({ source: _source, ...agent }) => ({ ...agent }));

  otel_debug(LOGGER_NAMES.BOOT, '[loadAgents] Returning %d allAgents, %d subAgents', [allAgents.length, subAgents.length]);
  return { allAgents, subAgents };
}
