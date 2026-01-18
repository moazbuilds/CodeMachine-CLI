/**
 * Agent Characters Config Loader
 *
 * Loads and caches the agent characters configuration,
 * providing helper functions for accessing faces and phrases.
 * Uses a persona-based system where agents map to personas.
 */

import * as path from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { resolvePackageRoot } from "../../../../shared/runtime/root.js"
import type { ActivityType, AgentCharactersConfig, Persona } from "./agent-characters.types.js"

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
  const defaultPersona: Persona = {
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
  return {
    personas: { default: defaultPersona },
    agents: {},
    defaultPersona: "default",
  }
}

/**
 * Gets the persona configuration for a specific agent
 * Looks up agent -> persona mapping, falls back to defaultPersona
 */
export function getCharacter(agentId: string): Persona {
  const config = loadAgentCharactersConfig()
  const personaName = config.agents[agentId] ?? config.defaultPersona
  return config.personas[personaName] ?? config.personas[config.defaultPersona] ?? getDefaultConfig().personas.default
}

/**
 * Gets the face expression for a specific agent and activity
 */
export function getFace(agentId: string, activity: ActivityType): string {
  const character = getCharacter(agentId)
  return character.expressions[activity] ?? character.baseFace
}

/**
 * Gets a random phrase for a specific agent and activity
 */
export function getPhrase(agentId: string, activity: ActivityType): string {
  const character = getCharacter(agentId)
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
