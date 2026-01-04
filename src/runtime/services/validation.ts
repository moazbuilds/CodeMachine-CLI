import * as path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const DEFAULT_SPEC_TEMPLATE = `# Project Specifications

- Describe goals, constraints, and context.
- Link any relevant docs or tickets.
- This file is created by workspace bootstrap and can be safely edited.
`;

/**
 * Custom error class for specification validation failures.
 * Used to distinguish validation errors from other errors for better error handling.
 */
export class ValidationError extends Error {
  public readonly specPath: string;

  constructor(message: string, specPath: string) {
    super(message);
    this.name = 'ValidationError';
    this.specPath = specPath;
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

export async function validateSpecification(specificationPath: string): Promise<void> {
  const absolute = path.resolve(specificationPath);
  let specificationContents: string;

  try {
    specificationContents = await readFile(absolute, { encoding: 'utf8' });
  } catch (_error) {
    // File doesn't exist - create it with default template
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, DEFAULT_SPEC_TEMPLATE, { encoding: 'utf8' });

    const message = `Spec file created. Please write your specs at: ${absolute}`;
    throw new ValidationError(message, absolute);
  }

  const trimmed = specificationContents.trim();

  // Check if empty or still has default template content
  if (trimmed.length === 0 || trimmed === DEFAULT_SPEC_TEMPLATE.trim()) {
    const message = `Spec file is empty. Please write your specs at: ${absolute}`;
    throw new ValidationError(message, absolute);
  }
}
