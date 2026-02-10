/**
 * Named Tracers
 *
 * Provides named tracer instances for different subsystems.
 * Each tracer is scoped to a specific domain for better organization.
 */

import { trace, Tracer, Span, SpanStatusCode, context, SpanKind, ROOT_CONTEXT, INVALID_SPAN_CONTEXT } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import { isTracingEnabled } from './init.js';

/**
 * Lightweight no-op span used when tracing is disabled.
 * Avoids all OpenTelemetry context/span machinery.
 */
const NOOP_SPAN: Span = {
  spanContext: () => INVALID_SPAN_CONTEXT,
  setAttribute: () => NOOP_SPAN,
  setAttributes: () => NOOP_SPAN,
  addEvent: () => NOOP_SPAN,
  addLink: () => NOOP_SPAN,
  setStatus: () => NOOP_SPAN,
  updateName: () => NOOP_SPAN,
  end: () => {},
  isRecording: () => false,
  recordException: () => {},
};

/**
 * Tracer names for different subsystems
 */
export const TRACER_NAMES = {
  ENGINE: 'codemachine.engine',
  AGENT: 'codemachine.agent',
  MCP: 'codemachine.mcp',
  TUI: 'codemachine.tui',
  CLI: 'codemachine.cli',
  PROCESS: 'codemachine.process',
} as const;

/**
 * Get the engine tracer (for Codex, Claude, etc.)
 */
export function getEngineTracer(): Tracer {
  return trace.getTracer(TRACER_NAMES.ENGINE);
}

/**
 * Get the agent tracer (for agent lifecycle)
 */
export function getAgentTracer(): Tracer {
  return trace.getTracer(TRACER_NAMES.AGENT);
}

/**
 * Get the MCP tracer (for MCP operations)
 */
export function getMcpTracer(): Tracer {
  return trace.getTracer(TRACER_NAMES.MCP);
}

/**
 * Get the TUI tracer (for TUI operations)
 */
export function getTuiTracer(): Tracer {
  return trace.getTracer(TRACER_NAMES.TUI);
}

/**
 * Get the CLI tracer (for CLI commands)
 */
export function getCliTracer(): Tracer {
  return trace.getTracer(TRACER_NAMES.CLI);
}

/**
 * Get the process tracer (for process spawning)
 */
export function getProcessTracer(): Tracer {
  return trace.getTracer(TRACER_NAMES.PROCESS);
}

/**
 * Helper to wrap an async function with a span
 */
export async function withSpan<T>(
  tracer: Tracer,
  spanName: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    attributes?: Attributes;
    kind?: SpanKind;
  }
): Promise<T> {
  if (!isTracingEnabled()) {
    return fn(NOOP_SPAN);
  }
  return tracer.startActiveSpan(
    spanName,
    {
      attributes: options?.attributes,
      kind: options?.kind ?? SpanKind.INTERNAL,
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const err = error as Error;
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err.message,
        });
        span.recordException(err);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Helper to wrap a sync function with a span
 */
export function withSpanSync<T>(
  tracer: Tracer,
  spanName: string,
  fn: (span: Span) => T,
  options?: {
    attributes?: Attributes;
    kind?: SpanKind;
  }
): T {
  if (!isTracingEnabled()) {
    return fn(NOOP_SPAN);
  }
  const span = tracer.startSpan(spanName, {
    attributes: options?.attributes,
    kind: options?.kind ?? SpanKind.INTERNAL,
  });

  const ctx = trace.setSpan(context.active(), span);

  return context.with(ctx, () => {
    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const err = error as Error;
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });
      span.recordException(err);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Get the current active span (if any)
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Add an event to the current active span
 */
export function addSpanEvent(name: string, attributes?: Attributes): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set attributes on the current active span
 */
export function setSpanAttributes(attributes: Attributes): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Record an error on the current active span
 */
export function recordSpanError(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

/**
 * Helper to wrap an async function with a span that starts as a new root trace.
 * Use this for fire-and-forget operations that shouldn't be nested under the current span.
 */
export async function withRootSpan<T>(
  tracer: Tracer,
  spanName: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    attributes?: Attributes;
    kind?: SpanKind;
  }
): Promise<T> {
  if (!isTracingEnabled()) {
    return fn(NOOP_SPAN);
  }
  // Start span with ROOT_CONTEXT to break the parent chain
  const span = tracer.startSpan(
    spanName,
    {
      attributes: options?.attributes,
      kind: options?.kind ?? SpanKind.INTERNAL,
    },
    ROOT_CONTEXT
  );

  const ctx = trace.setSpan(ROOT_CONTEXT, span);

  return context.with(ctx, async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const err = error as Error;
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });
      span.recordException(err);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Start a span and run a function with it as the active context.
 * Unlike withSpan, you control when to end the span manually.
 * Returns the span and a cleanup function to properly end it.
 *
 * Use this when you need to end a span before an async operation completes
 * (e.g., ending boot span before blocking on TUI).
 */
export function startManualSpan<T>(
  tracer: Tracer,
  spanName: string,
  fn: (span: Span) => T,
  options?: {
    attributes?: Attributes;
    kind?: SpanKind;
  }
): { result: T; span: Span } {
  if (!isTracingEnabled()) {
    const result = fn(NOOP_SPAN);
    return { result, span: NOOP_SPAN };
  }
  const span = tracer.startSpan(spanName, {
    attributes: options?.attributes,
    kind: options?.kind ?? SpanKind.INTERNAL,
  });

  const ctx = trace.setSpan(context.active(), span);

  const result = context.with(ctx, () => fn(span));

  return { result, span };
}

/**
 * Async version of startManualSpan.
 * Runs the function with the span as active context, returns the span for manual ending.
 */
export async function startManualSpanAsync<T>(
  tracer: Tracer,
  spanName: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    attributes?: Attributes;
    kind?: SpanKind;
  }
): Promise<{ result: T; span: Span }> {
  if (!isTracingEnabled()) {
    const result = await fn(NOOP_SPAN);
    return { result, span: NOOP_SPAN };
  }
  const span = tracer.startSpan(spanName, {
    attributes: options?.attributes,
    kind: options?.kind ?? SpanKind.INTERNAL,
  });

  const ctx = trace.setSpan(context.active(), span);

  const result = await context.with(ctx, () => fn(span));

  return { result, span };
}
