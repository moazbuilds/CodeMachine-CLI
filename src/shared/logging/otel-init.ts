/**
 * OpenTelemetry Logging Initialization
 *
 * Initializes the LoggerProvider with the appropriate exporters.
 * Reuses tracing configuration (enabled when CODEMACHINE_TRACE >= 1).
 */

import { logs } from '@opentelemetry/api-logs';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
  SimpleLogRecordProcessor,
  LogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
import type { ReadableLogRecord } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode } from '@opentelemetry/core';

import { getConfig, type TracingConfig } from '../tracing/config.js';
import { setOTelLoggingEnabled } from './otel-logger.js';

/**
 * Global LoggerProvider instance
 */
let loggerProvider: LoggerProvider | null = null;

/**
 * Whether logging has been initialized
 */
let initialized = false;

/**
 * Serialized log record format
 */
interface SerializedLogRecord {
  timestamp: [number, number];
  severityNumber: number;
  severityText: string | undefined;
  body: unknown;
  attributes: Record<string, unknown>;
  resource: Record<string, unknown> | undefined;
}

/**
 * File-based log exporter for writing logs to JSON files.
 *
 * File structure (mirrors tracing):
 * - traces/latest-logs.json - Most recent session logs (overwritten each session)
 * - traces/YYYY-MM-DD/HH-MM-SS-logs.json - Timestamped session files
 */
class FileLogExporter implements LogRecordExporter {
  private tracesDir: string;
  private sessionFile: string | null = null;
  private logs: SerializedLogRecord[] = [];
  private maxLogsPerFile = 1000;
  private fs: typeof import('node:fs') | null = null;
  private path: typeof import('node:path') | null = null;
  private initialized = false;

  constructor(tracesDir: string) {
    this.tracesDir = tracesDir;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Lazy load modules
    this.fs = await import('node:fs');
    this.path = await import('node:path');

    // Ensure traces directory exists
    if (!this.fs.existsSync(this.tracesDir)) {
      this.fs.mkdirSync(this.tracesDir, { recursive: true });
    }

    // Create session file path
    const now = new Date();
    const dateDir = this.path.join(
      this.tracesDir,
      now.toISOString().split('T')[0] // YYYY-MM-DD
    );

    if (!this.fs.existsSync(dateDir)) {
      this.fs.mkdirSync(dateDir, { recursive: true });
    }

    const timeStr = now.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0];
    this.sessionFile = this.path.join(dateDir, `${timeStr}-logs.json`);

    this.initialized = true;
  }

  private writeToFile(): void {
    if (!this.fs || !this.path || !this.sessionFile) return;

    // Trim if too many logs
    if (this.logs.length > this.maxLogsPerFile) {
      this.logs = this.logs.slice(-this.maxLogsPerFile);
    }

    const data = {
      version: 1,
      service: 'codemachine',
      exportedAt: new Date().toISOString(),
      logCount: this.logs.length,
      logs: this.logs,
    };

    this.fs.writeFileSync(this.sessionFile, JSON.stringify(data, null, 2));
  }

  private updateLatest(): void {
    if (!this.fs || !this.path) return;

    const latestPath = this.path.join(this.tracesDir, 'latest-logs.json');
    const data = {
      version: 1,
      service: 'codemachine',
      exportedAt: new Date().toISOString(),
      logCount: this.logs.length,
      sessionFile: this.sessionFile,
      logs: this.logs,
    };

    this.fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
  }

  export(
    logRecords: ReadableLogRecord[],
    resultCallback: (result: ExportResult) => void
  ): void {
    this.ensureInitialized()
      .then(() => {
        // Convert log records to serializable format
        const serializedLogs: SerializedLogRecord[] = logRecords.map((record) => ({
          timestamp: record.hrTime,
          severityNumber: record.severityNumber,
          severityText: record.severityText,
          body: record.body,
          attributes: record.attributes as Record<string, unknown>,
          resource: record.resource?.attributes as Record<string, unknown> | undefined,
        }));

        // Accumulate logs for this session
        this.logs.push(...serializedLogs);

        // Write to session file and update latest
        this.writeToFile();
        this.updateLatest();

        resultCallback({ code: ExportResultCode.SUCCESS });
      })
      .catch(() => {
        resultCallback({ code: ExportResultCode.FAILED });
      });
  }

  async shutdown(): Promise<void> {
    // Final write on shutdown
    if (this.logs.length > 0 && this.initialized) {
      this.writeToFile();
      this.updateLatest();
    }
  }
}

/**
 * No-op log exporter that discards all logs
 */
class NoopLogExporter implements LogRecordExporter {
  export(
    _logRecords: ReadableLogRecord[],
    resultCallback: (result: ExportResult) => void
  ): void {
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}

/**
 * Create log exporter based on configuration
 */
function createLogExporter(config: TracingConfig): LogRecordExporter {
  switch (config.exporter) {
    case 'otlp': {
      // Derive logs endpoint from traces endpoint
      // e.g., http://localhost:4318/v1/traces -> http://localhost:4318/v1/logs
      const logsEndpoint = config.otlpEndpoint.replace('/v1/traces', '/v1/logs');
      return new OTLPLogExporter({
        url: logsEndpoint,
        headers: {},
      });
    }

    case 'file':
      return new FileLogExporter(config.tracesDir);

    case 'none':
      return new NoopLogExporter();

    default:
      // Default to file exporter
      return new FileLogExporter(config.tracesDir);
  }
}

/**
 * Create log processor based on configuration
 */
function createLogProcessor(config: TracingConfig): LogRecordProcessor {
  const exporter = createLogExporter(config);

  // Use BatchLogRecordProcessor for OTLP, SimpleLogRecordProcessor for file
  if (config.exporter === 'otlp') {
    return new BatchLogRecordProcessor(exporter, {
      maxQueueSize: 100,
      maxExportBatchSize: 50,
      scheduledDelayMillis: 1000,
    });
  }

  // For file exporter, use simple processor for immediate writes
  return new SimpleLogRecordProcessor(exporter);
}

/**
 * Initialize OpenTelemetry logging
 *
 * Should be called after tracing initialization.
 * Returns true if logging was initialized, false if tracing is disabled.
 */
export async function initOTelLogging(): Promise<boolean> {
  // Only initialize once
  if (initialized) {
    return loggerProvider !== null;
  }

  const config = getConfig();

  // OTel logging is only enabled when tracing is enabled
  if (!config.enabled) {
    initialized = true;
    setOTelLoggingEnabled(false);
    return false;
  }

  try {
    // Create the resource (service metadata)
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || 'unknown',
      'deployment.environment': process.env.NODE_ENV || 'development',
    });

    // Create the log processor
    const processor = createLogProcessor(config);

    // Create the logger provider with processors
    loggerProvider = new LoggerProvider({
      resource,
      processors: [processor],
    });

    // Register the logger provider globally
    logs.setGlobalLoggerProvider(loggerProvider);

    // Enable OTel logging
    setOTelLoggingEnabled(true);
    initialized = true;

    // Log initialization (only in debug mode)
    if (process.env.DEBUG) {
      const exporterDesc =
        config.exporter === 'otlp'
          ? `OTLP (${config.otlpEndpoint.replace('/v1/traces', '/v1/logs')})`
          : config.exporter === 'file'
            ? `File (${config.tracesDir})`
            : config.exporter;
      console.log(`[OTelLogging] Initialized: exporter=${exporterDesc}`);
    }

    return true;
  } catch (error) {
    // Don't fail the application if logging fails to initialize
    if (process.env.DEBUG) {
      console.error('[OTelLogging] Failed to initialize:', error);
    }
    initialized = true;
    setOTelLoggingEnabled(false);
    return false;
  }
}

/**
 * Shutdown OpenTelemetry logging
 *
 * Should be called during application shutdown to flush pending logs.
 */
export async function shutdownOTelLogging(): Promise<void> {
  if (loggerProvider) {
    try {
      // Force flush all pending logs
      await loggerProvider.forceFlush();
      await loggerProvider.shutdown();
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('[OTelLogging] Error during shutdown:', error);
      }
    }
    loggerProvider = null;
  }
  setOTelLoggingEnabled(false);
  initialized = false;
}

/**
 * Check if OTel logging has been initialized
 */
export function isOTelLoggingInitialized(): boolean {
  return initialized && loggerProvider !== null;
}
