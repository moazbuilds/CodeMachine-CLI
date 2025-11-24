/** @jsxImportSource @opentui/solid */
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { resolvePackageJson } from "../../../shared/runtime/pkg.js"
import { BrandingHeader } from "@tui/component/layout/branding-header"
import { useTheme } from "@tui/context/theme"

export function Workflow() {
  const { theme } = useTheme()

  const getVersion = () => {
    const require = createRequire(import.meta.url)
    const packageJsonPath = resolvePackageJson(import.meta.url, "workflow route")
    const pkg = require(packageJsonPath) as { version: string }
    return pkg.version
  }

  const getCwd = () => {
    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    return cwd.replace(homedir(), "~")
  }

  return (
    <box flexDirection="column" gap={1} paddingLeft={1} paddingRight={1} paddingTop={1}>
      <BrandingHeader version={getVersion()} currentDir={getCwd()} />

      <box
        border
        borderColor={theme.border}
        padding={1}
        flexDirection="column"
        backgroundColor={theme.backgroundPanel}
      >
        <text fg={theme.text}>Workflow UI (OpenTUI) is initializing...</text>
        <text fg={theme.textMuted}>Next steps: mount timeline and output panels here.</text>
      </box>
    </box>
  )
}
