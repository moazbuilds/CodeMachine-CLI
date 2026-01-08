/**
 * GitHub Copilot API Runner
 *
 * Makes API calls to the Copilot chat completions endpoint using streaming.
 * This is an API-based runner (no CLI dependency).
 */

import type { EngineRunOptions, EngineRunResult, ParsedTelemetry } from '../../../core/types.js';
import { getToken, isAuthenticated, clearAuth } from '../auth.js';
import { COPILOT_API_URL } from '../config.js';
import { metadata } from '../metadata.js';
import {
  formatStatus,
  formatCommand,
  formatResult,
  formatMessage,
} from '../../../../../shared/formatters/outputMarkers.js';
import { logger } from '../../../../../shared/logging/index.js';

/** Extended options specific to Copilot runner */
export interface RunCopilotOptions extends EngineRunOptions {
  systemPrompt?: string;
}

/** SSE data chunk from Copilot API */
interface StreamChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    delta?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Parse SSE data from the stream
 */
function parseSSELine(line: string): StreamChunk | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  const data = line.slice(6).trim();

  if (data === '[DONE]') {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Run a prompt against the Copilot API
 */
export async function runCopilot(options: RunCopilotOptions): Promise<EngineRunResult> {
  const {
    prompt,
    workingDir,
    model = 'gpt-4o',
    onData,
    onErrorData,
    onTelemetry,
    abortSignal,
    systemPrompt,
  } = options;

  if (!prompt) {
    throw new Error('runCopilot requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runCopilot requires a working directory.');
  }

  // Check authentication - don't auto-prompt since TUI needs to handle that
  const isAuthed = await isAuthenticated();
  if (!isAuthed) {
    throw new Error(
      'GitHub Copilot authentication required.\n' +
      'Please login first: Press "a" in the main menu to open Auth settings, then select "GitHub Copilot".'
    );
  }

  const token = getToken();
  if (!token) {
    throw new Error('Copilot token not available after authentication.');
  }

  logger.debug(
    `Copilot runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}, model: ${model}`
  );

  // Emit status
  onData?.(formatStatus('Copilot is analyzing your request...') + '\n');

  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let fullOutput = '';

  // Build messages
  const messages: Array<{ role: string; content: string }> = [];

  // Add system prompt if provided
  const effectiveSystemPrompt =
    systemPrompt ||
    `You are an expert software engineer. You are working in the directory: ${workingDir}. Be concise and helpful.`;

  messages.push({ role: 'system', content: effectiveSystemPrompt });
  messages.push({ role: 'user', content: prompt });

  try {
    const response = await fetch(COPILOT_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Editor-Version': 'codemachine/1.0.0',
        'Copilot-Integration-Id': 'codemachine',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: 16384,
        n: 1,
        temperature: 0,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Handle authentication errors
      if (response.status === 401) {
        await clearAuth();
        throw new Error(
          'Copilot session expired. Please re-authenticate by running authentication again.'
        );
      }

      // Handle rate limiting
      if (response.status === 429) {
        throw new Error('Copilot API rate limit exceeded. Please try again later.');
      }

      // Handle Copilot-specific errors
      if (response.status === 403) {
        throw new Error(
          'Access denied to Copilot API. Please ensure you have an active Copilot subscription.'
        );
      }

      throw new Error(`Copilot API error ${response.status}: ${errorText}`);
    }

    // Process the streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const parsed = parseSSELine(line);

        if (!parsed) {
          continue;
        }

        // Extract content from delta
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullOutput += content;
          // Format as message and emit
          onData?.(formatMessage(content) + '\n');
        }

        // Extract usage info if present
        if (parsed.usage) {
          inputTokens = parsed.usage.prompt_tokens || 0;
          outputTokens = parsed.usage.completion_tokens || 0;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const parsed = parseSSELine(buffer);
      if (parsed?.choices?.[0]?.delta?.content) {
        const content = parsed.choices[0].delta.content;
        fullOutput += content;
        onData?.(formatMessage(content) + '\n');
      }
      if (parsed?.usage) {
        inputTokens = parsed.usage.prompt_tokens || 0;
        outputTokens = parsed.usage.completion_tokens || 0;
      }
    }

    // Calculate duration
    const durationMs = Date.now() - startTime;

    // Emit telemetry
    if (onTelemetry) {
      const telemetry: ParsedTelemetry = {
        tokensIn: inputTokens,
        tokensOut: outputTokens,
        cached: 0,
        cost: 0, // Copilot is subscription-based, no per-token cost
        duration: durationMs,
      };
      onTelemetry(telemetry);
    }

    logger.debug(
      `Copilot completed - tokens: ${inputTokens}in/${outputTokens}out, duration: ${durationMs}ms`
    );

    // Emit completion status
    const tokenSummary = `Tokens: ${inputTokens}in/${outputTokens}out`;
    onData?.(formatCommand(tokenSummary, 'success') + '\n');

    return {
      stdout: fullOutput,
      stderr: '',
    };
  } catch (error) {
    const err = error as Error;

    // Check for abort
    if (err.name === 'AbortError') {
      logger.debug('Copilot request was aborted');
      return { stdout: fullOutput, stderr: 'Request was cancelled' };
    }

    // Log and re-throw other errors
    logger.error('Copilot API error', { error: err.message });

    const errorMsg = err.message || 'Unknown Copilot error';
    onErrorData?.(formatResult(errorMsg, true) + '\n');

    throw error;
  }
}
