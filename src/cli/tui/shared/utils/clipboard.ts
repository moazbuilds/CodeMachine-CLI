/**
 * Clipboard Utilities
 *
 * Cross-platform clipboard read/write operations.
 */

type ClipboardMethod = (text: string) => Promise<void>
type ClipboardReadMethod = () => Promise<string>

let copyMethod: ClipboardMethod | null | undefined
let pasteMethod: ClipboardReadMethod | null | undefined

/**
 * Get the clipboard copy method based on OS
 */
function getClipboardCopyMethod(): ClipboardMethod | null {
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

/**
 * Get the clipboard paste/read method based on OS
 */
function getClipboardPasteMethod(): ClipboardReadMethod | null {
  const os = process.platform

  if (os === "darwin" && Bun.which("pbpaste")) {
    return async () => {
      const result = await Bun.$`pbpaste`.nothrow().quiet().text()
      return result.trim()
    }
  }

  if (os === "linux") {
    if (process.env.WAYLAND_DISPLAY && Bun.which("wl-paste")) {
      return async () => {
        const result = await Bun.$`wl-paste --no-newline`.nothrow().quiet().text()
        return result
      }
    }
    if (Bun.which("xclip")) {
      return async () => {
        const result = await Bun.$`xclip -selection clipboard -o`.nothrow().quiet().text()
        return result
      }
    }
    if (Bun.which("xsel")) {
      return async () => {
        const result = await Bun.$`xsel --clipboard --output`.nothrow().quiet().text()
        return result
      }
    }
    // WSL - use PowerShell to read clipboard
    if (Bun.which("powershell.exe")) {
      return async () => {
        const result = await Bun.$`powershell.exe -command "Get-Clipboard"`.nothrow().quiet().text()
        return result.trim()
      }
    }
  }

  if (os === "win32" && Bun.which("powershell")) {
    return async () => {
      const result = await Bun.$`powershell -command "Get-Clipboard"`.nothrow().quiet().text()
      return result.trim()
    }
  }

  return null
}

/**
 * Copy text to system clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (copyMethod === undefined) {
    copyMethod = getClipboardCopyMethod()
  }
  if (copyMethod) {
    try {
      await copyMethod(text)
      return true
    } catch {
      return false
    }
  }
  return false
}

/**
 * Read text from system clipboard
 */
export async function pasteFromClipboard(): Promise<string | null> {
  if (pasteMethod === undefined) {
    pasteMethod = getClipboardPasteMethod()
  }
  if (pasteMethod) {
    try {
      return await pasteMethod()
    } catch {
      return null
    }
  }
  return null
}
