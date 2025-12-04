export type UnknownRecord = Record<string, unknown>;

export interface LoopModuleBehavior {
	type: "loop";
	action: "stepBack";
	steps: number;
	trigger?: string; // Optional: behavior now controlled via .codemachine/memory/behavior.json
	maxIterations?: number;
	skip?: string[];
}

export interface TriggerModuleBehavior {
	type: "trigger";
	action: "mainAgentCall";
	triggerAgentId: string; // Agent ID to trigger
}

export interface CheckpointModuleBehavior {
	type: "checkpoint";
	action: "evaluate";
}

export type ModuleBehavior =
	| LoopModuleBehavior
	| TriggerModuleBehavior
	| CheckpointModuleBehavior;

export interface ModuleMetadata {
	id: string;
	behavior?: ModuleBehavior;
}

export interface ModuleStep {
	type: "module";
	agentId: string;
	agentName: string;
	promptPath: string;
	model?: string;
	modelReasoningEffort?: "low" | "medium" | "high";
	engine?: string; // Dynamic engine type from registry
	/**
	 * OpenCode agent name to use (passed as --agent flag)
	 * This selects which OpenCode agent configuration to use for execution.
	 * If not specified, uses the engine's default agent.
	 */
	agent?: string;
	/**
	 * URL of running OpenCode server to attach to (e.g., http://localhost:4096)
	 * When provided, uses --attach flag to connect to existing server.
	 * This is typically set automatically by the workflow runner when using
	 * consolidated server mode (--opencode-server flag).
	 */
	attach?: string;
	module?: ModuleMetadata;
	executeOnce?: boolean;
	notCompletedFallback?: string; // Agent ID to run if step is in notCompletedSteps
}

export interface UIStep {
	type: "ui";
	text: string;
}

export type WorkflowStep = ModuleStep | UIStep;

/**
 * Type guard to check if a step is a ModuleStep
 */
export function isModuleStep(step: WorkflowStep): step is ModuleStep {
	return step.type === "module";
}

export interface WorkflowTemplate {
	name: string;
	steps: WorkflowStep[];
	subAgentIds?: string[];
}

export type ModuleName = ModuleStep["agentId"];

export interface RunWorkflowOptions {
	cwd?: string;
	templatePath?: string;
	specificationPath?: string;
	/**
	 * [Experimental] Start a consolidated OpenCode server for all workflow steps.
	 * Reduces MCP cold boot times by reusing a single server instance.
	 * The server is started before the first OpenCode step and stopped when the workflow completes.
	 */
	opencodeServer?: boolean;
	/**
	 * Attach to an existing OpenCode server instead of starting a new one.
	 * Mutually exclusive with opencodeServer.
	 * Example: "http://localhost:4096"
	 */
	opencodeAttach?: string;
}

export interface TaskManagerOptions {
	cwd: string;
	tasksPath?: string;
	logsPath?: string;
	parallel?: boolean;
	abortSignal?: AbortSignal;
	execute?: (agentId: string, prompt: string) => Promise<string>;
}
