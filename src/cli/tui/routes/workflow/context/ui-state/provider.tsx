/** @jsxImportSource @opentui/solid */
/**
 * UI State Provider
 *
 * Context provider and hook for UI state.
 */

import { type Accessor, createSignal, onCleanup } from "solid-js"
import { createSimpleContext } from "@tui/shared/context/helper"
import type { WorkflowState } from "./types"
import { createStore } from "./store"

export const { provider: UIStateProvider, use: useUIState } = createSimpleContext({
  name: "UIState",
  init: (props: { workflowName: string }) => {
    const store = createStore(props.workflowName)
    const [state, setState]: [Accessor<WorkflowState>, (v: WorkflowState) => void] = createSignal(store.getState())

    const unsubscribe = store.subscribe(() => {
      setState(store.getState())
    })

    onCleanup(() => unsubscribe())

    return {
      state,
      actions: store,
    }
  },
})
