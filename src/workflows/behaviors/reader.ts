/**
 * Behavior File Reader
 *
 * Centralized logic for reading behavior.json signals from agents.
 * All behavior evaluators use this to read agent-written behavior actions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BehaviorAction } from './types.js';

/** Path to behavior.json relative to project root */
const BEHAVIOR_FILE_PATH = '.codemachine/memory/behavior.json';

/**
 * Reads and parses the behavior.json file from the project directory.
 *
 * @param cwd - Project working directory
 * @returns Parsed BehaviorAction or null if file doesn't exist/invalid
 */
export async function readBehaviorFile(cwd: string): Promise<BehaviorAction | null> {
  const behaviorFile = path.join(cwd, BEHAVIOR_FILE_PATH);

  try {
    const content = await fs.promises.readFile(behaviorFile, 'utf8');
    return JSON.parse(content) as BehaviorAction;
  } catch (error) {
    // No file = no behavior signal (normal case)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    // Log parse/read errors but don't crash
    console.error(
      `Failed to parse behavior file: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
