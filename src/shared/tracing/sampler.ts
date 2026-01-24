/**
 * Tiered Sampler
 *
 * Implements tiered trace level sampling:
 * - Level 0: No tracing
 * - Level 1: Only errors and slow/important operations
 * - Level 2: Full tracing
 */

import type { Context, SpanKind, Attributes, Link } from '@opentelemetry/api';
import { SamplingDecision, SamplingResult, Sampler } from '@opentelemetry/sdk-trace-base';
import type { TraceLevel } from './config.js';

/**
 * Span names that are always sampled at level 1 (important operations)
 */
const IMPORTANT_SPAN_PATTERNS = [
  'engine.',      // Engine operations (codex, claude, etc.)
  'spawn',        // Process spawning
  'agent.',       // Agent lifecycle
  'mcp.',         // MCP operations
  'workflow.',    // Workflow operations
  'error',        // Error-related spans
];

/**
 * Check if a span name matches any of the important patterns
 */
function isImportantSpan(spanName: string): boolean {
  const lowerName = spanName.toLowerCase();
  return IMPORTANT_SPAN_PATTERNS.some(pattern => lowerName.includes(pattern));
}

/**
 * Check if attributes indicate an error
 */
function hasErrorAttribute(attributes: Attributes): boolean {
  return (
    attributes['error'] === true ||
    attributes['error.type'] !== undefined ||
    attributes['exception.type'] !== undefined ||
    attributes['otel.status_code'] === 'ERROR'
  );
}

/**
 * TieredSampler implements the OpenTelemetry Sampler interface
 * to provide tiered trace sampling based on configuration.
 */
export class TieredSampler implements Sampler {
  private level: TraceLevel;

  constructor(level: TraceLevel) {
    this.level = level;
  }

  /**
   * Determines whether a span should be sampled.
   *
   * @param context - The parent context
   * @param traceId - The trace ID
   * @param spanName - The name of the span
   * @param spanKind - The kind of span (client, server, internal, etc.)
   * @param attributes - Initial attributes on the span
   * @param links - Links to other spans
   * @returns SamplingResult indicating whether to sample
   */
  shouldSample(
    _context: Context,
    _traceId: string,
    spanName: string,
    _spanKind: SpanKind,
    attributes: Attributes,
    _links: Link[]
  ): SamplingResult {
    // Level 0: No tracing at all
    if (this.level === 0) {
      return {
        decision: SamplingDecision.NOT_RECORD,
      };
    }

    // Level 2: Full tracing - sample everything
    if (this.level === 2) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
      };
    }

    // Level 1: Minimal tracing - only errors and important operations
    // Always sample error spans
    if (hasErrorAttribute(attributes)) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
        attributes: { 'sampler.reason': 'error' },
      };
    }

    // Sample important operations (engines, spawns, agents, etc.)
    if (isImportantSpan(spanName)) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
        attributes: { 'sampler.reason': 'important' },
      };
    }

    // Don't sample other spans at level 1
    return {
      decision: SamplingDecision.NOT_RECORD,
    };
  }

  /**
   * Returns a description of the sampler for debugging
   */
  toString(): string {
    return `TieredSampler{level=${this.level}}`;
  }
}

/**
 * Create a sampler based on the trace level
 */
export function createSampler(level: TraceLevel): Sampler {
  return new TieredSampler(level);
}
