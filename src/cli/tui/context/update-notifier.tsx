/** @jsxImportSource @opentui/solid */
import { createSignal, onMount } from "solid-js"
import updateNotifier from "update-notifier"
import { createSimpleContext } from "./helper"
import { createRequire } from "node:module"
import { resolvePackageJson } from "../../../shared/runtime/pkg.js"

export const { use: useUpdateNotifier, provider: UpdateNotifierProvider } = createSimpleContext({
  name: "UpdateNotifier",
  init: () => {
    const [ready, setReady] = createSignal(false)
    const [updateAvailable, setUpdateAvailable] = createSignal(false)
    const [latestVersion, setLatestVersion] = createSignal("")

    onMount(() => {
      // Check for updates (respects NO_UPDATE_NOTIFIER and CI environments)
      if (!process.env.NO_UPDATE_NOTIFIER && !process.env.CODEMACHINE_NO_UPDATE_CHECK) {
        try {
          const require = createRequire(import.meta.url)
          const packageJsonPath = resolvePackageJson(import.meta.url, "update notifier context")
          const pkg = require(packageJsonPath) as { version: string; name: string }

          const notifier = updateNotifier({
            pkg,
            updateCheckInterval: 1000 * 60 * 60 * 24, // Check once per day
          })

          if (notifier.update) {
            setUpdateAvailable(true)
            setLatestVersion(notifier.update.latest)
          }
        } catch {
          // Silently fail if update check errors (offline, network issues, etc.)
        }
      }
      setReady(true)
    })

    return {
      get ready() {
        return ready()
      },
      get updateAvailable() {
        return updateAvailable()
      },
      get latestVersion() {
        return latestVersion()
      },
    }
  },
})
