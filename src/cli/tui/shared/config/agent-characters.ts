/**
 * Agent Characters Config Loader
 *
 * Loads and caches the agent characters configuration,
 * providing helper functions for accessing faces and phrases.
 */

import * as path from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { resolvePackageRoot } from "../../../../shared/runtime/root.js"
import type { ActivityType, AgentCharactersConfig, EngineCharacter } from "./agent-characters.types.js"

let cachedConfig: AgentCharactersConfig | null = null

/**
 * Gets the package root directory
 */
function getPackageRoot(): string | null {
  try {
    return resolvePackageRoot(import.meta.url, "agent-characters config")
  } catch {
    return null
  }
}

/**
 * Loads the agent characters configuration from JSON
 * Caches the result after first load
 */
export function loadAgentCharactersConfig(): AgentCharactersConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const packageRoot = getPackageRoot()
  if (!packageRoot) {
    console.warn("Warning: Could not find codemachine package root for agent characters")
    return getDefaultConfig()
  }

  const configPath = path.join(packageRoot, "config", "agent-characters.json")

  if (!existsSync(configPath)) {
    console.warn(`Warning: Agent characters config not found at ${configPath}`)
    return getDefaultConfig()
  }

  try {
    const content = readFileSync(configPath, "utf-8")
    cachedConfig = JSON.parse(content) as AgentCharactersConfig
    return cachedConfig
  } catch (error) {
    console.warn(`Warning: Failed to parse agent characters config: ${error instanceof Error ? error.message : String(error)}`)
    return getDefaultConfig()
  }
}

/**
 * Returns a minimal default config when the JSON file is unavailable
 */
function getDefaultConfig(): AgentCharactersConfig {
  const defaults: EngineCharacter = {
    name: "Agent",
    baseFace: "(•_•)",
    expressions: {
      thinking: "(•_•)?",
      tool: "(•_•)!",
      error: "(•_•);;",
      idle: "(•_•)",
    },
    phrases: {
      thinking: ["Thinking..."],
      tool: ["Working..."],
      error: ["Error"],
      idle: ["Ready"],
    },
  }
  return { engines: {}, defaults }
}

/**
 * Gets the character configuration for a specific engine
 * Falls back to defaults if engine not found
 */
export function getCharacter(engineId: string): EngineCharacter {
  const config = loadAgentCharactersConfig()
  const normalizedId = engineId.toLowerCase()
  return config.engines[normalizedId] ?? config.defaults
}

/**
 * Gets the face expression for a specific engine and activity
 */
export function getFace(engineId: string, activity: ActivityType): string {
  const character = getCharacter(engineId)
  return character.expressions[activity] ?? character.baseFace
}

/**
 * Gets a random phrase for a specific engine and activity
 */
export function getPhrase(engineId: string, activity: ActivityType): string {
  const character = getCharacter(engineId)
  const phrases = character.phrases[activity]
  if (!phrases || phrases.length === 0) {
    return activity === "idle" ? "Ready" : "..."
  }
  const randomIndex = Math.floor(Math.random() * phrases.length)
  return phrases[randomIndex]
}

/**
 * Clears the cached config (useful for testing or hot reload)
 */
export function clearAgentCharactersCache(): void {
  cachedConfig = null
}
