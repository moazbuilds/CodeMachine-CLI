/**
 * Terminal Detection Utilities
 *
 * Detect terminal background color for theme selection.
 */

/**
 * Detects terminal background color by querying with OSC 11 escape sequence
 * Returns "dark" or "light" based on luminance calculation
 */
export async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
  // Can't set raw mode if not a TTY
  if (!process.stdin.isTTY) return "dark"

  return new Promise((resolve) => {
    const timeout: NodeJS.Timeout = setTimeout(() => {
      cleanup()
      resolve("dark") // Default to dark if no response
    }, 1000)

    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.removeListener("data", handler)
      clearTimeout(timeout)
      // Pause stdin to drain any buffered input before OpenTUI takes over
      process.stdin.pause()
    }

    const handler = (data: Buffer) => {
      const str = data.toString()
      // eslint-disable-next-line no-control-regex
      const match = str.match(/\x1b]11;([^\x07\x1b]+)/)
      if (match) {
        cleanup()
        const color = match[1]
        // Parse RGB values from color string
        let r = 0, g = 0, b = 0

        if (color.startsWith("rgb:")) {
          const parts = color.substring(4).split("/")
          r = parseInt(parts[0], 16) >> 8
          g = parseInt(parts[1], 16) >> 8
          b = parseInt(parts[2], 16) >> 8
        } else if (color.startsWith("#")) {
          r = parseInt(color.substring(1, 3), 16)
          g = parseInt(color.substring(3, 5), 16)
          b = parseInt(color.substring(5, 7), 16)
        } else if (color.startsWith("rgb(")) {
          const parts = color.substring(4, color.length - 1).split(",")
          r = parseInt(parts[0])
          g = parseInt(parts[1])
          b = parseInt(parts[2])
        }

        // Calculate luminance using relative luminance formula
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        resolve(luminance > 0.5 ? "light" : "dark")
      }
    }

    process.stdin.setRawMode(true)
    process.stdin.on("data", handler)
    process.stdout.write("\x1b]11;?\x07")
  })
}
