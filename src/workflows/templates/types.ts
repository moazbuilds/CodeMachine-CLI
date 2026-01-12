export type UnknownRecord = Record<string, unknown>;

export interface LoopModuleBehavior {
  type: 'loop';
  action: 'stepBack';
  steps: number;
  trigger?: string; // Optional: now controlled via .codemachine/memory/directive.json
  maxIterations?: number;
  skip?: string[];
}

export interface TriggerModuleBehavior {
  type: 'trigger';
  action: 'mainAgentCall';
  triggerAgentId: string; // Agent ID to trigger
}

export interface CheckpointModuleBehavior {
  type: 'checkpoint';
  action: 'evaluate';
}

export type ModuleBehavior = LoopModuleBehavior | TriggerModuleBehavior | CheckpointModuleBehavior;

export interface ModuleMetadata {
  id: string;
  behavior?: ModuleBehavior;
}

export interface ModuleStep {
  type: 'module' | 'controller';  // 'controller' for pre-workflow conversation step
  agentId: string;
  agentName: string;
  promptPath: string | string[];
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
  engine?: string; // Dynamic engine type from registry
  module?: ModuleMetadata;
  executeOnce?: boolean;
  interactive?: boolean; // Controls waiting behavior: true=wait for input, false=auto-advance
  tracks?: string[]; // Track names this step belongs to (e.g., ['bmad', 'enterprise'])
  conditions?: string[]; // Conditions required for this step (e.g., ['has_ui', 'has_api'])
}

export interface Separator {
  type: 'separator';
  text: string;
}

export type WorkflowStep = ModuleStep | Separator;

/**
 * Type guard to check if a step is a ModuleStep (includes both 'module' and 'controller' types)
 */
export function isModuleStep(step: WorkflowStep): step is ModuleStep {
  return step.type === 'module' || step.type === 'controller';
}

/**
 * Type guard to check if a ModuleStep is a controller step
 */
export function isControllerStep(step: ModuleStep): boolean {
  return step.type === 'controller';
}

export interface TrackOption {
  label: string;
  description?: string;
}

export interface TracksConfig {
  question: string;
  options: Record<string, TrackOption>;
}

export interface ConditionConfig {
  label: string;
  description?: string;
}

export interface ChildConditionGroup {
  question: string;
  multiSelect?: boolean; // default: false (radio buttons)
  conditions: Record<string, ConditionConfig>;
}

export interface ConditionGroup {
  id: string;
  question: string;
  multiSelect?: boolean; // default: false (radio buttons)
  tracks?: string[]; // Track IDs this group applies to (empty/missing = all tracks)
  conditions: Record<string, ConditionConfig>;
  children?: Record<string, ChildConditionGroup>; // keyed by parent condition ID
}

export interface WorkflowTemplate {
  name: string;
  steps: WorkflowStep[];
  subAgentIds?: string[];
  tracks?: TracksConfig; // Track selection with question and options
  conditionGroups?: ConditionGroup[]; // Grouped conditions with optional nested children
  controller?: ModuleStep; // Controller agent for pre-workflow conversation (replaces boolean)
  specification?: boolean; // If true, requires specification file before workflow can start
}

export type ModuleName = ModuleStep['agentId'];

export interface RunWorkflowOptions {
  cwd?: string;
  templatePath?: string;
  eventBus?: any; // WorkflowEventBus (any to avoid circular dependency)
}

export interface TaskManagerOptions {
  cwd: string;
  tasksPath?: string;
  logsPath?: string;
  parallel?: boolean;
  abortSignal?: AbortSignal;
  execute?: (agentId: string, prompt: string) => Promise<string>;
}
