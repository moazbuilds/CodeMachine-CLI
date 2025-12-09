/**
 * Output formatting markers for structured log display
 * Provides consistent color-coded markers for thinking, commands, and results
 */

// Color marker constants
export const COLOR_GRAY = '[GRAY]';
export const COLOR_GREEN = '[GREEN]';
export const COLOR_RED = '[RED]';
export const COLOR_ORANGE = '[ORANGE]';
export const COLOR_CYAN = '[CYAN]';
export const COLOR_MAGENTA = '[MAGENTA]';

// Symbol constants
export const SYMBOL_BULLET = '●';
export const SYMBOL_NEST = '⎿';

// Color marker regex for parsing
const COLOR_MARKER_REGEX = /^\[(GRAY|GREEN|RED|ORANGE|CYAN|MAGENTA)\]/;
// Status marker regex for log file variants (no color processor applied)
const STATUS_MARKER_REGEX = /^\[(THINKING|SUCCESS|ERROR|RUNNING)\]/;

const STATUS_TO_COLOR: Record<string, 'gray' | 'green' | 'red' | 'orange'> = {
  THINKING: 'orange',
  SUCCESS: 'green',
  ERROR: 'red',
  RUNNING: 'gray',
};

/**
 * Add a color marker to text
 */
export function addMarker(color: 'GRAY' | 'GREEN' | 'RED' | 'ORANGE' | 'CYAN' | 'MAGENTA', text: string): string {
  return `[${color}]${text}`;
}

/**
 * Strip color marker and bold marker from text
 */
export function stripMarker(text: string): string {
  let result = text.replace(COLOR_MARKER_REGEX, '').replace(STATUS_MARKER_REGEX, '');
  // Strip bold markers (===)
  if (result.startsWith('===')) {
    result = result.substring(3);
  }
  return result;
}

/**
 * Parse color marker from text
 * Returns the color and text without marker
 */
export function parseMarker(text: string): { color: 'gray' | 'green' | 'red' | 'orange' | 'cyan' | 'magenta' | null; text: string } {
  const match = text.match(COLOR_MARKER_REGEX);
  if (match) {
    const color = match[1].toLowerCase() as 'gray' | 'green' | 'red' | 'orange' | 'cyan' | 'magenta';
    const textWithoutMarker = text.replace(COLOR_MARKER_REGEX, '');
    return { color, text: textWithoutMarker };
  }

  const statusMatch = text.match(STATUS_MARKER_REGEX);
  if (statusMatch) {
    const status = statusMatch[1];
    const color = STATUS_TO_COLOR[status] ?? null;
    const textWithoutMarker = text.replace(STATUS_MARKER_REGEX, '');
    return { color, text: textWithoutMarker };
  }

  return { color: null, text };
}

/**
 * Format thinking output
 */
export function formatThinking(text: string): string {
  return addMarker('ORANGE', `${SYMBOL_BULLET} Thinking: ${text}`);
}

/**
 * Format command output with dynamic color based on state
 */
export function formatCommand(
  command: string,
  state: 'started' | 'success' | 'error' = 'started'
): string {
  const color = state === 'error' ? 'RED' : state === 'success' ? 'GREEN' : 'GRAY';
  return addMarker(color, `${SYMBOL_BULLET} Command: ${command}`);
}

/**
 * Format nested result output
 */
export function formatResult(result: string, isError: boolean = false): string {
  const color = isError ? 'RED' : 'GREEN';
  const lines = result.split('\n');
  const formattedLines = lines.map((line) => {
    if (!line) {
      return addMarker(color, `${SYMBOL_NEST}`);
    }
    return addMarker(color, `${SYMBOL_NEST} ${line}`);
  });
  return formattedLines.join('\n');
}

/**
 * Format message output
 */
export function formatMessage(text: string): string {
  return addMarker('GRAY', `${SYMBOL_BULLET} Message: ${text}`);
}

/**
 * Format status output (cyan color for informational messages)
 */
export function formatStatus(text: string): string {
  return addMarker('CYAN', `${SYMBOL_BULLET} ${text}`);
}

/**
 * Format user input (magenta/purple color with user icon)
 */
export function formatUserInput(text: string): string {
  return addMarker('MAGENTA', `◆ User: ${text}`);
}
