import * as path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { WorkflowTemplate } from './types.js';
import { validateWorkflowTemplate } from './validator.js';
import { ensureTemplateGlobals } from './globals.js';
import { resolvePackageRoot } from '../../shared/runtime/root.js';

// Package root resolution
export const packageRoot = resolvePackageRoot(import.meta.url, 'workflow templates loader');

export const templatesDir = path.resolve(packageRoot, 'templates', 'workflows');

// Module loading
export async function loadWorkflowModule(modPath: string): Promise<unknown> {
  ensureTemplateGlobals();
  const ext = path.extname(modPath).toLowerCase();
  if (ext === '.cjs' || ext === '.cts') {
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
  cacheBustingUrl.searchParams.set('ts', Date.now().toString());
  const mod = await import(cacheBustingUrl.href);
  return mod?.default ?? mod;
}

// Template loading
export async function loadTemplate(cwd: string, templatePath?: string): Promise<WorkflowTemplate> {
  const resolvedTemplateOverride = templatePath
    ? path.isAbsolute(templatePath)
      ? templatePath
      : path.resolve(packageRoot, templatePath)
    : undefined;
  const codemachineTemplate = path.resolve(templatesDir, 'codemachine-one.workflow.js');
  const candidates = [resolvedTemplateOverride, codemachineTemplate].filter(Boolean) as string[];

  const errors: string[] = [];
  for (const modPath of candidates) {
    try {
      const tpl = (await loadWorkflowModule(modPath)) as unknown;
      const result = validateWorkflowTemplate(tpl);
      if (result.valid) return tpl as WorkflowTemplate;
      const rel = path.relative(cwd, modPath);
      errors.push(`${rel}: ${result.errors.join('; ')}`);
    } catch (e) {
      const rel = path.relative(cwd, modPath);
      errors.push(`${rel}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const looked = candidates.map((p) => path.relative(cwd, p)).join(', ');
  const details = errors.length ? `\nValidation errors:\n- ${errors.join('\n- ')}` : '';
  throw new Error(`No workflow template found. Looked for: ${looked}${details}`);
}

export async function loadTemplateWithPath(cwd: string, templatePath?: string): Promise<{ template: WorkflowTemplate; resolvedPath: string }> {
  const resolvedTemplateOverride = templatePath
    ? path.isAbsolute(templatePath)
      ? templatePath
      : path.resolve(packageRoot, templatePath)
    : undefined;
  const codemachineTemplate = path.resolve(templatesDir, 'codemachine-one.workflow.js');
  const candidates = [resolvedTemplateOverride, codemachineTemplate].filter(Boolean) as string[];

  const errors: string[] = [];
  for (const modPath of candidates) {
    try {
      const tpl = (await loadWorkflowModule(modPath)) as unknown;
      const result = validateWorkflowTemplate(tpl);
      if (result.valid) return { template: tpl as WorkflowTemplate, resolvedPath: modPath };
      const rel = path.relative(cwd, modPath);
      errors.push(`${rel}: ${result.errors.join('; ')}`);
    } catch (e) {
      const rel = path.relative(cwd, modPath);
      errors.push(`${rel}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const looked = candidates.map((p) => path.relative(cwd, p)).join(', ');
  const details = errors.length ? `\nValidation errors:\n- ${errors.join('\n- ')}` : '';
  throw new Error(`No workflow template found. Looked for: ${looked}${details}`);
}
