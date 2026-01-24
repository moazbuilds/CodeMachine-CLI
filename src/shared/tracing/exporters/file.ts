/**
 * File Exporter
 *
 * Custom SpanExporter that writes spans to JSON files.
 * Used for bug reports and offline analysis.
 */

import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SerializedSpan } from '../storage.js';

/**
 * Convert OpenTelemetry HrTime to milliseconds
 */
function hrTimeToMs(hrTime: [number, number]): number {
  return hrTime[0] * 1000 + hrTime[1] / 1_000_000;
}

/**
 * Serialize a span to a JSON-friendly format
 */
function serializeSpan(span: ReadableSpan): SerializedSpan {
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
}

/**
 * FileSpanExporter writes spans to JSON files in a specified directory.
 *
 * File structure:
 * - traces/latest.json - Most recent trace file (overwritten)
 * - traces/YYYY-MM-DD/HH-MM-SS.json - Timestamped files
 */
export class FileSpanExporter implements SpanExporter {
  private tracesDir: string;
  private sessionFile: string;
  private spans: SerializedSpan[] = [];
  private maxSpansPerFile = 1000;

  constructor(tracesDir: string) {
    this.tracesDir = tracesDir;

    // Ensure traces directory exists
    if (!existsSync(this.tracesDir)) {
      mkdirSync(this.tracesDir, { recursive: true });
    }

    // Create session file path
    const now = new Date();
    const dateDir = join(
      this.tracesDir,
      now.toISOString().split('T')[0] // YYYY-MM-DD
    );

    if (!existsSync(dateDir)) {
      mkdirSync(dateDir, { recursive: true });
    }

    const timeStr = now.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0];
    this.sessionFile = join(dateDir, `${timeStr}.json`);
  }

  /**
   * Export spans to file
   */
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    try {
      const serialized = spans.map(serializeSpan);
      this.spans.push(...serialized);

      // Write to session file
      this.writeToFile();

      // Also update latest.json symlink/copy
      this.updateLatest();

      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: error as Error,
      });
    }
  }

  /**
   * Write accumulated spans to the session file
   */
  private writeToFile(): void {
    // Trim if too many spans
    if (this.spans.length > this.maxSpansPerFile) {
      this.spans = this.spans.slice(-this.maxSpansPerFile);
    }

    const data = {
      version: 1,
      service: 'codemachine',
      exportedAt: new Date().toISOString(),
      spanCount: this.spans.length,
      spans: this.spans,
    };

    writeFileSync(this.sessionFile, JSON.stringify(data, null, 2));
  }

  /**
   * Update the latest.json file with current session data
   */
  private updateLatest(): void {
    const latestPath = join(this.tracesDir, 'latest.json');
    const data = {
      version: 1,
      service: 'codemachine',
      exportedAt: new Date().toISOString(),
      spanCount: this.spans.length,
      sessionFile: this.sessionFile,
      spans: this.spans,
    };

    writeFileSync(latestPath, JSON.stringify(data, null, 2));
  }

  /**
   * Shutdown the exporter
   */
  async shutdown(): Promise<void> {
    // Final write on shutdown
    if (this.spans.length > 0) {
      this.writeToFile();
      this.updateLatest();
    }
  }

  /**
   * Force flush any pending spans
   */
  async forceFlush(): Promise<void> {
    if (this.spans.length > 0) {
      this.writeToFile();
      this.updateLatest();
    }
  }

  /**
   * Get the current session file path
   */
  getSessionFilePath(): string {
    return this.sessionFile;
  }

  /**
   * Get the latest.json file path
   */
  getLatestFilePath(): string {
    return join(this.tracesDir, 'latest.json');
  }
}

/**
 * Read spans from a trace file
 */
export function readTraceFile(filePath: string): SerializedSpan[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.spans || [];
  } catch {
    return [];
  }
}
