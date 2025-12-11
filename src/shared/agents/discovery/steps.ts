import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

import { loadWorkflowModule, isWorkflowTemplate } from '../../../workflows/index.js';

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

export async function collectAgentsFromWorkflows(roots: string[]): Promise<WorkflowAgentDefinition[]> {
  const seenFiles = new Set<string>();
  const byId = new Map<string, WorkflowAgentDefinition>();

  for (const root of roots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);
    for (const filePath of discoverWorkflowFiles(resolvedRoot)) {
      if (seenFiles.has(filePath)) continue;
      seenFiles.add(filePath);

      try {
        const template = await loadWorkflowModule(filePath);
        if (!isWorkflowTemplate(template)) {
          continue;
        }

        for (const step of template.steps ?? []) {
          if (!step || step.type !== 'module') {
            continue;
          }

          const id = typeof step.agentId === 'string' ? step.agentId.trim() : '';
          if (!id) {
            continue;
          }

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
      } catch {
        // Ignore templates that fail to load; other files might still provide definitions.
      }
    }
  }

  return Array.from(byId.values());
}
