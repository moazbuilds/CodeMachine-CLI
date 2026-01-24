/**
 * In-Memory Span Storage
 *
 * Buffers recent spans for bug reports and diagnostics.
 * Uses a circular buffer to limit memory usage.
 */

import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

/**
 * Maximum number of spans to keep in memory
 */
const MAX_SPANS = 100;

/**
 * Circular buffer for storing spans
 */
const spanBuffer: ReadableSpan[] = [];

/**
 * Last error context (for bug reports)
 */
let lastError: { message: string; stack?: string; timestamp: string } | null = null;

/**
 * Serializable span data for bug reports
 */
export interface SerializedSpan {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: {
    code: number;
    message?: string;
  };
  attributes: Record<string, unknown>;
  events: Array<{
    name: string;
    time: number;
    attributes?: Record<string, unknown>;
  }>;
}

/**
 * Add a span to the in-memory buffer
 * Called by the BufferingSpanProcessor when a span ends
 */
export function addSpan(span: ReadableSpan): void {
  spanBuffer.push(span);
  if (spanBuffer.length > MAX_SPANS) {
    spanBuffer.shift(); // Remove oldest span
  }
}

/**
 * Get all buffered spans (raw OpenTelemetry format)
 */
export function getSpans(): ReadableSpan[] {
  return [...spanBuffer];
}

/**
 * Get all buffered spans in a serializable format
 * Used for bug reports and file export
 */
export function getSerializedSpans(): SerializedSpan[] {
  return spanBuffer.map(span => {
    const startTimeMs = hrTimeToMs(span.startTime);
    const endTimeMs = hrTimeToMs(span.endTime);

    return {
      name: span.name,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: span.parentSpanContext?.spanId,
      startTime: startTimeMs,
      endTime: endTimeMs,
      duration: endTimeMs - startTimeMs,
      status: {
        code: span.status.code,
        message: span.status.message,
      },
      attributes: { ...span.attributes },
      events: span.events.map(event => ({
        name: event.name,
        time: hrTimeToMs(event.time),
        attributes: event.attributes ? { ...event.attributes } : undefined,
      })),
    };
  });
}

/**
 * Convert OpenTelemetry HrTime to milliseconds
 */
function hrTimeToMs(hrTime: [number, number]): number {
  return hrTime[0] * 1000 + hrTime[1] / 1_000_000;
}

/**
 * Clear the span buffer (e.g., on new session start)
 */
export function clearSpans(): void {
  spanBuffer.length = 0;
}

/**
 * Get the current span count
 */
export function getSpanCount(): number {
  return spanBuffer.length;
}

/**
 * Save error context for bug reports
 */
export function saveErrorContext(error: Error): void {
  lastError = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get the last error context
 */
export function getLastError(): { message: string; stack?: string; timestamp: string } | null {
  return lastError;
}

/**
 * Clear the last error context
 */
export function clearLastError(): void {
  lastError = null;
}
