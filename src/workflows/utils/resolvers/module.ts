import type { ModuleOverrides, WorkflowStep, LoopBehaviorConfig } from '../types.js';
import { moduleCatalog, type ModuleBehaviorConfig } from '../config.js';

function resolveLoopBehavior(
  base: ModuleBehaviorConfig | undefined,
  overrides: ModuleOverrides,
): LoopBehaviorConfig | undefined {
  if (!base || base.type !== 'loop' || base.action !== 'stepBack') {
    return undefined;
  }

  // Trigger is now optional - controlled via .codemachine/memory/directive.json
  const trigger = typeof base.trigger === 'string' ? base.trigger : undefined;

  const overrideSteps = typeof overrides.loopSteps === 'number' ? overrides.loopSteps : undefined;
  const baseSteps = typeof base.steps === 'number' ? base.steps : undefined;
  const stepsCandidate = overrideSteps ?? baseSteps ?? 1;
  const steps = stepsCandidate > 0 ? Math.floor(stepsCandidate) : 1;
  const maxIterationsCandidate = overrides.loopMaxIterations ?? base.maxIterations;
  const maxIterations = typeof maxIterationsCandidate === 'number' && maxIterationsCandidate > 0
    ? Math.floor(maxIterationsCandidate)
    : undefined;

  return {
    type: 'loop',
    action: 'stepBack',
    steps,
    trigger,
    maxIterations,
    skip: overrides.loopSkip ?? base.skip,
  };
}

export function resolveModule(id: string, overrides: ModuleOverrides = {}): WorkflowStep {
  const moduleEntry = moduleCatalog.find((entry) => entry?.id === id);

  if (!moduleEntry) {
    throw new Error(`Unknown workflow module: ${id}`);
  }

  const agentName = overrides.agentName ?? moduleEntry.name ?? moduleEntry.id;
  const promptPath = overrides.promptPath ?? moduleEntry.promptPath;
  const model = overrides.model ?? moduleEntry.model;
  const modelReasoningEffort = overrides.modelReasoningEffort ?? moduleEntry.modelReasoningEffort;
  const engine = overrides.engine ?? moduleEntry.engine;

  const promptPathInvalid = Array.isArray(promptPath)
    ? promptPath.length === 0 || promptPath.some(p => typeof p !== 'string' || p.trim() === '')
    : typeof promptPath !== 'string' || !promptPath.trim();

  if (promptPathInvalid) {
    throw new Error(`Module ${id} is missing a promptPath configuration.`);
  }

  const safePromptPath = promptPath as string | string[];

  const behavior = resolveLoopBehavior(moduleEntry.behavior, overrides);

  return {
    type: 'module',
    agentId: moduleEntry.id,
    agentName,
    promptPath: safePromptPath,
    model,
    modelReasoningEffort,
    engine,
    executeOnce: overrides.executeOnce,
    interactive: overrides.interactive,
    tracks: overrides.tracks ?? moduleEntry.tracks as string[] | undefined,
    conditions: overrides.conditions ?? moduleEntry.conditions as string[] | undefined,
    conditionsAny: overrides.conditionsAny ?? moduleEntry.conditionsAny as string[] | undefined,
    module: {
      id: moduleEntry.id,
      behavior,
    },
  };
}
