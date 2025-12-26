/**
 * Prompt Line Types
 *
 * Shared types for prompt line components.
 */

export type PromptLineState =
  | { mode: "disabled" }
  | { mode: "passive"; chainedStep?: { name: string; index: number; total: number } }
  | { mode: "active"; reason?: "paused" | "chaining" }
  | { mode: "chained"; name: string; description: string; index: number; total: number }

export interface PromptLineProps {
  state: PromptLineState
  isFocused: boolean
  onSubmit: (prompt: string) => void
  onSkip?: () => void
  onFocusExit: () => void
}
