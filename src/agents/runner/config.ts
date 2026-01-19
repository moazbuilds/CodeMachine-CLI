import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { collectAgentDefinitions, resolveProjectRoot } from '../../shared/agents/index.js';
import type { AgentDefinition } from '../../shared/agents/config/types.js';
import { resolvePromptPath, getAllInstalledImports } from '../../shared/imports/index.js';
import { resolvePackageRoot } from '../../shared/runtime/root.js';

const packageRoot = resolvePackageRoot(import.meta.url, 'agent runner config');

export type AgentConfig = AgentDefinition & {
  name: string;
  description?: string;
  promptPath?: string | string[];
};

/**
 * Slugify a string to create a valid filename
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Generate the default prompt path based on agent ID
 */
function getDefaultPromptPath(agentId: string): string {
  const slugBase = slugify(agentId) || 'agent';
  return path.join('.codemachine', 'agents', `${slugBase}.md`);
}

/**
 * Loads the agent configuration by ID from all available agent files
 * Supports both raw IDs and namespaced IDs (e.g., 'bmad-pm' or 'bmad:bmad-pm')
 */
export async function loadAgentConfig(agentId: string, projectRoot?: string): Promise<AgentConfig> {
  const lookupBase = projectRoot ?? process.env.CODEMACHINE_CWD ?? process.cwd();
  const resolvedRoot = resolveProjectRoot(lookupBase);

  // Collect all agent definitions from all config files
  const agents = await collectAgentDefinitions(resolvedRoot);

  // Try direct lookup first
  let config = agents.find((a) => a.id === agentId) as AgentConfig | undefined;

  // If not found, try looking up with import namespaces prefixed
  // This handles cases where workflow templates reference agents by raw ID
  // but agents are registered with namespace (e.g., 'bmad-pm' -> 'bmad:bmad-pm')
  if (!config) {
    const imports = getAllInstalledImports();
    for (const imp of imports) {
      const namespacedId = `${imp.name}:${agentId}`;
      config = agents.find((a) => a.id === namespacedId) as AgentConfig | undefined;
      if (config) {
        break;
      }
    }
  }

  if (!config) {
    throw new Error(`Unknown agent id: ${agentId}. Available agents: ${agents.map(a => a.id).join(', ')}`);
  }

  return config;
}

/**
 * Loads the agent prompt template
 */
export async function loadAgentTemplate(agentId: string, projectRoot?: string): Promise<string> {
  const config = await loadAgentConfig(agentId, projectRoot);
  const lookupBase = projectRoot ?? process.env.CODEMACHINE_CWD ?? process.cwd();
  const resolvedRoot = resolveProjectRoot(lookupBase);

  // Use config.promptPath if provided, otherwise generate default path from agent ID
  const configuredPath = config.promptPath ?? getDefaultPromptPath(agentId);
  const promptSources = Array.isArray(configuredPath) ? configuredPath : [configuredPath];

  if (promptSources.length === 0) {
    throw new Error(`Agent ${agentId} has an empty promptPath configuration`);
  }
  if (promptSources.some(p => typeof p !== 'string' || p.trim() === '')) {
    throw new Error(`Agent ${agentId} has an invalid promptPath configuration`);
  }

  // If path is absolute, use it directly; otherwise check imports first, then project root
  const resolvedPromptPaths = promptSources.map(p => {
    if (path.isAbsolute(p)) return p;

    // Try to resolve from imports first
    const importResolved = resolvePromptPath(p, packageRoot);
    if (importResolved) return importResolved;

    // Fall back to project root
    return path.resolve(resolvedRoot, p);
  });

  const contentParts = await Promise.all(
    resolvedPromptPaths.map(promptPath => fs.readFile(promptPath, 'utf-8')),
  );
  return contentParts.join('\n\n');
}
