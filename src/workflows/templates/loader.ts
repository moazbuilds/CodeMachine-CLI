import * as path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { WorkflowTemplate } from './types.js';
import { validateWorkflowTemplate } from './validator.js';
import { ensureTemplateGlobals } from './globals.js';
import { resolvePackageRoot } from '../../shared/runtime/root.js';
import { appDebug } from '../../shared/logging/logger.js';

// Package root resolution
export const packageRoot = resolvePackageRoot(import.meta.url, 'workflow templates loader');
appDebug('[TemplateLoader] packageRoot resolved to: %s', packageRoot);

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
  appDebug('[TemplateLoader] loadTemplate called');
  appDebug('[TemplateLoader] templatePath input: %s', templatePath);
  appDebug('[TemplateLoader] packageRoot: %s', packageRoot);
  appDebug('[TemplateLoader] isAbsolute: %s', path.isAbsolute(templatePath));

  const resolvedPath = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(packageRoot, templatePath);

  appDebug('[TemplateLoader] resolvedPath: %s', resolvedPath);

  try {
    appDebug('[TemplateLoader] Loading module from: %s', resolvedPath);
    const tpl = (await loadWorkflowModule(resolvedPath)) as unknown;
    const result = validateWorkflowTemplate(tpl);
    if (result.valid) {
      // Log deprecation warnings if any
      if (result.warnings?.length) {
        for (const warning of result.warnings) {
          console.warn(`[Template: ${(tpl as { name?: string }).name ?? 'unknown'}] ${warning}`);
        }
      }
      appDebug('[TemplateLoader] Template loaded successfully from: %s', resolvedPath);
      return tpl as WorkflowTemplate;
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Template validation failed for ${rel}: ${result.errors.join('; ')}`);
  } catch (e) {
    appDebug('[TemplateLoader] Failed to load template: %s', e instanceof Error ? e.message : String(e));
    if (e instanceof Error && e.message.includes('Template validation failed')) {
      throw e;
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Failed to load template ${rel}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function loadTemplateWithPath(cwd: string, templatePath: string): Promise<{ template: WorkflowTemplate; resolvedPath: string }> {
  appDebug('[TemplateLoader] loadTemplateWithPath called');
  appDebug('[TemplateLoader] templatePath input: %s', templatePath);
  appDebug('[TemplateLoader] packageRoot: %s', packageRoot);

  const resolvedPath = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(packageRoot, templatePath);

  appDebug('[TemplateLoader] resolvedPath: %s', resolvedPath);

  try {
    const tpl = (await loadWorkflowModule(resolvedPath)) as unknown;
    const result = validateWorkflowTemplate(tpl);
    if (result.valid) {
      // Log deprecation warnings if any
      if (result.warnings?.length) {
        for (const warning of result.warnings) {
          console.warn(`[Template: ${(tpl as { name?: string }).name ?? 'unknown'}] ${warning}`);
        }
      }
      appDebug('[TemplateLoader] Template loaded successfully from: %s', resolvedPath);
      return { template: tpl as WorkflowTemplate, resolvedPath };
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Template validation failed for ${rel}: ${result.errors.join('; ')}`);
  } catch (e) {
    appDebug('[TemplateLoader] Failed to load template: %s', e instanceof Error ? e.message : String(e));
    if (e instanceof Error && e.message.includes('Template validation failed')) {
      throw e;
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Failed to load template ${rel}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
