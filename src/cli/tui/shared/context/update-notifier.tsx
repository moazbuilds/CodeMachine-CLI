/** @jsxImportSource @opentui/solid */
import { createSignal, onMount } from "solid-js"
import { createSimpleContext } from "./helper"
import { status } from "../../../../shared/updates/index.js"

export const { use: useUpdateNotifier, provider: UpdateNotifierProvider } = createSimpleContext({
  name: "UpdateNotifier",
  init: () => {
    const [ready, setReady] = createSignal(false)
    const [updateAvailable, setUpdateAvailable] = createSignal(false)
    const [latestVersion, setLatestVersion] = createSignal("")

    onMount(() => {
      const cache = status()
      if (cache && cache.available && cache.latest) {
        setUpdateAvailable(true)
        setLatestVersion(cache.latest)
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
