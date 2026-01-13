/**
 * Workflow Pre-flight Checks
 *
 * Consolidates all checks that must pass before a workflow can start.
 * Single source of truth for workflow startup validation.
 */

import * as path from 'node:path';
import type { WorkflowTemplate } from './templates/types.js';
import { loadTemplateWithPath } from './templates/loader.js';
import { getTemplatePathFromTracking, getSelectedTrack, hasSelectedConditions, getProjectName } from '../shared/workflows/index.js';
import { validateSpecification } from '../runtime/services/index.js';
import { ensureWorkspaceStructure } from '../runtime/services/workspace/index.js';
import type { AgentDefinition } from '../shared/agents/config/types.js';

export { ValidationError } from '../runtime/services/index.js';

/**
 * Onboarding requirements - what the user needs to configure before workflow can start
 */
export interface OnboardingNeeds {
  needsProjectName: boolean;
  needsTrackSelection: boolean;
  needsConditionsSelection: boolean;
  needsControllerSelection: boolean;
  /** @deprecated Controller is now pre-specified via controller() function */
  controllerAgents: AgentDefinition[];
  /** The loaded template for reference */
  template: WorkflowTemplate;
}

/**
 * Check what onboarding steps are needed before workflow can start
 * Does NOT throw - returns the requirements for the UI to handle
 */
export async function checkOnboardingRequired(options: { cwd?: string } = {}): Promise<OnboardingNeeds> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const cmRoot = path.join(cwd, '.codemachine');

  // Ensure workspace structure exists
  await ensureWorkspaceStructure({ cwd });

  // Load template
  const templatePath = await getTemplatePathFromTracking(cmRoot);
  const { template } = await loadTemplateWithPath(cwd, templatePath);

  // Check existing selections
  const selectedTrack = await getSelectedTrack(cmRoot);
  const conditionsSelected = await hasSelectedConditions(cmRoot);
  const existingProjectName = await getProjectName(cmRoot);

  // Determine what's needed
  const hasTracks = !!(template.tracks && Object.keys(template.tracks.options).length > 0);
  const hasConditionGroups = !!(template.conditionGroups && template.conditionGroups.length > 0);
  const needsTrackSelection = hasTracks && !selectedTrack;
  const needsConditionsSelection = hasConditionGroups && !conditionsSelected;
  const needsProjectName = !existingProjectName;

  // Controller is now pre-specified via controller() function - no selection needed
  const needsControllerSelection = false;
  const controllerAgents: AgentDefinition[] = [];

  return {
    needsProjectName,
    needsTrackSelection,
    needsConditionsSelection,
    needsControllerSelection,
    controllerAgents,
    template,
  };
}

/**
 * Check if specification file is required and valid
 * Throws ValidationError if template requires specification but it's missing/empty
 *
 * Path can be overridden via:
 * - CLI: --spec <path>
 * - Env: CODEMACHINE_SPEC_PATH
 */
export async function checkSpecificationRequired(options: { cwd?: string } = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const cmRoot = path.join(cwd, '.codemachine');
  const specificationPath = process.env.CODEMACHINE_SPEC_PATH
    || path.resolve(cwd, '.codemachine', 'inputs', 'specifications.md');

  // Ensure workspace structure exists
  await ensureWorkspaceStructure({ cwd });

  // Load template to check specification requirement
  const templatePath = await getTemplatePathFromTracking(cmRoot);
  const { template } = await loadTemplateWithPath(cwd, templatePath);

  // Validate specification only if template requires it
  if (template.specification === true) {
    await validateSpecification(specificationPath);
  }
}

/**
 * Main pre-flight check - verifies workflow can start
 * Throws ValidationError if workflow cannot start due to missing specification
 * Returns onboarding needs if user configuration is required
 */
export async function checkWorkflowCanStart(options: { cwd?: string } = {}): Promise<OnboardingNeeds> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

  // First check specification requirement (throws if invalid)
  await checkSpecificationRequired({ cwd });

  // Then check onboarding requirements (returns needs, doesn't throw)
  return checkOnboardingRequired({ cwd });
}

/**
 * Quick check if any onboarding is needed
 * Useful for UI to decide whether to show onboarding flow
 */
export function needsOnboarding(needs: OnboardingNeeds): boolean {
  return (
    needs.needsProjectName ||
    needs.needsTrackSelection ||
    needs.needsConditionsSelection ||
    needs.needsControllerSelection
  );
}
