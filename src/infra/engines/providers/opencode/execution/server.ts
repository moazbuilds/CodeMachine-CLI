import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { buildOpenCodeServeCommand } from "./commands.js";
import {
	info,
	error as logError,
	debug,
} from "../../../../../shared/logging/logger.js";

/**
 * Agent information returned by OpenCode server
 */
export interface OpenCodeAgent {
	id: string;
	name?: string;
	description?: string;
}

export interface OpenCodeServerOptions {
	/**
	 * Port to listen on. If not provided, finds an available port.
	 */
	port?: number;
	/**
	 * Hostname to listen on. Defaults to 127.0.0.1.
	 */
	hostname?: string;
	/**
	 * Working directory for the server process.
	 */
	workingDir?: string;
	/**
	 * Timeout in ms to wait for server to be ready. Defaults to 30000 (30s).
	 */
	startupTimeout?: number;
}

export interface OpenCodeServer {
	/**
	 * URL to connect to (e.g., http://127.0.0.1:4096)
	 */
	url: string;
	/**
	 * Port the server is listening on
	 */
	port: number;
	/**
	 * Hostname the server is listening on
	 */
	hostname: string;
	/**
	 * Stop the server
	 */
	stop: () => Promise<void>;
	/**
	 * Check if server is healthy
	 */
	isHealthy: () => Promise<boolean>;
	/**
	 * List available agents from the server
	 */
	listAgents: () => Promise<OpenCodeAgent[]>;
}

/**
 * Find an available port by attempting to bind to port 0
 */
async function findAvailablePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address && typeof address === "object") {
				const port = address.port;
				server.close(() => resolve(port));
			} else {
				server.close(() => reject(new Error("Could not determine port")));
			}
		});
		server.on("error", reject);
	});
}

/**
 * Wait for the server to be ready by polling the /app endpoint
 */
async function waitForServer(url: string, timeoutMs: number): Promise<boolean> {
	const startTime = Date.now();
	const pollInterval = 500;

	while (Date.now() - startTime < timeoutMs) {
		try {
			const response = await fetch(`${url}/app`, {
				method: "GET",
				signal: AbortSignal.timeout(2000),
			});
			if (response.ok) {
				return true;
			}
		} catch {
			// Server not ready yet, continue polling
		}
		await new Promise((resolve) => setTimeout(resolve, pollInterval));
	}
	return false;
}

/**
 * Check if an OpenCode server is healthy at the given URL
 */
export async function checkServerHealth(url: string): Promise<boolean> {
	try {
		const response = await fetch(`${url}/app`, {
			method: "GET",
			signal: AbortSignal.timeout(5000),
		});
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * List available agents from an OpenCode server
 */
export async function listServerAgents(url: string): Promise<OpenCodeAgent[]> {
	try {
		const response = await fetch(`${url}/agent`, {
			method: "GET",
			signal: AbortSignal.timeout(10000),
		});
		if (!response.ok) {
			throw new Error(
				`Failed to list agents: ${response.status} ${response.statusText}`,
			);
		}
		const data = await response.json();
		// The API returns an array of agents
		return Array.isArray(data) ? data : [];
	} catch (err) {
		debug(`Failed to list agents from ${url}: ${err}`);
		return [];
	}
}

/**
 * Start an OpenCode server process
 *
 * @example
 * ```typescript
 * const server = await startOpenCodeServer({ port: 4096 });
 * console.log(`Server running at ${server.url}`);
 *
 * // Use server.url with --attach flag
 * // opencode run --attach http://127.0.0.1:4096 "prompt"
 *
 * // When done
 * await server.stop();
 * ```
 */
export async function startOpenCodeServer(
	options: OpenCodeServerOptions = {},
): Promise<OpenCodeServer> {
	const hostname = options.hostname ?? "127.0.0.1";
	const port = options.port ?? (await findAvailablePort());
	const startupTimeout = options.startupTimeout ?? 30000;

	const { command, args } = buildOpenCodeServeCommand({ port, hostname });

	debug(`Starting OpenCode server: ${command} ${args.join(" ")}`);

	let serverProcess: ChildProcess | null = null;

	try {
		serverProcess = spawn(command, args, {
			cwd: options.workingDir ?? process.cwd(),
			stdio: ["ignore", "pipe", "pipe"],
			detached: false,
			env: {
				...process.env,
				// Ensure opencode doesn't try to use a TTY
				NO_COLOR: "1",
			},
		});

		// Capture stderr for debugging
		let stderrOutput = "";
		serverProcess.stderr?.on("data", (chunk) => {
			stderrOutput += chunk.toString();
			debug(`[opencode serve stderr] ${chunk.toString().trim()}`);
		});

		// Handle process exit
		const exitPromise = new Promise<never>((_, reject) => {
			serverProcess?.on("exit", (code, signal) => {
				reject(
					new Error(
						`OpenCode server exited unexpectedly (code=${code}, signal=${signal}). stderr: ${stderrOutput}`,
					),
				);
			});
			serverProcess?.on("error", (err) => {
				reject(new Error(`Failed to start OpenCode server: ${err.message}`));
			});
		});

		const url = `http://${hostname}:${port}`;

		// Wait for server to be ready or exit
		const isReady = await Promise.race([
			waitForServer(url, startupTimeout),
			exitPromise,
		]);

		if (!isReady) {
			serverProcess.kill("SIGTERM");
			throw new Error(
				`OpenCode server failed to start within ${startupTimeout}ms`,
			);
		}

		info(`OpenCode server started at ${url}`);

		const server: OpenCodeServer = {
			url,
			port,
			hostname,
			stop: async () => {
				if (serverProcess && !serverProcess.killed) {
					debug(`Stopping OpenCode server at ${url}`);
					serverProcess.kill("SIGTERM");

					// Wait for graceful shutdown
					await new Promise<void>((resolve) => {
						const timeout = setTimeout(() => {
							if (serverProcess && !serverProcess.killed) {
								serverProcess.kill("SIGKILL");
							}
							resolve();
						}, 5000);

						serverProcess?.on("exit", () => {
							clearTimeout(timeout);
							resolve();
						});
					});

					info(`OpenCode server stopped`);
				}
			},
			isHealthy: async () => checkServerHealth(url),
			listAgents: async () => listServerAgents(url),
		};

		return server;
	} catch (err) {
		// Clean up on error
		if (serverProcess && !serverProcess.killed) {
			serverProcess.kill("SIGKILL");
		}
		throw err;
	}
}

/**
 * Create a server handle for an existing external server (no lifecycle management)
 */
export function attachToExternalServer(url: string): OpenCodeServer {
	// Parse URL to extract hostname and port
	const parsed = new URL(url);
	const hostname = parsed.hostname;
	const port = parseInt(parsed.port || "4096", 10);

	return {
		url: url.replace(/\/$/, ""), // Remove trailing slash
		port,
		hostname,
		stop: async () => {
			// External server - we don't manage its lifecycle
			debug(`Not stopping external OpenCode server at ${url}`);
		},
		isHealthy: async () => checkServerHealth(url),
		listAgents: async () => listServerAgents(url),
	};
}
