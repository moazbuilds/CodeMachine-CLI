import { describe, it, expect } from "bun:test"
import { formatTokens, formatNumber } from "../formatters"

describe("formatTokens", () => {
  it("should format tokens correctly", () => {
    expect(formatTokens(1000, 500)).toBe("1,000in/500out")
    expect(formatTokens(39652, 129)).toBe("39,652in/129out")
  })
})

describe("formatNumber", () => {
  it("should format numbers with commas", () => {
    expect(formatNumber(1000)).toBe("1,000")
    expect(formatNumber(18816)).toBe("18,816")
  })
})

describe("telemetry bar calculation", () => {
  // This tests the logic from telemetry-bar.tsx
  const calculateDisplayTokens = (tokensIn: number, tokensOut: number, cached?: number) => {
    const cachedAmount = cached ?? 0
    const newTokensIn = tokensIn - cachedAmount
    const base = formatTokens(newTokensIn, tokensOut)
    return cachedAmount > 0 ? `${base} (${formatNumber(cachedAmount)} cached)` : base
  }

  it("should subtract cached from input tokens", () => {
    // Example: 39,652 total in, 18,816 cached = 20,836 new tokens
    const result = calculateDisplayTokens(39652, 129, 18816)
    expect(result).toBe("20,836in/129out (18,816 cached)")
  })

  it("should show just tokens when no cache", () => {
    const result = calculateDisplayTokens(5000, 200)
    expect(result).toBe("5,000in/200out")
  })

  it("should handle zero cached", () => {
    const result = calculateDisplayTokens(5000, 200, 0)
    expect(result).toBe("5,000in/200out")
  })

  it("should handle all tokens cached", () => {
    // Edge case: all input tokens are cached
    const result = calculateDisplayTokens(10000, 100, 10000)
    expect(result).toBe("0in/100out (10,000 cached)")
  })
})
