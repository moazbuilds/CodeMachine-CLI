/**
 * Theme Storage Utilities
 *
 * Read/write saved theme preference from KV storage.
 */

import { homedir } from "os"
import path from "path"
import { appDebug } from "../../../shared/logging/logger.js"

/**
 * Read saved theme from KV file (if exists)
 */
export async function getSavedTheme(): Promise<"dark" | "light" | null> {
  appDebug('[ThemeStorage] getSavedTheme called')
  try {
    const kvPath = path.join(homedir(), ".codemachine", "state", "kv.json")
    appDebug('[ThemeStorage] kvPath=%s', kvPath)
    const file = Bun.file(kvPath)

    // Check if file exists before calling .json() - Bun crashes hard otherwise
    const exists = await file.exists()
    appDebug('[ThemeStorage] file exists=%s', exists)
    if (!exists) {
      appDebug('[ThemeStorage] File does not exist, returning null')
      return null
    }

    const data = await file.json() as { theme?: string }
    appDebug('[ThemeStorage] data=%o', data)
    if (data.theme === "dark" || data.theme === "light") {
      appDebug('[ThemeStorage] Returning saved theme=%s', data.theme)
      return data.theme
    }
    appDebug('[ThemeStorage] No valid theme in data, returning null')
  } catch (err) {
    appDebug('[ThemeStorage] Error reading theme: %s', err)
    // File doesn't exist or invalid
  }
  return null
}
