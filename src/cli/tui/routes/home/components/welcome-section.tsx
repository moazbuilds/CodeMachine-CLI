/** @jsxImportSource @opentui/solid */
/**
 * Welcome Section Component
 *
 * Displays logo, version info, and help commands.
 */

import { For } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/shared/context/theme"
import { Logo } from "@tui/shared/components/logo"
import { HelpRow } from "./help-row"
import { getVersion, getSpecPath, COMMAND_HELP } from "../config/commands"

export function WelcomeSection() {
  const themeCtx = useTheme()

  return (
    <>
      <Logo />

      <box width={60} flexDirection="column" gap={0}>
        <box flexDirection="row" gap={0} marginBottom={1}>
          <text fg={themeCtx.theme.purple}>░▒▓ </text>
          <text fg={themeCtx.theme.text}>🌟 </text>
          <text fg={themeCtx.theme.text} attributes={TextAttributes.BOLD}>Nova Edition</text>
          <text fg={themeCtx.theme.purple}> ▓▒░  </text>
          <text fg={themeCtx.theme.textMuted}>v{getVersion()}</text>
        </box>
        <For each={COMMAND_HELP}>
          {(item) => (
            <HelpRow command={item.command} description={item.description} />
          )}
        </For>
      </box>

      <box flexDirection="row" gap={0} marginTop={1} marginBottom={0}>
        <text fg={themeCtx.theme.textMuted}>Write your specifications in </text>
        <text fg={themeCtx.theme.primary} attributes={TextAttributes.BOLD}>{getSpecPath()}</text>
      </box>
    </>
  )
}
