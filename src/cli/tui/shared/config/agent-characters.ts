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
import { debug } from "../../../../shared/logging/logger.js"
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
    debug('[Characters] loadCharactersFromPath: file does not exist: %s', configPath)
    return null
  }

  try {
    const content = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(content) as AgentCharactersConfig
    debug('[Characters] loadCharactersFromPath: successfully loaded %s', configPath)
    return parsed
  } catch (err) {
    debug('[Characters] loadCharactersFromPath: parse error for %s: %s', configPath, err)
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

  debug('[Characters] loadAgentCharactersConfig: loading fresh config...')

  // Start with default config
  let config = getDefaultConfig()

  // Load base config from package root
  const packageRoot = getPackageRoot()
  if (packageRoot) {
    const basePath = path.join(packageRoot, "config", "agent-characters.json")
    const baseConfig = loadCharactersFromPath(basePath)
    if (baseConfig) {
      config = baseConfig
      debug('[Characters] Loaded base config from %s (%d personas, %d agents)',
        basePath, Object.keys(config.personas).length, Object.keys(config.agents).length)
    }
  }

  // Merge characters from all installed imports
  try {
    const imports = getAllInstalledImports()
    debug('[Characters] Found %d imports to merge', imports.length)
    for (const imp of imports) {
      try {
        const charactersPath = imp.resolvedPaths?.characters
        debug('[Characters] Import %s: charactersPath=%s, exists=%s',
          imp.name, charactersPath, charactersPath ? existsSync(charactersPath) : 'no-path')
        if (!charactersPath) {
          debug('[Characters] Import %s has no characters path, skipping', imp.name)
          continue
        }
        const importedConfig = loadCharactersFromPath(charactersPath)
        if (importedConfig) {
          debug('[Characters] Merging import %s (%d personas, %d agents)',
            imp.name,
            importedConfig.personas ? Object.keys(importedConfig.personas).length : 0,
            importedConfig.agents ? Object.keys(importedConfig.agents).length : 0)
          config = mergeCharactersConfigs(config, importedConfig)
        } else {
          debug('[Characters] Import %s: failed to load config from %s', imp.name, charactersPath)
        }
      } catch (importErr) {
        // Log error for this specific import but continue with others
        debug('[Characters] Error processing import %s: %s', imp.name, importErr)
      }
    }
  } catch (err) {
    debug('[Characters] Error loading imports registry: %s', err)
  }

  debug('[Characters] Final config: %d personas, %d agents, default=%s',
    Object.keys(config.personas).length, Object.keys(config.agents).length, config.defaultPersona)

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
  const persona = config.personas[personaName] ?? config.personas[config.defaultPersona] ?? getDefaultConfig().personas.default
  debug('[Characters] getCharacter: agentId=%s → persona=%s → face=%s',
    agentId, personaName, persona.baseFace)
  return persona
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
