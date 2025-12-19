/**
 * Command List Component
 *
 * Displays available commands with keyboard shortcuts.
 */

import { For, type JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { HomeCommand } from '../types'

/**
 * Command list props
 */
export interface CommandListProps {
  /** Available commands */
  commands: HomeCommand[]
  /** Currently selected index */
  selectedIndex?: number
  /** Called when a command is selected */
  onSelect?: (index: number) => void
}

/**
 * List of available commands
 *
 * @example
 * ```tsx
 * <CommandList
 *   commands={commands}
 *   selectedIndex={selectedIndex()}
 *   onSelect={setSelectedIndex}
 * />
 * ```
 */
export function CommandList(props: CommandListProps): JSX.Element {
  return (
    <Box flexDirection="column" gap={0}>
      <Text color="gray" dimColor>
        Available Commands:
      </Text>
      <Box flexDirection="column" paddingLeft={2}>
        <For each={props.commands}>
          {(cmd, index) => {
            const isSelected = () => index() === props.selectedIndex
            const isEnabled = () => cmd.enabled !== false

            return (
              <Box flexDirection="row" gap={1}>
                <Text
                  color={isSelected() ? 'cyan' : isEnabled() ? 'white' : 'gray'}
                  bold={isSelected()}
                >
                  {isSelected() ? '› ' : '  '}
                  {cmd.command}
                </Text>
                <Text color="gray" dimColor>
                  - {cmd.description}
                </Text>
                {cmd.shortcut && (
                  <Text color="yellow" dimColor>
                    [{cmd.shortcut}]
                  </Text>
                )}
              </Box>
            )
          }}
        </For>
      </Box>
    </Box>
  )
}
