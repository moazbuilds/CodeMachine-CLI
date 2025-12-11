/**
 * Global error toast utility
 *
 * Usage: emitAppError("Something went wrong")
 * Usage: emitAppError("Error message", 5000) // auto-dismiss after 5 seconds
 */
export function emitAppError(message: string, duration?: number): void {
  ;(process as NodeJS.EventEmitter).emit('app:error', { message, duration })
}
