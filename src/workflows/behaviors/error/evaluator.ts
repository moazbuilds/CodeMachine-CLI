import { readBehaviorFile } from '../reader.js';

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

  const behaviorAction = await readBehaviorFile(cwd);
  if (!behaviorAction) {
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
