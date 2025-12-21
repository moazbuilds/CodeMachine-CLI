import type { WorkflowTemplate } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isValidPromptPath(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0 && value.every(item => typeof item === 'string' && item.trim().length > 0);
  }

  return false;
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
        if (!isValidPromptPath(candidate.promptPath)) {
          errors.push(`Step[${index}].promptPath must be a non-empty string or array of non-empty strings`);
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

  // Validate tracks if provided
  const tracks = (obj as { tracks?: unknown }).tracks;
  if (tracks !== undefined) {
    if (!tracks || typeof tracks !== 'object' || Array.isArray(tracks)) {
      errors.push('Template.tracks must be an object with question and options');
    } else {
      const t = tracks as { question?: unknown; options?: unknown };
      if (typeof t.question !== 'string' || t.question.trim().length === 0) {
        errors.push('Template.tracks.question must be a non-empty string');
      }
      if (!t.options || typeof t.options !== 'object' || Array.isArray(t.options)) {
        errors.push('Template.tracks.options must be an object');
      } else {
        Object.entries(t.options).forEach(([trackId, config]) => {
          if (!config || typeof config !== 'object') {
            errors.push(`Template.tracks.options.${trackId} must be an object`);
          } else {
            const c = config as { label?: unknown };
            if (typeof c.label !== 'string') {
              errors.push(`Template.tracks.options.${trackId}.label must be a string`);
            }
          }
        });
      }
    }
  }

  // Validate conditionGroups if provided
  const conditionGroups = (obj as { conditionGroups?: unknown }).conditionGroups;
  if (conditionGroups !== undefined) {
    if (!Array.isArray(conditionGroups)) {
      errors.push('Template.conditionGroups must be an array');
    } else {
      conditionGroups.forEach((group, gIndex) => {
        if (!group || typeof group !== 'object') {
          errors.push(`conditionGroups[${gIndex}] must be an object`);
          return;
        }
        const g = group as {
          id?: unknown;
          question?: unknown;
          multiSelect?: unknown;
          tracks?: unknown;
          conditions?: unknown;
          children?: unknown;
        };

        if (typeof g.id !== 'string' || g.id.trim().length === 0) {
          errors.push(`conditionGroups[${gIndex}].id must be a non-empty string`);
        }
        if (typeof g.question !== 'string' || g.question.trim().length === 0) {
          errors.push(`conditionGroups[${gIndex}].question must be a non-empty string`);
        }
        if (g.multiSelect !== undefined && typeof g.multiSelect !== 'boolean') {
          errors.push(`conditionGroups[${gIndex}].multiSelect must be a boolean`);
        }
        if (g.tracks !== undefined) {
          if (!Array.isArray(g.tracks)) {
            errors.push(`conditionGroups[${gIndex}].tracks must be an array`);
          } else if (!g.tracks.every(t => typeof t === 'string')) {
            errors.push(`conditionGroups[${gIndex}].tracks must be an array of strings`);
          }
        }

        // Validate conditions
        if (!g.conditions || typeof g.conditions !== 'object' || Array.isArray(g.conditions)) {
          errors.push(`conditionGroups[${gIndex}].conditions must be an object`);
        } else {
          Object.entries(g.conditions).forEach(([condId, config]) => {
            if (!config || typeof config !== 'object') {
              errors.push(`conditionGroups[${gIndex}].conditions.${condId} must be an object`);
            } else {
              const c = config as { label?: unknown };
              if (typeof c.label !== 'string') {
                errors.push(`conditionGroups[${gIndex}].conditions.${condId}.label must be a string`);
              }
            }
          });
        }

        // Validate children if provided
        if (g.children !== undefined) {
          if (!g.children || typeof g.children !== 'object' || Array.isArray(g.children)) {
            errors.push(`conditionGroups[${gIndex}].children must be an object`);
          } else {
            Object.entries(g.children).forEach(([parentCondId, childGroup]) => {
              if (!childGroup || typeof childGroup !== 'object') {
                errors.push(`conditionGroups[${gIndex}].children.${parentCondId} must be an object`);
                return;
              }
              const child = childGroup as {
                question?: unknown;
                multiSelect?: unknown;
                conditions?: unknown;
              };
              if (typeof child.question !== 'string' || child.question.trim().length === 0) {
                errors.push(`conditionGroups[${gIndex}].children.${parentCondId}.question must be a non-empty string`);
              }
              if (child.multiSelect !== undefined && typeof child.multiSelect !== 'boolean') {
                errors.push(`conditionGroups[${gIndex}].children.${parentCondId}.multiSelect must be a boolean`);
              }
              if (!child.conditions || typeof child.conditions !== 'object' || Array.isArray(child.conditions)) {
                errors.push(`conditionGroups[${gIndex}].children.${parentCondId}.conditions must be an object`);
              } else {
                Object.entries(child.conditions).forEach(([condId, config]) => {
                  if (!config || typeof config !== 'object') {
                    errors.push(`conditionGroups[${gIndex}].children.${parentCondId}.conditions.${condId} must be an object`);
                  } else {
                    const c = config as { label?: unknown };
                    if (typeof c.label !== 'string') {
                      errors.push(`conditionGroups[${gIndex}].children.${parentCondId}.conditions.${condId}.label must be a string`);
                    }
                  }
                });
              }
            });
          }
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isWorkflowTemplate(value: unknown): value is WorkflowTemplate {
  return validateWorkflowTemplate(value).valid;
}
