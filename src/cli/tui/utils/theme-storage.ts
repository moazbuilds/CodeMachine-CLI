/**
 * Theme Storage Utilities
 *
 * Read/write saved theme preference from KV storage.
 */

import { homedir } from "os"
import path from "path"
import { otel_debug } from "../../../shared/logging/logger.js"
import { LOGGER_NAMES } from "../../../shared/logging/otel-logger.js"

/**
 * Read saved theme from KV file (if exists)
 */
export async function getSavedTheme(): Promise<"dark" | "light" | null> {
  otel_debug(LOGGER_NAMES.TUI, '[ThemeStorage] getSavedTheme called', [])
  try {
    const kvPath = path.join(homedir(), ".codemachine", "state", "kv.json")
    otel_debug(LOGGER_NAMES.TUI, '[ThemeStorage] kvPath=%s', [kvPath])
    const file = Bun.file(kvPath)

    // Check if file exists before calling .json() - Bun crashes hard otherwise
    const exists = await file.exists()
    otel_debug(LOGGER_NAMES.TUI, '[ThemeStorage] file exists=%s', [exists])
    if (!exists) {
      otel_debug(LOGGER_NAMES.TUI, '[ThemeStorage] File does not exist, returning null', [])
      return null
    }

    const data = await file.json() as { theme?: string }
    otel_debug(LOGGER_NAMES.TUI, '[ThemeStorage] data=%o', [data])
    if (data.theme === "dark" || data.theme === "light") {
      otel_debug(LOGGER_NAMES.TUI, '[ThemeStorage] Returning saved theme=%s', [data.theme])
      return data.theme
    }
    otel_debug(LOGGER_NAMES.TUI, '[ThemeStorage] No valid theme in data, returning null', [])
  } catch (err) {
    otel_debug(LOGGER_NAMES.TUI, '[ThemeStorage] Error reading theme: %s', [err])
    // File doesn't exist or invalid
  }
  return null
}
