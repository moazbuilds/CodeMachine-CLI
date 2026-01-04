#!/usr/bin/env node
/**
 * Workflow Signals MCP Server
 *
 * A Model Context Protocol (MCP) server that provides structured tools
 * for workflow step completion signaling between agents.
 *
 * This replaces fragile text-based signals like "ACTION: NEXT" with
 * schema-validated tool calls that are more reliable across different models.
 *
 * Usage:
 *   node workflow-signals/index.js
 *
 * Signals are stored globally at ~/.codemachine/mcp/workflow-signals/
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

import { workflowSignalTools } from './tools.js';
import {
  ProposeStepCompletionSchema,
  ApproveStepTransitionSchema,
  type ProposeStepCompletion,
} from './schemas.js';
import { SignalQueue } from './queue.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const signalQueue = new SignalQueue();

// ============================================================================
// MCP SERVER
// ============================================================================

const server = new Server(
  {
    name: 'workflow-signals',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// LIST TOOLS HANDLER
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: workflowSignalTools,
  };
});

// ============================================================================
// CALL TOOL HANDLER
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    await signalQueue.init();

    // ========================================================================
    // PROPOSE STEP COMPLETION
    // ========================================================================
    if (name === 'propose_step_completion') {
      // Validate with Zod
      const validated = ProposeStepCompletionSchema.parse(args);

      // Compute artifact hash if not provided
      if (!validated.artifact_hash && validated.artifact_path) {
        try {
          const content = await fs.readFile(validated.artifact_path, 'utf-8');
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          validated.artifact_hash = `sha256:${hash}`;
        } catch {
          // File might not exist yet, that's ok
        }
      }

      // Emit signal to queue
      await signalQueue.emitProposal(validated);

      // Calculate checklist completion
      const checklistItems = Object.entries(validated.checklist);
      const completed = checklistItems.filter(([, v]) => v).length;
      const total = checklistItems.length;

      return {
        content: [
          {
            type: 'text',
            text: `Step completion proposed for ${validated.step_id}

Checklist: ${completed}/${total} items complete
Confidence: ${(validated.confidence * 100).toFixed(0)}%
Open Questions: ${validated.open_questions.length}
Artifact: ${validated.artifact_path}
${validated.artifact_hash ? `Hash: ${validated.artifact_hash}` : ''}

Awaiting approval from reviewing agent.`,
          },
        ],
      };
    }

    // ========================================================================
    // APPROVE STEP TRANSITION
    // ========================================================================
    if (name === 'approve_step_transition') {
      // Validate with Zod
      const validated = ApproveStepTransitionSchema.parse(args);

      // Validate blockers required for revise
      if (validated.decision === 'revise' && validated.blockers.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Validation Error: blockers are required when decision is "revise"',
            },
          ],
          isError: true,
        };
      }

      // Emit signal to queue
      await signalQueue.emitApproval(validated);

      const emoji = {
        approve: '[APPROVED]',
        reject: '[REJECTED]',
        revise: '[REVISION REQUESTED]',
      }[validated.decision];

      const statusMessage = {
        approve: 'Workflow will proceed to next step.',
        reject: 'Workflow stopped due to rejection.',
        revise: 'Step will be revised based on blockers.',
      }[validated.decision];

      return {
        content: [
          {
            type: 'text',
            text: `${emoji} Step transition ${validated.decision.toUpperCase()} for ${validated.step_id}

${validated.blockers.length > 0 ? `Blockers:\n${validated.blockers.map((b) => `- ${b}`).join('\n')}` : ''}
${validated.notes ? `Notes: ${validated.notes}` : ''}

${statusMessage}`,
          },
        ],
      };
    }

    // ========================================================================
    // GET PENDING PROPOSAL
    // ========================================================================
    if (name === 'get_pending_proposal') {
      const proposal = await signalQueue.getLatestProposal();

      if (!proposal) {
        return {
          content: [
            {
              type: 'text',
              text: 'No pending step completion proposal found.',
            },
          ],
        };
      }

      const p = proposal.payload as ProposeStepCompletion;

      return {
        content: [
          {
            type: 'text',
            text: `Pending Proposal for ${p.step_id}

Artifact: ${p.artifact_path}
Hash: ${p.artifact_hash || 'not computed'}
Confidence: ${(p.confidence * 100).toFixed(0)}%

Checklist:
${Object.entries(p.checklist)
  .map(([k, v]) => `- [${v ? 'x' : ' '}] ${k}`)
  .join('\n')}

Open Questions:
${p.open_questions.length > 0 ? p.open_questions.map((q) => `- ${q}`).join('\n') : 'None'}

Review the artifact and call approve_step_transition with your decision.`,
          },
        ],
      };
    }

    // ========================================================================
    // UNKNOWN TOOL
    // ========================================================================
    return {
      content: [
        {
          type: 'text',
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  } catch (error) {
    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'errors' in error) {
      const zodError = error as { errors: Array<{ path: string[]; message: string }> };
      return {
        content: [
          {
            type: 'text',
            text: `Validation Error:\n${zodError.errors.map((e) => `- ${e.path.join('.')}: ${e.message}`).join('\n')}`,
          },
        ],
        isError: true,
      };
    }

    // Re-throw other errors
    throw error;
  }
});

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

}

main().catch((error) => {
  console.error('[workflow-signals] Fatal error:', error);
  process.exit(1);
});
