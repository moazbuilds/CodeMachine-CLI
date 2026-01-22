import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

import { loadWorkflowModule, isWorkflowTemplate } from '../../../workflows/index.js';
import { getAllWorkflowDirectories } from '../../imports/index.js';
import { appDebug } from '../../logging/logger.js';

export type WorkflowAgentDefinition = {
  id: string;
  name?: string;
  promptPath?: string | string[];
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
};

/**
 * Workflow file with source metadata for namespacing
 */
interface WorkflowFileWithSource {
  filePath: string;
  packageName: string | null;
}

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
 * Returns files with their source package name for namespacing
 */
function discoverAllWorkflowFilesWithSource(
  localRoot: string,
  importPathToPackage: Map<string, string>
): WorkflowFileWithSource[] {
  const allFiles: WorkflowFileWithSource[] = [];
  const seenDirs = new Set<string>();

  // Get all workflow directories (imports + local)
  const workflowDirs = getAllWorkflowDirectories(localRoot);

  for (const dir of workflowDirs) {
    if (seenDirs.has(dir) || !existsSync(dir)) continue;
    seenDirs.add(dir);

    // Determine package name by checking if this dir is under an import root
    let packageName: string | null = null;
    for (const [importPath, pkgName] of importPathToPackage) {
      if (dir.startsWith(importPath)) {
        packageName = pkgName;
        break;
      }
    }

    const files = readdirSync(dir)
      .filter((file) => file.endsWith('.workflow.js'))
      .map((file) => ({
        filePath: path.resolve(dir, file),
        packageName,
      }));
    allFiles.push(...files);
  }

  return allFiles;
}

/**
 * Collect agent definitions from workflow templates
 * @param roots - Root directories to search for workflows
 * @param importPathToPackage - Map from import path to package name for namespacing (optional)
 */
export async function collectAgentsFromWorkflows(
  roots: string[],
  importPathToPackage?: Map<string, string>
): Promise<WorkflowAgentDefinition[]> {
  appDebug('[collectAgentsFromWorkflows] Called with roots=%O', roots);

  const seenFiles = new Set<string>();
  const byId = new Map<string, WorkflowAgentDefinition>();
  const pathToPackage = importPathToPackage ?? new Map<string, string>();

  appDebug('[collectAgentsFromWorkflows] pathToPackage size=%d', pathToPackage.size);

  // Collect workflow files from all roots with source tracking
  const allWorkflowFiles: WorkflowFileWithSource[] = [];

  for (const root of roots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);

    // Determine package name for this root
    const packageName = pathToPackage.get(resolvedRoot) ?? null;
    appDebug('[collectAgentsFromWorkflows] Scanning root=%s, packageName=%s', resolvedRoot, packageName);

    // Use traditional discovery for this root
    const discoveredFiles = discoverWorkflowFiles(resolvedRoot);
    appDebug('[collectAgentsFromWorkflows] Discovered %d workflow files from %s', discoveredFiles.length, resolvedRoot);

    for (const filePath of discoveredFiles) {
      allWorkflowFiles.push({ filePath, packageName });
    }
  }

  // Also discover from all import directories with source tracking
  if (roots.length > 0) {
    appDebug('[collectAgentsFromWorkflows] Discovering from import directories...');
    const importFiles = discoverAllWorkflowFilesWithSource(roots[0], pathToPackage);
    appDebug('[collectAgentsFromWorkflows] Found %d import workflow files', importFiles.length);
    allWorkflowFiles.push(...importFiles);
  }

  appDebug('[collectAgentsFromWorkflows] Total workflow files to process: %d', allWorkflowFiles.length);

  // Process all discovered workflow files
  for (const { filePath, packageName } of allWorkflowFiles) {
    if (seenFiles.has(filePath)) {
      appDebug('[collectAgentsFromWorkflows] Skipping already seen file: %s', filePath);
      continue;
    }
    seenFiles.add(filePath);

    try {
      appDebug('[collectAgentsFromWorkflows] Loading workflow: %s', filePath);
      const template = await loadWorkflowModule(filePath);
      if (!isWorkflowTemplate(template)) {
        appDebug('[collectAgentsFromWorkflows] Not a valid workflow template: %s', filePath);
        continue;
      }

      appDebug('[collectAgentsFromWorkflows] Processing template %s with %d steps', template.name, template.steps?.length ?? 0);

      for (const step of template.steps ?? []) {
        if (!step || step.type !== 'module') {
          continue;
        }

        const rawId = typeof step.agentId === 'string' ? step.agentId.trim() : '';
        if (!rawId) {
          continue;
        }

        // Namespace the ID if from an imported package
        const id = packageName ? `${packageName}:${rawId}` : rawId;
        appDebug('[collectAgentsFromWorkflows] Found agent in workflow: rawId=%s, id=%s, packageName=%s', rawId, id, packageName);

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
      appDebug('[collectAgentsFromWorkflows] Error loading workflow %s: %s', filePath, err);
      // Ignore templates that fail to load; other files might still provide definitions.
    }
  }

  appDebug('[collectAgentsFromWorkflows] Returning %d agents: %O', byId.size, Array.from(byId.keys()));
  return Array.from(byId.values());
}
