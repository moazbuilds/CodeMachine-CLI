/**
 * Controller Agent Initialization
 *
 * Initializes a controller agent session for workflow orchestration.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { ControllerConfig } from './types.js';
import type { InitControllerOptions, InitControllerResult } from './types.js';
import { executeAgent } from '../../agents/runner/runner.js';
import { AgentMonitorService } from '../../agents/monitoring/index.js';
import { processPromptString } from '../../shared/prompts/index.js';
import { debug } from '../../shared/logging/logger.js';
import { saveControllerConfig } from './config.js';
import { resolvePromptPath } from '../../shared/imports/index.js';
import { getDevRoot } from '../../shared/runtime/dev.js';

const localRoot = getDevRoot() || '';

/**
 * Initialize controller agent session
 * Called at onboard time to create persistent session for the workflow
 *
 * Engine/model resolution happens inside executeAgent (single source of truth).
 * Returns resolved values from MonitorService for TUI display.
 */
export async function initControllerAgent(
  agentId: string,
  promptPath: string | string[],
  cwd: string,
  cmRoot: string,
  options?: InitControllerOptions
): Promise<InitControllerResult> {
  debug('[Controller] initControllerAgent called: agentId=%s promptPath=%o cwd=%s cmRoot=%s', agentId, promptPath, cwd, cmRoot);

  // Handle both single path and array of paths
  const promptPaths = Array.isArray(promptPath) ? promptPath : [promptPath];
  debug('[Controller] Prompt paths to load: %o', promptPaths);

  // Load and combine all prompt files - check imports first, then cwd
  const promptParts: string[] = [];
  for (const p of promptPaths) {
    let resolvedPath: string;
    if (path.isAbsolute(p)) {
      resolvedPath = p;
    } else {
      // Try to resolve from imports first
      const importResolved = resolvePromptPath(p, localRoot);
      resolvedPath = importResolved ?? path.resolve(cwd, p);
    }
    debug('[Controller] Resolved prompt path: %s', resolvedPath);

    const promptExists = existsSync(resolvedPath);
    debug('[Controller] Prompt file exists: %s', promptExists);
    if (!promptExists) {
      throw new Error(`Prompt file not found: ${resolvedPath} (checked imports and cwd)`);
    }

    const content = await readFile(resolvedPath, 'utf8');
    debug('[Controller] Read prompt file %s, length=%d', resolvedPath, content.length);
    promptParts.push(content);
  }

  const rawPrompt = promptParts.join('\n\n');
  debug('[Controller] Combined raw prompt, length=%d', rawPrompt.length);
  const prompt = await processPromptString(rawPrompt, cwd);
  debug('[Controller] Processed prompt, length=%d', prompt.length);

  // Execute agent via normal flow (creates monitoring entry, session, etc.)
  debug('[Controller] Calling executeAgent...');

  // Create UI interface to capture monitoring ID early (for log streaming)
  const ui = options?.onMonitoringId ? {
    registerMonitoringId: (_uiAgentId: string, monitoringAgentId: number) => {
      debug('[Controller] Received monitoringId=%d, invoking callback', monitoringAgentId);
      options.onMonitoringId!(monitoringAgentId);
    }
  } : undefined;

  const result = await executeAgent(agentId, prompt, {
    workingDir: cwd,
    ui,
    uniqueAgentId: agentId, // Required for ui callback to work
    engine: options?.engineOverride,
    model: options?.modelOverride,
    onTelemetry: options?.onTelemetry,
  });
  debug('[Controller] executeAgent returned: agentId=%s', result.agentId);

  // Get sessionId from monitoring service
  const monitor = AgentMonitorService.getInstance();
  const agent = monitor.getAgent(result.agentId!);
  debug('[Controller] Monitor agent: %o', agent ? { id: agent.id, sessionId: agent.sessionId } : null);

  if (!agent?.sessionId) {
    debug('[Controller] ERROR: No session ID for controller agent');
    throw new Error(`Failed to get session ID for controller agent: ${agentId}`);
  }

  // Get resolved engine/model from monitoring service (single source of truth)
  const resolvedEngine = agent.engine ?? 'claude';
  const resolvedModel = agent.modelName;
  debug('[Controller] Resolved engine=%s model=%s from MonitorService', resolvedEngine, resolvedModel);

  // Build config for persistence (engine/model NOT saved - read from MonitorService)
  const config: ControllerConfig = {
    agentId,
    sessionId: agent.sessionId,
    monitoringId: result.agentId!,
  };
  debug('[Controller] Built config: %o', config);

  // Save to template.json
  debug('[Controller] Saving controller config to template.json...');
  await saveControllerConfig(cmRoot, config);
  debug('[Controller] Controller config saved successfully');

  // Return includes engine/model from MonitorService for UI display
  return {
    ...config,
    engine: resolvedEngine,
    model: resolvedModel,
  };
}
