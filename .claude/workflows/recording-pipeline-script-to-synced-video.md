# Recording Pipeline: Script to Synced Video

> **Goal:** Auto-generate content for YouTube — brainstorm a narration script, generate audio, record the terminal, transcribe, and sync everything into a final video via Remotion
> **Key Insight:** Sentence-level audio cutting mapped to per-word video timestamps, with Whisper transcription bridging TTS audio to frame-matched video. Upstream: collaborative script brainstorming produces all three input files before the pipeline runs.
> **Captured:** 2026-02-06
> **Status:** complete

## Pipeline Overview

```
Brainstorm → scripts/{name}.txt → subtitles/{name}.txt
  → bun run clean            → clear previous output
  → bun audio {name}         → output/audio/{name}.mp3  (generate voice FIRST)
  → check audio duration     → tune script {N} pauses + --speed to match
  → create tapes/{name}.tape
  → bun record {name}        → output/video/{name}.mp4 + output/timestamps/{name}.json
  → bun transcribe {name}    → output/captions/{name}.json
  → copy to comps/public/    → npx remotion render Sync → output/video/{name}-final.mp4
```

## One-Shot Execution Points (Go / No-Go)

Use this as the final acceptance gate before shipping any video:

1. Audio generated
- `recordings/output/audio/{name}.mp3` exists
- Audio duration measured (`ffprobe`) and noted

2. Tape anchors are safe
- First anchor is near the first spoken phrase
- Anchors are distinctive and short (avoid fragile long multi-word matches)
- Screenshot numbering is zero-padded (`w01`, `w02`, ...), preventing sort-order mistakes

3. Record step completed cleanly
- `bun run record {name}` exits successfully
- `recordings/output/timestamps/{name}.json` exists
- Timestamps are monotonic (no backward jumps)

4. Transcription completed
- `recordings/output/captions/{name}.json` exists
- No obvious missing major phrases in transcript output

5. Segment generation quality checks
- `generate-segments` exits successfully
- No overlap violations
- No tiny/invalid source video slices
- No structural sync warnings (or warnings reviewed explicitly)

6. Duration alignment
- Final timeline roughly matches audio end (no long black tail)
- Beginning and ending words are not clipped

7. Render quality gate
- No black flicker frames at transitions
- No clipped starts (e.g. `|un`)
- No clipped ends (e.g. `realt|`)
- Mid-script spot check confirms sync stays stable

8. Final artifact
- `recordings/output/video/{name}-final.mp4` exists
- Manual spot check at:
  - first 3 seconds
  - first transition
  - middle section
  - last 3 seconds

If any gate fails: NO-GO. Fix pipeline inputs/logic and re-run.

## TTS System Prompt Guidance (Default, Non-Humorous)

Use this baseline when you want clean, neutral explainer delivery:

```text
Speak naturally and conversationally with clear diction.
Keep pace moderately brisk and smooth.
Preserve exact wording and punctuation intent.
Do not add extra words or ad-libs.
Do not exaggerate pauses; pause only where punctuation or explicit break markers imply it.
Keep sentence endings complete and clean, without swallowing final consonants.
```

## Phases

### Phase 0: Script Writing (Upstream Agent)

**Purpose:** Collaboratively brainstorm and create the three input files the recording pipeline needs — this is the creative step before any automation runs

#### Step 0.1: Brainstorm the narration

- **How:** Discuss the topic with the user. Draft narration lines with face expressions, timing, and tone. Iterate until the user confirms the script content
- **Why:** The script content drives everything downstream — the voice, the video, the timing. Getting it right here prevents re-recording later
- **Output:** Agreed-upon narration text (not yet written to files)

#### Step 0.2: Create narrator script

- **How:** Write `recordings/scripts/{name}.txt` — one line per sentence, format: `face|delay: text`
  - `face` = starting expression for the line (`idle`, `thinking`, `excited`, `cool`, `error`, `tool`)
  - `delay` = seconds to wait after the line finishes typing
  - `text` = narration content, supports `{N}` mid-sentence pauses and `[face]` inline expression changes
  - Lines starting with `#` are comments, empty lines are skipped
- **Why:** The narrator TUI reads this format to render the typing animation with face expressions and timed pauses
- **Decision:** No `**bold**` markdown in script text
  - *Alternative:* Use `**word**` for emphasis
  - *Chosen because:* The narrator TUI parser (`src/cli/tui/routes/narrator/parser/script-parser.ts`) only supports `{N}` pauses and `[face]` expression changes — `**` renders as literal `*` on screen. The entire narrator text is already rendered bold via the JSX `bold` prop
- **Output:** `recordings/scripts/{name}.txt`

#### Step 0.3: Create subtitle file

- **How:** Write `recordings/subtitles/{name}.txt` — clean text, one sentence per line, proper punctuation, no metadata (no face, no delay, no inline markup)
- **Why:** The TTS engine (ElevenLabs) needs clean text without mood/timing metadata. Sending `idle|3:` to TTS produces garbled voice output
- **Natural pauses in subtitles:** Use punctuation to hint pauses to `eleven_v3` (which does NOT support SSML `<break>` tags):
  - `—` (em dash) at dramatic/emphasis beats: `"I am Ali — your CodeMachine explainer."`
  - Blank lines between sentences for breathing room
  - Don't overuse `...` or `—` — only at natural speech boundaries where you'd actually pause when talking
  - Don't add pauses between words that flow naturally together (e.g. "editing videos in After Effects" needs no stops)
- **Output:** `recordings/subtitles/{name}.txt`
- **Depends on:** Step 0.2 (extract clean text from the script)

### Phase 1: Clean and Generate Audio

**Purpose:** Start fresh and generate the voice first so we know the target duration for the video

#### Step 1.0: Clean previous output

- **How:** `bun run clean` — removes all previous output files (frames, screenshots, video, audio, timestamps, captions)
- **Why:** Stale files from previous runs can cause wrong frame matches or outdated audio being used. Always start clean
- **Output:** Empty `recordings/output/` subdirectories
- **Depends on:** Nothing

#### Step 1.1: Run audio generation

- **How:** `bun audio {name}` — reads `recordings/subtitles/{name}.txt`, concatenates all lines into a single text block, calls ElevenLabs TTS API
- **Why:** The audio duration determines how long the video needs to be. Generating audio first avoids duration mismatches
- **Decision:** ElevenLabs with model `eleven_v3`, Bill voice (`pqHfZKP75CvOlQylNhV4`)
  - *Alternative:* Other TTS services, other voices/models
  - *Chosen because:* eleven_v3 is the latest and most expressive model; Bill is a wise, mature, balanced voice
- **Audio speed:** Set `speed: 1.2` in `voice_settings` — makes audio faster/shorter, giving more headroom for video to be longer than audio. ElevenLabs range is 0.7–1.2
- **Output:** `recordings/output/audio/{name}.mp3`
- **Depends on:** Step 0.3 (subtitle file), `ELEVENLABS_API_KEY` in `.env`

#### Step 1.2: Check audio duration

- **How:** `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 recordings/output/audio/{name}.mp3`
- **Why:** This is the target duration the video must match or exceed
- **Output:** Audio duration in seconds (e.g. `28.16`)

### Phase 2: Tune Script Timing to Match Audio

**Purpose:** Adjust the narrator script so the video duration matches the audio — the video should be the same length or slightly longer than the audio

#### Step 2.1: Add mid-sentence pauses

- **How:** Add `{N}` pauses between phrases/clauses in `recordings/scripts/{name}.txt`. Place them at natural breathing points — after commas, between clauses
- **Why:** Stretches the typing animation to match the natural speaking pace of the generated audio
- **Timing guidelines:**
  - `{2}` for emphasis/dramatic moments — key reveals, important names, punchlines
  - `{1}` for light flow points — listing items, transitions like "as an example", "right?"
  - Don't go above `{3}` — it looks unnatural, like the narrator froze
  - Don't put pauses where speech flows naturally — e.g. "editing videos in After Effects" doesn't need a stop between every word
  - Sentence end delays (`face|N:`) of 3-4 seconds work well for breathing room between sentences
- **Example:**
  ```
  idle|4: Hi, {1} I am Ali, {2} your CodeMachine explainer.
  thinking|4: So, {2} you spend hours editing videos {1} in After Effects or DaVinci Resolve?
  excited|4: All you need is Claude Code {2} and CodeMachine.
  cool|4: Pretty cool, {1} right?
  ```

#### Step 2.2: Set typing speed

- **How:** In the VHS tape, set `--speed 180` (180ms per character) instead of the default `--speed 100`
- **Why:** Slower typing stretches the video further to ensure it's longer than audio. Combined with audio `speed: 1.2`, this creates a safe margin
- **Tuning:** If video is still too short after adding pauses, increase to `--speed 200`. If too long, reduce to `--speed 150`

#### Step 2.3: Use PlaybackSpeed for short scripts

- **How:** Add `Set PlaybackSpeed {value}` in the VHS tape (after other `Set` commands). Values < 1.0 slow down the output (longer video), values > 1.0 speed it up (shorter video)
- **Why:** Short scripts (3-4 sentences) don't have enough characters to fill long audio even at `--speed 200` with max pauses. `PlaybackSpeed` stretches the video without making pauses look unnatural
- **Calculating the right value:**
  1. Record once without `PlaybackSpeed`, measure video duration with `ffprobe`
  2. Target = audio duration × 1.05 (5% longer)
  3. If video is too short: `PlaybackSpeed = previous_speed × (actual_duration / target_duration)`. Start with `previous_speed = 1.0`
  4. Re-record and measure. VHS `PlaybackSpeed` affects both recording AND output, so it won't be a simple ratio — expect 1-2 iterations
- **Example:** Video was 11.56s, audio was 17.0s, target 17.85s. After iteration: `PlaybackSpeed 1.16` → 17.64s video

#### Step 2.4: Record and compare duration

- **How:** Run `bun record {name}`, then check video duration with `ffprobe`. Compare against audio duration
- **Why:** Iterative — may need 1-2 rounds of adjustment
- **Target:** Video duration must be at least **5% longer** than audio duration. If not, re-record with more pauses or higher `--speed`. Example: 33.8s audio → video should be ~35.5s+. A few extra seconds beyond 5% is fine — Remotion handles the sync

### Phase 3: Create VHS Tape and Record

#### Step 3.1: Create VHS tape

- **How:** Write `recordings/tapes/{name}.tape` — VHS commands that record the terminal running the narrator and capture per-word screenshots for frame matching
- **Why:** VHS records the terminal session as video frames and takes targeted screenshots when specific words appear, enabling precise word-to-frame timestamp mapping later

- **Exact tape template** (copy this and replace `{name}` and the per-word sections):

  ```tape
  Output recordings/output/frames/
  Output recordings/output/video/{name}.mp4
  Set Width 2560
  Set Height 1440
  Set FontSize 80
  Set Padding 0
  Set Theme { "background": "#181D27", "foreground": "#ffffff" }
  Set Framerate 60

  # Hide command typing, show when Ali frame appears
  Hide
  Type "bun run dev -- narrate recordings/scripts/{name}.txt --speed 180"
  Enter
  Wait+Screen /The CM Guy/
  Show

  # ── S1: "First sentence here." ──
  Wait+Screen /distinctiveword1/
  Screenshot recordings/output/screenshots/s1-w1-label.png
  Wait+Screen /distinctiveword2/
  Screenshot recordings/output/screenshots/s1-w2-label.png

  # ── S2: "Second sentence here." ──
  Wait+Screen /distinctiveword3/
  Screenshot recordings/output/screenshots/s2-w1-label.png

  Sleep 2
  ```

- **Working example** — the `what-is-this` tape that successfully recorded:

  ```tape
  Output recordings/output/frames/
  Output recordings/output/video/what-is-this.mp4
  Set Width 2560
  Set Height 1440
  Set FontSize 80
  Set Padding 0
  Set Theme { "background": "#181D27", "foreground": "#ffffff" }
  Set Framerate 60

  # Hide command typing, show when Ali frame appears
  Hide
  Type "bun run dev -- narrate recordings/scripts/what-is-this.txt --speed 150"
  Enter
  Wait+Screen /The CM Guy/
  Show

  # ── S1: "Hi, I am Ali, your CodeMachine explainer." ──
  Wait+Screen /Hi,/
  Screenshot recordings/output/screenshots/s1-w1-hi.png
  Wait+Screen /am/
  Screenshot recordings/output/screenshots/s1-w2-am.png
  Wait+Screen /CodeMachine/
  Screenshot recordings/output/screenshots/s1-w3-codemachine.png
  Wait+Screen /explainer/
  Screenshot recordings/output/screenshots/s1-w4-explainer.png

  # ── S2: "So, you spend hours editing videos in After Effects or DaVinci Resolve?" ──
  Wait+Screen /So,/
  Screenshot recordings/output/screenshots/s2-w1-so.png
  Wait+Screen /spend/
  Screenshot recordings/output/screenshots/s2-w2-spend.png
  Wait+Screen /hours/
  Screenshot recordings/output/screenshots/s2-w3-hours.png
  Wait+Screen /editing/
  Screenshot recordings/output/screenshots/s2-w4-editing.png
  Wait+Screen /videos/
  Screenshot recordings/output/screenshots/s2-w5-videos.png
  Wait+Screen /After/
  Screenshot recordings/output/screenshots/s2-w6-after.png
  Wait+Screen /Effects/
  Screenshot recordings/output/screenshots/s2-w7-effects.png
  Wait+Screen /DaVinci/
  Screenshot recordings/output/screenshots/s2-w8-davinci.png
  Wait+Screen /Resolve/
  Screenshot recordings/output/screenshots/s2-w9-resolve.png

  # ── S3: "Well, you don't need to anymore." ──
  Wait+Screen /Well,/
  Screenshot recordings/output/screenshots/s3-w1-well.png
  Wait+Screen /don't/
  Screenshot recordings/output/screenshots/s3-w2-dont.png
  Wait+Screen /need/
  Screenshot recordings/output/screenshots/s3-w3-need.png
  Wait+Screen /anymore/
  Screenshot recordings/output/screenshots/s3-w4-anymore.png

  Sleep 2
  ```

- **Settings breakdown:**
  - `2560x1440` (2K resolution) with `FontSize 80` — gives ~53 terminal columns
  - `Padding 0` — no border around the terminal content
  - `Framerate 60` — smooth video, 60fps frame capture
  - `Theme { "background": "#181D27", "foreground": "#ffffff" }` — CodeMachine dark background with white text

- **Hide/Show pattern:**
  - `Hide` before typing the command so the raw command text doesn't appear in the recording
  - `Wait+Screen /The CM Guy/` detects when the narrator TUI frame has loaded (the header "Ali | The CM Guy" is always visible)
  - `Show` makes the recording visible from that point forward
  - `Wait+Screen` works while `Hide` is active — VHS can still read the virtual terminal buffer

- **Word matching strategy:**
  - Use **single distinctive words** (`Wait+Screen /Effects/`) not two-word pairs (`Wait+Screen /After Effects/`)
  - At FontSize 80 with 2560px width, long sentences wrap across lines. Two-word pairs that span a line break never match in VHS screen regex
  - Skip common short words (`the`, `I`, `you`, `in`, `a`) that could match against the header text "Ali | The CM Guy" or earlier content still on screen
  - Use unique/distinctive words only: proper nouns, long words, uncommon words

- **Screenshot naming convention:** `s{sentence}-w{word}-{label}.png`
  - Example: `s2-w7-effects.png` = sentence 2, word 7, the word "effects"
  - The `sN-` prefix is used by the Remotion sync composition to group words into sentences

- **Output:** `recordings/tapes/{name}.tape`
- **Depends on:** Step 0.2 (script text determines which words to match and screenshot)

#### Step 3.2: Run VHS recording pipeline

- **How:** `bun record {name}` — this runs the pipeline script which:
  1. Cleans previous output
  2. Executes VHS with the tape file (`recordings/tapes/{name}.tape`)
  3. VHS captures every frame as PNG + records MP4 video
  4. VHS takes screenshots at each `Wait+Screen` match point
  5. Frame matcher downscales all frames and screenshots to 64x64, compares each screenshot against all frames using RMSE (ImageMagick `compare`), finds the best-matching frame
  6. Writes timestamp JSON mapping each word to its frame number and time offset
- **Why:** Creates the terminal video and a JSON mapping of when each word appears visually on screen. This mapping is essential for syncing audio to video later
- **Output:** `recordings/output/video/{name}.mp4`, `recordings/output/timestamps/{name}.json`, `recordings/output/frames/` (all PNG frames), `recordings/output/screenshots/` (per-word PNGs)
- **Depends on:** Step 0.4 (VHS tape), Step 0.2 (narrator script)

### Phase 4: Transcribe Audio

**Purpose:** Get word-level timestamps from the generated audio for sync mapping

#### Step 4.1: Run Whisper transcription

- **How:** `bun transcribe {name}` — converts MP3 to 16KHz WAV, runs Whisper.cpp (medium.en model) with `tokenLevelTimestamps: true`, parses the JSON output into Remotion `Caption[]` format
- **Why:** We need to know when each word is spoken in the audio so we can align it with when each word appears in the video
- **Decision:** Whisper.cpp via `@remotion/install-whisper-cpp` with `medium.en` model
  - *Alternative:* `base.en` (faster, less accurate), cloud transcription APIs
  - *Chosen because:* Runs locally, good accuracy, integrates directly with Remotion's `Caption` type
- **Note:** Whisper may split proper nouns oddly (e.g. "Claude" → "Cl" + "awed", "DaVinci" → "Da" + "V" + "in" + "ci"). The Remotion sync composition handles reassembly at the sentence level
- **Output:** `recordings/output/captions/{name}.json`
- **Depends on:** Step 1.1 (audio file must exist)

### Phase 5: Sync in Remotion

**Purpose:** Compose the terminal video with the generated audio, cutting audio segments to match video timing

#### Step 5.1: Copy assets to Remotion public folder

- **How:** Copy `recordings/output/` contents into `recordings/comps/public/output/`
- **Why:** Remotion serves assets from its `public/` folder via `staticFile()`. It cannot access files outside this directory
- **Output:** Assets accessible in Remotion Studio
- **Depends on:** Steps 2.1 and 3.1

#### Step 5.2: Sync composition

- **How:** The `Sync` composition in `recordings/comps/` loads both JSONs, groups words into sentences (video: by `sN-` prefix in screenshot names; audio: by `.`/`?` punctuation), pairs them, and places trimmed `<Audio>` segments at the video sentence timestamps using `<Sequence>`
- **Why:** The video and audio have different internal timing — the video shows words appearing at certain times, the audio speaks them at different times. Sentence-level cutting aligns them
- **Output:** Synced preview in Remotion Studio at `http://localhost:3200`
- **Depends on:** Step 4.1

#### Step 5.3: Export final video

- **How:** `npx remotion render Sync --output recordings/output/video/{name}-final.mp4`
- **Why:** Produces the final composited video file with synced audio
- **Decision:** Export settings: PNG image format (not JPEG), CRF 18, H.264 codec
  - *Alternative:* JPEG frames with default CRF
  - *Chosen because:* JPEG causes quality loss, dark/washed-out colors. PNG frames are lossless, CRF 18 gives high quality output
- **Config:** `recordings/comps/remotion.config.ts` must have:
  ```ts
  Config.setVideoImageFormat("png");
  Config.setOverwriteOutput(true);
  Config.setCrf(18);
  ```
- **Output:** `recordings/output/video/{name}-final.mp4`
- **Depends on:** Step 4.2

### Branching Logic

- **If** subtitle file doesn't exist for `{name}`: → abort with error, run Phase 0 first
- **If** Whisper model not downloaded yet: → auto-downloads on first `bun transcribe` run (~1.5GB, one-time)
- **If** VHS `Wait+Screen` times out on a word: → check if the word wraps across lines (use single words instead of pairs), or if the narrator moved past it (increase `--speed` value for slower typing)
- **If** video duration < audio duration: → first try increasing `--speed` (e.g. 150 → 200). If still too short (especially with short scripts), use `Set PlaybackSpeed` in the tape to slow the output. Don't crank up `{N}` pauses or delays — it looks unnatural. `PlaybackSpeed` is the right tool for bridging large duration gaps
- **If** video duration > audio duration by more than 5s: → reduce `{N}` values or lower `--speed`. A few seconds longer is fine

## Dead Ends

### Recording video before generating audio
- **What happened:** Recorded the terminal video first (18s), then generated audio (28s). Audio was 10 seconds longer than video
- **Why it failed:** The TTS voice speaks at its natural pace which is unpredictable. Recording video first means you don't know the target duration, leading to audio/video mismatch
- **Lesson:** Always generate audio FIRST (`bun audio {name}`), check its duration with `ffprobe`, then tune the script timing (`{N}` pauses, `--speed`, sentence delays) to match before recording. Video should be >= audio duration

### `**bold**` markdown in narrator scripts
- **What happened:** Added `**Ali**`, `**CodeMachine**` etc. to script for emphasis
- **Why it failed:** The narrator TUI parser (`src/cli/tui/routes/narrator/parser/script-parser.ts`) only supports `{N}` pauses and `[face]` expression changes — no bold markup. `**` rendered as literal `*` on screen
- **Lesson:** The entire narrator text is already rendered with the JSX `bold` prop. Don't add markdown bold to scripts

### Unicode `╭` in VHS `Wait+Screen` regex
- **What happened:** Used `Wait+Screen /╭/` to detect when the TUI frame appeared
- **Why it failed:** VHS regex engine couldn't match the unicode box-drawing character — timed out every time
- **Lesson:** Use ASCII text from the TUI header instead: `Wait+Screen /The CM Guy/`

### Two-word pair matching at large font sizes
- **What happened:** Used `Wait+Screen /After Effects/` to match word pairs for reliable detection
- **Why it failed:** At FontSize 80 + 2560px width (~53 columns), sentences wrap across lines. Two-word pairs that span a line break never match in VHS screen regex
- **Lesson:** Use single distinctive words at large font sizes. Common words (The, I, you) may conflict with header text — skip them or use unique words only

### `match.ts` hardcoded output name
- **What happened:** `match.ts` wrote timestamps to hardcoded `test-ali.json`
- **Why it failed:** Not parameterized — couldn't run for different recordings
- **Lesson:** Updated to accept `process.argv[2]` as `{name}` argument, outputs to `timestamps/{name}.json`

### Using `<Video>` from `@remotion/media`
- **What happened:** Video rendered as black/transparent in Remotion Studio
- **Why it failed:** `@remotion/media` uses WebCodecs API (`VideoDecoderWrapper`) which couldn't decode the VHS-generated H.264 video — threw `EncodingError: Decoding error`
- **Lesson:** Use `<OffthreadVideo>` from `remotion` instead — it extracts frames server-side and handles more codecs

### Reading subtitle text from `recordings/scripts/{name}.txt`
- **What happened:** Initial audio script read from the narrator script format (`idle|3: Hello I am Ali...`)
- **Why it failed:** Mood/timing metadata (`idle|3:`) was sent to TTS, producing garbled voice output
- **Lesson:** Keep separate clean subtitle files in `recordings/subtitles/` for TTS input

### Symlinked public folder
- **What happened:** Symlinked `recordings/output` into `recordings/comps/public/output`
- **Why it failed:** Remotion's dev server had issues serving files through symlinks
- **Lesson:** Copy actual files into `public/` instead of symlinking

### JPEG image format for rendering
- **What happened:** Exported video looked dark and washed out
- **Why it failed:** Remotion's default `Config.setVideoImageFormat("jpeg")` uses lossy JPEG compression for intermediate frames, causing color degradation
- **Lesson:** Always use `Config.setVideoImageFormat("png")` and `Config.setCrf(18)` for high quality output

### Skipping first word screenshots in sentences
- **What happened:** First screenshot in S1 was `coding` (6th word), skipping "Every time you use an AI"
- **Why it failed:** The sync composition starts audio from the first matched word. Since "coding" was the first match, audio for "Every time you use an AI" (0.07s–1.89s) was never placed — the first ~2 seconds of voice were silent
- **Lesson:** Always screenshot the FIRST distinctive word of each sentence. The sync composition needs it as the anchor to place the full sentence audio. If the first word is too common (e.g. "The"), use the second or third word — but never skip deep into the sentence

### Stale files in `comps/public/output/` causing wrong render
- **What happened:** Rendered final video showed the old "what-is-this" content instead of the new "workflow-model" recording
- **Why it failed:** Copied new assets on top of old ones without cleaning first. Old files (video, timestamps, captions) from the previous recording were still present. Also `Root.tsx` still had `defaultProps.name: "what-is-this"` and the old `durationInFrames`
- **Lesson:** Always `rm -rf recordings/comps/public/output/` before copying new assets. Always update `Root.tsx` `defaultProps.name` and `durationInFrames` when switching recordings

### Excessive pauses to match audio duration
- **What happened:** Video was 11.56s but audio was 17s. Cranked up `{N}` pauses to `{3}` and delays to `|5` to stretch the video
- **Why it failed:** The typing animation looked frozen and unnatural with long pauses everywhere. With only 4 short sentences there simply aren't enough characters to fill 17s of typing
- **Lesson:** Use `Set PlaybackSpeed` in the VHS tape to stretch the output instead. It slows the entire recording uniformly rather than adding awkward freezes at specific points

### `calculateMetadata` with hardcoded port
- **What happened:** Used `fetch("http://localhost:3000/public/...")` in `calculateMetadata`
- **Why it failed:** Studio was running on a different port (3200), causing `Failed to fetch`
- **Lesson:** Use `staticFile()` which resolves to the correct Studio URL automatically

## Artifacts

| Artifact | Location | Purpose |
|----------|----------|---------|
| Narrator scripts | `recordings/scripts/{name}.txt` | Script with mood/timing for the narrator TUI |
| Subtitles | `recordings/subtitles/{name}.txt` | Clean narration text for TTS |
| VHS tapes | `recordings/tapes/{name}.tape` | VHS recording commands with per-word screenshots |
| Audio generator | `recordings/tools/audio.ts` | ElevenLabs TTS from subtitle files |
| Pipeline script | `recordings/tools/pipeline.ts` | VHS recording + frame matching pipeline |
| Match tool | `recordings/tools/match.ts` | Frame matching with dynamic `{name}` argument |
| Transcriber | `recordings/comps/transcribe.ts` | Whisper.cpp transcription to Remotion Caption format |
| Sync composition | `recordings/comps/src/SyncComposition.tsx` | Remotion composition that syncs video + audio |
| Root composition | `recordings/comps/src/Root.tsx` | Registers Sync composition |
| Video timestamps | `recordings/output/timestamps/{name}.json` | Per-word frame mapping from VHS recording |
| Audio captions | `recordings/output/captions/{name}.json` | Word-level audio timestamps from Whisper |
| .env | `.env` | `ELEVENLABS_API_KEY` |
| npm scripts | `package.json` | `bun audio`, `bun transcribe`, `bun record`, `bun match` |

## Gotchas

- At FontSize 80 with 2560px width, terminal has ~53 columns — long sentences WILL wrap. Use single distinctive words for `Wait+Screen`, not two-word pairs
- `Wait+Screen` works fine while `Hide` is active — VHS can still read the virtual terminal buffer
- VHS `Wait+Screen` cannot match unicode box-drawing characters (`╭`, `╰`, etc.) — use ASCII patterns like `/The CM Guy/`
- The narrator TUI does NOT support `**bold**` markdown — all text is already bold via JSX prop. `**` renders as literal `*`
- Composition FPS must match video FPS (25fps for VHS output) — mismatched FPS causes stuttering in Studio
- `@remotion/install-whisper-cpp` must be installed in `recordings/comps/` (not root) since that's where Remotion dependencies live — the transcribe script lives there too
- The Whisper medium.en model is ~1.5GB — first run downloads it to `recordings/whisper.cpp/`
- VHS video uses H.264 High profile which WebCodecs can't decode — always use `OffthreadVideo`
- Audio `.mp3` and captions `.json` must be copied to `recordings/comps/public/output/` before Remotion can access them
- Whisper splits proper nouns oddly ("Claude" → "Cl"+"awed") — the sync composition handles this at sentence level
- ALWAYS generate audio before recording video — the audio duration is unpredictable and determines how long the video needs to be
- **Pause variation matters:** Use `{2}` for dramatic/emphasis moments, `{1}` for light transitions. Don't pause between words that flow naturally together. Over-pausing sounds robotic
- `--speed 180` (180ms/char) is the default typing speed. Combined with audio `speed: 1.2`, this ensures video is ~5% longer than audio. `--speed 100` is too fast for voice sync, `--speed 200` looks sluggish
- **Audio speed 1.2** in `voice_settings` makes audio shorter — this is key to keeping video longer than audio without needing excessive script pauses
- **Video must be ≥5% longer than audio.** If not, increase `--speed`, use `Set PlaybackSpeed`, or add more `{N}` pauses (in that order of preference). Never ship a video shorter than audio — the audio will get cut off
- `eleven_v3` does NOT support SSML `<break>` tags — use `—` (em dash) and blank lines in subtitles for natural pauses instead
- **Always screenshot the first distinctive word of each sentence** — the sync starts audio from the first matched word. Skipping early words causes the beginning of the sentence audio to be silent
- **Always clean `comps/public/output/` before copying** — `rm -rf` then `cp -r`. Stale files from previous recordings cause wrong renders
- **Always update Root.tsx** when switching recordings — change both `defaultProps.name` and `durationInFrames` (= video duration in seconds × 25fps)
- **VHS `PlaybackSpeed` affects both recording AND output** — it's not just a post-processing speed change. Values need iterative tuning, not simple ratio math
- **Short scripts (3-4 sentences) need `PlaybackSpeed`** — don't try to fill 17s of audio with 4 short sentences by cranking up pauses. Use `PlaybackSpeed` to slow the output uniformly instead
