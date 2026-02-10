/**
 * OpenTelemetry Logger Module
 *
 * Provides named loggers matching tracer names (BOOT, CLI, TUI, ENGINE, AGENT)
 * and emits OTel logs with automatic trace correlation.
 */

import { logs, SeverityNumber, Logger, LogAttributes } from '@opentelemetry/api-logs';
import { trace, context } from '@opentelemetry/api';

/**
 * Logger names matching tracer names for consistency
 */
export const LOGGER_NAMES = {
  BOOT: 'codemachine.boot',
  CLI: 'codemachine.cli',
  TUI: 'codemachine.tui',
  ENGINE: 'codemachine.engine',
  AGENT: 'codemachine.agent',
  MCP: 'codemachine.mcp',
  PROCESS: 'codemachine.process',
} as const;

/**
 * Whether OTel logging is enabled
 */
let otelLoggingEnabled = false;

/**
 * Enable or disable OTel logging
 */
export function setOTelLoggingEnabled(enabled: boolean): void {
  otelLoggingEnabled = enabled;
}

/**
 * Check if OTel logging is enabled
 */
export function isOTelLoggingEnabled(): boolean {
  return otelLoggingEnabled;
}

/**
 * Get a named OTel logger
 */
export function getOTelLogger(name: string): Logger {
  return logs.getLogger(name);
}

/**
 * Emit an OTel log with automatic trace correlation
 *
 * @param loggerName - The logger name (use LOGGER_NAMES)
 * @param severityNumber - The severity level (use SeverityNumber from @opentelemetry/api-logs)
 * @param message - The log message
 * @param attributes - Optional additional attributes
 */
export function emitOTelLog(
  loggerName: string,
  severityNumber: SeverityNumber,
  message: string,
  attributes?: LogAttributes
): void {
  if (!otelLoggingEnabled) {
    return;
  }

  const logger = getOTelLogger(loggerName);

  // Get current span for trace correlation
  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan?.spanContext();

  // Build attributes with trace correlation
  const logAttributes: LogAttributes = {
    ...attributes,
  };

  // Add trace correlation if we have an active span
  if (spanContext && spanContext.traceId && spanContext.spanId) {
    logAttributes['trace.id'] = spanContext.traceId;
    logAttributes['span.id'] = spanContext.spanId;
  }

  // Emit the log record
  logger.emit({
    severityNumber,
    severityText: getSeverityText(severityNumber),
    body: message,
    attributes: logAttributes,
  });
}

/**
 * Get severity text from severity number
 */
function getSeverityText(severityNumber: SeverityNumber): string {
  switch (severityNumber) {
    case SeverityNumber.TRACE:
    case SeverityNumber.TRACE2:
    case SeverityNumber.TRACE3:
    case SeverityNumber.TRACE4:
      return 'TRACE';
    case SeverityNumber.DEBUG:
    case SeverityNumber.DEBUG2:
    case SeverityNumber.DEBUG3:
    case SeverityNumber.DEBUG4:
      return 'DEBUG';
    case SeverityNumber.INFO:
    case SeverityNumber.INFO2:
    case SeverityNumber.INFO3:
    case SeverityNumber.INFO4:
      return 'INFO';
    case SeverityNumber.WARN:
    case SeverityNumber.WARN2:
    case SeverityNumber.WARN3:
    case SeverityNumber.WARN4:
      return 'WARN';
    case SeverityNumber.ERROR:
    case SeverityNumber.ERROR2:
    case SeverityNumber.ERROR3:
    case SeverityNumber.ERROR4:
      return 'ERROR';
    case SeverityNumber.FATAL:
    case SeverityNumber.FATAL2:
    case SeverityNumber.FATAL3:
    case SeverityNumber.FATAL4:
      return 'FATAL';
    default:
      return 'UNSPECIFIED';
  }
}

// Re-export SeverityNumber for convenience
export { SeverityNumber };
