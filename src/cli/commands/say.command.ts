/**
 * Say Command
 *
 * CLI command: codemachine say <text> --face <expr> --delay <sec> --speed <ms>
 *
 * Launches narrator TUI with a single line of text.
 *
 * Examples:
 *   codemachine say "Hello world" --face idle
 *   codemachine say "Hi {1} [thinking] I'm thinking now" --face idle --delay 3
 */

import type { Command } from 'commander'
import chalk from 'chalk'

interface SayCommandOptions {
  face: string
  delay: number
  speed: number
}

/**
 * Register the say command
 */
export function registerSayCommand(program: Command): void {
  program
    .command('say <text>')
    .description('Display Ali narrator with typed text')
    .option('-f, --face <expression>', 'Starting face expression', 'idle')
    .option('-d, --delay <seconds>', 'Seconds to wait after text completes', '2')
    .option('-s, --speed <ms>', 'Milliseconds per character', '30')
    .action(async (text: string, options: SayCommandOptions) => {
      try {
        await runSayCommand(text, options)
        process.exit(0)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`\nError: ${message}\n`))
        process.exit(1)
      }
    })
}

/**
 * Execute the say command
 */
async function runSayCommand(text: string, options: SayCommandOptions): Promise<void> {
  // Parse options
  const face = options.face
  const delay = parseFloat(String(options.delay))
  const speed = parseInt(String(options.speed), 10)

  // Create single-line script
  const { createSingleLineScript } = await import('../tui/routes/narrator/parser/script-parser.js')
  const script = createSingleLineScript(text, face, delay)

  // Launch narrator TUI
  const { startNarratorTUI } = await import('../tui/narrator-launcher.js')
  await startNarratorTUI({ script, speed })
}
