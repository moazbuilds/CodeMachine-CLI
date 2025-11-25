export class CircularBuffer<T> {
  private buffer: T[] = []
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  push(item: T): void {
    this.buffer.push(item)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  getAll(): T[] {
    return [...this.buffer]
  }

  getSlice(start: number, end?: number): T[] {
    return this.buffer.slice(start, end)
  }

  clear(): void {
    this.buffer = []
  }

  get length(): number {
    return this.buffer.length
  }
}

export function getVisibleItems<T>(
  items: T[],
  scrollOffset: number,
  viewportHeight: number
): { visibleItems: T[]; startIndex: number; endIndex: number } {
  const startIndex = Math.max(0, scrollOffset)
  const endIndex = Math.min(items.length, startIndex + viewportHeight)

  return {
    visibleItems: items.slice(startIndex, endIndex),
    startIndex,
    endIndex,
  }
}
