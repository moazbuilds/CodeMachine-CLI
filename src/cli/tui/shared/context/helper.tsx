/** @jsxImportSource @opentui/solid */
import { createContext, Show, useContext, type ParentProps } from "solid-js"

type WithOptionalReady = { ready?: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSimpleContext<T, Props extends Record<string, any>>(input: {
  name: string
  init: ((input: Props) => T) | (() => T)
}) {
  const ctx = createContext<T>()

  return {
    provider: (props: ParentProps<Props>) => {
      const init = input.init(props)
      const initWithReady = init as T & WithOptionalReady
      return (
        <Show when={initWithReady.ready === undefined || initWithReady.ready === true}>
          <ctx.Provider value={init}>{props.children}</ctx.Provider>
        </Show>
      )
    },
    use() {
      const value = useContext(ctx)
      if (!value) throw new Error(`${input.name} context must be used within a context provider`)
      return value
    },
  }
}
