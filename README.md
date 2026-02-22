# Ali Narrator TUI

A terminal-based narrator interface featuring Ali, the CodeMachine explainer character. Ali types out text with a typing animation inside an ASCII art frame, with support for face expressions, timed pauses, and multi-line scripts.

This is used to create video content - record the terminal running a narrate script and you get a ready-to-use explainer clip.

[![See it in action](video-thumbnail.png)](https://www.youtube.com/watch?v=G7OTG9iSvYw)

## Requirements

- [Bun](https://bun.sh) runtime

## Setup

```bash
bun install
```

## Commands

### `say` - Quick single-line narration

```bash
bun run dev -- say "Hello world"
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --face <expression>` | Starting face expression | `idle` |
| `-d, --delay <seconds>` | Seconds to wait after text completes | `2` |
| `-s, --speed <ms>` | Milliseconds per character | `30` |

The text supports inline markup:

- `{N}` - pause for N seconds mid-sentence
- `[face]` - change face expression inline

```bash
bun run dev -- say "Hi {1} [thinking] Let me think about that..." --face idle --delay 3
```

### `narrate` - Play a script file

```bash
bun run dev -- narrate script.txt
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `-s, --speed <ms>` | Milliseconds per character | `30` |

## Script format

Each line follows the format:

```
face|delay: text content here
```

- **face** - starting face expression for the line (e.g. `idle`, `thinking`)
- **delay** - seconds to wait after the line finishes typing
- **text** - content with optional `{N}` pauses and `[face]` expression changes

Lines starting with `#` are comments. Empty lines are skipped.

### Example script

```
# intro.txt
idle|3: Hi, {2} I am Ali {1} [thinking] your codemachine explainer
thinking|2: Let me explain how this works...
idle|1: Pretty cool, right?
```

Run it:

```bash
bun run dev -- narrate intro.txt
```

## Example output

Running `bun run dev -- say "Hello world"` renders a centered frame in the terminal:

```
 ╭─
 │  (⌐■_■)    Ali | The CM Guy
 │  ↳ Hello world_
 ╰─
```

With face changes, `bun run dev -- say "Hi {1} [thinking] Let me think..." --face idle`:

```
 ╭─
 │  (╭ರ_•́)    Ali | The CM Guy
 │  ↳ Hi  Let me think..._
 ╰─
```

The text types out character by character. `{1}` inserts a 1-second pause mid-sentence, and `[thinking]` switches the face from `(⌐■_■)` to `(╭ರ_•́)`.

### Available faces

| Name | Face |
|------|------|
| `idle` | `(⌐■_■)` |
| `thinking` | `(╭ರ_•́)` |
| `tool` | `<(•_•<)` |
| `error` | `(╥﹏╥)` |
| `excited` | `(ノ◕ヮ◕)ノ` |
| `cool` | `(⌐■_■)` |

### Keyboard controls

| Key | Action |
|-----|--------|
| `r` | Restart playback |
| `Ctrl+C` | Exit |

## Recording Pipeline

End-to-end pipeline: subtitle → audio → terminal recording → transcription → synced video export.

Requires [VHS](https://github.com/charmbracelet/vhs), [ImageMagick](https://imagemagick.org/), [ffmpeg](https://ffmpeg.org/), and an `ELEVENLABS_API_KEY` in `.env`.

| Command | Description |
|---------|-------------|
| `bun run audio <name>` | Generate TTS audio from `recordings/inputs/{name}/subtitles.txt` via ElevenLabs, Google, or Gemini |
| `bun run record <name>` | Run VHS tape, match frames, generate per-word timestamps |
| `bun run match <name>` | Re-run frame matching only |
| `bun run transcribe <name>` | Transcribe audio to word-level captions (Whisper.cpp) |
| `bun run segments <name>` | Generate silence-aware sync segments for Remotion |
| `bun run clean` | Archive project inputs/outputs into `recordings/.archive` and clean active run folders |

### Workflow

```
recordings/inputs/{name}/subtitles.txt → bun audio → recordings/outputs/{name}/audio/{name}.mp3
                                           bun record → recordings/outputs/{name}/video/{name}.mp4 + recordings/outputs/{name}/timestamps/{name}.json
                                           bun transcribe → recordings/outputs/{name}/captions/{name}.json
                                           bun segments → recordings/apps/remotion/public/outputs/{name}/segments/{name}.json
                                           cd recordings/apps/remotion && npx remotion render Sync → recordings/outputs/{name}/video/{name}-final.mp4
```

1. Write clean narration text in `recordings/inputs/{name}/subtitles.txt`
2. `bun audio {name}` — generates MP3 using `TTS_PROVIDER`:
   - `elevenlabs` (default)
   - `google` (uses SSML input)
   - `gemini` (uses Gemini TTS on Vertex AI with SSML-directed pauses)
3. `bun record {name}` — records terminal via VHS, matches per-word screenshots to frames
4. `bun transcribe {name}` — runs Whisper.cpp on the audio, outputs Remotion `Caption[]` JSON
5. Copy `recordings/outputs/{name}/` to `recordings/apps/remotion/public/outputs/{name}/`
6. `bun segments {name}` — generates `recordings/apps/remotion/public/outputs/{name}/segments/{name}.json`
7. Render with Remotion

The Remotion composition cuts the audio into sentence segments and places each at the video timestamp where that sentence appears on screen.

### Remotion export

```bash
cd recordings/apps/remotion
npx remotion render Sync --output ../outputs/{name}/video/{name}-final.mp4
```

Export settings in `remotion.config.ts`: PNG frames, CRF 18, H.264. Uses `OffthreadVideo` (not `<Video>` from `@remotion/media` — VHS H.264 output triggers WebCodecs decoding errors).
