/**
 * MCP Signal Detector
 *
 * Detects workflow signals from agent stream-json output.
 * This provides an alternative detection path by watching for MCP tool calls
 * in the streaming output from Claude Code or Codex.
 */

import type {
  ProposeStepCompletion,
  ApproveStepTransition,
} from '../../../infra/mcp/index.js';

// ============================================================================
// TYPES
// ============================================================================

export type MCPSignalType = 'proposal' | 'approval' | 'get_proposal';

export interface DetectedMCPSignal {
  type: MCPSignalType;
  toolName: string;
  arguments: Record<string, unknown>;
  timestamp: number;
}

export interface ProposalSignal extends DetectedMCPSignal {
  type: 'proposal';
  toolName: 'propose_step_completion';
  arguments: ProposeStepCompletion;
}

export interface ApprovalSignal extends DetectedMCPSignal {
  type: 'approval';
  toolName: 'approve_step_transition';
  arguments: ApproveStepTransition;
}

// ============================================================================
// STREAM JSON PARSERS
// ============================================================================

/**
 * Detect MCP tool calls from Claude Code stream-json output
 *
 * Claude Code outputs JSON like:
 * {
 *   "type": "assistant",
 *   "message": {
 *     "content": [
 *       { "type": "tool_use", "name": "propose_step_completion", "input": {...} }
 *     ]
 *   }
 * }
 */
export function detectClaudeMCPSignal(line: string): DetectedMCPSignal | null {
  try {
    const json = JSON.parse(line);

    if (json.type !== 'assistant' || !json.message?.content) {
      return null;
    }

    for (const content of json.message.content) {
      if (content.type !== 'tool_use') continue;

      const toolName = content.name;
      const args = content.input || {};

      // Check for our workflow signal tools
      if (toolName === 'propose_step_completion') {
        return {
          type: 'proposal',
          toolName,
          arguments: args,
          timestamp: Date.now(),
        };
      }

      if (toolName === 'approve_step_transition') {
        return {
          type: 'approval',
          toolName,
          arguments: args,
          timestamp: Date.now(),
        };
      }

      if (toolName === 'get_pending_proposal') {
        return {
          type: 'get_proposal',
          toolName,
          arguments: args,
          timestamp: Date.now(),
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect MCP tool calls from Codex stream-json output
 *
 * Codex outputs JSON like:
 * {
 *   "type": "item.started",
 *   "item": { "type": "mcp_tool_call", "name": "propose_step_completion", "arguments": {...} }
 * }
 */
export function detectCodexMCPSignal(line: string): DetectedMCPSignal | null {
  try {
    const json = JSON.parse(line);

    // Codex MCP tool call format (adjust based on actual Codex output)
    if (
      (json.type === 'item.started' || json.type === 'item.completed') &&
      json.item?.type === 'mcp_tool_call'
    ) {
      const toolName = json.item.name;
      const args = json.item.arguments || {};

      if (toolName === 'propose_step_completion') {
        return {
          type: 'proposal',
          toolName,
          arguments: args,
          timestamp: Date.now(),
        };
      }

      if (toolName === 'approve_step_transition') {
        return {
          type: 'approval',
          toolName,
          arguments: args,
          timestamp: Date.now(),
        };
      }

      if (toolName === 'get_pending_proposal') {
        return {
          type: 'get_proposal',
          toolName,
          arguments: args,
          timestamp: Date.now(),
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Unified detector that tries all parsers
 */
export function detectMCPSignal(
  line: string,
  engine: 'claude' | 'codex' | 'auto' = 'auto'
): DetectedMCPSignal | null {
  if (engine === 'claude') {
    return detectClaudeMCPSignal(line);
  }

  if (engine === 'codex') {
    return detectCodexMCPSignal(line);
  }

  // Auto-detect: try all parsers
  return detectClaudeMCPSignal(line) || detectCodexMCPSignal(line);
}

// ============================================================================
// STREAM PROCESSOR
// ============================================================================

export interface MCPSignalDetectorOptions {
  engine?: 'claude' | 'codex' | 'auto';
  onProposal?: (signal: ProposalSignal) => void;
  onApproval?: (signal: ApprovalSignal) => void;
  onAnySignal?: (signal: DetectedMCPSignal) => void;
}

/**
 * Create a stream processor that detects MCP signals
 *
 * Usage:
 * ```typescript
 * const processor = createMCPSignalProcessor({
 *   engine: 'claude',
 *   onProposal: (signal) => console.log('Proposal:', signal),
 *   onApproval: (signal) => console.log('Approval:', signal),
 * });
 *
 * // In your stream handler
 * onStdout: (chunk) => {
 *   const lines = chunk.split('\n');
 *   for (const line of lines) {
 *     processor.processLine(line);
 *   }
 * }
 * ```
 */
export function createMCPSignalProcessor(options: MCPSignalDetectorOptions) {
  const { engine = 'auto', onProposal, onApproval, onAnySignal } = options;

  return {
    processLine(line: string): DetectedMCPSignal | null {
      const signal = detectMCPSignal(line, engine);

      if (!signal) return null;

      // Call specific handlers
      if (signal.type === 'proposal' && onProposal) {
        onProposal(signal as ProposalSignal);
      }

      if (signal.type === 'approval' && onApproval) {
        onApproval(signal as ApprovalSignal);
      }

      // Call generic handler
      if (onAnySignal) {
        onAnySignal(signal);
      }

      return signal;
    },
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isProposalSignal(signal: DetectedMCPSignal): signal is ProposalSignal {
  return signal.type === 'proposal';
}

export function isApprovalSignal(signal: DetectedMCPSignal): signal is ApprovalSignal {
  return signal.type === 'approval';
}
