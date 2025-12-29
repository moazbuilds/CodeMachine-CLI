export interface StepOverrides {
  agentName?: string;
  promptPath?: string | string[];
  model?: string;
  modelReasoningEffort?: string;
  engine?: string; // Dynamic engine type from registry
  executeOnce?: boolean;
  interactive?: boolean; // Controls waiting behavior: true=wait for input, false=auto-advance
  tracks?: string[]; // Track names this step belongs to (e.g., ['bmad', 'enterprise'])
  conditions?: string[]; // Conditions required for this step (e.g., ['has_ui', 'has_api'])
}

export interface WorkflowStep {
  type: string;
  agentId: string;
  agentName: string;
  promptPath: string | string[];
  model?: string;
  modelReasoningEffort?: string;
  engine?: string; // Dynamic engine type from registry
  module?: ModuleMetadata;
  executeOnce?: boolean;
  interactive?: boolean; // Controls waiting behavior: true=wait for input, false=auto-advance
  tracks?: string[]; // Track names this step belongs to (e.g., ['bmad', 'enterprise'])
  conditions?: string[]; // Conditions required for this step (e.g., ['has_ui', 'has_api'])
}

export interface LoopBehaviorConfig {
  type: 'loop';
  action: 'stepBack';
  steps: number;
  trigger?: string; // Optional: now controlled via .codemachine/memory/directive.json
  maxIterations?: number;
  skip?: string[];
}

export interface ModuleMetadata {
  id: string;
  behavior?: LoopBehaviorConfig;
}

export interface ModuleOverrides extends StepOverrides {
  loopSteps?: number;
  loopMaxIterations?: number;
  loopSkip?: string[];
}
