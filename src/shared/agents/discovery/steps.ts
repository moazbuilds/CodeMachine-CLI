import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

import { loadWorkflowModule, isWorkflowTemplate } from '../../../workflows/index.js';
import { getAllWorkflowDirectories } from '../../imports/index.js';
import { otel_debug } from '../../logging/logger.js';
import { LOGGER_NAMES } from '../../logging/otel-logger.js';

export type WorkflowAgentDefinition = {
  id: string;
  name?: string;
  promptPath?: string | string[];
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
};

function discoverWorkflowFiles(root: string): string[] {
  const baseDir = path.resolve(root, 'templates', 'workflows');
  if (!existsSync(baseDir)) {
    return [];
  }

  return readdirSync(baseDir)
    .filter((file) => file.endsWith('.workflow.js'))
    .map((file) => path.resolve(baseDir, file));
}

/**
 * Discover workflow files from all workflow directories including imports
 */
function discoverAllWorkflowFiles(localRoot: string): string[] {
  const allFiles: string[] = [];
  const seenDirs = new Set<string>();

  // Get all workflow directories (imports + local)
  const workflowDirs = getAllWorkflowDirectories(localRoot);

  for (const dir of workflowDirs) {
    if (seenDirs.has(dir) || !existsSync(dir)) continue;
    seenDirs.add(dir);

    const files = readdirSync(dir)
      .filter((file) => file.endsWith('.workflow.js'))
      .map((file) => path.resolve(dir, file));
    allFiles.push(...files);
  }

  return allFiles;
}

export async function collectAgentsFromWorkflows(roots: string[]): Promise<WorkflowAgentDefinition[]> {
  otel_debug(LOGGER_NAMES.CLI, '[collectAgentsFromWorkflows] Called with roots=%O', [roots]);

  const seenFiles = new Set<string>();
  const byId = new Map<string, WorkflowAgentDefinition>();

  // Collect workflow files from all roots
  const allWorkflowFiles: string[] = [];

  for (const root of roots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);

    // Use both traditional discovery and import-aware discovery
    for (const filePath of discoverWorkflowFiles(resolvedRoot)) {
      allWorkflowFiles.push(filePath);
    }
  }

  // Also discover from all import directories (handles case where imports aren't in roots)
  if (roots.length > 0) {
    const importFiles = discoverAllWorkflowFiles(roots[0]);
    allWorkflowFiles.push(...importFiles);
  }

  otel_debug(LOGGER_NAMES.CLI, '[collectAgentsFromWorkflows] Total workflow files to process: %d', [allWorkflowFiles.length]);

  // Process all discovered workflow files
  for (const filePath of allWorkflowFiles) {
    if (seenFiles.has(filePath)) {
      otel_debug(LOGGER_NAMES.CLI, '[collectAgentsFromWorkflows] Skipping already seen file: %s', [filePath]);
      continue;
    }
    seenFiles.add(filePath);

    try {
      otel_debug(LOGGER_NAMES.CLI, '[collectAgentsFromWorkflows] Loading workflow: %s', [filePath]);
      const template = await loadWorkflowModule(filePath);
      if (!isWorkflowTemplate(template)) {
        otel_debug(LOGGER_NAMES.CLI, '[collectAgentsFromWorkflows] Not a valid workflow template: %s', [filePath]);
        continue;
      }

      otel_debug(LOGGER_NAMES.CLI, '[collectAgentsFromWorkflows] Processing template %s with %d steps', [template.name, template.steps?.length ?? 0]);

      for (const step of template.steps ?? []) {
        if (!step || step.type !== 'module') {
          continue;
        }

        const id = typeof step.agentId === 'string' ? step.agentId.trim() : '';
        if (!id) {
          continue;
        }

        otel_debug(LOGGER_NAMES.CLI, '[collectAgentsFromWorkflows] Found agent in workflow: id=%s', [id]);

        const existing = byId.get(id) ?? { id };
        byId.set(id, {
          ...existing,
          id,
          name: step.agentName ?? existing.name,
          promptPath: step.promptPath ?? existing.promptPath,
          model: step.model ?? existing.model,
          modelReasoningEffort: step.modelReasoningEffort ?? existing.modelReasoningEffort,
        });
      }
    } catch (err) {
      otel_debug(LOGGER_NAMES.CLI, '[collectAgentsFromWorkflows] Error loading workflow %s: %s', [filePath, err]);
      // Ignore templates that fail to load; other files might still provide definitions.
    }
  }

  otel_debug(LOGGER_NAMES.CLI, '[collectAgentsFromWorkflows] Returning %d agents: %O', [byId.size, Array.from(byId.keys())]);
  return Array.from(byId.values());
}
