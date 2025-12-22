import { readDirectiveFile } from '../reader.js';

export interface ErrorEvaluationOptions {
  output: string;
  cwd: string;
}

export interface ErrorEvaluationResult {
  shouldStopWorkflow: boolean;
  reason?: string;
}

export async function evaluateErrorDirective(options: ErrorEvaluationOptions): Promise<ErrorEvaluationResult | null> {
  const { cwd } = options;

  const directiveAction = await readDirectiveFile(cwd);
  if (!directiveAction) {
    return null;
  }

  // Handle error action
  if (directiveAction.action === 'error') {
    return {
      shouldStopWorkflow: true,
      reason: directiveAction.reason,
    };
  }

  // Other actions are not error behavior
  return null;
}
