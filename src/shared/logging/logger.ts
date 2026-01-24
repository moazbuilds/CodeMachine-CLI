import * as fs from 'node:fs';
import * as path from 'node:path';
import { format as formatMessage } from 'node:util';

/**
 * Logger utility that respects LOG_LEVEL environment variable
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

let debugLogStream: fs.WriteStream | null = null;
let appLogStream: fs.WriteStream | null = null;

/**
 * Global shutdown flag - when true, error/warn logs are suppressed
 * Set this when handling SIGINT/Ctrl+C for clean exit
 */
let isShuttingDown = false;

export function setShuttingDown(value: boolean): void {
  isShuttingDown = value;
}

export function getShuttingDown(): boolean {
  return isShuttingDown;
}

function resolveRequestedLevel(): string {
  const explicit = process.env.LOG_LEVEL;
  if (explicit && explicit.trim()) {
    return explicit.trim().toLowerCase();
  }

  // Fallback to DEBUG env flag (used by bun run dev)
  if (process.env.DEBUG && process.env.DEBUG.trim() !== '' && process.env.DEBUG !== '0' && process.env.DEBUG.toLowerCase() !== 'false') {
    return 'debug';
  }

  return 'info';
}

function getCurrentLogLevel(): LogLevel {
  const level = resolveRequestedLevel() as LogLevel;
  return LOG_LEVELS[level] !== undefined ? level : 'info';
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getCurrentLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function writeDebugLog(message: string, ...args: unknown[]): void {
  if (!debugLogStream) {
    console.error(message, ...args);
    return;
  }

  const timestamp = new Date().toISOString();
  const formatted = formatMessage(message, ...args);
  debugLogStream.write(`${timestamp} ${formatted}\n`);
}

export function setDebugLogFile(filePath: string | null): void {
  if (debugLogStream) {
    debugLogStream.end();
    debugLogStream = null;
  }

  if (!filePath) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  debugLogStream = fs.createWriteStream(filePath, { flags: 'a' });
}

/**
 * Get the global debug log path
 * Used when LOG_LEVEL=debug to ensure all processes (including MCP servers) write to the same file
 */
export function getGlobalDebugLogPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  return path.join(home, '.codemachine', 'logs', 'debug.log');
}

/**
 * Auto-initialize debug logging if LOG_LEVEL=debug
 *
 * Call this at the start of child processes (e.g., MCP servers) to enable
 * file-based debug logging. Uses a global well-known path so all processes
 * write to the same file.
 *
 * @returns true if logging was initialized, false if debug not enabled
 */
export function initDebugLogging(): boolean {
  // Only initialize if debug level is enabled and stream not already set
  if (debugLogStream) {
    return true;
  }

  if (shouldLog('debug')) {
    setDebugLogFile(getGlobalDebugLogPath());
    return true;
  }
  return false;
}

export function setAppLogFile(filePath: string | null): void {
  if (appLogStream) {
    appLogStream.end();
    appLogStream = null;
  }

  if (!filePath) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  appLogStream = fs.createWriteStream(filePath, { flags: 'a' });
}

function writeAppLog(message: string, ...args: unknown[]): void {
  if (!appLogStream) {
    return;
  }

  const timestamp = new Date().toISOString();
  const formatted = formatMessage(message, ...args);
  appLogStream.write(`${timestamp} ${formatted}\n`);
}

export function appDebug(message: string, ...args: unknown[]): void {
  if (shouldLog('debug')) {
    writeAppLog(`[DEBUG] ${message}`, ...args);
  }
}

export function debug(message: string, ...args: unknown[]): void {
  if (shouldLog('debug')) {
    writeDebugLog(`[DEBUG] ${message}`, ...args);
  }
}

export function info(message: string, ...args: unknown[]): void {
  if (shouldLog('info')) {
    // Write to debug log file only (not to UI)
    writeDebugLog(message, ...args);
  }
}

export function warn(message: string, ...args: unknown[]): void {
  if (isShuttingDown) return; // Suppress during graceful shutdown
  if (shouldLog('warn')) {
    // Write directly to stderr to bypass console hijacking
    const formatted = formatMessage(`[WARN] ${message}`, ...args);
    process.stderr.write(formatted + '\n');
  }
}

export function error(message: string, ...args: unknown[]): void {
  if (isShuttingDown) return; // Suppress during graceful shutdown
  if (shouldLog('error')) {
    // Write directly to stderr to bypass console hijacking
    const formatted = formatMessage(`[ERROR] ${message}`, ...args);
    process.stderr.write(formatted + '\n');
  }
}
