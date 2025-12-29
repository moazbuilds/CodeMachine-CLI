/** @jsxImportSource solid-js */
import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"
import { getActiveTemplate } from "../../../../shared/workflows/template.js"
import { onMount } from "solid-js"
import * as path from "node:path"

export const { use: useSession, provider: SessionProvider } = createSimpleContext({
  name: "Session",
  init: () => {
    const [store, setStore] = createStore({
      templateName: "bmad",
      workflowCount: 0,
      lastRun: null as Date | null,
    })

    // Load active template from .codemachine/template.json
    onMount(async () => {
      const cwd = process.env.CODEMACHINE_CWD || process.cwd()
      const cmRoot = path.join(cwd, ".codemachine")
      const activeTemplate = await getActiveTemplate(cmRoot)

      if (activeTemplate) {
        // Convert filename to display name: "default.workflow.js" -> "Default"
        const displayName = path.basename(activeTemplate, ".workflow.js")
          .split("-")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
        setStore("templateName", displayName)
      }
    })

    return {
      get templateName() {
        return store.templateName
      },
      get workflowCount() {
        return store.workflowCount
      },
      get lastRun() {
        return store.lastRun
      },
      updateTemplate(name: string) {
        setStore("templateName", name)
      },
      updateWorkflowCount(count: number) {
        setStore("workflowCount", count)
      },
      updateLastRun(date: Date) {
        setStore("lastRun", date)
      },
    }
  },
})
