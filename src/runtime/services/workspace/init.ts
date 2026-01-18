import * as path from 'node:path';

import { CLI_ROOT_CANDIDATES, debugLog, loadAgents } from './discovery.js';
import { ensureDir, ensureSpecificationsTemplate, mirrorAgentsToJson } from './fs-utils.js';
import { getImportRoots } from '../../../shared/imports/index.js';

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

  // Ensure specifications template exists (do not overwrite if present)
  await ensureSpecificationsTemplate(inputsDir);
}

/**
 * Mirrors sub-agents to `.codemachine/agents/` based on template's subAgentIds.
 * Should only be called when the template has subAgentIds defined.
 */
export async function mirrorSubAgents(options: MirrorSubAgentsOptions): Promise<void> {
  const { cwd, subAgentIds } = options;

  if (!subAgentIds || subAgentIds.length === 0) {
    debugLog('No subAgentIds to mirror, skipping');
    return;
  }

  // Include import roots so sub-agents from imported packages can be found
  const importRoots = getImportRoots();

  const agentRoots = Array.from(
    new Set([
      cwd,
      ...(CLI_ROOT_CANDIDATES ?? []),
      ...importRoots
    ].filter((root): root is string => Boolean(root)))
  );

  const cmRoot = path.join(cwd, '.codemachine');
  const agentsDir = path.join(cmRoot, 'agents');

  // Ensure agents directory exists
  await ensureDir(agentsDir);

  // Load and mirror only the specified sub-agents
  const { subAgents } = await loadAgents(agentRoots, subAgentIds);
  debugLog('Mirroring agents', { agentRoots, agentCount: subAgents.length, subAgentIds });
  await mirrorAgentsToJson(agentsDir, subAgents, agentRoots);
}
