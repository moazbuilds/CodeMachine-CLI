/**
 * OpenCode Server Integration Tests
 *
 * Tests the OpenCode server lifecycle management, including:
 * - Starting a server on a random port
 * - Health checks
 * - Listing available agents
 * - Attaching to an external server
 * - Server cleanup
 *
 * Note: These tests require OpenCode to be installed (`opencode` CLI available).
 * Tests are skipped if OpenCode is not installed.
 */

import { describe, test, expect } from "bun:test";
import { execSync } from "node:child_process";
import {
	startOpenCodeServer,
	attachToExternalServer,
	checkServerHealth,
	type OpenCodeServer,
} from "../../../src/infra/engines/providers/opencode/execution/server.js";
import {
	buildOpenCodeRunCommand,
	buildOpenCodeServeCommand,
} from "../../../src/infra/engines/providers/opencode/execution/commands.js";

// Check if opencode is installed
let opencodeInstalled = false;
try {
	execSync("opencode --version", { stdio: "ignore" });
	opencodeInstalled = true;
} catch {
	opencodeInstalled = false;
}

const describeIfOpencode = opencodeInstalled ? describe : describe.skip;

describeIfOpencode("OpenCode Server", () => {
	describe("Command Building", () => {
		test("buildOpenCodeRunCommand includes --attach when provided", () => {
			const cmd = buildOpenCodeRunCommand({
				model: "anthropic/claude-3-5-sonnet",
				agent: "task-implementer",
				attach: "http://localhost:4096",
			});

			expect(cmd.command).toBe("opencode");
			expect(cmd.args).toContain("run");
			expect(cmd.args).toContain("--format");
			expect(cmd.args).toContain("json");
			expect(cmd.args).toContain("--attach");
			expect(cmd.args).toContain("http://localhost:4096");
			expect(cmd.args).toContain("--agent");
			expect(cmd.args).toContain("task-implementer");
			expect(cmd.args).toContain("--model");
			expect(cmd.args).toContain("anthropic/claude-3-5-sonnet");
		});

		test("buildOpenCodeRunCommand omits --attach when not provided", () => {
			const cmd = buildOpenCodeRunCommand({
				model: "anthropic/claude-3-5-sonnet",
				agent: "build",
			});

			expect(cmd.args).not.toContain("--attach");
		});

		test("buildOpenCodeServeCommand with port and hostname", () => {
			const cmd = buildOpenCodeServeCommand({
				port: 5000,
				hostname: "0.0.0.0",
			});

			expect(cmd.command).toBe("opencode");
			expect(cmd.args).toContain("serve");
			expect(cmd.args).toContain("--port");
			expect(cmd.args).toContain("5000");
			expect(cmd.args).toContain("--hostname");
			expect(cmd.args).toContain("0.0.0.0");
		});
	});

	describe("Server Lifecycle", () => {
		let server: OpenCodeServer | null = null;

		test("startOpenCodeServer starts a server on random port", async () => {
			server = await startOpenCodeServer({
				startupTimeout: 60000, // 60s timeout for CI
			});

			expect(server).toBeDefined();
			expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
			expect(server.port).toBeGreaterThan(0);
			expect(server.hostname).toBe("127.0.0.1");
			expect(typeof server.stop).toBe("function");
			expect(typeof server.isHealthy).toBe("function");
			expect(typeof server.listAgents).toBe("function");
		}, 90000); // 90s test timeout

		test("server health check returns true for running server", async () => {
			if (!server) {
				throw new Error("Server not started");
			}

			const healthy = await server.isHealthy();
			expect(healthy).toBe(true);
		});

		test("listAgents returns array of agents", async () => {
			if (!server) {
				throw new Error("Server not started");
			}

			const agents = await server.listAgents();
			expect(Array.isArray(agents)).toBe(true);

			// OpenCode should have at least the default 'build' agent
			// The exact agents depend on the project config
			if (agents.length > 0) {
				expect(agents[0]).toHaveProperty("id");
			}
		});

		test("server stops cleanly", async () => {
			if (!server) {
				throw new Error("Server not started");
			}

			await server.stop();

			// Health check should fail after stop
			const healthy = await checkServerHealth(server.url);
			expect(healthy).toBe(false);

			server = null;
		});
	});

	describe("External Server", () => {
		test("attachToExternalServer creates handle without lifecycle management", () => {
			const server = attachToExternalServer("http://localhost:4096");

			expect(server.url).toBe("http://localhost:4096");
			expect(server.port).toBe(4096);
			expect(server.hostname).toBe("localhost");
			expect(typeof server.stop).toBe("function");
			expect(typeof server.isHealthy).toBe("function");
			expect(typeof server.listAgents).toBe("function");
		});

		test("attachToExternalServer handles URL with trailing slash", () => {
			const server = attachToExternalServer("http://localhost:4096/");

			expect(server.url).toBe("http://localhost:4096");
		});

		test("attachToExternalServer parses custom port", () => {
			const server = attachToExternalServer("http://127.0.0.1:5555");

			expect(server.port).toBe(5555);
			expect(server.hostname).toBe("127.0.0.1");
		});
	});

	describe("Health Check", () => {
		test("checkServerHealth returns false for non-existent server", async () => {
			const healthy = await checkServerHealth("http://localhost:59999");
			expect(healthy).toBe(false);
		});
	});
});

// Tests that run regardless of OpenCode installation
describe("OpenCode Commands (no runtime)", () => {
	test("buildOpenCodeRunCommand defaults to build agent", () => {
		const cmd = buildOpenCodeRunCommand({});

		expect(cmd.args).toContain("--agent");
		expect(cmd.args).toContain("build");
	});

	test("buildOpenCodeRunCommand includes --format json", () => {
		const cmd = buildOpenCodeRunCommand({});

		expect(cmd.args).toContain("--format");
		expect(cmd.args).toContain("json");
	});
});
