import { SYMBOL_BULLET, SYMBOL_NEST, parseMarker } from "../../../shared/formatters/outputMarkers.js"
import { parseTelemetryChunk, type ParsedTelemetry } from "./telemetry"

export type OutputChunkType = "text" | "tool" | "thinking" | "telemetry" | "error"

export interface ProcessedChunk {
  type: OutputChunkType
  content: string
  telemetry?: ParsedTelemetry
  toolName?: string
}

const COMMAND_PREFIX = "● Command:"

export function processOutputChunk(chunk: string | undefined | null): ProcessedChunk {
  if (!chunk || typeof chunk !== "string") {
    return { type: "text", content: "" }
  }

  const trimmed = chunk.trim()
  const { color, text } = parseMarker(trimmed)

  if (text.includes(`${SYMBOL_BULLET} Command:`)) {
    const commandMatch = text.match(/● Command:\s*(.+)/)
    return {
      type: "tool",
      content: trimmed,
      toolName: commandMatch ? commandMatch[1] : undefined,
    }
  }

  if (text.includes(SYMBOL_NEST)) {
    const isError = color === "red"
    return {
      type: isError ? "error" : "tool",
      content: trimmed,
    }
  }

  if (text.includes(`${SYMBOL_BULLET} Thinking:`)) {
    return {
      type: "thinking",
      content: trimmed,
    }
  }

  const telemetry = parseTelemetryChunk(text)
  if (telemetry) {
    return {
      type: "telemetry",
      content: trimmed,
      telemetry,
    }
  }

  if (text.includes("ERROR") || text.includes("✗") || color === "red") {
    return {
      type: "error",
      content: trimmed,
    }
  }

  return {
    type: "text",
    content: trimmed,
  }
}

export function normalizeCommandLines(lines: string[]): string[] {
  const normalized: string[] = []
  const pending: Array<{ command: string; index: number }> = []

  for (const line of lines) {
    if (!line) {
      normalized.push(line)
      continue
    }

    const { color, text } = parseMarker(line)

    if (text.startsWith(COMMAND_PREFIX)) {
      const commandText = text.slice(COMMAND_PREFIX.length).trim()

      if (color === "gray") {
        pending.push({ command: commandText, index: normalized.length })
        normalized.push(line)
        continue
      }

      if (color === "green" || color === "red") {
        let matchedIndex = -1
        for (let i = pending.length - 1; i >= 0; i--) {
          if (pending[i].command === commandText) {
            matchedIndex = pending[i].index
            pending.splice(i, 1)
            break
          }
        }

        if (matchedIndex >= 0) {
          normalized[matchedIndex] = line
        } else {
          normalized.push(line)
        }
        continue
      }
    }

    normalized.push(line)
  }

  return normalized
}
