/**
 * Narrate Command
 *
 * CLI command: codemachine narrate <script.txt> --speed <ms>
 *
 * Parses a script file and launches narrator TUI to play it.
 *
 * Script Format:
 *   face|delay: text with {N} delays and [face] changes
 *
 * Examples:
 *   # script.txt
 *   idle|3: Hi, {2} I am ali {1} [thinking] your codemachine explainer
 *   thinking|2: Let me explain how this works...
 *
 *   codemachine narrate script.txt
 *   codemachine narrate script.txt --speed 50
 */

import type { Command } from 'commander'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import chalk from 'chalk'

interface NarrateCommandOptions {
  speed: number
}

/**
 * Register the narrate command
 */
export function registerNarrateCommand(program: Command): void {
  program
    .command('narrate <script>')
    .description('Run Ali narrator with a script file')
    .option('-s, --speed <ms>', 'Milliseconds per character', '30')
    .action(async (scriptPath: string, options: NarrateCommandOptions) => {
      try {
        await runNarrateCommand(scriptPath, options)
        process.exit(0)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`\nError: ${message}\n`))
        process.exit(1)
      }
    })
}

/**
 * Execute the narrate command
 */
async function runNarrateCommand(scriptPath: string, options: NarrateCommandOptions): Promise<void> {
  // Resolve and read script file
  const fullPath = resolve(process.cwd(), scriptPath)
  let content: string

  try {
    content = await readFile(fullPath, 'utf-8')
  } catch (err) {
    throw new Error(`Could not read script file: ${scriptPath}`)
  }

  // Parse options
  const speed = parseInt(String(options.speed), 10)

  // Parse script
  const { parseScript } = await import('../tui/routes/narrator/parser/script-parser.js')
  const script = parseScript(content)

  if (script.lines.length === 0) {
    throw new Error('Script file contains no valid lines')
  }

  // Launch narrator TUI
  const { startNarratorTUI } = await import('../tui/narrator-launcher.js')
  await startNarratorTUI({ script, speed })
}
