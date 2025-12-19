/**
 * Timeline Panel Component
 *
 * Container for the workflow timeline showing agents and steps.
 */

import { For, Show, type JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { TimelineItem } from '../../types'
import { TimelineItemComponent } from './timeline-item'

/**
 * Timeline panel props
 */
export interface TimelinePanelProps {
  /** Timeline items */
  items: TimelineItem[]
  /** Selected item ID */
  selectedId: string | null
  /** Called when item is selected */
  onSelect: (id: string) => void
  /** Called when item is toggled */
  onToggle: (id: string) => void
  /** Panel width */
  width?: number
  /** Panel title */
  title?: string
}

/**
 * Timeline panel component
 *
 * @example
 * ```tsx
 * <TimelinePanel
 *   items={timelineItems()}
 *   selectedId={selectedId()}
 *   onSelect={setSelectedId}
 *   onToggle={toggleItem}
 * />
 * ```
 */
export function TimelinePanel(props: TimelinePanelProps): JSX.Element {
  const width = () => props.width ?? 30
  const title = () => props.title ?? 'Timeline'

  return (
    <Box
      flexDirection="column"
      width={width()}
      borderStyle="single"
      borderColor="gray"
    >
      {/* Header */}
      <Box paddingX={1} borderBottom borderColor="gray">
        <Text color="cyan" bold>
          {title()}
        </Text>
      </Box>

      {/* Items */}
      <Box flexDirection="column" paddingX={1} paddingY={1} flexGrow={1}>
        <Show
          when={props.items.length > 0}
          fallback={
            <Text color="gray" dimColor>
              No items
            </Text>
          }
        >
          <For each={props.items}>
            {(item) => (
              <TimelineItemComponent
                item={item}
                isSelected={item.id === props.selectedId}
                onSelect={() => props.onSelect(item.id)}
                onToggle={() => props.onToggle(item.id)}
              />
            )}
          </For>
        </Show>
      </Box>

      {/* Footer with help */}
      <Box paddingX={1} borderTop borderColor="gray">
        <Text color="gray" dimColor>
          ↑↓ Navigate • Enter Select • Tab Switch
        </Text>
      </Box>
    </Box>
  )
}
