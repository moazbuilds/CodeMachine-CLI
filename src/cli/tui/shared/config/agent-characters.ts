/**
 * Agent Characters Config Loader
 *
 * Loads and caches the agent characters configuration,
 * providing helper functions for accessing faces and phrases.
 * Uses a persona-based system where agents map to personas.
 *
 * Supports merging characters from imported packages.
 */

import * as path from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { resolvePackageRoot } from "../../../../shared/runtime/root.js"
import { getAllInstalledImports } from "../../../../shared/imports/registry.js"
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
 * Merges two agent characters configs
 * Imported config extends/overrides the base config
 */
function mergeCharactersConfigs(
  base: AgentCharactersConfig,
  imported: AgentCharactersConfig
): AgentCharactersConfig {
  return {
    personas: { ...base.personas, ...imported.personas },
    agents: { ...base.agents, ...imported.agents },
    defaultPersona: base.defaultPersona, // Keep base default
  }
}

/**
 * Loads characters config from a file path
 */
function loadCharactersFromPath(configPath: string): AgentCharactersConfig | null {
  if (!existsSync(configPath)) {
    return null
  }

  try {
    const content = readFileSync(configPath, "utf-8")
    return JSON.parse(content) as AgentCharactersConfig
  } catch {
    return null
  }
}

/**
 * Loads the agent characters configuration from JSON
 * Merges base config with any imported package characters
 * Caches the result after first load
 */
export function loadAgentCharactersConfig(): AgentCharactersConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  // Start with default config
  let config = getDefaultConfig()

  // Load base config from package root
  const packageRoot = getPackageRoot()
  if (packageRoot) {
    const basePath = path.join(packageRoot, "config", "agent-characters.json")
    const baseConfig = loadCharactersFromPath(basePath)
    if (baseConfig) {
      config = baseConfig
    }
  }

  // Merge characters from all installed imports
  try {
    const imports = getAllInstalledImports()
    for (const imp of imports) {
      const importedConfig = loadCharactersFromPath(imp.resolvedPaths.characters)
      if (importedConfig) {
        config = mergeCharactersConfigs(config, importedConfig)
      }
    }
  } catch {
    // Silently ignore import errors - may not have imports system initialized
  }

  cachedConfig = config
  return cachedConfig
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
