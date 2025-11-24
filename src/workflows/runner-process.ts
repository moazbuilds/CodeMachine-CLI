#!/usr/bin/env bun
/**
 * Workflow Runner Process
 *
 * Executes workflows in a separate Bun process WITHOUT the SolidJS transform plugin.
 * This prevents JSX conflicts between OpenTUI (SolidJS) and workflow UI (React/Ink).
 *
 * Architecture:
 * - Process 1: TUI home screen (SolidJS/OpenTUI) with preload active
 * - Process 2: This file - Workflow execution (React/Ink) with NO preload
 *
 * When the user types /start in the TUI, the TUI process spawns this script
 * as a subprocess, passing terminal control to it. The workflow runs with
 * clean React/Ink rendering, then exits when complete.
 *
 * Usage:
 *   bun runner-process.ts <cwd> [specificationPath]
 */

// ENSURE EMBEDDED RESOURCES EARLY (BEFORE IMPORTS)
// This must run before any modules that might resolve the package root
import { ensure as ensureResources } from '../shared/runtime/embed.js';

const embeddedRoot = await ensureResources();

if (!embeddedRoot && !process.env.CODEMACHINE_INSTALL_DIR) {
  // Fallback to normal resolution if not embedded
  const { resolvePackageRoot } = await import('../shared/runtime/root.js');
  try {
    const packageRoot = resolvePackageRoot(import.meta.url, 'workflow runner');
    process.env.CODEMACHINE_INSTALL_DIR = packageRoot;
  } catch {
    // Continue without setting
  }
}

import { runWorkflowQueue } from './execution/index.js';

// Parse command line arguments
const [_bunPath, _scriptPath, cwd, specificationPath = ''] = process.argv;

if (!cwd) {
  console.error('Error: Missing required argument <cwd>');
  console.error('Usage: bun runner-process.ts <cwd> [specificationPath]');
  process.exit(1);
}

// Run the workflow queue with React/Ink UI
// Since this process never imports @opentui/solid/preload,
// all JSX is compiled correctly for React
try {
  await runWorkflowQueue({ cwd, specificationPath });
  process.exit(0);
} catch (error) {
  console.error('Workflow execution failed:', error);
  process.exit(1);
}
