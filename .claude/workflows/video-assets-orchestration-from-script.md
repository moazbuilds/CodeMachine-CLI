# Video Assets Orchestration from Script

> **Goal:** Create the video's assets by reading the script, planning asset needs with the user, and auto-generating approved assets.
> **Key Insight:** A two-agent flow works best: one agent owns synced video baseline timing, and one agent owns visual asset planning/generation with user-in-the-loop draft approval.
> **Captured:** 2026-02-22
> **Status:** in-progress

## Phases

### Phase 1: Intake and Asset Discovery

**Purpose:** Convert the narration script into a concrete asset plan before generating media.

#### Step 1.1: Parse script into visual beats

- **How:** Read `recordings/scripts/{name}.txt` (or subtitle source), split by sentence/line, and extract visual cues (entities, actions, mood shifts, transitions).
- **Why:** Asset generation must map to actual narration beats, not generic visuals.
- **Decision:** Use script/subtitle lines as the source of truth.
  - *Alternative:* Start from ad-hoc visual ideas only.
  - *Chosen because:* Direct script mapping prevents missing scenes and timing mismatches.
- **Output:** Beat list with scene intents.
- **Depends on:** Existing script files.

#### Step 1.2: Build a draft asset sheet

- **How:** Auto-generate a draft that includes: total asset count, asset categories (overall/summary cards, ASCII media, overlays, transition cards), style direction, and per-scene examples.
- **Why:** The user should review one structured plan instead of approving assets one-by-one blindly.
- **Decision:** Draft first, generate second.
  - *Alternative:* Generate all assets immediately.
  - *Chosen because:* Early review avoids wasted renders and style rework.
- **Output:** Asset sheet draft.
- **Depends on:** Step 1.1.

#### Step 1.3: User brainstorming and approval gate

- **How:** Ask for additions/removals, style edits, and missing assets; update the draft once; finalize approved scope.
- **Why:** Human direction is required for narrative intent and brand tone.
- **Decision:** One explicit approval gate before generation.
  - *Alternative:* Iterative generation without a gate.
  - *Chosen because:* Approval gate keeps production deterministic and faster.
- **Output:** Approved asset plan.
- **Depends on:** Step 1.2.

### Phase 2: Two-Agent Production

**Purpose:** Produce synchronized base video and approved assets in parallel-safe roles.

#### Step 2.1: Agent 1 - Synced baseline video

- **How:** Generate audio, record terminal video, match timestamps, and sync final baseline video through the existing recording pipeline workflow.
- **Why:** Baseline timing is required so assets can be aligned to real beats.
- **Decision:** Reuse existing sync pipeline as an independent agent task.
  - *Alternative:* Rebuild sync logic inside asset workflow.
  - *Chosen because:* Existing pipeline is already validated and avoids duplicated logic.
- **Output:** Synced baseline (`recordings/output/video/{name}-final.mp4`) and timing data.
- **Depends on:** Approved script/subtitles and existing pipeline tooling.

#### Step 2.2: Agent 2 - Asset and ASCII media generation

- **How:** Generate assets from approved plan, including ASCII projects under `recordings/asciis/{project}/` and render via `bun ascii {project}` to PNG (single-frame) or GIF (multi-frame).
- **Why:** Separating visual asset generation from sync logic improves iteration speed and keeps concerns clean.
- **Decision:** Use script-driven folders and text-based frame sources.
  - *Alternative:* Hardcoded assets in code or terminal capture-only approach.
  - *Chosen because:* File-driven assets are editable, versioned, and reproducible.
- **Output:** Rendered assets in `recordings/asciis/{project}/out/` and other approved media outputs.
- **Depends on:** Step 1.3 and renderer/tool availability.

#### Step 2.3: Integration pass

- **How:** Map generated assets to script beats, validate visual timing against baseline video, and mark missing assets for next pass.
- **Why:** Assets are only useful when placed at the intended narrative moments.
- **Decision:** Validate placement before final expansion.
  - *Alternative:* Defer validation until full final edit.
  - *Chosen because:* Early integration catches count/style mismatches quickly.
- **Output:** Integrated asset map and pass/fail checklist.
- **Depends on:** Step 2.1 and Step 2.2.

### Branching Logic

- **If** user rejects draft asset sheet: → revise Step 1.2 and return to Step 1.3.
- **Else** (user approves draft): → continue to Phase 2 generation.
- **If** asset is single-frame: → render PNG by default.
- **Else** (multi-frame): → render GIF by default, or PNG sequence when explicitly requested.
- **If** GIF frames appear to append/trail: → enforce disposal mode (`background`) and rerender.
- **If** alignment looks wrong in ASCII renders: → use fixed character-grid rendering and tune `--char-width-factor` / `--line-height-factor`.

## Dead Ends

### Multiline text rendering for ASCII alignment
- **What happened:** Face/body/legs and logo columns drifted when rendered through multiline annotate behavior.
- **Why it failed:** Text engine layout was not strict enough for character-cell ASCII.
- **Lesson:** Render with an explicit char-grid (row/column positions), not multiline text flow.

### Transparent GIF frames visually stacking
- **What happened:** New frames looked appended over older ones.
- **Why it failed:** GIF disposal mode did not clear prior frame state for transparent frames.
- **Lesson:** Set per-frame disposal to `background` for replacement behavior.

## Artifacts

| Artifact | Location | Purpose |
|----------|----------|---------|
| Asset workflow | `.claude/workflows/video-assets-orchestration-from-script.md` | Captured process for script-to-assets orchestration |
| ASCII tool | `recordings/tools/ascii.ts` | Render ASCII sources to PNG/GIF |
| ASCII projects root | `recordings/asciis/` | File-driven asset source folders by project |
| Example project | `recordings/asciis/multi-agent-orchestration/` | Modern tab-window multi-frame ASCII sheets |
| Render outputs | `recordings/asciis/{project}/out/` | Generated PNG/GIF deliverables |
| Baseline sync workflow | `.claude/workflows/recording-pipeline-script-to-synced-video.md` | Agent 1 reference pipeline |

## Gotchas

- Always run a draft/approval step before generation; skipping it creates rework.
- Keep agent responsibilities separated: sync pipeline vs asset generation.
- For ASCII, folder-driven sources (`recordings/asciis/{project}`) are more maintainable than hardcoded strings.
- Default transparent PNG is ideal for compositing, but GIF needs proper disposal settings.
- Treat this as in-progress: additional agents/phases can be appended later.
