import type { Command } from 'commander';
import * as path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { select, isCancel } from '@clack/prompts';
import { loadWorkflowModule, isWorkflowTemplate, WorkflowTemplate } from '../../workflows/index.js';
import { hasTemplateChanged, setActiveTemplate } from '../../shared/workflows/index.js';
import { ensureWorkspaceStructure, mirrorSubAgents } from '../../runtime/services/workspace/index.js';
import type { SelectionChoice } from '../utils/selection-menu.js';
import { isModuleStep } from '../../workflows/templates/types.js';
import { resolvePackageRoot } from '../../shared/runtime/root.js';
import { getAllInstalledImports } from '../../shared/imports/index.js';
import { runInteractiveImport } from './import.command.js';
import { registerImportedAgents, clearImportedAgents } from '../../workflows/utils/config.js';

const packageRoot = resolvePackageRoot(import.meta.url, 'templates command');

const templatesDir = path.resolve(packageRoot, 'templates', 'workflows');

export function printAvailableWorkflowTemplatesHeading(): void {
  console.log('\nAvailable workflow templates:\n');
}

export interface TemplateChoice extends SelectionChoice<string> {
  category: 'builtin' | 'imported';
  source?: string; // Import package name for imported templates
  stepCount: number;
}


async function handleTemplateSelectionSuccess(template: WorkflowTemplate, templateFilePath: string): Promise<void> {
  const templateFileName = path.basename(templateFilePath);
  const cwd = process.env.CODEMACHINE_CWD || process.cwd();
  const cmRoot = path.join(cwd, '.codemachine');
  const agentsDir = path.join(cmRoot, 'agents');

  console.log(`\nSelected: ${template.name}`);
  console.log(`Template path: ${path.relative(process.cwd(), templateFilePath)}`);
  console.log(`\nSteps:`);

  template.steps.forEach((step, index) => {
    if (isModuleStep(step)) {
      console.log(`  ${index + 1}. ${step.agentName} [${step.agentId}]`);
    } else {
      console.log(`  ${index + 1}. [UI Element]`);
    }
  });

  // Ensure workspace structure exists first (needed for template tracking file)
  await ensureWorkspaceStructure({ cwd });

  // Check if template changed and regenerate agents folder
  const changed = await hasTemplateChanged(cmRoot, templateFileName);

  // Update active template tracking (pass autonomousMode from template if defined)
  await setActiveTemplate(cmRoot, templateFileName, template.autonomousMode);

  if (changed) {
    console.log('\n🔄 Template changed, regenerating agents...');

    // Delete existing agents folder if it exists
    if (existsSync(agentsDir)) {
      await rm(agentsDir, { recursive: true, force: true });
    }

    // Mirror sub-agents if template has subAgentIds
    if (template.subAgentIds && template.subAgentIds.length > 0) {
      await mirrorSubAgents({ cwd, subAgentIds: template.subAgentIds });
      console.log('✅ Agents regenerated successfully');
    } else {
      console.log('✓ Template has no sub-agents to mirror');
    }
  } else {
    console.log('\n✓ Template unchanged, agents folder up to date');
  }

  console.log(`\n✅ Template saved to .codemachine/template.json`);
}

export async function getAvailableTemplates(): Promise<TemplateChoice[]> {
  const builtinTemplates: TemplateChoice[] = [];
  const importedTemplates: TemplateChoice[] = [];

  // Clear any previously registered imported agents
  clearImportedAgents();

  // Pre-register all imported agents before loading any templates
  // This ensures resolveStep() can find agents from all imports
  const importedPackages = getAllInstalledImports();
  for (const imp of importedPackages) {
    registerImportedAgents(imp.resolvedPaths.config);
  }

  // Helper to load templates from a directory
  async function loadFromDir(
    dir: string,
    category: 'builtin' | 'imported',
    source?: string
  ): Promise<TemplateChoice[]> {
    const results: TemplateChoice[] = [];

    if (!existsSync(dir)) {
      return results;
    }

    const files = readdirSync(dir).filter(file =>
      file.endsWith('.workflow.js') && !file.startsWith('_example.')
    );

    for (const file of files) {
      try {
        const filePath = path.join(dir, file);
        const template = await loadWorkflowModule(filePath);

        if (isWorkflowTemplate(template)) {
          const stepCount = template.steps.length;
          const description = source
            ? `${stepCount} step(s) · from ${source}`
            : `${stepCount} step(s)`;

          results.push({
            title: template.name,
            value: filePath,
            description,
            category,
            source,
            stepCount,
          });
        }
      } catch (error) {
        // Skip invalid templates
        console.warn(`Warning: Could not load template ${file}:`, error);
      }
    }

    return results;
  }

  // Load core templates
  builtinTemplates.push(...await loadFromDir(templatesDir, 'builtin'));

  // Load templates from imported packages
  for (const imp of importedPackages) {
    importedTemplates.push(...await loadFromDir(imp.resolvedPaths.workflows, 'imported', imp.name));
  }

  // Sort each category alphabetically, then return builtin first, imported second
  builtinTemplates.sort((a, b) => a.title.localeCompare(b.title));
  importedTemplates.sort((a, b) => a.title.localeCompare(b.title));

  return [...builtinTemplates, ...importedTemplates];
}

export async function selectTemplateByNumber(templateNumber: number): Promise<void> {
  try {
    const templates = await getAvailableTemplates();

    if (templates.length === 0) {
      console.log('No workflow templates found in templates/workflows/');
      return;
    }

    if (templateNumber < 1 || templateNumber > templates.length) {
      console.log(`Invalid selection. Please choose a number between 1 and ${templates.length}.`);
      return;
    }

    const selectedTemplate = templates[templateNumber - 1];
    const template = await loadWorkflowModule(selectedTemplate.value);

    if (isWorkflowTemplate(template)) {
      await handleTemplateSelectionSuccess(template, selectedTemplate.value);
    }
  } catch (error) {
    console.error('Error selecting template:', error instanceof Error ? error.message : String(error));
  }
}

export async function runTemplatesCommand(inSession: boolean = false): Promise<void> {
  try {
    const templates = await getAvailableTemplates();

    if (templates.length === 0) {
      console.log('No workflow templates found in templates/workflows/');
      return;
    }

    // Build options with category shown in hint
    const options = templates.map(t => ({
      value: t.value,
      label: t.title,
      hint: t.category === 'imported'
        ? `${t.stepCount} steps · ${t.source} [imported]`
        : `${t.stepCount} steps`,
    }));

    console.log();
    const result = await select({
      message: 'Choose a workflow template:',
      options,
    });

    if (isCancel(result)) {
      console.log('No template selected.');
      return;
    }

    const selectedPath = result as string;
    const template = await loadWorkflowModule(selectedPath);
    if (isWorkflowTemplate(template)) {
      await handleTemplateSelectionSuccess(template, selectedPath);
    }
  } catch (error) {
    console.error('Error loading templates:', error);
    // Only exit if not in session mode
    if (!inSession) {
      process.exit(1);
    }
  }
}

export function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .description('List and select workflow templates')
    .action(runTemplatesCommand);
}
