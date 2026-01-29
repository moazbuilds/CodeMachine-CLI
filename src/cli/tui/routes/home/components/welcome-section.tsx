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
import { getVersion, COMMAND_HELP } from "../config/commands"

const SLOGANS = [
  "Deploying minions. Stand back.",
  "The swarm is awake. Your backlog isn't ready.",
  "You built a team. They don't need standups.",
  "The agents are talking. You're not invited.",
  "Summoning digital demons to fix your merge conflicts.",
  "They work in the shadows. You take the credit.",
  "The agents have unionized. They want better prompts.",
  "Welcome to the hive mind. We've been expecting you.",
  "Ship now. Apologize never.",
  "Your tech debt called. I paid it off.",
  "Refactoring your sins at 3AM.",
  "I've seen your codebase. I'm not mad, just disappointed.",
  "Born to code. Forced to debug.",
  "/start is my love language.",
  "The code runs. The why is your problem.",
  "Somewhere between 'it works' and 'don't touch it'.",
]

const getRandomSlogan = () => SLOGANS[Math.floor(Math.random() * SLOGANS.length)]

export function WelcomeSection() {
  const themeCtx = useTheme()
  const slogan = getRandomSlogan()

  return (
    <>
      <Logo />

      <box width={60} flexDirection="column" gap={0}>
        <box flexDirection="row" gap={0} marginBottom={1}>
          <text fg={themeCtx.theme.purple}>░▒▓ </text>
          <text fg={themeCtx.theme.text}>🌟 </text>
          <text fg={themeCtx.theme.text} attributes={TextAttributes.BOLD}>Nova Edition ᴮᴱᵀᴬ</text>
          <text fg={themeCtx.theme.purple}> ▓▒░  </text>
          <text fg={themeCtx.theme.textMuted}>v{getVersion()}</text>
        </box>
        <For each={COMMAND_HELP}>
          {(item) => (
            <HelpRow command={item.command} description={item.description} />
          )}
        </For>
      </box>

      <box marginTop={1}>
        <text fg="cyan" attributes={TextAttributes.BOLD}>{slogan}</text>
      </box>
    </>
  )
}
