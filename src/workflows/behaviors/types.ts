export interface BehaviorAction {
  action: 'loop' | 'checkpoint' | 'continue' | 'trigger' | 'stop' | 'error' | 'pause';
  reason?: string;
  triggerAgentId?: string; // Required when action is 'trigger'
}
