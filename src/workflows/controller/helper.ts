/**
 * Controller Helper
 *
 * Helper function and types for defining controller agents in workflow templates.
 * Provides a clean API for specifying which agent controls the pre-workflow conversation.
 */

/**
 * Options for controller configuration
 */
export interface ControllerOptions {
  /** Engine to use (e.g., 'codex', 'claude', 'gemini') */
  engine?: string;
  /** Model override */
  model?: string;
}

/**
 * Controller definition - returned by the controller() function
 * Used in workflow templates to specify the controller agent
 */
export interface ControllerDefinition {
  /** Type discriminator for type guards */
  readonly type: 'controller';
  /** Agent ID to use as controller */
  readonly agentId: string;
  /** Optional configuration overrides */
  readonly options?: ControllerOptions;
}

/**
 * Define a controller agent for a workflow template
 *
 * @param agentId - The agent ID to use as controller
 * @param options - Optional configuration (engine, model overrides)
 * @returns ControllerDefinition for use in workflow template
 *
 * @example
 * ```js
 * export default {
 *   name: 'My Workflow',
 *   controller: controller('my-controller', { engine: 'codex' }),
 *   steps: [...]
 * }
 * ```
 */
export function controller(agentId: string, options?: ControllerOptions): ControllerDefinition {
  return {
    type: 'controller',
    agentId,
    options,
  };
}

/**
 * Type guard to check if a value is a ControllerDefinition
 */
export function isControllerDefinition(value: unknown): value is ControllerDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ControllerDefinition).type === 'controller' &&
    typeof (value as ControllerDefinition).agentId === 'string'
  );
}
