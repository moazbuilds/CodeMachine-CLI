/**
 * Controller Resolver
 *
 * Creates ModuleStep objects for controller agents used in pre-workflow
 * conversation steps. Controllers are agents with role: 'controller' in
 * the main agents config.
 */

import type { ModuleStep } from '../../templates/types.js';
import type { StepOverrides } from '../types.js';
import { getMainAgents, type AgentConfig } from '../config.js';

/**
 * Get controller agents from the main agents config
 * Controllers are agents with role: 'controller'
 */
export function getControllerAgents(): AgentConfig[] {
    return getMainAgents().filter((agent) => agent.type === 'controller' || agent.role === 'controller');
}

/**
 * Create a controller ModuleStep for use in workflow templates.
 *
 * Usage in workflow template:
 * ```javascript
 * import { controller } from 'codemachine/workflows/utils';
 *
 * export default {
 *   name: 'BMAD Method',
 *   controller: controller('bmad-po', { engine: 'codex' }),
 *   steps: [...]
 * }
 * ```
 *
 * @param controllerId - Agent ID of the controller (e.g., 'bmad-po')
 * @param overrides - Optional overrides for engine, model, etc.
 * @returns ModuleStep with type: 'controller'
 */
export function controller(
    controllerId: string,
    overrides: StepOverrides = {}
): ModuleStep {
    const controllerAgents = getControllerAgents();
    const agent = controllerAgents.find((entry) => entry?.id === controllerId);

    if (!agent) {
        // Also check main agents in case controller doesn't have role set
        const mainAgents = getMainAgents();
        const mainAgent = mainAgents.find((entry) => entry?.id === controllerId);

        if (!mainAgent) {
            throw new Error(`Unknown controller agent: ${controllerId}`);
        }

        // Use main agent but warn that it doesn't have controller role
        console.warn(
            `Agent "${controllerId}" is being used as controller but doesn't have role: 'controller'. ` +
            `Consider adding role: 'controller' to the agent config.`
        );

        return buildControllerStep(mainAgent, overrides);
    }

    return buildControllerStep(agent, overrides);
}

/**
 * Build a ModuleStep from an agent config
 */
function buildControllerStep(agent: AgentConfig, overrides: StepOverrides): ModuleStep {
    const agentName = overrides.agentName ?? agent.name;
    const promptPath = overrides.promptPath ?? agent.promptPath;
    const model = overrides.model ?? agent.model;

    const promptPathMissing = Array.isArray(promptPath)
        ? promptPath.length === 0 || promptPath.some((p) => typeof p !== 'string' || p.trim() === '')
        : typeof promptPath !== 'string' || promptPath?.trim() === '';

    if (!agentName || promptPathMissing) {
        throw new Error(`Controller agent ${agent.id} is missing required fields (name or promptPath)`);
    }

    const safePromptPath = promptPath as string | string[];

    return {
        type: 'controller',
        agentId: agent.id,
        agentName,
        promptPath: safePromptPath,
        model,
        modelReasoningEffort: (overrides.modelReasoningEffort ?? agent.modelReasoningEffort) as
            | 'low'
            | 'medium'
            | 'high'
            | undefined,
        engine: overrides.engine ?? agent.engine,
    };
}
