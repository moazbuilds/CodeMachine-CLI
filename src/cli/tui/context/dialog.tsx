/** @jsxImportSource @opentui/solid */
import { Show, createContext, useContext, type JSX, type ParentProps, createSignal } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { useToast } from "./toast"
import { useTheme } from "./theme"
import { DialogWrapper } from "@tui/ui/dialog-wrapper"
import { startTUI } from "../app"

// Store the content factory function, not the rendered element
// This allows the content to be rendered inside the Show wrapper
// where all contexts are available, and properly cleaned up when dialog closes
type DialogContentFactory = () => JSX.Element

type DialogContextValue = {
  readonly current: DialogContentFactory | null
  show(content: () => JSX.Element): void
  close(): void
  handleInteractiveCommand(
    title: string,
    command: () => Promise<void>
  ): Promise<{ success: boolean; error?: Error }>
  handleAuthCommand(
    title: string,
    command: () => Promise<void>
  ): Promise<{ success: boolean; error?: Error }>
}

const DialogContext = createContext<DialogContextValue>()

export function DialogProvider(props: ParentProps) {
  // Use a signal to store the content factory
  // This avoids solid-js/store's deep tracking which can cause the factory to be called prematurely
  const [contentFactory, setContentFactory] = createSignal<DialogContentFactory | null>(null)
  const renderer = useRenderer()
  const toast = useToast()
  const themeContext = useTheme()

  const value: DialogContextValue = {
    get current() {
      return contentFactory()
    },
    show(content) {
      // Store the content factory function, not the rendered result
      // The actual rendering happens inside the Show wrapper below,
      // where all parent contexts (Theme, Toast, etc.) are accessible
      // When close() sets current to null, Show unmounts the content,
      // and SolidJS properly cleans up all reactive subscriptions
      setContentFactory(() => content)
    },
    close() {
      // Setting to null unmounts the dialog content via Show's conditional rendering
      // SolidJS automatically disposes all reactive subscriptions when unmounting
      setContentFactory(null)
    },
    async handleInteractiveCommand(title, command) {
      try {
        // Show message before suspending
        toast.show({
          variant: "info",
          message: `Launching ${title}...`,
          duration: 1500,
        })

        // Wait a moment for user to see the message
        await new Promise((resolve) => setTimeout(resolve, 800))

        // Stop the TUI session
        renderer.suspend()

        // Aggressive terminal clear (multiple methods)
        console.clear()
        process.stdout.write('\x1Bc')              // Reset terminal
        process.stdout.write('\x1b[2J\x1b[H')      // Clear screen + home
        process.stdout.write('\x1b[3J')            // Clear scrollback

        // Show banner
        console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}\n`)

        // Run the command
        await command()

        // Show completion message
        console.log(`\n✓ Complete!\nReturning to CodeMachine...\n`)
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // Resume TUI session
        renderer.resume()

        return { success: true }
      } catch (error) {
        const err = error as Error
        console.error(`\n✗ Failed: ${err.message}\n`)
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Resume session even on error
        renderer.resume()

        // Show error toast after resuming
        toast.show({
          variant: "error",
          message: `Failed: ${err.message}`,
        })

        return { success: false, error: err }
      }
    },
    async handleAuthCommand(title, command) {
      try {
        // Close dialog first
        setContentFactory(null)

        // Show launching message
        toast.show({
          variant: "info",
          message: `Launching ${title}...`,
          duration: 1500,
        })

        // Wait for user to see the message
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Capture current theme mode to avoid re-detection
        const currentMode = themeContext.mode

        // Completely destroy the TUI session
        renderer.destroy()

        // Aggressive terminal clear
        console.clear()
        process.stdout.write('\x1Bc')              // Reset terminal
        process.stdout.write('\x1b[2J\x1b[H')      // Clear screen + home
        process.stdout.write('\x1b[3J')            // Clear scrollback

        // Show banner
        console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}\n`)

        // Run the auth command
        await command()

        // Show completion message
        console.log(`\n✓ Complete!\nRestarting CodeMachine...\n`)
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Clear again before restart
        console.clear()
        process.stdout.write('\x1Bc')

        // Restart TUI with known mode (skip background detection) and show success toast
        await startTUI(true, currentMode, {
          variant: "success",
          message: `${title} completed successfully!`,
          duration: 15000,
        })

        return { success: true }
      } catch (error) {
        const err = error as Error
        console.error(`\n✗ Failed: ${err.message}\n`)
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Clear and restart even on error
        console.clear()
        process.stdout.write('\x1Bc')

        // Restart TUI with error toast
        await startTUI(true, themeContext.mode, {
          variant: "error",
          message: `${title} failed: ${err.message}`,
          duration: 15000,
        })

        return { success: false, error: err }
      }
    },
  }

  return (
    <DialogContext.Provider value={value}>
      {props.children}
      <Show when={contentFactory()}>
        {(factory) => (
          /* Call the content factory to render dialog content
             This happens inside the Show, so when Show unmounts (contentFactory becomes null),
             SolidJS properly cleans up all reactive subscriptions from the content */
          <DialogWrapper>{factory()()}</DialogWrapper>
        )}
      </Show>
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const value = useContext(DialogContext)
  if (!value) {
    throw new Error("Dialog context must be used within a context provider")
  }
  return value
}
