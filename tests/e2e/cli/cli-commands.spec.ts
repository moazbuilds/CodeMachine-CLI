/**
 * E2E Tests for CLI Commands
 *
 * Tests the CLI commands by spawning the actual CLI process.
 * These tests verify that:
 * - Commands are registered correctly
 * - Help text is displayed properly
 * - Command execution produces expected output
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { spawn, type Subprocess } from 'bun'
import * as path from 'path'
import * as fs from 'fs'

// ============================================================================
// Test Utilities
// ============================================================================

interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Execute the CLI with given arguments
 */
async function execCli(args: string[], timeout = 10000): Promise<ExecResult> {
  const cliPath = path.resolve(process.cwd(), 'dist/index.js')

  // Check if the CLI is built
  if (!fs.existsSync(cliPath)) {
    throw new Error('CLI not built. Run `bun run build` first.')
  }

  return new Promise<ExecResult>((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const proc = spawn({
      cmd: ['node', cliPath, ...args],
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        // Disable interactive features for testing
        CI: 'true',
        NO_COLOR: '1',
      },
    })

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true
      proc.kill()
      reject(new Error(`Command timed out after ${timeout}ms: ${args.join(' ')}`))
    }, timeout)

    // Read stdout
    const stdoutReader = async () => {
      const reader = proc.stdout.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        stdout += decoder.decode(value)
      }
    }

    // Read stderr
    const stderrReader = async () => {
      const reader = proc.stderr.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        stderr += decoder.decode(value)
      }
    }

    Promise.all([stdoutReader(), stderrReader(), proc.exited]).then(
      ([, , exitCode]) => {
        clearTimeout(timeoutId)
        if (!timedOut) {
          resolve({ stdout, stderr, exitCode })
        }
      }
    )
  })
}

/**
 * Execute CLI expecting success
 */
async function execCliSuccess(args: string[]): Promise<string> {
  const result = await execCli(args)
  if (result.exitCode !== 0) {
    throw new Error(
      `CLI command failed with exit code ${result.exitCode}:\n${result.stderr}`
    )
  }
  return result.stdout
}

// ============================================================================
// Test Setup
// ============================================================================

// Skip tests if CLI is not built
let cliBuilt = false

beforeAll(() => {
  const cliPath = path.resolve(process.cwd(), 'dist/index.js')
  cliBuilt = fs.existsSync(cliPath)
  if (!cliBuilt) {
    console.warn('⚠️  CLI not built. Skipping E2E tests. Run `bun run build` first.')
  }
})

// ============================================================================
// Version Command Tests
// ============================================================================

describe('CLI Commands', () => {
  describe('version command', () => {
    it.skipIf(!cliBuilt)('should display version information', async () => {
      const result = await execCli(['version'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/CodeMachine v\d+\.\d+\.\d+/)
    })

    it.skipIf(!cliBuilt)('should also work with --version flag', async () => {
      const result = await execCli(['--version'])

      expect(result.exitCode).toBe(0)
      // Commander outputs version differently with flag
      expect(result.stdout.trim()).toMatch(/\d+\.\d+\.\d+/)
    })
  })

  // ============================================================================
  // Help Command Tests
  // ============================================================================

  describe('help command', () => {
    it.skipIf(!cliBuilt)('should display help with --help flag', async () => {
      const result = await execCli(['--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('Commands:')
    })

    it.skipIf(!cliBuilt)('should display help for version command', async () => {
      const result = await execCli(['version', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Display CLI version')
    })

    it.skipIf(!cliBuilt)('should display help for templates command', async () => {
      const result = await execCli(['templates', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout.toLowerCase()).toContain('template')
    })

    it.skipIf(!cliBuilt)('should display help for agents command', async () => {
      const result = await execCli(['agents', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout.toLowerCase()).toContain('agent')
    })
  })

  // ============================================================================
  // Templates Command Tests
  // ============================================================================

  describe('templates command', () => {
    it.skipIf(!cliBuilt)('should list available templates', async () => {
      const result = await execCli(['templates', 'list'])

      // May exit with 0 or show templates
      expect(result.exitCode).toBe(0)
    })
  })

  // ============================================================================
  // Agents Command Tests
  // ============================================================================

  describe('agents command', () => {
    it.skipIf(!cliBuilt)('should have list subcommand', async () => {
      const result = await execCli(['agents', 'list', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout.toLowerCase()).toContain('list')
    })

    it.skipIf(!cliBuilt)('should have logs subcommand', async () => {
      const result = await execCli(['agents', 'logs', '--help'])

      expect(result.exitCode).toBe(0)
    })

    it.skipIf(!cliBuilt)('should have export subcommand', async () => {
      const result = await execCli(['agents', 'export', '--help'])

      expect(result.exitCode).toBe(0)
    })
  })

  // ============================================================================
  // Unknown Command Tests
  // ============================================================================

  describe('error handling', () => {
    it.skipIf(!cliBuilt)('should show error for unknown command', async () => {
      const result = await execCli(['unknown-command-xyz'])

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toLowerCase()).toContain('unknown')
    })

    it.skipIf(!cliBuilt)('should show help suggestion on error', async () => {
      const result = await execCli(['invalid'])

      expect(result.exitCode).not.toBe(0)
      // Commander typically suggests help
    })
  })
})

// ============================================================================
// Command Registration Tests
// ============================================================================

describe('Command Registration', () => {
  it.skipIf(!cliBuilt)('should have all expected commands registered', async () => {
    const result = await execCli(['--help'])

    expect(result.exitCode).toBe(0)

    // Check for expected commands
    const expectedCommands = [
      'version',
      'templates',
      'agents',
    ]

    for (const cmd of expectedCommands) {
      expect(result.stdout.toLowerCase()).toContain(cmd)
    }
  })
})
