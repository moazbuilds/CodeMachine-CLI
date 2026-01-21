/**
 * Workflow Modals Hook
 *
 * Manages modal state for the workflow view.
 */

import { createSignal } from "solid-js"

export interface ChainConfirmInfo {
  stepIndex: number
  stepName: string
  stepDescription: string
  totalSteps: number
}

export interface WorkflowModalsState {
  logViewerAgentId: () => string | null
  setLogViewerAgentId: (id: string | null) => void
  showHistory: () => boolean
  setShowHistory: (show: boolean) => void
  historySelectedIndex: () => number
  setHistorySelectedIndex: (index: number) => void
  historyLogViewerMonitoringId: () => number | null
  setHistoryLogViewerMonitoringId: (id: number | null) => void
  isLogViewerActive: () => boolean
  isHistoryActive: () => boolean
  isHistoryLogViewerActive: () => boolean
  // Chain confirm modal
  chainConfirmInfo: () => ChainConfirmInfo | null
  showChainConfirm: (info: ChainConfirmInfo) => void
  hideChainConfirm: () => void
  isChainConfirmActive: () => boolean
  onChainConfirmResolve: ((confirmed: boolean) => void) | null
  setOnChainConfirmResolve: (resolve: ((confirmed: boolean) => void) | null) => void
}

/**
 * Hook for managing workflow modal states
 */
export function useWorkflowModals(): WorkflowModalsState {
  const [logViewerAgentId, setLogViewerAgentId] = createSignal<string | null>(null)
  const [showHistory, setShowHistory] = createSignal(false)
  const [historySelectedIndex, setHistorySelectedIndex] = createSignal(0)
  const [historyLogViewerMonitoringId, setHistoryLogViewerMonitoringId] = createSignal<number | null>(null)
  const [chainConfirmInfo, setChainConfirmInfo] = createSignal<ChainConfirmInfo | null>(null)
  let onChainConfirmResolve: ((confirmed: boolean) => void) | null = null

  return {
    logViewerAgentId,
    setLogViewerAgentId,
    showHistory,
    setShowHistory,
    historySelectedIndex,
    setHistorySelectedIndex,
    historyLogViewerMonitoringId,
    setHistoryLogViewerMonitoringId,
    isLogViewerActive: () => logViewerAgentId() !== null,
    isHistoryActive: () => showHistory(),
    isHistoryLogViewerActive: () => historyLogViewerMonitoringId() !== null,
    // Chain confirm modal
    chainConfirmInfo,
    showChainConfirm: (info: ChainConfirmInfo) => setChainConfirmInfo(info),
    hideChainConfirm: () => setChainConfirmInfo(null),
    isChainConfirmActive: () => chainConfirmInfo() !== null,
    get onChainConfirmResolve() { return onChainConfirmResolve },
    setOnChainConfirmResolve: (resolve) => { onChainConfirmResolve = resolve },
  }
}
