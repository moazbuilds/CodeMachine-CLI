/**
 * Timeline Item Component
 *
 * Individual item in the timeline with expand/collapse support.
 */

import { For, Show, type JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { TimelineItem } from '../../types'

/**
 * Timeline item props
 */
export interface TimelineItemProps {
  /** The timeline item */
  item: TimelineItem
  /** Whether the item is selected */
  isSelected: boolean
  /** Called when item is selected */
  onSelect: () => void
  /** Called when item is toggled */
  onToggle: () => void
  /** Indentation level */
  level?: number
}

/**
 * Get icon for timeline item type
 */
function getItemIcon(type: TimelineItem['type'], expanded: boolean): string {
  switch (type) {
    case 'agent':
      return expanded ? '▼' : '▶'
    case 'subagent':
      return '○'
    case 'checkpoint':
      return '◆'
    case 'loop':
      return '↻'
    default:
      return '•'
  }
}

/**
 * Get color for timeline item type
 */
function getItemColor(type: TimelineItem['type'], selected: boolean): string {
  if (selected) return 'cyan'

  switch (type) {
    case 'agent':
      return 'white'
    case 'subagent':
      return 'gray'
    case 'checkpoint':
      return 'yellow'
    case 'loop':
      return 'magenta'
    default:
      return 'white'
  }
}

/**
 * Timeline item component
 *
 * @example
 * ```tsx
 * <TimelineItemComponent
 *   item={item}
 *   isSelected={isSelected}
 *   onSelect={handleSelect}
 *   onToggle={handleToggle}
 * />
 * ```
 */
export function TimelineItemComponent(props: TimelineItemProps): JSX.Element {
  const level = () => props.level ?? 0
  const hasChildren = () => (props.item.children?.length ?? 0) > 0
  const icon = () => getItemIcon(props.item.type, props.item.expanded)
  const color = () => getItemColor(props.item.type, props.isSelected)
  const indent = () => '  '.repeat(level())

  return (
    <Box flexDirection="column">
      {/* Item row */}
      <Box flexDirection="row">
        <Text color={color()} bold={props.isSelected}>
          {indent()}
          {props.isSelected ? '› ' : '  '}
          {icon()} {props.item.label}
        </Text>
      </Box>

      {/* Children (if expanded) */}
      <Show when={props.item.expanded && hasChildren()}>
        <For each={props.item.children}>
          {(child) => (
            <TimelineItemComponent
              item={child}
              isSelected={child.selected}
              onSelect={props.onSelect}
              onToggle={props.onToggle}
              level={level() + 1}
            />
          )}
        </For>
      </Show>
    </Box>
  )
}
