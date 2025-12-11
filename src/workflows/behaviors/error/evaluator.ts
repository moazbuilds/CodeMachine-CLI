import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BehaviorAction } from '../types.js';

export interface ErrorEvaluationOptions {
  output: string;
  cwd: string;
}

export interface ErrorEvaluationResult {
  shouldStopWorkflow: boolean;
  reason?: string;
}

export async function evaluateErrorBehavior(options: ErrorEvaluationOptions): Promise<ErrorEvaluationResult | null> {
  const { cwd } = options;

  // Check for behavior file
  const behaviorFile = path.join(cwd, '.codemachine', 'memory', 'behavior.json');

  // Read and parse behavior action
  let behaviorAction: BehaviorAction;
  try {
    const content = await fs.promises.readFile(behaviorFile, 'utf8');
    behaviorAction = JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // No file = no special behavior, continue normally
      return null;
    }
    console.error(`Failed to parse behavior file: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }

  // Handle error action
  if (behaviorAction.action === 'error') {
    return {
      shouldStopWorkflow: true,
      reason: behaviorAction.reason,
    };
  }

  // Other actions are not error behavior
  return null;
}
