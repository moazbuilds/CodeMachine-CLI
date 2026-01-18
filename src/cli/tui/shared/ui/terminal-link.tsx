/** @jsxImportSource @opentui/solid */
/**
 * Terminal Link Utilities
 *
 * Creates clickable hyperlinks in terminals that support OSC8.
 * Falls back to plain text in unsupported terminals.
 */

import { useTheme } from "@tui/shared/context/theme"

/**
 * Creates an OSC8 hyperlink escape sequence for terminals.
 * Supported by: iTerm2, Windows Terminal, GNOME Terminal, Konsole, etc.
 */
export function createTerminalLink(url: string, text?: string): string {
  const displayText = text || url
  // OSC 8 ; params ; URI ST text OSC 8 ; ; ST
  return `\x1b]8;;${url}\x07${displayText}\x1b]8;;\x07`
}

export interface TerminalLinkProps {
  url: string
  text?: string
  muted?: boolean
}

/**
 * Component wrapper for terminal hyperlinks.
 */
export function TerminalLink(props: TerminalLinkProps) {
  const theme = useTheme()

  const displayText = () => props.text || props.url

  return (
    <text fg={props.muted ? theme.theme.textMuted : theme.theme.info}>
      {createTerminalLink(props.url, displayText())}
    </text>
  )
}
