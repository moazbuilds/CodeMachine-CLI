/** @jsxImportSource solid-js */
import { createSignal, type Setter } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"
import path from "path"
import { homedir } from "os"

export const { use: useKV, provider: KVProvider } = createSimpleContext({
  name: "KV",
  init: () => {
    const [ready, setReady] = createSignal(false)
    const [kvStore, setKvStore] = createStore<Record<string, unknown>>({})
    const statePath = path.join(homedir(), ".codemachine", "state")
    const file = Bun.file(path.join(statePath, "kv.json"))

    // Ensure state directory exists
    import("fs").then(async (fs) => {
      await fs.promises.mkdir(statePath, { recursive: true })
    })

    // Load KV store from disk
    file
      .json()
      .then((x) => {
        setKvStore(x)
      })
      .catch(() => {
        // File doesn't exist yet, that's okay
      })
      .finally(() => {
        setReady(true)
      })

    const result = {
      get ready() {
        return ready()
      },
      signal<T>(name: string, defaultValue: T) {
        if (!kvStore[name]) setKvStore(name, defaultValue)
        return [
          function () {
            return result.get(name, defaultValue)
          },
          function setter(next: Setter<T>) {
            result.set(name, next)
          },
        ] as const
      },
      get<T = unknown>(key: string, defaultValue?: T): T | undefined {
        return (kvStore[key] as T) ?? defaultValue
      },
      set<T = unknown>(key: string, value: T) {
        setKvStore(key, value)
        Bun.write(file, JSON.stringify(kvStore, null, 2))
      },
    }
    return result
  },
})
