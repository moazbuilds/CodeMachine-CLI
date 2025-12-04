import * as path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import type { WorkflowTemplate } from "./types.js";
import { validateWorkflowTemplate } from "./validator.js";
import { ensureTemplateGlobals } from "./globals.js";
import { resolvePackageRoot } from "../../shared/runtime/pkg.js";

// Package root resolution
export const packageRoot = resolvePackageRoot(
	import.meta.url,
	"workflow templates loader",
);

export const templatesDir = path.resolve(packageRoot, "templates", "workflows");

// Module loading
export async function loadWorkflowModule(modPath: string): Promise<unknown> {
	ensureTemplateGlobals();
	const ext = path.extname(modPath).toLowerCase();
	if (ext === ".cjs" || ext === ".cts") {
		const require = createRequire(import.meta.url);
		try {
			delete require.cache[require.resolve(modPath)];
		} catch {
			// Ignore cache deletion errors
		}
		return require(modPath);
	}

	const fileUrl = pathToFileURL(modPath);
	const cacheBustingUrl = new URL(fileUrl.href);
	cacheBustingUrl.searchParams.set("ts", Date.now().toString());
	const mod = await import(cacheBustingUrl.href);
	return mod?.default ?? mod;
}

// Template loading
export async function loadTemplate(
	cwd: string,
	templatePath?: string,
): Promise<WorkflowTemplate> {
	const resolvedTemplateOverride = templatePath
		? resolveTemplatePath(cwd, templatePath)
		: undefined;
	const codemachineTemplate = path.resolve(
		templatesDir,
		"codemachine.workflow.js",
	);
	const candidates = [resolvedTemplateOverride, codemachineTemplate].filter(
		Boolean,
	) as string[];

	const errors: string[] = [];
	for (const modPath of candidates) {
		try {
			const tpl = (await loadWorkflowModule(modPath)) as unknown;
			const result = validateWorkflowTemplate(tpl);
			if (result.valid) return tpl as WorkflowTemplate;
			const rel = path.relative(cwd, modPath);
			errors.push(`${rel}: ${result.errors.join("; ")}`);
		} catch (e) {
			const rel = path.relative(cwd, modPath);
			errors.push(`${rel}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	const looked = candidates.map((p) => path.relative(cwd, p)).join(", ");
	const details = errors.length
		? `\nValidation errors:\n- ${errors.join("\n- ")}`
		: "";
	throw new Error(
		`No workflow template found. Looked for: ${looked}${details}`,
	);
}

/**
 * Resolves a template path, checking the project's .codemachine directory first.
 * For relative paths like "templates/workflows/foo.workflow.js":
 *   1. First check if it exists at {cwd}/.codemachine/{templatePath}
 *   2. Fall back to CodeMachine's package templates directory
 * For absolute paths, use them directly.
 */
function resolveTemplatePath(cwd: string, templatePath: string): string {
	// Absolute paths are used directly
	if (path.isAbsolute(templatePath)) {
		return templatePath;
	}

	// Check project's .codemachine directory first
	const projectPath = path.join(cwd, ".codemachine", templatePath);
	if (existsSync(projectPath)) {
		return projectPath;
	}

	// Fall back to CodeMachine's templates directory
	return path.resolve(packageRoot, templatePath);
}

export async function loadTemplateWithPath(
	cwd: string,
	templatePath?: string,
): Promise<{ template: WorkflowTemplate; resolvedPath: string }> {
	const resolvedTemplateOverride = templatePath
		? resolveTemplatePath(cwd, templatePath)
		: undefined;
	const codemachineTemplate = path.resolve(
		templatesDir,
		"codemachine.workflow.js",
	);
	const candidates = [resolvedTemplateOverride, codemachineTemplate].filter(
		Boolean,
	) as string[];

	const errors: string[] = [];
	for (const modPath of candidates) {
		try {
			const tpl = (await loadWorkflowModule(modPath)) as unknown;
			const result = validateWorkflowTemplate(tpl);
			if (result.valid)
				return { template: tpl as WorkflowTemplate, resolvedPath: modPath };
			const rel = path.relative(cwd, modPath);
			errors.push(`${rel}: ${result.errors.join("; ")}`);
		} catch (e) {
			const rel = path.relative(cwd, modPath);
			errors.push(`${rel}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	const looked = candidates.map((p) => path.relative(cwd, p)).join(", ");
	const details = errors.length
		? `\nValidation errors:\n- ${errors.join("\n- ")}`
		: "";
	throw new Error(
		`No workflow template found. Looked for: ${looked}${details}`,
	);
}
