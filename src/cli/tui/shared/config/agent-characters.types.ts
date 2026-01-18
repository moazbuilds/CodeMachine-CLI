/**
 * Agent Characters Configuration Types
 *
 * Defines the types for configurable ASCII art faces and phrases
 * that give personality to different agents via personas.
 */

/**
 * Activity types that determine which expression/phrase to show
 */
export type ActivityType = "thinking" | "tool" | "error" | "idle"

/**
 * Configuration for a persona's visual character
 */
export interface Persona {
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
  /** Persona definitions keyed by persona name */
  personas: Record<string, Persona>
  /** Agent ID to persona name mapping */
  agents: Record<string, string>
  /** Default persona for unmapped agents */
  defaultPersona: string
}
