import * as path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { WorkflowTemplate } from './types.js';
import { validateWorkflowTemplate } from './validator.js';
import { ensureTemplateGlobals } from './globals.js';
import { getDevRoot } from '../../shared/runtime/dev.js';
import { resolveWorkflowTemplate } from '../../shared/imports/index.js';
import { otel_debug } from '../../shared/logging/logger.js';
import { LOGGER_NAMES } from '../../shared/logging/otel-logger.js';

const localRoot = getDevRoot() || '';
otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] localRoot resolved to: %s', [localRoot || '(none — compiled binary)']);

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
  otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] loadTemplate called', []);
  otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] templatePath input: %s', [templatePath]);
  otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] localRoot: %s', [localRoot]);
  otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] isAbsolute: %s', [path.isAbsolute(templatePath)]);

  let resolvedPath: string;
  if (path.isAbsolute(templatePath)) {
    resolvedPath = templatePath;
  } else {
    const importResolved = resolveWorkflowTemplate(templatePath, localRoot);
    resolvedPath = importResolved ?? (localRoot ? path.resolve(localRoot, templatePath) : templatePath);
  }

  otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] resolvedPath: %s', [resolvedPath]);

  try {
    otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] Loading module from: %s', [resolvedPath]);
    const tpl = (await loadWorkflowModule(resolvedPath)) as unknown;
    const result = validateWorkflowTemplate(tpl);
    if (result.valid) {
      otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] Template loaded successfully from: %s', [resolvedPath]);
      return tpl as WorkflowTemplate;
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Template validation failed for ${rel}: ${result.errors.join('; ')}`);
  } catch (e) {
    otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] Failed to load template: %s', [e instanceof Error ? e.message : String(e)]);
    if (e instanceof Error && e.message.includes('Template validation failed')) {
      throw e;
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Failed to load template ${rel}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function loadTemplateWithPath(cwd: string, templatePath: string): Promise<{ template: WorkflowTemplate; resolvedPath: string }> {
  otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] loadTemplateWithPath called', []);
  otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] templatePath input: %s', [templatePath]);
  otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] localRoot: %s', [localRoot]);

  let resolvedPath: string;
  if (path.isAbsolute(templatePath)) {
    resolvedPath = templatePath;
  } else {
    const importResolved = resolveWorkflowTemplate(templatePath, localRoot);
    resolvedPath = importResolved ?? (localRoot ? path.resolve(localRoot, templatePath) : templatePath);
  }

  otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] resolvedPath: %s', [resolvedPath]);

  try {
    const tpl = (await loadWorkflowModule(resolvedPath)) as unknown;
    const result = validateWorkflowTemplate(tpl);
    if (result.valid) {
      otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] Template loaded successfully from: %s', [resolvedPath]);
      return { template: tpl as WorkflowTemplate, resolvedPath };
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Template validation failed for ${rel}: ${result.errors.join('; ')}`);
  } catch (e) {
    otel_debug(LOGGER_NAMES.CLI, '[TemplateLoader] Failed to load template: %s', [e instanceof Error ? e.message : String(e)]);
    if (e instanceof Error && e.message.includes('Template validation failed')) {
      throw e;
    }
    const rel = path.relative(cwd, resolvedPath);
    throw new Error(`Failed to load template ${rel}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
