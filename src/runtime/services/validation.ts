import * as path from 'node:path';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';

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

  // Check if path exists and what type it is
  try {
    const stats = await stat(absolute);
    if (stats.isDirectory()) {
      throw new ValidationError(`Spec path should be a file, not a directory: ${absolute}`, absolute);
    }
  } catch (error) {
    // Re-throw ValidationError
    if (error instanceof ValidationError) {
      throw error;
    }

    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      // File doesn't exist - create it with default template
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, DEFAULT_SPEC_TEMPLATE, { encoding: 'utf8' });
      throw new ValidationError(`Spec file created. Please write your specs at: ${absolute}`, absolute);
    }

    // Unexpected error - wrap it
    throw new ValidationError(`Failed to access spec file: ${nodeError.message}`, absolute);
  }

  // File exists and is not a directory - read it
  const specificationContents = await readFile(absolute, { encoding: 'utf8' });
  const trimmed = specificationContents.trim();

  // Check if empty or still has default template content
  if (trimmed.length === 0 || trimmed === DEFAULT_SPEC_TEMPLATE.trim()) {
    throw new ValidationError(`Spec file is empty. Please write your specs at: ${absolute}`, absolute);
  }
}
