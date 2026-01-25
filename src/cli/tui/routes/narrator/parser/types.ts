/**
 * Narrator Script Parser Types
 *
 * Defines the structure for parsed narrator scripts
 */

/**
 * A segment of text that can be displayed
 */
export type TextSegment =
  | { type: 'text'; content: string }
  | { type: 'delay'; seconds: number }
  | { type: 'face'; expression: string }

/**
 * A single line in a narrator script
 */
export interface ScriptLine {
  /** Starting face expression for this line (e.g., "idle", "thinking") */
  initialFace: string
  /** Seconds to wait after the line completes */
  endDelay: number
  /** Parsed segments of the line (text, delays, face changes) */
  segments: TextSegment[]
}

/**
 * A complete parsed narrator script
 */
export interface NarratorScript {
  /** All lines in the script */
  lines: ScriptLine[]
}

/**
 * Options for the narrator playback
 */
export interface NarratorOptions {
  /** Milliseconds per character when typing (default: 30) */
  speed?: number
  /** Starting face expression if not specified in script */
  defaultFace?: string
}
