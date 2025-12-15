/** @jsxImportSource @opentui/solid */
/**
 * Home Commands Hook
 *
 * Handles command execution logic for the home view.
 */

import { useRenderer } from "@opentui/solid"
import { useToast } from "@tui/shared/context/toast"
import { useDialog } from "@tui/shared/context/dialog"
import { useSession } from "@tui/shared/context/session"
import { SelectMenu } from "@tui/shared/components/select-menu"
import * as path from "node:path"
import { getAbsoluteSpecPath, HOME_COMMANDS } from "../config/commands"

export interface UseHomeCommandsOptions {
  onStartWorkflow?: () => void
}

export function useHomeCommands(options: UseHomeCommandsOptions) {
  const toast = useToast()
  const dialog = useDialog()
  const renderer = useRenderer()
  const session = useSession()

  const handleCommand = async (command: string) => {
    const cmd = command.toLowerCase()
    console.log(`Executing command: ${cmd}`)

    if (cmd === HOME_COMMANDS.START) {
      await handleStartCommand()
      return
    }

    if (cmd === HOME_COMMANDS.TEMPLATES || cmd === HOME_COMMANDS.TEMPLATE) {
      await handleTemplatesCommand()
      return
    }

    if (cmd === HOME_COMMANDS.LOGIN) {
      await handleLoginCommand()
      return
    }

    if (cmd === HOME_COMMANDS.LOGOUT) {
      await handleLogoutCommand()
      return
    }

    if (cmd === HOME_COMMANDS.EXIT || cmd === HOME_COMMANDS.QUIT) {
      handleExitCommand()
      return
    }

    // Unknown command
    toast.show({
      variant: "error",
      message: `Unknown command: ${command}. Type /help for options.`,
    })
  }

  const handleStartCommand = async () => {
    const specPath = getAbsoluteSpecPath()

    try {
      const { validateSpecification } = await import("../../../../../workflows/execution/run.js")
      await validateSpecification(specPath)
    } catch (error) {
      if (error instanceof Error) {
        toast.show({
          variant: "info",
          message: error.message,
          duration: 10000,
        })
      }
      return
    }

    if (options.onStartWorkflow) {
      options.onStartWorkflow()
      return
    }
  }

  const handleTemplatesCommand = async () => {
    const { getAvailableTemplates, selectTemplateByNumber } = await import("../../../../commands/templates.command.js")

    const templates = await getAvailableTemplates()
    const choices = templates.map((t, index) => ({
      title: t.title,
      value: index + 1,
      description: t.description,
    }))

    dialog.show(() => (
      <SelectMenu
        message="Choose a workflow template:"
        choices={choices}
        onSelect={async (templateNumber: number) => {
          dialog.close()
          try {
            const selectedTemplate = templates[templateNumber - 1]
            await selectTemplateByNumber(templateNumber)

            const displayName = path.basename(selectedTemplate.value, ".workflow.js")
              .split("-")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")
            session.updateTemplate(displayName)

            toast.show({
              variant: "success",
              message: "Template activated!",
            })
          } catch (error) {
            toast.show({
              variant: "error",
              message: error instanceof Error ? error.message : String(error),
            })
          }
        }}
        onCancel={() => dialog.close()}
      />
    ))
  }

  const handleLoginCommand = async () => {
    const { registry } = await import("../../../../../infra/engines/index.js")
    const { handleLogin } = await import("../../../../commands/auth.command.js")

    const providers = registry.getAll().map((engine) => ({
      title: engine.metadata.name,
      value: engine.metadata.id,
      description: engine.metadata.description,
    }))

    dialog.show(() => (
      <SelectMenu
        message="Choose authentication provider to login:"
        choices={providers}
        onSelect={async (providerId: string) => {
          const providerName = providers.find((p) => p.value === providerId)?.title || "Provider"
          const engine = registry.get(providerId)

          if (!engine) {
            dialog.close()
            toast.show({
              variant: "error",
              message: `Unknown provider: ${providerId}`,
            })
            return
          }

          dialog.close()
          await new Promise((resolve) => setTimeout(resolve, 200))

          const isAuthenticated = await engine.auth.isAuthenticated()

          if (isAuthenticated) {
            toast.show({
              variant: "info",
              message: `${providerName} is already authenticated. Use /logout to sign out.`,
              duration: 15000,
            })
            return
          }

          await dialog.handleAuthCommand(
            `${providerName} Authentication`,
            async () => {
              await handleLogin(providerId)
            }
          )
        }}
        onCancel={() => dialog.close()}
      />
    ))
  }

  const handleLogoutCommand = async () => {
    const { registry } = await import("../../../../../infra/engines/index.js")
    const { handleLogout } = await import("../../../../commands/auth.command.js")

    const providers = registry.getAll().map((engine) => ({
      title: engine.metadata.name,
      value: engine.metadata.id,
      description: engine.metadata.description,
    }))

    dialog.show(() => (
      <SelectMenu
        message="Choose authentication provider to logout:"
        choices={providers}
        onSelect={async (providerId: string) => {
          const providerName = providers.find((p) => p.value === providerId)?.title || "Provider"

          dialog.close()
          await new Promise((resolve) => setTimeout(resolve, 200))

          try {
            await handleLogout(providerId)
            toast.show({
              variant: "success",
              message: `${providerName} signed out successfully!`,
              duration: 15000,
            })
          } catch (error) {
            toast.show({
              variant: "error",
              message: `Logout failed: ${error instanceof Error ? error.message : String(error)}`,
              duration: 15000,
            })
          }
        }}
        onCancel={() => dialog.close()}
      />
    ))
  }

  const handleExitCommand = () => {
    renderer.destroy()

    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[2J\x1b[H\x1b[?25h')
    }

    process.exit(0)
  }

  return { handleCommand }
}
