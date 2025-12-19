/**
 * E2E Test Utilities
 *
 * Helper functions for running E2E tests against the CLI.
 */

import { spawn } from 'bun'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// ============================================================================
// Types
// ============================================================================

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

export interface ExecOptions {
  /** Timeout in milliseconds */
  timeout?: number
  /** Working directory */
  cwd?: string
  /** Environment variables */
  env?: Record<string, string>
  /** Input to send to stdin */
  stdin?: string
}

// ============================================================================
// CLI Execution
// ============================================================================

/**
 * Get the path to the built CLI
 */
export function getCliPath(): string {
  return path.resolve(process.cwd(), 'dist/index.js')
}

/**
 * Check if the CLI is built
 */
export function isCliBuild(): boolean {
  return fs.existsSync(getCliPath())
}

/**
 * Execute the CLI with given arguments
 */
export async function execCli(
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const cliPath = getCliPath()
  const { timeout = 30000, cwd, env = {}, stdin } = options

  if (!fs.existsSync(cliPath)) {
    throw new Error('CLI not built. Run `bun run build` first.')
  }

  return new Promise<ExecResult>((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const startTime = Date.now()

    const proc = spawn({
      cmd: ['node', cliPath, ...args],
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: stdin ? 'pipe' : undefined,
      cwd,
      env: {
        ...process.env,
        // Disable interactive features for testing
        CI: 'true',
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        ...env,
      },
    })

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true
      proc.kill()
      reject(
        new Error(`Command timed out after ${timeout}ms: ${args.join(' ')}`)
      )
    }, timeout)

    // Write stdin if provided
    if (stdin && proc.stdin) {
      const writer = proc.stdin.getWriter()
      writer.write(new TextEncoder().encode(stdin))
      writer.close()
    }

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
          resolve({
            stdout,
            stderr,
            exitCode,
            duration: Date.now() - startTime,
          })
        }
      }
    )
  })
}

/**
 * Execute CLI expecting success (exit code 0)
 */
export async function execCliSuccess(
  args: string[],
  options?: ExecOptions
): Promise<string> {
  const result = await execCli(args, options)
  if (result.exitCode !== 0) {
    throw new Error(
      `CLI command failed with exit code ${result.exitCode}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    )
  }
  return result.stdout
}

/**
 * Execute CLI expecting failure (non-zero exit code)
 */
export async function execCliFailure(
  args: string[],
  options?: ExecOptions
): Promise<ExecResult> {
  const result = await execCli(args, options)
  if (result.exitCode === 0) {
    throw new Error(
      `CLI command unexpectedly succeeded:\nstdout: ${result.stdout}`
    )
  }
  return result
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a temporary directory for test files
 */
export async function createTempDir(prefix = 'codemachine-test-'): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `${prefix}${Date.now()}`)
  await fs.promises.mkdir(tempDir, { recursive: true })
  return tempDir
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true })
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Create a test workflow file
 */
export async function createTestWorkflow(
  dir: string,
  name: string,
  content: string
): Promise<string> {
  const workflowPath = path.join(dir, `${name}.yaml`)
  await fs.promises.writeFile(workflowPath, content, 'utf-8')
  return workflowPath
}

/**
 * Read a file safely
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

// ============================================================================
// Assertions
// ============================================================================

/**
 * Assert that output contains all given strings
 */
export function assertContainsAll(output: string, strings: string[]): void {
  for (const str of strings) {
    if (!output.includes(str)) {
      throw new Error(`Output does not contain expected string: "${str}"\nOutput: ${output}`)
    }
  }
}

/**
 * Assert that output matches a pattern
 */
export function assertMatches(output: string, pattern: RegExp): void {
  if (!pattern.test(output)) {
    throw new Error(
      `Output does not match pattern: ${pattern}\nOutput: ${output}`
    )
  }
}

/**
 * Assert that output does not contain any of the given strings
 */
export function assertNotContains(output: string, strings: string[]): void {
  for (const str of strings) {
    if (output.includes(str)) {
      throw new Error(
        `Output unexpectedly contains string: "${str}"\nOutput: ${output}`
      )
    }
  }
}

// ============================================================================
// Wait Utilities
// ============================================================================

/**
 * Wait for a file to exist
 */
export async function waitForFile(
  filePath: string,
  timeout = 5000
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (fs.existsSync(filePath)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`File not found after ${timeout}ms: ${filePath}`)
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error(`Condition not met after ${timeout}ms`)
}
