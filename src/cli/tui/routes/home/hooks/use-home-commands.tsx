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
import { DialogSelect } from "@tui/shared/ui/dialog-select"
import { StatusBadge } from "@tui/shared/ui/status-badge"
import { SelectMenu } from "@tui/shared/components/select-menu"
import { ImportDialog } from "../dialogs/import-dialog"
import * as path from "node:path"
import { HOME_COMMANDS } from "../config/commands"

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

    if (cmd === HOME_COMMANDS.IMPORT) {
      await handleImportCommand()
      return
    }

    if (cmd === HOME_COMMANDS.EXPORT) {
      handleExportCommand()
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
    // Quick check: does a loadable template exist?
    const { existsSync } = await import("node:fs")
    const { getTemplatePathFromTracking } = await import("../../../../../shared/workflows/template.js")
    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    const cmRoot = path.join(cwd, ".codemachine")
    const templatePath = await getTemplatePathFromTracking(cmRoot)

    if (!existsSync(templatePath)) {
      toast.show({
        variant: "warning",
        message: "No workflow templates available. Use /import to add a workflow package.",
        duration: 8000,
      })
      return
    }

    try {
      // Pre-flight check - validates specification if required by template
      const { checkSpecificationRequired } = await import("../../../../../workflows/preflight.js")
      await checkSpecificationRequired()
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
    }
  }

  const handleTemplatesCommand = async () => {
    const { getAvailableTemplates, selectTemplateByNumber } = await import("../../../../commands/templates.command.js")

    const templates = await getAvailableTemplates()
    const IMPORT_ACTION = "__IMPORT_TEMPLATE__"

    const templateOptions = templates.map((t, index) => {
      return {
        title: t.title,
        value: index + 1,
        description: `${t.stepCount} steps`,
      }
    })

    // Add import option at the top (no category)
    const selectOptions = [
      {
        title: "⬇ Import template (GitHub or local)",
        value: IMPORT_ACTION,
      },
      ...templateOptions,
    ]

    dialog.show(() => (
      <DialogSelect
        title="Select Workflow Template"
        options={selectOptions}
        placeholder="Search templates..."
        onSelect={async (selection: number | string) => {
          // Handle import action
          if (selection === IMPORT_ACTION) {
            dialog.close()
            await new Promise((resolve) => setTimeout(resolve, 100))
            await handleImportCommand()
            return
          }

          // Handle template selection
          const templateNumber = selection as number
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

    // Check auth status for each provider
    const engines = registry.getAll()
    const providersWithStatus = await Promise.all(
      engines.map(async (engine) => {
        const isAuth = await engine.auth.isAuthenticated()
        return {
          title: engine.metadata.name,
          value: engine.metadata.id,
          description: engine.metadata.description,
          footer: isAuth ? "✓ Connected" : undefined,
        }
      })
    )

    dialog.show(() => (
      <DialogSelect
        title="Select Provider to Login"
        options={providersWithStatus}
        placeholder="Search providers..."
        onSelect={async (providerId: string) => {
          const providerName = providersWithStatus.find((p) => p.value === providerId)?.title || "Provider"
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

          // Special handling for OpenCode when already authenticated
          if (providerId === "opencode" && isAuthenticated) {
            await handleOpenCodeAddProvider(providerId, providerName)
            return
          }

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

  /**
   * Handles adding another OpenCode provider by spawning `opencode auth login` interactively
   */
  const handleOpenCodeAddProvider = async (providerId: string, providerName: string) => {
    const { registry } = await import("../../../../../infra/engines/index.js")

    dialog.show(() => (
      <SelectMenu
        message={`${providerName} is authenticated. Add another provider?`}
        choices={[
          { title: "Add another provider", value: "add" },
          { title: "Cancel", value: "cancel" },
        ]}
        onSelect={async (choice: string) => {
          dialog.close()
          if (choice === "cancel") return

          const engine = registry.get(providerId)
          if (!engine) return

          await dialog.handleAuthCommand(
            `${providerName} - Add Provider`,
            async () => {
              // Call ensureAuth(true) directly to force interactive login
              // This bypasses handleLogin's clack confirmation which doesn't work well after TUI destruction
              await engine.auth.ensureAuth(true)
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

    // Check auth status for each provider
    const engines = registry.getAll()
    const providersWithStatus = await Promise.all(
      engines.map(async (engine) => {
        const isAuth = await engine.auth.isAuthenticated()
        return {
          title: engine.metadata.name,
          value: engine.metadata.id,
          description: engine.metadata.description,
          footer: isAuth ? "✓ Connected" : "Not connected",
          disabled: !isAuth, // Disable logout for providers not connected
        }
      })
    )

    dialog.show(() => (
      <DialogSelect
        title="Select Provider to Logout"
        options={providersWithStatus}
        placeholder="Search providers..."
        onSelect={async (providerId: string) => {
          const providerName = providersWithStatus.find((p) => p.value === providerId)?.title || "Provider"

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

  const handleImportCommand = async () => {
    const { installPackage } = await import("../../../../../shared/imports/installer.js")

    const performInstall = async (source: string) => {
      return installPackage(source)
    }

    dialog.show(() => (
      <ImportDialog
        onClose={() => dialog.close()}
        onInstall={performInstall}
      />
    ))
  }

  const handleExportCommand = () => {
    const { getImportsDir, ensureImportsDir } = require("../../../../../shared/imports/index.js")

    ensureImportsDir()
    const importsDir = getImportsDir()

    toast.show({
      variant: "info",
      message: `Imports can be accessed manually from: ${importsDir}`,
      duration: 10000,
    })
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
