import { homedir } from "os"
import { join } from "path"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs"
import { VERSION } from "../../runtime/version.js"
import { otel_debug, otel_info } from "../logging/logger.js"
import { LOGGER_NAMES } from "../logging/otel-logger.js"
import type { UpdateCache } from "./types.js"

function debug(message: string, ...args: unknown[]) {
  otel_debug(LOGGER_NAMES.CLI, `[UpdateChecker] ${message}`, args)
}

const CACHE_DIR = join(homedir(), ".codemachine", "cache")
const CACHE_PATH = join(CACHE_DIR, "updates.json")
const CHECK_INTERVAL = 1000 * 60 * 60 * 24 // 24 hours

function getPackageInfo(): { name: string; version: string } {
  return { name: "codemachine", version: VERSION }
}

function readCache(): UpdateCache | null {
  try {
    if (!existsSync(CACHE_PATH)) {
      debug("Cache file does not exist")
      return null
    }
    const data = readFileSync(CACHE_PATH, "utf-8")
    const cache = JSON.parse(data) as UpdateCache
    debug("Read cache:", cache)
    return cache
  } catch (error) {
    debug("Failed to read cache:", error)
    return null
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
    debug("Wrote cache:", cache)
  } catch (error) {
    debug("Failed to write cache:", error)
  }
}

async function fetchLatestVersion(packageName: string): Promise<string | null> {
  try {
    debug("Fetching latest version for:", packageName)
    const fetchStart = performance.now()
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })
    otel_info(LOGGER_NAMES.CLI, '[UpdateChecker] Latest-version fetch duration: %dms (status=%s)', [
      Math.round(performance.now() - fetchStart),
      response.status,
    ])
    if (!response.ok) {
      debug("Registry response not ok:", response.status)
      return null
    }
    const data = (await response.json()) as { version: string }
    debug("Latest version:", data.version)
    return data.version
  } catch (error) {
    debug("Failed to fetch latest version:", error)
    return null
  }
}

function compareVersions(current: string, latest: string): boolean {
  const currentParts = current.split(".").map(Number)
  const latestParts = latest.split(".").map(Number)

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0
    const l = latestParts[i] || 0
    if (l > c) return true
    if (l < c) return false
  }
  return false
}

/**
 * Check for updates. Spawns background check if cache is stale.
 * Safe to call on every CLI startup - returns immediately if cache is fresh.
 */
export async function check(): Promise<void> {
  debug("check() called")

  if (process.env.NO_UPDATE_NOTIFIER || process.env.CODEMACHINE_NO_UPDATE_CHECK) {
    debug("Update check disabled by environment variable")
    return
  }

  const cache = readCache()
  const now = Date.now()

  if (cache && now - cache.checked < CHECK_INTERVAL) {
    debug("Cache is fresh, skipping check")
    return
  }

  debug("Cache is stale or missing, performing check")

  const pkg = getPackageInfo()
  const latest = await fetchLatestVersion(pkg.name)

  const newCache: UpdateCache = {
    current: pkg.version,
    latest,
    available: latest ? compareVersions(pkg.version, latest) : false,
    checked: now,
  }

  writeCache(newCache)
  debug("Check complete:", newCache)
}

/**
 * Get cached update status. Returns null if no cache exists.
 * This is synchronous and safe to call from TUI render.
 */
export function status(): UpdateCache | null {
  debug("status() called")
  return readCache()
}
