/**
 * Directive File Reader
 *
 * Centralized logic for reading directive.json signals from agents.
 * All directive evaluators use this to read agent-written directive actions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DirectiveAction } from './types.js';

/** Path to directive.json relative to project root */
const DIRECTIVE_FILE_PATH = '.codemachine/memory/directive.json';

/**
 * Reads and parses the directive.json file from the project directory.
 *
 * @param cwd - Project working directory
 * @returns Parsed DirectiveAction or null if file doesn't exist/invalid
 */
export async function readDirectiveFile(cwd: string): Promise<DirectiveAction | null> {
  const directiveFile = path.join(cwd, DIRECTIVE_FILE_PATH);

  try {
    const content = await fs.promises.readFile(directiveFile, 'utf8');
    return JSON.parse(content) as DirectiveAction;
  } catch (error) {
    // No file = no directive signal (normal case)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    // Log parse/read errors but don't crash
    console.error(
      `Failed to parse directive file: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
