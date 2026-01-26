/** @jsxImportSource @opentui/solid */
/**
 * Home View Component
 *
 * Main home screen with logo, commands, and prompt.
 */

import { onMount } from "solid-js"
import { useToast } from "@tui/shared/context/toast"
import { useDialog } from "@tui/shared/context/dialog"
import { Toast } from "@tui/shared/ui/toast"
import { WelcomeSection } from "./components/welcome-section"
import { CommandInput } from "./components/command-input"
import { useHomeCommands } from "./hooks/use-home-commands"
import type { InitialToast } from "../../app"

export interface HomeViewProps {
  initialToast?: InitialToast
  onStartWorkflow?: () => void
}

export function HomeView(props: HomeViewProps) {
  const toast = useToast()
  const dialog = useDialog()
  const { handleCommand } = useHomeCommands({
    onStartWorkflow: props.onStartWorkflow,
  })

  onMount(() => {
    if (props.initialToast) {
      toast.show({
        variant: props.initialToast.variant,
        message: props.initialToast.message,
        duration: props.initialToast.duration || 15000,
      })
    }
  })

  const isDialogOpen = () => dialog.current !== null

  return (
    <box flexGrow={1} justifyContent="center" alignItems="center" paddingLeft={2} paddingRight={2} gap={1}>
      <WelcomeSection />
      <CommandInput onSubmit={handleCommand} disabled={isDialogOpen()} />
      <Toast />
    </box>
  )
}
