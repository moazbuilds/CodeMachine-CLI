import * as path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { WorkflowTemplate } from './types.js';
import { validateWorkflowTemplate } from './validator.js';
import { ensureTemplateGlobals } from './globals.js';
import { resolvePackageRoot } from '../../shared/runtime/root.js';

// Package root resolution
export const packageRoot = resolvePackageRoot(import.meta.url, 'workflow templates loader');

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
export async function loadTemplate(cwd: string, templatePath: string): Promise<WorkflowTemplate> {
  const resolvedPath = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(packageRoot, templatePath);

  try {
    const tpl = (await loadWorkflowModule(resolvedPath)) as unknown;
    const result = validateWorkflowTemplate(tpl);
    if (result.valid) return tpl as WorkflowTemplate;
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Template validation failed for ${rel}: ${result.errors.join('; ')}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes('Template validation failed')) {
      throw e;
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Failed to load template ${rel}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function loadTemplateWithPath(cwd: string, templatePath: string): Promise<{ template: WorkflowTemplate; resolvedPath: string }> {
  const resolvedPath = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(packageRoot, templatePath);

  try {
    const tpl = (await loadWorkflowModule(resolvedPath)) as unknown;
    const result = validateWorkflowTemplate(tpl);
    if (result.valid) return { template: tpl as WorkflowTemplate, resolvedPath };
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Template validation failed for ${rel}: ${result.errors.join('; ')}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes('Template validation failed')) {
      throw e;
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Failed to load template ${rel}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
