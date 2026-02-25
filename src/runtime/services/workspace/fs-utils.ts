import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import type { AgentDefinition } from './discovery.js';
import { debug, warn, error, otel_debug, otel_warn } from '../../../shared/logging/logger.js';
import { LOGGER_NAMES } from '../../../shared/logging/otel-logger.js';

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeFileIfChanged(filePath: string, content: string): Promise<void> {
  try {
    const existing = await readFile(filePath, 'utf8');
    if (existing === content) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await writeFile(filePath, content, 'utf8');
}

export async function ensurePromptFile(filePath: string): Promise<void> {
  try {
    await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await writeFile(filePath, '', 'utf8');
  }
}

export async function copyPromptFile(sourcePath: string, targetPath: string): Promise<void> {
  try {
    const content = await readFile(sourcePath, 'utf8');
    await writeFile(targetPath, content, 'utf8');
    debug(`[workspace] Copied template file from ${sourcePath} to ${targetPath}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      warn(`[workspace] Template file not found: ${sourcePath}, creating empty file instead`);
      await writeFile(targetPath, '', 'utf8');
    } else {
      error(`[workspace] Error copying template file from ${sourcePath}:`, err);
      throw err;
    }
  }
}

export function slugify(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function mirrorAgentsToJson(
  agentsDir: string,
  agents: AgentDefinition[],
  searchRoots: string[]
): Promise<void> {
  otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Called with agentsDir=%s, agents count=%d, searchRoots=%O', [agentsDir, agents.length, searchRoots]);

  await ensureDir(agentsDir);

  const normalizedAgents = await Promise.all(
    agents.map(async (agent) => {
      const rawId = agent.id ?? agent.name ?? 'agent';
      const slugBase = slugify(String(rawId)) || 'agent';
      const filename = `${slugBase}.md`;
      const promptFile = path.join(agentsDir, filename);

      otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Processing agent rawId=%s, slugBase=%s, mirrorPath=%s', [rawId, slugBase, agent.mirrorPath]);

      // Check if agent has a mirrorPath for template mirroring
      if (agent.mirrorPath && typeof agent.mirrorPath === 'string') {
        otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Agent %s has mirrorPath=%s, searching in roots...', [rawId, agent.mirrorPath]);

        // Try to resolve mirrorPath against each search root until we find the file
        let foundSource: string | undefined;
        for (const root of searchRoots) {
          const candidatePath = path.resolve(root, agent.mirrorPath);
          otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Trying candidatePath=%s', [candidatePath]);
          try {
            await readFile(candidatePath, 'utf8');
            foundSource = candidatePath;
            otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Found source at %s', [foundSource]);
            break;
          } catch (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') {
              otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Candidate missing at %s', [candidatePath]);
            } else {
              otel_warn(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Failed to read candidatePath=%s; trying next root', [candidatePath]);
            }
          }
        }

        if (foundSource) {
          otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Copying from %s to %s', [foundSource, promptFile]);
          await copyPromptFile(foundSource, promptFile);
        } else {
          otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Template file not found in any search root: %s', [agent.mirrorPath]);
          console.warn(`[workspace] Template file not found in any search root: ${agent.mirrorPath}`);
          await ensurePromptFile(promptFile);
        }
      } else {
        otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Agent %s has no mirrorPath, creating empty prompt file', [rawId]);
        await ensurePromptFile(promptFile);
      }

      // Remove mirrorPath from the saved config as it's only used during initialization
      const { mirrorPath: _mirrorPath, promptPath: _promptPath, ...cleanAgent } = agent;
      return cleanAgent;
    }),
  );

  const target = path.join(agentsDir, 'agents-config.json');
  otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Writing agents-config.json to %s with %d agents', [target, normalizedAgents.length]);
  const json = `${JSON.stringify(normalizedAgents, null, 2)}\n`;
  await writeFileIfChanged(target, json);
  otel_debug(LOGGER_NAMES.BOOT, '[mirrorAgentsToJson] Completed', []);
}
