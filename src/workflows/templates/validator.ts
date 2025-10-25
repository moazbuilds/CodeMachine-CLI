import type { WorkflowTemplate } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateWorkflowTemplate(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') {
    return { valid: false, errors: ['Template is not an object'] };
  }

  const obj = value as { name?: unknown; steps?: unknown };
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    errors.push('Template.name must be a non-empty string');
  }
  if (!Array.isArray(obj.steps)) {
    errors.push('Template.steps must be an array');
  } else {
    obj.steps.forEach((step, index) => {
      if (!step || typeof step !== 'object') {
        errors.push(`Step[${index}] must be an object`);
        return;
      }
      const candidate = step as {
        type?: unknown;
        agentId?: unknown;
        agentName?: unknown;
        promptPath?: unknown;
        model?: unknown;
        modelReasoningEffort?: unknown;
        module?: unknown;
        executeOnce?: unknown;
        text?: unknown;
      };

      // Validate step type
      if (candidate.type !== 'module' && candidate.type !== 'ui') {
        errors.push(`Step[${index}].type must be 'module' or 'ui'`);
      }

      // Validate UI step
      if (candidate.type === 'ui') {
        if (typeof candidate.text !== 'string' || (candidate.text as string).trim().length === 0) {
          errors.push(`Step[${index}].text must be a non-empty string`);
        }
        // UI steps don't need other validation
        return;
      }

      // Validate module step
      if (candidate.type === 'module') {
        if (typeof candidate.agentId !== 'string') {
          errors.push(`Step[${index}].agentId must be a string`);
        }
        if (typeof candidate.agentName !== 'string') {
          errors.push(`Step[${index}].agentName must be a string`);
        }
        if (typeof candidate.promptPath !== 'string') {
          errors.push(`Step[${index}].promptPath must be a string`);
        }

        if (candidate.model !== undefined && typeof candidate.model !== 'string') {
          errors.push(`Step[${index}].model must be a string`);
        }

        if (candidate.modelReasoningEffort !== undefined) {
          const mre = candidate.modelReasoningEffort;
          if (mre !== 'low' && mre !== 'medium' && mre !== 'high') {
            errors.push(
              `Step[${index}].modelReasoningEffort must be one of 'low'|'medium'|'high' (got '${String(mre)}')`,
            );
          }
        }

        if (candidate.executeOnce !== undefined && typeof candidate.executeOnce !== 'boolean') {
          errors.push(`Step[${index}].executeOnce must be a boolean`);
        }

        if (candidate.module !== undefined) {
          if (!candidate.module || typeof candidate.module !== 'object') {
            errors.push(`Step[${index}].module must be an object`);
          } else {
            const moduleMeta = candidate.module as { id?: unknown; behavior?: unknown };
            if (typeof moduleMeta.id !== 'string') {
              errors.push(`Step[${index}].module.id must be a string`);
            }
            if (moduleMeta.behavior !== undefined) {
              if (!moduleMeta.behavior || typeof moduleMeta.behavior !== 'object') {
                errors.push(`Step[${index}].module.behavior must be an object`);
              } else {
                const behavior = moduleMeta.behavior as {
                  type?: unknown;
                  action?: unknown;
                  steps?: unknown;
                  trigger?: unknown;
                  maxIterations?: unknown;
                };
                if (behavior.type !== 'loop' || behavior.action !== 'stepBack') {
                  errors.push(`Step[${index}].module.behavior must be { type: 'loop', action: 'stepBack', ... }`);
                }
                if (typeof behavior.steps !== 'number' || behavior.steps <= 0) {
                  errors.push(`Step[${index}].module.behavior.steps must be a positive number`);
                }
                if (behavior.trigger !== undefined && typeof behavior.trigger !== 'string') {
                  errors.push(`Step[${index}].module.behavior.trigger must be a string if provided`);
                }
                if (behavior.maxIterations !== undefined && typeof behavior.maxIterations !== 'number') {
                  errors.push(`Step[${index}].module.behavior.maxIterations must be a number`);
                }
              }
            }
          }
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function isWorkflowTemplate(value: unknown): value is WorkflowTemplate {
  return validateWorkflowTemplate(value).valid;
}
