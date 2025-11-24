export interface ParsedTelemetry {
  tokensIn: number
  tokensOut: number
  cached?: number
  cost?: number
  duration?: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
}

export function parseTelemetryChunk(chunk: string): ParsedTelemetry | null {
  const tokensMatch = chunk.match(/Tokens:\s*(\d+(?:,\d{3})*)in\/(\d+(?:,\d{3})*)out/i)
  if (!tokensMatch) return null

  const tokensIn = parseInt(tokensMatch[1].replace(/,/g, ""), 10)
  const tokensOut = parseInt(tokensMatch[2].replace(/,/g, ""), 10)

  const result: ParsedTelemetry = { tokensIn, tokensOut }

  const cachedMatch = chunk.match(/\((\d+(?:,\d{3})*)\s*cached\)/i)
  if (cachedMatch) {
    result.cached = parseInt(cachedMatch[1].replace(/,/g, ""), 10)
  }

  const costMatch = chunk.match(/Cost:\s*\$(\d+\.\d+)/i)
  if (costMatch) {
    result.cost = parseFloat(costMatch[1])
  }

  const durationMatch = chunk.match(/Duration:\s*(\d+)ms/i)
  if (durationMatch) {
    result.duration = parseInt(durationMatch[1], 10) / 1000
  }

  return result
}
