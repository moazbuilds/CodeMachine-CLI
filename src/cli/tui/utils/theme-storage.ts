/**
 * Theme Storage Utilities
 *
 * Read/write saved theme preference from KV storage.
 */

import { homedir } from "os"
import path from "path"

/**
 * Read saved theme from KV file (if exists)
 */
export async function getSavedTheme(): Promise<"dark" | "light" | null> {
  try {
    const kvPath = path.join(homedir(), ".codemachine", "state", "kv.json")
    const file = Bun.file(kvPath)
    const data = await file.json() as { theme?: string }
    if (data.theme === "dark" || data.theme === "light") {
      return data.theme
    }
  } catch {
    // File doesn't exist or invalid
  }
  return null
}
