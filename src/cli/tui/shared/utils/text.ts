/**
 * Text utility functions
 */

/**
 * Truncate string to maximum length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + "..."
}

/**
 * Wrap text to fit within a specified width
 *
 * @param text - Text to wrap
 * @param width - Maximum line width
 * @returns Array of wrapped lines
 */
export function wrapText(text: string, width: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine = currentLine ? `${currentLine} ${word}` : word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

/**
 * Repeat a character to create a line
 */
export function repeatChar(char: string, count: number): string {
  return char.repeat(count)
}
