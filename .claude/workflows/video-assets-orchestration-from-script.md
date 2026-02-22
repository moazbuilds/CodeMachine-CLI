# Video Assets Orchestration from Script

> **Goal:** Create the video's assets by reading the script, planning asset needs with the user, and auto-generating approved assets.
> **Key Insight:** A two-agent assets flow works best: one agent plans the asset sheet with the user, and one agent generates media from that approved sheet.
> **Captured:** 2026-02-22
> **Status:** in-progress

## Phases

### Phase 0: Assets CLI Contract

**Purpose:** Lock a minimal, assets-only command surface.

#### Step 0.1: Use asset wrappers only

- **How:** Use only asset-generation commands through Bun wrappers.
- **Why:** Prevents unrelated pipeline steps from leaking into this workflow.
- **Decision:** Assets-only command policy.
  - *Alternative:* Mix with audio/record/transcribe/sync commands.
  - *Chosen because:* This workflow is scoped to asset production only.
- **Output:** Clear assets-only execution boundary.
- **Depends on:** `recordings/tools/ascii.ts` and `package.json` script `ascii`.

#### Step 0.2: Command set

- **How:** Use only these commands:
  - `bun ascii {project}`
  - `bun ascii {project} --name {asset}`
  - `bun ascii {project} --name {asset} --format png`
  - `bun ascii {project} --name {asset} --format gif`
- **Why:** These are sufficient to render approved ASCII media assets.
- **Decision:** No non-assets commands in this workflow.
  - *Alternative:* Include `audio/record/transcribe/render:sync`.
  - *Chosen because:* Those belong to the recording/sync workflow, not assets workflow.
- **Output:** Repeatable asset render command matrix.
- **Depends on:** Step 0.1.

### Phase 1: Agent A - Asset Planner

**Purpose:** Convert narration script into an approved asset sheet.

#### Step 1.1: Parse script into visual beats

- **How:** Read `recordings/scripts/{name}.txt` (or equivalent narrative source), split by lines/sentences, and extract what visuals are needed per beat.
- **Why:** Assets should be driven by narration intent, not generic templates.
- **Decision:** Script-first planning.
  - *Alternative:* Brainstorm assets without script mapping.
  - *Chosen because:* Script mapping reduces missing shots and overproduction.
- **Output:** Beat map with required visuals.
- **Depends on:** Existing script.

#### Step 1.2: Auto-draft the asset sheet

- **How:** Produce a draft including:
  - total number of assets
  - categories (overall-summary cards, ASCII scenes, overlays, transitions)
  - style direction (modern tab-window, typography tone, spacing)
  - concrete examples per scene
- **Why:** Gives the user a full plan to critique before generation.
- **Decision:** Draft-first review gate.
  - *Alternative:* Immediate generation.
  - *Chosen because:* Prevents wasted render cycles.
- **Output:** Draft asset sheet.
- **Depends on:** Step 1.1.

#### Step 1.3: Brainstorm + approval loop

- **How:** Ask user for additions/removals/style changes, apply edits, and get explicit approval.
- **Why:** Creative fit requires user input before committing files.
- **Decision:** Explicit approval required.
  - *Alternative:* Assume draft is final.
  - *Chosen because:* Keeps scope aligned with user intent.
- **Output:** Approved asset sheet.
- **Depends on:** Step 1.2.

### Phase 2: Agent B - Asset Generator

**Purpose:** Materialize approved assets into project folders and outputs.

#### Step 2.1: Create asset source structure

- **How:** Build sources under `recordings/asciis/{project}/` with one `.txt` per asset.
  - Single-frame asset: plain ASCII text
  - Multi-frame asset: `frame N|duration:` blocks
- **Why:** File-driven sources are editable, versioned, and reproducible.
- **Decision:** Folder-per-project convention.
  - *Alternative:* Hardcoded text inside scripts.
  - *Chosen because:* Easier iteration and collaboration.
- **Output:** Asset source files in project folder.
- **Depends on:** Approved plan from Step 1.3.

#### Step 2.2: Render approved assets

- **How:** Render by need:
  - Full project: `bun ascii {project}`
  - One asset only: `bun ascii {project} --name {asset}`
  - PNG required: `bun ascii {project} --name {asset} --format png`
  - GIF required: `bun ascii {project} --name {asset} --format gif`
- **Why:** Produces concrete media for compositing.
- **Decision:** Format based on frame count and usage.
  - *Alternative:* Always GIF or always PNG.
  - *Chosen because:* Single-frame and multi-frame assets have different needs.
- **Output:** Rendered media in `recordings/asciis/{project}/out/`.
- **Depends on:** Step 2.1.

#### Step 2.3: Asset QA pass

- **How:** Validate each output against the approved sheet (count, naming, style, readability, alignment, transparency expectations).
- **Why:** Prevents drift between approved draft and generated media.
- **Decision:** QA before handoff.
  - *Alternative:* Defer checks to final edit stage.
  - *Chosen because:* Earlier QA is cheaper to fix.
- **Output:** Pass/fail checklist and rerender list.
- **Depends on:** Step 2.2.

### Branching Logic

- **If** user rejects asset draft: → revise Step 1.2 and repeat Step 1.3.
- **Else** (approved): → proceed to Agent B generation.
- **If** asset is single-frame: → default PNG.
- **Else** (multi-frame): → default GIF (or PNG sequence if requested).
- **If** GIF shows trailing/appending frames: → enforce disposal mode `background` and rerender.
- **If** ASCII alignment is off: → tune `--char-width-factor` and `--line-height-factor`, then rerender.

## Dead Ends

### Using multiline text flow for ASCII layout
- **What happened:** Character columns drifted in face/logo assets.
- **Why it failed:** Multiline text layout was not strict enough for cell-based ASCII.
- **Lesson:** Use fixed character-grid rendering.

### Transparent GIF frame stacking
- **What happened:** Frames appeared appended instead of replaced.
- **Why it failed:** Disposal mode did not clear prior frame state.
- **Lesson:** Use frame disposal `background` for replacement behavior.

## Artifacts

| Artifact | Location | Purpose |
|----------|----------|---------|
| Assets workflow | `.claude/workflows/video-assets-orchestration-from-script.md` | Captured process for script-to-assets generation |
| ASCII renderer | `recordings/tools/ascii.ts` | Render ASCII source files to PNG/GIF |
| Assets source root | `recordings/asciis/` | Project folders for ASCII assets |
| Rendered outputs | `recordings/asciis/{project}/out/` | Final asset media for compositing |
| Example asset project | `recordings/asciis/multi-agent-orchestration/` | Modern tab-window animation sheets |

## Gotchas

- Keep this workflow assets-only; do not include sync/audio pipeline commands.
- Always require approval on the draft asset sheet before generating files.
- Use folder-driven sources (`recordings/asciis/{project}`), not hardcoded strings.
- PNG outputs are transparent by default; confirm this is desired per asset.
- GIF outputs must use proper disposal to avoid visual trails.
