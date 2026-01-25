/** @jsxImportSource @opentui/solid */
/**
 * Narrator Route
 *
 * Re-exports for the narrator TUI feature.
 */

export { NarratorView } from './narrator-view.js'
export type { NarratorViewProps } from './narrator-view.js'

export { AliFrame } from './components/ali-frame.js'
export { NarratorText } from './components/narrator-text.js'

export { useNarratorPlayback } from './hooks/use-narrator-playback.js'

export { parseScript, parseScriptLine, createSingleLineScript } from './parser/script-parser.js'
export type { ScriptLine, TextSegment, NarratorScript, NarratorOptions } from './parser/types.js'
