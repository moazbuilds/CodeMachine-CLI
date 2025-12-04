import * as path from "node:path";
import type { Command } from "commander";

import { debug } from "../../shared/logging/logger.js";
import { clearTerminal } from "../../shared/utils/terminal.js";

const DEFAULT_SPEC_PATH = ".codemachine/inputs/specifications.md";

type StartCommandOptions = {
	spec?: string;
	opencodeServer?: boolean;
	opencodeAttach?: string;
};

export function registerStartCommand(program: Command): void {
	program
		.command("start")
		.description("Run the workflow queue until completion (non-interactive)")
		.option("--spec <path>", "Path to the planning specification file")
		.option(
			"--opencode-server",
			"[Experimental] Start a consolidated OpenCode server for all workflow steps. " +
				"Reduces MCP cold boot times by reusing a single server instance.",
		)
		.option(
			"--opencode-attach <url>",
			"Attach to an existing OpenCode server (e.g., http://localhost:4096). " +
				"Mutually exclusive with --opencode-server.",
		)
		.action(async (options: StartCommandOptions, command: Command) => {
			const cwd = process.env.CODEMACHINE_CWD || process.cwd();

			// Use command-specific --spec if provided, otherwise fall back to global --spec, then default
			const globalOpts = command.optsWithGlobals
				? command.optsWithGlobals()
				: command.opts();
			const specPath = options.spec ?? globalOpts.spec ?? DEFAULT_SPEC_PATH;
			const specificationPath = path.resolve(cwd, specPath);

			// Validate mutually exclusive options
			if (options.opencodeServer && options.opencodeAttach) {
				console.error(
					"Error: --opencode-server and --opencode-attach are mutually exclusive",
				);
				process.exit(1);
			}

			debug(`Starting workflow (spec: ${specificationPath})`);
			if (options.opencodeServer) {
				debug("OpenCode consolidated server mode enabled (experimental)");
			}
			if (options.opencodeAttach) {
				debug(
					`Attaching to external OpenCode server: ${options.opencodeAttach}`,
				);
			}

			// Comprehensive terminal clearing
			clearTerminal();

			// Determine execution method based on environment:
			// - Dev mode: Import and run workflow directly (no SolidJS preload in dev)
			// - Production: Spawn workflow binary (prevents JSX conflicts)
			const isDev = import.meta.url.includes("/src/");

			if (isDev) {
				// Development mode - directly import and run (SolidJS preload not active)
				const { runWorkflowQueue } = await import("../../workflows/index.js");
				const { ValidationError } = await import(
					"../../runtime/services/validation.js"
				);
				try {
					await runWorkflowQueue({
						cwd,
						specificationPath,
						opencodeServer: options.opencodeServer,
						opencodeAttach: options.opencodeAttach,
					});
					console.log("\n✓ Workflow completed successfully");
					process.exit(0);
				} catch (error) {
					// Show friendly instructional message for validation errors (no stack trace)
					if (error instanceof ValidationError) {
						console.log(`\n${error.message}\n`);
						process.exit(1);
					}
					// Show detailed error for other failures
					console.error(
						"\n✗ Workflow failed:",
						error instanceof Error ? error.message : String(error),
					);
					process.exit(1);
				}
			} else {
				// Production mode - spawn workflow binary to avoid JSX conflicts
				// The main binary has SolidJS transform, so we must use separate workflow binary
				const { spawnProcess } = await import("../../infra/process/spawn.js");
				const { resolveWorkflowBinary } = await import(
					"../../shared/utils/resolve-workflow-binary.js"
				);

				try {
					// Build environment with optional OpenCode server settings
					const spawnEnv: Record<string, string> = {};
					if (process.env.CODEMACHINE_INSTALL_DIR) {
						spawnEnv.CODEMACHINE_INSTALL_DIR =
							process.env.CODEMACHINE_INSTALL_DIR;
					}
					if (options.opencodeServer) {
						spawnEnv.CODEMACHINE_OPENCODE_SERVER = "1";
					}
					if (options.opencodeAttach) {
						spawnEnv.CODEMACHINE_OPENCODE_ATTACH = options.opencodeAttach;
					}

					const result = await spawnProcess({
						command: resolveWorkflowBinary(),
						args: [cwd, specificationPath],
						env: Object.keys(spawnEnv).length > 0 ? spawnEnv : undefined,
						stdioMode: "inherit", // Let workflow take full terminal control
					});

					if (result.exitCode === 0) {
						console.log("\n✓ Workflow completed successfully");
						process.exit(0);
					} else {
						console.error(
							`\n✗ Workflow failed with exit code ${result.exitCode}`,
						);
						process.exit(result.exitCode);
					}
				} catch (error) {
					console.error(
						"\n✗ Failed to spawn workflow:",
						error instanceof Error ? error.message : String(error),
					);
					process.exit(1);
				}
			}
		});
}
