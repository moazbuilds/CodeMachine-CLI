/**
 * Logo Component
 *
 * CodeMachine CLI branding logo.
 */

import { For, type JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'

// ============================================================================
// Types
// ============================================================================

export interface LogoProps {
  /** Logo size variant */
  size?: 'small' | 'medium' | 'large'
  /** Whether to show animated colors */
  animated?: boolean
  /** Primary color */
  color?: string
}

// ============================================================================
// Logo Art
// ============================================================================

const LOGO_SMALL = ['CodeMachine']

const LOGO_MEDIUM = [
  '╔═╗┌─┐┌┬┐┌─┐╔╦╗┌─┐┌─┐┬ ┬┬┌┐┌┌─┐',
  '║  │ │ ││├┤ ║║║├─┤│  ├─┤││││├┤ ',
  '╚═╝└─┘─┴┘└─┘╩ ╩┴ ┴└─┘┴ ┴┴┘└┘└─┘',
]

const LOGO_LARGE = [
  '  ██████╗ ██████╗ ██████╗ ███████╗███╗   ███╗ █████╗  ██████╗██╗  ██╗██╗███╗   ██╗███████╗',
  ' ██╔════╝██╔═══██╗██╔══██╗██╔════╝████╗ ████║██╔══██╗██╔════╝██║  ██║██║████╗  ██║██╔════╝',
  ' ██║     ██║   ██║██║  ██║█████╗  ██╔████╔██║███████║██║     ███████║██║██╔██╗ ██║█████╗  ',
  ' ██║     ██║   ██║██║  ██║██╔══╝  ██║╚██╔╝██║██╔══██║██║     ██╔══██║██║██║╚██╗██║██╔══╝  ',
  ' ╚██████╗╚██████╔╝██████╔╝███████╗██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║██║██║ ╚████║███████╗',
  '  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝',
]

// ============================================================================
// Component
// ============================================================================

/**
 * CodeMachine logo component
 *
 * @example
 * ```tsx
 * <Logo size="medium" color="cyan" />
 * ```
 */
export function Logo(props: LogoProps): JSX.Element {
  const size = () => props.size ?? 'medium'
  const color = () => props.color ?? 'cyan'

  const logoLines = () => {
    switch (size()) {
      case 'small':
        return LOGO_SMALL
      case 'large':
        return LOGO_LARGE
      default:
        return LOGO_MEDIUM
    }
  }

  return (
    <Box flexDirection="column" alignItems="center">
      <For each={logoLines()}>
        {(line) => (
          <Text color={color()} bold>
            {line}
          </Text>
        )}
      </For>
    </Box>
  )
}
