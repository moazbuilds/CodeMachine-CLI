/**
 * Agent Characters Configuration Types
 *
 * Defines the types for configurable ASCII art faces and phrases
 * that give personality to different AI engines.
 */

/**
 * Activity types that determine which expression/phrase to show
 */
export type ActivityType = "thinking" | "tool" | "error" | "idle"

/**
 * Configuration for a single engine's character
 */
export interface EngineCharacter {
  /** Display name for the engine */
  name: string
  /** Default face when no specific activity */
  baseFace: string
  /** ASCII art faces for different activities */
  expressions: Record<ActivityType, string>
  /** Phrases shown for different activities */
  phrases: Record<ActivityType, string[]>
}

/**
 * Full agent characters configuration
 */
export interface AgentCharactersConfig {
  /** Character configs keyed by engine ID */
  engines: Record<string, EngineCharacter>
  /** Default character for unknown engines */
  defaults: EngineCharacter
}
