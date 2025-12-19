/**
 * Welcome Section Component
 *
 * Displays the welcome message and branding.
 */

import type { JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import { Logo } from '../../shared/components/logo'

/**
 * Welcome section props
 */
export interface WelcomeSectionProps {
  /** Version string */
  version?: string
  /** Whether to show the logo */
  showLogo?: boolean
}

/**
 * Welcome section with logo and version
 *
 * @example
 * ```tsx
 * <WelcomeSection version="1.0.0" showLogo />
 * ```
 */
export function WelcomeSection(props: WelcomeSectionProps): JSX.Element {
  const showLogo = () => props.showLogo ?? true

  return (
    <Box flexDirection="column" alignItems="center" gap={1}>
      {showLogo() && <Logo size="medium" color="cyan" />}
      <Box flexDirection="row" gap={1}>
        <Text color="gray">Welcome to</Text>
        <Text color="cyan" bold>
          CodeMachine CLI
        </Text>
        {props.version && (
          <Text color="gray" dimColor>
            v{props.version}
          </Text>
        )}
      </Box>
      <Text color="gray" dimColor>
        Type a command or press ? for help
      </Text>
    </Box>
  )
}
