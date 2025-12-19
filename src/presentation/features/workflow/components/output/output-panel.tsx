/**
 * Output Panel Component
 *
 * Main panel for displaying agent output and logs.
 */

import { For, Show, type JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { OutputLine, WorkflowMode } from '../../types'
import { OutputLineComponent } from './output-line'
import { InputPrompt } from './input-prompt'

/**
 * Output panel props
 */
export interface OutputPanelProps {
  /** Output lines */
  lines: OutputLine[]
  /** Current mode */
  mode: WorkflowMode
  /** Whether input is active */
  inputActive: boolean
  /** Current input value */
  inputValue: string
  /** Called when input changes */
  onInputChange: (value: string) => void
  /** Called when input is submitted */
  onInputSubmit: () => void
  /** Panel height */
  height?: number
  /** Whether panel is focused */
  focused?: boolean
}

/**
 * Output panel component
 *
 * @example
 * ```tsx
 * <OutputPanel
 *   lines={outputLines()}
 *   mode={mode()}
 *   inputActive={inputActive()}
 *   inputValue={inputValue()}
 *   onInputChange={setInputValue}
 *   onInputSubmit={handleSubmit}
 * />
 * ```
 */
export function OutputPanel(props: OutputPanelProps): JSX.Element {
  const height = () => props.height ?? 20
  const modeLabel = () => (props.mode === 'autopilot' ? 'AUTOPILOT' : 'MANUAL')
  const modeColor = () => (props.mode === 'autopilot' ? 'green' : 'cyan')

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      borderColor={props.focused ? 'cyan' : 'gray'}
    >
      {/* Header */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        paddingX={1}
        borderBottom
        borderColor="gray"
      >
        <Text color="cyan" bold>
          Output
        </Text>
        <Text color={modeColor()} bold>
          [{modeLabel()}]
        </Text>
      </Box>

      {/* Output content */}
      <Box
        flexDirection="column"
        height={height()}
        overflowY="hidden"
        paddingX={1}
      >
        <Show
          when={props.lines.length > 0}
          fallback={
            <Text color="gray" dimColor>
              Waiting for output...
            </Text>
          }
        >
          <For each={props.lines}>
            {(line) => <OutputLineComponent line={line} />}
          </For>
        </Show>
      </Box>

      {/* Input prompt (when active) */}
      <Show when={props.inputActive}>
        <InputPrompt
          value={props.inputValue}
          onChange={props.onInputChange}
          onSubmit={props.onInputSubmit}
          mode={props.mode}
        />
      </Show>

      {/* Footer with shortcuts */}
      <Box paddingX={1} borderTop borderColor="gray">
        <Text color="gray" dimColor>
          Shift+Tab Mode • Ctrl+S Skip • Ctrl+C Stop
        </Text>
      </Box>
    </Box>
  )
}
