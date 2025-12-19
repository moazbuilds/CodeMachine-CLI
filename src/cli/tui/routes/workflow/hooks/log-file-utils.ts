/**
 * Log File Utilities
 *
 * File reading and size utilities for log streaming.
 */

import { readFileSync, existsSync, statSync } from "fs"

/**
 * Read log file and return array of lines
 */
export function readLogFile(path: string): string[] {
  try {
    if (!existsSync(path)) {
      return []
    }
    const content = readFileSync(path, "utf-8")
    return content.split("\n")
  } catch {
    return []
  }
}

/**
 * Get file size in bytes
 */
export function getFileSize(path: string): number {
  try {
    if (!existsSync(path)) {
      return 0
    }
    return statSync(path).size
  } catch {
    return 0
  }
}

/**
 * Check if file exists
 */
export function fileExists(path: string): boolean {
  try {
    return existsSync(path)
  } catch {
    return false
  }
}
