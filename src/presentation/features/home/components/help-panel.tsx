/**
 * Help Panel Component
 *
 * Displays keyboard shortcuts and help information.
 */

import { For, type JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'

/**
 * Help item definition
 */
export interface HelpItem {
  /** Key or shortcut */
  key: string
  /** Description of the action */
  description: string
  /** Category for grouping */
  category?: string
}

/**
 * Help panel props
 */
export interface HelpPanelProps {
  /** Help items to display */
  items: HelpItem[]
  /** Panel title */
  title?: string
}

/**
 * Help panel with keyboard shortcuts
 *
 * @example
 * ```tsx
 * <HelpPanel
 *   title="Keyboard Shortcuts"
 *   items={[
 *     { key: '↑/↓', description: 'Navigate commands' },
 *     { key: 'Enter', description: 'Execute command' },
 *     { key: 'Esc', description: 'Cancel' },
 *   ]}
 * />
 * ```
 */
export function HelpPanel(props: HelpPanelProps): JSX.Element {
  const title = () => props.title ?? 'Help'

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      padding={1}
    >
      <Text color="cyan" bold>
        {title()}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <For each={props.items}>
          {(item) => (
            <Box flexDirection="row" gap={2}>
              <Box width={12}>
                <Text color="yellow">{item.key}</Text>
              </Box>
              <Text color="white">{item.description}</Text>
            </Box>
          )}
        </For>
      </Box>
    </Box>
  )
}
