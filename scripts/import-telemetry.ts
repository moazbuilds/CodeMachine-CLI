#!/usr/bin/env bun
/**
 * Import Telemetry Script
 *
 * Imports CodeMachine trace and log JSON files into the Grafana/Tempo/Loki stack.
 * Useful for viewing user bug reports with full visualization.
 *
 * Usage:
 *   bun scripts/import-telemetry.ts <path-to-traces-dir>
 *   bun scripts/import-telemetry.ts ~/.codemachine/traces
 *   bun scripts/import-telemetry.ts ./bug-report/traces
 *
 * Options:
 *   --loki-url    Loki push URL (default: http://localhost:3100)
 *   --tempo-url   Tempo OTLP URL (default: http://localhost:4318)
 *   --logs-only   Only import logs
 *   --traces-only Only import traces
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

// Configuration
interface Config {
  lokiUrl: string;
  tempoUrl: string;
  logsOnly: boolean;
  tracesOnly: boolean;
  sourcePath: string;
}

// Our serialized formats (from the exporters)
interface SerializedSpan {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number; // ms
  endTime: number; // ms
  duration: number; // ms
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

interface TraceFile {
  version: number;
  service: string;
  exportedAt: string;
  spanCount: number;
  spans: SerializedSpan[];
}

interface SerializedLog {
  timestamp: [number, number]; // [seconds, nanoseconds]
  severityNumber: number;
  severityText?: string;
  body: unknown;
  attributes: Record<string, unknown>;
  resource?: Record<string, unknown>;
}

interface LogFile {
  version: number;
  service: string;
  exportedAt: string;
  logCount: number;
  logs: SerializedLog[];
}

// Parse command line arguments
function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    lokiUrl: 'http://localhost:3100',
    tempoUrl: 'http://localhost:4318',
    logsOnly: false,
    tracesOnly: false,
    sourcePath: '',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--loki-url' && args[i + 1]) {
      config.lokiUrl = args[++i];
    } else if (arg === '--tempo-url' && args[i + 1]) {
      config.tempoUrl = args[++i];
    } else if (arg === '--logs-only') {
      config.logsOnly = true;
    } else if (arg === '--traces-only') {
      config.tracesOnly = true;
    } else if (!arg.startsWith('-')) {
      config.sourcePath = arg;
    }
  }

  return config;
}

// Find trace and log files in a directory
function findFiles(dir: string): { traceFiles: string[]; logFiles: string[] } {
  const traceFiles: string[] = [];
  const logFiles: string[] = [];

  function scan(path: string) {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) {
        scan(join(path, entry));
      }
    } else if (stat.isFile() && path.endsWith('.json')) {
      const name = basename(path);
      if (name.includes('-logs') || name === 'latest-logs.json') {
        logFiles.push(path);
      } else if (!name.includes('-logs')) {
        traceFiles.push(path);
      }
    }
  }

  scan(dir);
  return { traceFiles, logFiles };
}

// Convert our span format to OTLP JSON format
function spansToOTLP(spans: SerializedSpan[], serviceName: string): object {
  // Group spans by trace ID
  const spansByTrace = new Map<string, SerializedSpan[]>();
  for (const span of spans) {
    const existing = spansByTrace.get(span.traceId) || [];
    existing.push(span);
    spansByTrace.set(span.traceId, existing);
  }

  // Convert to OTLP format
  const resourceSpans = [
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: serviceName } },
          { key: 'telemetry.sdk.name', value: { stringValue: 'codemachine-import' } },
        ],
      },
      scopeSpans: [
        {
          scope: { name: 'codemachine.import' },
          spans: spans.map((span) => ({
            traceId: hexToBytes(span.traceId),
            spanId: hexToBytes(span.spanId),
            parentSpanId: span.parentSpanId ? hexToBytes(span.parentSpanId) : undefined,
            name: span.name,
            kind: 1, // INTERNAL
            startTimeUnixNano: String(Math.floor(span.startTime * 1_000_000)),
            endTimeUnixNano: String(Math.floor(span.endTime * 1_000_000)),
            attributes: Object.entries(span.attributes || {}).map(([key, value]) => ({
              key,
              value: attributeValue(value),
            })),
            status: {
              code: span.status.code === 2 ? 2 : span.status.code === 1 ? 1 : 0,
              message: span.status.message,
            },
            events: (span.events || []).map((event) => ({
              name: event.name,
              timeUnixNano: String(Math.floor(event.time * 1_000_000)),
              attributes: Object.entries(event.attributes || {}).map(([key, value]) => ({
                key,
                value: attributeValue(value),
              })),
            })),
          })),
        },
      ],
    },
  ];

  return { resourceSpans };
}

// Convert hex string to byte array for OTLP JSON
// OTLP JSON expects byte arrays as base64-encoded strings
function hexToBytes(hex: string): string {
  // For OTLP JSON format, we need to provide hex string directly
  // The receiver expects lowercase hex
  return hex.toLowerCase();
}

// Convert a value to OTLP attribute value format
function attributeValue(value: unknown): object {
  if (typeof value === 'string') {
    return { stringValue: value };
  } else if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { intValue: String(value) };
    }
    return { doubleValue: value };
  } else if (typeof value === 'boolean') {
    return { boolValue: value };
  } else if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(attributeValue) } };
  }
  return { stringValue: String(value) };
}

// Convert our log format to Loki push format
function logsToLokiFormat(logs: SerializedLog[], serviceName: string): object {
  // Group logs by their label set
  const streams = new Map<string, Array<[string, string]>>();

  for (const log of logs) {
    // Build labels
    const labels: Record<string, string> = {
      service_name: serviceName,
      severity_text: log.severityText || 'UNSPECIFIED',
      imported: 'true',
    };

    // Add trace correlation if present
    if (log.attributes['trace.id']) {
      labels.trace_id = String(log.attributes['trace.id']);
    }
    if (log.attributes['span.id']) {
      labels.span_id = String(log.attributes['span.id']);
    }

    // Create label key for grouping
    const labelKey = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    // Convert timestamp
    const [seconds, nanos] = log.timestamp;
    const timestampNs = String(BigInt(seconds) * BigInt(1_000_000_000) + BigInt(nanos));

    // Format log line
    const logLine = typeof log.body === 'string' ? log.body : JSON.stringify(log.body);

    // Add to stream
    const existing = streams.get(labelKey) || [];
    existing.push([timestampNs, logLine]);
    streams.set(labelKey, existing);
  }

  // Convert to Loki format
  const lokiStreams = Array.from(streams.entries()).map(([labelKey, values]) => ({
    stream: Object.fromEntries(
      labelKey.split(',').map((pair) => {
        const [key, value] = pair.split('=');
        return [key, value.replace(/^"|"$/g, '')];
      })
    ),
    values: values.sort((a, b) => a[0].localeCompare(b[0])),
  }));

  return { streams: lokiStreams };
}

// Send traces to Tempo via OTLP
async function sendTracesToTempo(spans: SerializedSpan[], serviceName: string, tempoUrl: string): Promise<void> {
  const otlpData = spansToOTLP(spans, serviceName);
  const url = `${tempoUrl}/v1/traces`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(otlpData),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to send traces to Tempo: ${response.status} ${text}`);
  }
}

// Send logs to Loki
async function sendLogsToLoki(logs: SerializedLog[], serviceName: string, lokiUrl: string): Promise<void> {
  const lokiData = logsToLokiFormat(logs, serviceName);
  const url = `${lokiUrl}/loki/api/v1/push`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(lokiData),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to send logs to Loki: ${response.status} ${text}`);
  }
}

// Read and parse a JSON file
function readJsonFile<T>(path: string): T | null {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Failed to read ${path}:`, error);
    return null;
  }
}

// Main function
async function main() {
  const config = parseArgs();

  if (!config.sourcePath) {
    console.log(`
Usage: bun scripts/import-telemetry.ts <path-to-traces-dir>

Examples:
  bun scripts/import-telemetry.ts .codemachine/traces
  bun scripts/import-telemetry.ts ~/Downloads/bug-report-traces
  bun scripts/import-telemetry.ts ./traces --loki-url http://localhost:3100

Options:
  --loki-url <url>   Loki URL (default: http://localhost:3100)
  --tempo-url <url>  Tempo OTLP URL (default: http://localhost:4318)
  --logs-only        Only import logs
  --traces-only      Only import traces
`);
    process.exit(1);
  }

  if (!existsSync(config.sourcePath)) {
    console.error(`Path not found: ${config.sourcePath}`);
    process.exit(1);
  }

  console.log(`Importing telemetry from: ${config.sourcePath}`);
  console.log(`Loki URL: ${config.lokiUrl}`);
  console.log(`Tempo URL: ${config.tempoUrl}`);
  console.log('');

  // Find files
  const stat = statSync(config.sourcePath);
  let traceFiles: string[] = [];
  let logFiles: string[] = [];

  if (stat.isDirectory()) {
    const found = findFiles(config.sourcePath);
    traceFiles = found.traceFiles;
    logFiles = found.logFiles;
  } else {
    // Single file
    const name = basename(config.sourcePath);
    if (name.includes('-logs') || name === 'latest-logs.json') {
      logFiles = [config.sourcePath];
    } else {
      traceFiles = [config.sourcePath];
    }
  }

  console.log(`Found ${traceFiles.length} trace file(s) and ${logFiles.length} log file(s)`);
  console.log('');

  // Import traces
  if (!config.logsOnly && traceFiles.length > 0) {
    console.log('Importing traces...');
    let totalSpans = 0;

    for (const file of traceFiles) {
      const data = readJsonFile<TraceFile>(file);
      if (!data || !data.spans || data.spans.length === 0) {
        console.log(`  Skipping ${basename(file)} (no spans)`);
        continue;
      }

      try {
        await sendTracesToTempo(data.spans, data.service || 'codemachine', config.tempoUrl);
        totalSpans += data.spans.length;
        console.log(`  Imported ${data.spans.length} spans from ${basename(file)}`);
      } catch (error) {
        console.error(`  Failed to import ${basename(file)}:`, error);
      }
    }

    console.log(`Total: ${totalSpans} spans imported`);
    console.log('');
  }

  // Import logs
  if (!config.tracesOnly && logFiles.length > 0) {
    console.log('Importing logs...');
    let totalLogs = 0;

    for (const file of logFiles) {
      const data = readJsonFile<LogFile>(file);
      if (!data || !data.logs || data.logs.length === 0) {
        console.log(`  Skipping ${basename(file)} (no logs)`);
        continue;
      }

      try {
        await sendLogsToLoki(data.logs, data.service || 'codemachine', config.lokiUrl);
        totalLogs += data.logs.length;
        console.log(`  Imported ${data.logs.length} logs from ${basename(file)}`);
      } catch (error) {
        console.error(`  Failed to import ${basename(file)}:`, error);
      }
    }

    console.log(`Total: ${totalLogs} logs imported`);
    console.log('');
  }

  console.log('Done! View in Grafana at http://localhost:3000');
  console.log('');
  console.log('Tips:');
  console.log('  - Imported logs have label: imported="true"');
  console.log('  - Query imported logs: {service_name="codemachine", imported="true"}');
  console.log('  - Traces appear in Tempo under service "codemachine"');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
