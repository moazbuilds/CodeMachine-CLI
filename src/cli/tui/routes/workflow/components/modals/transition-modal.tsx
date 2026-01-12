/** @jsxImportSource @opentui/solid */
/**
 * Transition Confirmation Modal
 *
 * Asks user to confirm transitioning from Controller to Workflow.
 */

import { createSignal } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ModalBase, ModalHeader, ModalFooter } from "@tui/shared/components/modal"

export interface TransitionModalProps {
    onConfirm: () => void
    onCancel: () => void
}

type ButtonType = "start" | "cancel"

export function TransitionModal(props: TransitionModalProps) {
    const themeCtx = useTheme()
    const dimensions = useTerminalDimensions()
    const [selectedButton, setSelectedButton] = createSignal<ButtonType>("start")

    const modalWidth = () => {
        const safeWidth = Math.max(40, (dimensions()?.width ?? 80) - 8)
        return Math.min(safeWidth, 60)
    }

    useKeyboard((evt) => {
        if (evt.name === "left" || evt.name === "right") {
            evt.preventDefault()
            setSelectedButton((prev) => (prev === "start" ? "cancel" : "start"))
            return
        }

        if (evt.name === "return") {
            evt.preventDefault()
            if (selectedButton() === "start") {
                props.onConfirm()
            } else {
                props.onCancel()
            }
            return
        }

        if (evt.name === "s") {
            evt.preventDefault()
            props.onConfirm()
            return
        }
        if (evt.name === "c" || evt.name === "escape") {
            evt.preventDefault()
            props.onCancel()
            return
        }
    })

    return (
        <ModalBase width={modalWidth()}>
            <ModalHeader title="Start Workflow" icon="▶" iconColor={themeCtx.theme.success} />
            <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
                <text fg={themeCtx.theme.text}>Ready to begin the workflow? The AI will start working autonomously.</text>
            </box>
            <box flexDirection="row" justifyContent="center" gap={2} paddingBottom={1}>
                <box
                    paddingLeft={2}
                    paddingRight={2}
                    backgroundColor={selectedButton() === "start" ? themeCtx.theme.success : themeCtx.theme.backgroundElement}
                    borderColor={selectedButton() === "start" ? themeCtx.theme.success : themeCtx.theme.borderSubtle}
                    border
                >
                    <text fg={selectedButton() === "start" ? themeCtx.theme.background : themeCtx.theme.text}>Start</text>
                </box>
                <box
                    paddingLeft={2}
                    paddingRight={2}
                    backgroundColor={selectedButton() === "cancel" ? themeCtx.theme.warning : themeCtx.theme.backgroundElement}
                    borderColor={selectedButton() === "cancel" ? themeCtx.theme.warning : themeCtx.theme.borderSubtle}
                    border
                >
                    <text fg={selectedButton() === "cancel" ? themeCtx.theme.background : themeCtx.theme.text}>Cancel</text>
                </box>
            </box>
            <ModalFooter shortcuts="[Left/Right] Navigate  [ENTER] Confirm  [S/C] Direct  [Esc] Cancel" />
        </ModalBase>
    )
}
