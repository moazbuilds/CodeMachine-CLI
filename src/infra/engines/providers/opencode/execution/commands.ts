export interface OpenCodeCommandOptions {
	/**
	 * Provider/model identifier (e.g., anthropic/claude-3.7-sonnet)
	 */
	model?: string;
	/**
	 * Agent name to run (defaults to 'build')
	 */
	agent?: string;
	/**
	 * URL of running OpenCode server to attach to (e.g., http://localhost:4096)
	 * When provided, uses --attach flag to connect to existing server instead of spawning new process.
	 * This avoids MCP server cold boot times on every run.
	 */
	attach?: string;
}

export interface OpenCodeCommand {
	command: string;
	args: string[];
}

/**
 * Build command for `opencode run`
 */
export function buildOpenCodeRunCommand(
	options: OpenCodeCommandOptions = {},
): OpenCodeCommand {
	const args: string[] = ["run", "--format", "json"];

	// Attach to existing server if URL provided
	if (options.attach?.trim()) {
		args.push("--attach", options.attach.trim());
	}

	const agentName = options.agent?.trim() || "build";
	if (agentName) {
		args.push("--agent", agentName);
	}

	if (options.model?.trim()) {
		args.push("--model", options.model.trim());
	}

	return {
		command: "opencode",
		args,
	};
}

/**
 * Build command for `opencode serve`
 */
export function buildOpenCodeServeCommand(
	options: { port?: number; hostname?: string } = {},
): OpenCodeCommand {
	const args: string[] = ["serve"];

	if (options.port) {
		args.push("--port", options.port.toString());
	}

	if (options.hostname?.trim()) {
		args.push("--hostname", options.hostname.trim());
	}

	return {
		command: "opencode",
		args,
	};
}
