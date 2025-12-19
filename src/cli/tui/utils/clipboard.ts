/**
 * Clipboard Utilities
 *
 * Cross-platform clipboard copy functionality.
 * Supports macOS (osascript), Linux (wl-copy, xclip, xsel), and Windows (powershell).
 */

/**
 * Get the clipboard copy method based on OS (lazy loaded)
 */
function getClipboardCopyMethod(): ((text: string) => Promise<void>) | null {
  const os = process.platform

  if (os === "darwin" && Bun.which("osascript")) {
    return async (text: string) => {
      const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      await Bun.$`osascript -e 'set the clipboard to "${escaped}"'`.nothrow().quiet()
    }
  }

  if (os === "linux") {
    if (process.env.WAYLAND_DISPLAY && Bun.which("wl-copy")) {
      return async (text: string) => {
        const proc = Bun.spawn(["wl-copy"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited.catch(() => {})
      }
    }
    if (Bun.which("xclip")) {
      return async (text: string) => {
        const proc = Bun.spawn(["xclip", "-selection", "clipboard"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited.catch(() => {})
      }
    }
    if (Bun.which("xsel")) {
      return async (text: string) => {
        const proc = Bun.spawn(["xsel", "--clipboard", "--input"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited.catch(() => {})
      }
    }
    if (Bun.which("clip.exe")) {
      return async (text: string) => {
        const proc = Bun.spawn(["clip.exe"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited.catch(() => {})
      }
    }
  }

  if (os === "win32" && Bun.which("powershell")) {
    return async (text: string) => {
      const escaped = text.replace(/"/g, '""')
      await Bun.$`powershell -command "Set-Clipboard -Value \"${escaped}\""`.nothrow().quiet()
    }
  }

  return null
}

let clipboardMethod: ((text: string) => Promise<void>) | null | undefined

/**
 * Copy text to system clipboard
 */
export async function copyToSystemClipboard(text: string): Promise<void> {
  if (clipboardMethod === undefined) {
    clipboardMethod = getClipboardCopyMethod()
  }
  if (clipboardMethod) {
    await clipboardMethod(text)
  }
}
