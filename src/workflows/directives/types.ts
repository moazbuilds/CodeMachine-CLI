/**
 * Directive Types
 *
 * Actions that agents can issue via directive.json
 */

export interface DirectiveAction {
  action: 'loop' | 'checkpoint' | 'continue' | 'trigger' | 'stop' | 'error' | 'pause';
  reason?: string;
  triggerAgentId?: string; // Required when action is 'trigger'
}
