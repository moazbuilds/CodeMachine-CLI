/** @jsxImportSource @opentui/solid */
import { Logo } from "@tui/component/logo"
import { HelpRow } from "@tui/component/help-row"
import { Prompt } from "@tui/component/prompt"
import { SelectMenu } from "@tui/component/select-menu"
import { FadeIn } from "@tui/component/fade-in"
import { Toast } from "@tui/ui/toast"
import { useToast } from "@tui/context/toast"
import { useDialog } from "@tui/context/dialog"
import { useTheme } from "@tui/context/theme"
import { useSession } from "@tui/context/session"
import { useRenderer } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { createRequire } from "node:module"
import { resolvePackageJson } from "../../../shared/runtime/pkg.js"
import { onMount } from "solid-js"
import * as path from "node:path"
import type { InitialToast } from "../app"

type HomeProps = {
  initialToast?: InitialToast
  onStartWorkflow?: () => void
}

export function Home(props: HomeProps) {
  const toast = useToast()
  const dialog = useDialog()
  const renderer = useRenderer()
  const { theme } = useTheme()
  const session = useSession()

  // Show initial toast if provided (e.g., after auth restart)
  onMount(() => {
    if (props.initialToast) {
      toast.show({
        variant: props.initialToast.variant,
        message: props.initialToast.message,
        duration: props.initialToast.duration || 15000,
      })
    }
  })


  const getVersion = () => {
    const require = createRequire(import.meta.url)
    const packageJsonPath = resolvePackageJson(import.meta.url, "home route")
    const pkg = require(packageJsonPath) as { version: string }
    return pkg.version
  }

  const getSpecPath = () => {
    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    const fullPath = path.join(cwd, '.codemachine', 'inputs', 'specifications.md')
    // Show relative path if it's in current directory, otherwise show full path
    const relativePath = path.relative(process.cwd(), fullPath)
    return relativePath.startsWith('..') ? fullPath : relativePath
  }

  const handleCommand = async (command: string) => {
    const cmd = command.toLowerCase()
    console.log(`Executing command: ${cmd}`)

    if (cmd === "/start") {
      // Validate spec file BEFORE destroying the TUI
      const cwd = process.env.CODEMACHINE_CWD || process.cwd()
      const specPath = path.join(cwd, '.codemachine', 'inputs', 'specifications.md')

      try {
        const { validateSpecification } = await import("../../../workflows/execution/queue.js")
        await validateSpecification(specPath)
      } catch (error) {
        // Show validation error as info toast (instructional, not error) and keep TUI running
        if (error instanceof Error) {
          toast.show({
            variant: "info",
            message: error.message,
            duration: 10000, // Longer duration since it contains instructions
          })
        }
        return // Don't destroy TUI or spawn workflow
      }

      if (props.onStartWorkflow) {
        props.onStartWorkflow()
        return
      }

      // TODO: legacy Ink workflow spawn is temporarily disabled during TUI refactor.
      // Validation passed; workflow execution will be handled by the new OpenTUI flow.
      // Previously: destroy renderer → reset stdin → clear terminal → spawn runner-process/binary → exit with code.
      return
    }

    if (cmd === "/templates" || cmd === "/template") {
      // Lazy load templates command
      const { getAvailableTemplates, selectTemplateByNumber } = await import("../../commands/templates.command.js")

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

              // Update session with new template display name
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
      return
    }

    if (cmd === "/login") {
      // Lazy load registry and auth commands
      const { registry } = await import("../../../infra/engines/index.js")
      const { handleLogin } = await import("../../commands/auth.command.js")

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

            // Close dialog first
            dialog.close()
            await new Promise((resolve) => setTimeout(resolve, 200))

            // Check if already authenticated via filesystem
            const isAuthenticated = await engine.auth.isAuthenticated()

            if (isAuthenticated) {
              // Already authenticated - just show toast
              toast.show({
                variant: "info",
                message: `${providerName} is already authenticated. Use /logout to sign out.`,
                duration: 15000,
              })
              return
            }

            // Not authenticated - destroy session, clear terminal, run auth, restart
            await dialog.handleAuthCommand(
              `${providerName} Authentication`,
              async () => {
                await handleLogin(providerId)
              }
            )
            // Note: Toast will be shown automatically by handleAuthCommand after restart
          }}
          onCancel={() => dialog.close()}
        />
      ))
      return
    }

    if (cmd === "/logout") {
      // Lazy load registry and auth commands
      const { registry } = await import("../../../infra/engines/index.js")
      const { handleLogout } = await import("../../commands/auth.command.js")

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

            // Close dialog first
            dialog.close()
            await new Promise((resolve) => setTimeout(resolve, 200))

            // Logout is just a filesystem operation - no need to suspend session
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
      return
    }

    if (cmd === "/exit" || cmd === "/quit") {
      renderer.destroy()

      // Clean terminal completely before exit
      if (process.stdout.isTTY) {
        process.stdout.write('\x1b[2J\x1b[H\x1b[?25h') // Clear screen, home cursor, show cursor
      }

      process.exit(0)
    }

    // Unknown command
    toast.show({
      variant: "error",
      message: `Unknown command: ${command}. Type /help for options.`,
    })
  }

  // Check if dialog is open
  const isDialogOpen = () => dialog.current !== null

  return (
    <FadeIn duration={600}>
      <box flexGrow={1} justifyContent="center" alignItems="center" paddingLeft={2} paddingRight={2} gap={1}>
        <Logo />

        <box width={60} flexDirection="column" gap={0}>
          <box flexDirection="row" gap={0} marginBottom={1}>
            <text fg={theme.textMuted}>🥟 </text>
            <text fg={theme.text} attributes={TextAttributes.BOLD}>Bun Runtime Edition</text>
            <text fg={theme.textMuted}> • v{getVersion()}</text>
          </box>
          <HelpRow command="start" description="Start workflow with current template" />
          <HelpRow command="templates" description="Select and configure workflow templates" />
          <HelpRow command="login" description="Authenticate with AI providers" />
        </box>

        <box flexDirection="row" gap={0} marginTop={1} marginBottom={0}>
          <text fg={theme.textMuted}>Write your specifications in </text>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>{getSpecPath()}</text>
        </box>

        <Prompt onSubmit={handleCommand} disabled={isDialogOpen()} />

        <Toast />
      </box>
    </FadeIn>
  )
}
