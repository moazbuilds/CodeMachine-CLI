import * as path from 'node:path';

import { loadWorkflowModule, isWorkflowTemplate } from '../../../workflows/index.js';
import { setActiveTemplate } from '../../../shared/workflows/index.js';
import { CLI_ROOT_CANDIDATES, debugLog, loadAgents } from './discovery.js';
import { ensureDir, ensureSpecificationsTemplate, mirrorAgentsToJson } from './fs-utils.js';

export type WorkspaceBootstrapOptions = {
  projectRoot?: string;
  cwd?: string; // target working directory for this run
  templatePath?: string; // path to workflow template
};

function resolveDesiredCwd(explicitCwd?: string): string {
  return explicitCwd ?? process.env.CODEMACHINE_CWD ?? process.cwd();
}

/**
 * Ensures workspace scaffolding under `.codemachine/` and prepares the working directory.
 * Idempotent and safe to run repeatedly.
 */
export async function bootstrapWorkspace(options?: WorkspaceBootstrapOptions): Promise<void> {
  const desiredCwd = resolveDesiredCwd(options?.cwd);

  // Prepare workspace-rooted scaffolding directory tree.
  const workspaceRoot = desiredCwd;

  const agentRoots = Array.from(
    new Set([
      options?.projectRoot,
      workspaceRoot,
      ...(CLI_ROOT_CANDIDATES ?? [])
    ].filter((root): root is string => Boolean(root)))
  );

  // Ensure the working directory exists and use it for this process.
  await ensureDir(desiredCwd);
  try {
    process.chdir(desiredCwd);
  } catch {
    // If chdir fails, continue without throwing to avoid blocking other bootstrap steps.
  }

  // Prepare .codemachine tree under the workspace root.
  const cmRoot = path.join(workspaceRoot, '.codemachine');
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

  // Ensure specifications template exists (do not overwrite if present).
  await ensureSpecificationsTemplate(inputsDir);

  // Load workflow template and extract sub-agent IDs (if templatePath provided)
  let agentIdsToLoad: string[] | undefined;

  if (options?.templatePath) {
    try {
      const template = await loadWorkflowModule(options.templatePath);
      if (isWorkflowTemplate(template)) {
        const templateName = path.basename(options.templatePath);
        agentIdsToLoad = template.subAgentIds ?? [];

        // Save template to template.json
        await setActiveTemplate(cmRoot, templateName);

        debugLog('Loaded template with sub-agents', { templateName, subAgentIds: agentIdsToLoad });
      }
    } catch (error) {
      debugLog('Failed to load workflow template', { error });
      // Continue with no filtering if template fails to load
    }
  }

  // Load agents and mirror to JSON (filtered by template's subAgentIds if provided)
  const { subAgents } = await loadAgents(agentRoots, agentIdsToLoad);
  debugLog('Mirroring agents', { agentRoots, agentCount: subAgents.length, filtered: !!agentIdsToLoad });
  await mirrorAgentsToJson(agentsDir, subAgents, agentRoots);
}
