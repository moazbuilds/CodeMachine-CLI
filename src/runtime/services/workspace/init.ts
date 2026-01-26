import * as path from 'node:path';

import { CLI_ROOT_CANDIDATES, debugLog, loadAgents } from './discovery.js';
import { ensureDir, mirrorAgentsToJson } from './fs-utils.js';
import { getImportRoots } from '../../../shared/imports/index.js';
import { appDebug } from '../../../shared/logging/logger.js';

export type WorkspaceStructureOptions = {
  cwd?: string;
};

export type MirrorSubAgentsOptions = {
  cwd: string;
  subAgentIds: string[];
};

function resolveDesiredCwd(explicitCwd?: string): string {
  return explicitCwd ?? process.env.CODEMACHINE_CWD ?? process.cwd();
}

/**
 * Ensures workspace folder structure under `.codemachine/`.
 * Does NOT load or mirror any agents - that's handled separately by mirrorSubAgents.
 * Idempotent and safe to run repeatedly.
 */
export async function ensureWorkspaceStructure(options?: WorkspaceStructureOptions): Promise<void> {
  const desiredCwd = resolveDesiredCwd(options?.cwd);

  // Ensure the working directory exists
  await ensureDir(desiredCwd);

  // Prepare .codemachine tree
  const cmRoot = path.join(desiredCwd, '.codemachine');
  const agentsDir = path.join(cmRoot, 'agents');
  const inputsDir = path.join(cmRoot, 'inputs');
  const memoryDir = path.join(cmRoot, 'memory');
  const artifactsDir = path.join(cmRoot, 'artifacts');
  const promptDir = path.join(cmRoot, 'prompts');
  const logsDir = path.join(cmRoot, 'logs');

  // Create all directories
  await Promise.all([
    ensureDir(cmRoot),
    ensureDir(agentsDir),
    ensureDir(inputsDir),
    ensureDir(memoryDir),
    ensureDir(artifactsDir),
    ensureDir(promptDir),
    ensureDir(logsDir)
  ]);

  // Note: specifications.md is only created when template.specification === true
  // See validateSpecification() in validation.ts
}

/**
 * Mirrors sub-agents to `.codemachine/agents/` based on template's subAgentIds.
 * Should only be called when the template has subAgentIds defined.
 */
export async function mirrorSubAgents(options: MirrorSubAgentsOptions): Promise<void> {
  const { cwd, subAgentIds } = options;

  appDebug('[mirrorSubAgents] Called with cwd=%s, subAgentIds=%O', cwd, subAgentIds);

  if (!subAgentIds || subAgentIds.length === 0) {
    appDebug('[mirrorSubAgents] No subAgentIds to mirror, skipping');
    debugLog('No subAgentIds to mirror, skipping');
    return;
  }

  // Include import roots so sub-agents from imported packages can be found
  const importRoots = getImportRoots();
  appDebug('[mirrorSubAgents] Import roots: %O', importRoots);

  const agentRoots = Array.from(
    new Set([
      cwd,
      ...(CLI_ROOT_CANDIDATES ?? []),
      ...importRoots
    ].filter((root): root is string => Boolean(root)))
  );
  appDebug('[mirrorSubAgents] Agent roots to search: %O', agentRoots);

  const cmRoot = path.join(cwd, '.codemachine');
  const agentsDir = path.join(cmRoot, 'agents');
  appDebug('[mirrorSubAgents] Target agentsDir=%s', agentsDir);

  // Ensure agents directory exists
  await ensureDir(agentsDir);

  // Load and mirror only the specified sub-agents
  appDebug('[mirrorSubAgents] Calling loadAgents with filterIds=%O', subAgentIds);
  const { subAgents } = await loadAgents(agentRoots, subAgentIds);
  appDebug('[mirrorSubAgents] loadAgents returned %d sub-agents: %O', subAgents.length, subAgents.map(a => a.id ?? a.name));

  debugLog('Mirroring agents', { agentRoots, agentCount: subAgents.length, subAgentIds });

  appDebug('[mirrorSubAgents] Calling mirrorAgentsToJson');
  await mirrorAgentsToJson(agentsDir, subAgents, agentRoots);
  appDebug('[mirrorSubAgents] mirrorAgentsToJson completed');
}
