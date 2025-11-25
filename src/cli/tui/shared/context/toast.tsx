/** @jsxImportSource solid-js */
import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"

export type ToastVariant = "success" | "error" | "info" | "warning"

export type ToastMessage = {
  message: string
  variant: ToastVariant
}

export type ToastOptions = ToastMessage & {
  duration?: number
}

export const { use: useToast, provider: ToastProvider } = createSimpleContext({
  name: "Toast",
  init: () => {
    const [store, setStore] = createStore<{
      current: ToastMessage | null
    }>({
      current: null,
    })

    let timeoutHandle: NodeJS.Timeout | null = null

    return {
      get current() {
        return store.current
      },
      show(options: ToastOptions) {
        const { duration = 3000, ...rest } = options
        setStore("current", rest)

        if (timeoutHandle) clearTimeout(timeoutHandle)
        timeoutHandle = setTimeout(() => {
          setStore("current", null)
        }, duration)
      },
      dismiss() {
        if (timeoutHandle) clearTimeout(timeoutHandle)
        setStore("current", null)
      },
    }
  },
})
