import * as path from 'node:path';
import {
  type RunWorkflowOptions,
  type WorkflowStep,
  type WorkflowTemplate,
} from '../templates/types.js';
import { runWorkflow } from './run.js';
import { validateSpecification } from '../../runtime/services/index.js';

export { validateSpecification, ValidationError } from '../../runtime/services/index.js';

export type { WorkflowStep, WorkflowTemplate };

export type RunWorkflowQueueOptions = RunWorkflowOptions;

export async function runWorkflowQueue(options: RunWorkflowQueueOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const specificationPath = options.specificationPath || path.resolve(cwd, '.codemachine', 'inputs', 'specifications.md');

  await validateSpecification(specificationPath);

  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H');
  }

  await runWorkflow(options);
}

export default runWorkflowQueue;
