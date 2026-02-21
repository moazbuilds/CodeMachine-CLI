#!/usr/bin/env bun
/**
 * generate-segments.ts
 *
 * Reads the actual WAV waveform to find real silence regions, then uses
 * Whisper captions + video timestamps + script pause markers to decide
 * WHICH silence to cut at. Cuts only happen where the audio volume is
 * actually silent — never mid-word, regardless of Whisper timestamp accuracy.
 *
 * Usage: bun generate-segments.ts <name>
 *   e.g. bun generate-segments.ts what-is-this
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

type VideoTimestamp = {
  word: string;
  screenshot: string;
  frame: string;
  frameNumber: number;
  timestamp: number;
};

type AudioWord = {
  text: string;
  startSec: number;
  endSec: number;
};

type WordSegment = {
  videoStartSec: number;
  videoEndSec: number;
  audioStartSec: number;
  audioEndSec: number;
};

type SilenceRegion = {
  startSec: number;
  endSec: number;
  midSec: number;
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const name = process.argv[2];
if (!name) {
  console.error("Usage: bun generate-segments.ts <name>");
  process.exit(1);
}

const COMPS_DIR = dirname(Bun.main);
const PUBLIC_DIR = join(COMPS_DIR, "public/output");
const SCRIPTS_DIR = join(COMPS_DIR, "../scripts");

const captions: Caption[] = JSON.parse(
  readFileSync(join(PUBLIC_DIR, `captions/${name}.json`), "utf-8"),
);
const videoTimestamps: VideoTimestamp[] = JSON.parse(
  readFileSync(join(PUBLIC_DIR, `timestamps/${name}.json`), "utf-8"),
);
const scriptText = readFileSync(join(SCRIPTS_DIR, `${name}.txt`), "utf-8");

// ---------------------------------------------------------------------------
// Step 1 – Read WAV file and compute RMS energy per window
//
// The WAV is 16-bit PCM, 16kHz mono (produced by ffmpeg for Whisper).
// We compute RMS in small windows (10ms = 160 samples) to build an
// energy profile, then find silence regions where energy stays below
// a threshold.
// ---------------------------------------------------------------------------

const WINDOW_MS = 10;
const SILENCE_THRESHOLD_DB = -35; // dB below peak — anything quieter = silence
const MIN_SILENCE_MS = 30; // minimum silence duration to count as a gap

function readWavSamples(wavPath: string): { samples: Float32Array; sampleRate: number } {
  const buf = readFileSync(wavPath);

  // Parse WAV header
  const riff = buf.toString("ascii", 0, 4);
  if (riff !== "RIFF") throw new Error("Not a WAV file");

  const fmt = buf.toString("ascii", 12, 16);
  if (fmt !== "fmt ") throw new Error("Missing fmt chunk");

  const audioFormat = buf.readUInt16LE(20);
  const numChannels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);

  if (audioFormat !== 1) throw new Error(`Unsupported audio format: ${audioFormat}`);
  if (bitsPerSample !== 16) throw new Error(`Unsupported bits: ${bitsPerSample}`);

  // Find data chunk
  let offset = 36;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === "data") {
      offset += 8;
      const numSamples = chunkSize / (bitsPerSample / 8);
      const samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = buf.readInt16LE(offset + i * 2) / 32768;
      }
      if (numChannels > 1) {
        const mono = new Float32Array(Math.floor(numSamples / numChannels));
        for (let i = 0; i < mono.length; i++) {
          mono[i] = samples[i * numChannels];
        }
        return { samples: mono, sampleRate };
      }
      return { samples, sampleRate };
    }
    offset += 8 + chunkSize;
  }

  throw new Error("No data chunk found in WAV");
}

function computeRmsWindows(
  samples: Float32Array,
  sampleRate: number,
  windowMs: number,
): { rms: Float32Array; windowSec: number } {
  const windowSamples = Math.round((sampleRate * windowMs) / 1000);
  const numWindows = Math.floor(samples.length / windowSamples);
  const rms = new Float32Array(numWindows);

  for (let w = 0; w < numWindows; w++) {
    let sum = 0;
    const start = w * windowSamples;
    for (let i = start; i < start + windowSamples; i++) {
      sum += samples[i] * samples[i];
    }
    rms[w] = Math.sqrt(sum / windowSamples);
  }

  return { rms, windowSec: windowMs / 1000 };
}

function findSilenceRegions(
  rms: Float32Array,
  windowSec: number,
  thresholdDb: number,
  minSilenceMs: number,
): SilenceRegion[] {
  let peakRms = 0;
  for (const v of rms) {
    if (v > peakRms) peakRms = v;
  }
  const thresholdLinear = peakRms * Math.pow(10, thresholdDb / 20);
  const minWindows = Math.ceil(minSilenceMs / (windowSec * 1000));

  const regions: SilenceRegion[] = [];
  let silenceStart = -1;

  for (let i = 0; i < rms.length; i++) {
    const isSilent = rms[i] < thresholdLinear;

    if (isSilent && silenceStart < 0) {
      silenceStart = i;
    } else if (!isSilent && silenceStart >= 0) {
      const len = i - silenceStart;
      if (len >= minWindows) {
        const startSec = silenceStart * windowSec;
        const endSec = i * windowSec;
        regions.push({
          startSec,
          endSec,
          midSec: (startSec + endSec) / 2,
        });
      }
      silenceStart = -1;
    }
  }

  if (silenceStart >= 0) {
    const len = rms.length - silenceStart;
    if (len >= minWindows) {
      const startSec = silenceStart * windowSec;
      const endSec = rms.length * windowSec;
      regions.push({ startSec, endSec, midSec: (startSec + endSec) / 2 });
    }
  }

  return regions;
}

/**
 * Find the best cut point within a bounded time range [minSec, maxSec].
 * Only considers silence regions that actually overlap this range.
 * If real silence is found → cut in the middle of it.
 * If no silence in range → return the fallback (Whisper estimate).
 */
function findCutInRange(
  minSec: number,
  maxSec: number,
  fallbackSec: number,
  silenceRegions: SilenceRegion[],
): number | null {
  let bestMid = -1;
  let bestDist = Infinity;

  for (const r of silenceRegions) {
    const overlapStart = Math.max(r.startSec, minSec);
    const overlapEnd = Math.min(r.endSec, maxSec);
    if (overlapStart >= overlapEnd) continue;

    const mid = (overlapStart + overlapEnd) / 2;
    const dist = Math.abs(mid - fallbackSec);
    if (dist < bestDist) {
      bestDist = dist;
      bestMid = mid;
    }
  }

  return bestMid >= 0 ? bestMid : null;
}

function buildWordBoundaries(audioWords: AudioWord[]): number[] {
  const points = new Set<number>();
  points.add(0);

  for (const w of audioWords) {
    points.add(w.startSec);
    points.add(w.endSec);
  }

  return [...points].sort((a, b) => a - b);
}

function findNearestBoundary(
  fallbackSec: number,
  boundaries: number[],
  minSec: number,
  maxSec: number,
): number {
  if (boundaries.length === 0) return fallbackSec;

  const lo = Math.min(minSec, maxSec);
  const hi = Math.max(minSec, maxSec);
  const inRange = boundaries.filter((b) => b >= lo && b <= hi);
  const pool = inRange.length > 0 ? inRange : boundaries;

  let best = pool[0];
  let bestDist = Math.abs(pool[0] - fallbackSec);
  for (let i = 1; i < pool.length; i++) {
    const d = Math.abs(pool[i] - fallbackSec);
    if (d < bestDist) {
      best = pool[i];
      bestDist = d;
    }
  }

  return best;
}

function snapCutOutOfWord(
  cutSec: number,
  minSec: number,
  maxSec: number,
  audioWords: AudioWord[],
  boundaries: number[],
): number {
  const EPS = 1e-6;
  const containing = audioWords.find(
    (w) => cutSec > w.startSec + EPS && cutSec < w.endSec - EPS,
  );
  if (!containing) return cutSec;

  const lo = Math.min(minSec, maxSec);
  const hi = Math.max(minSec, maxSec);
  const inRangeWordEdges = [containing.startSec, containing.endSec].filter(
    (edge) => edge >= lo && edge <= hi,
  );

  if (inRangeWordEdges.length > 0) {
    return inRangeWordEdges.reduce((best, edge) =>
      Math.abs(edge - cutSec) < Math.abs(best - cutSec) ? edge : best,
    );
  }

  return findNearestBoundary(cutSec, boundaries, minSec, maxSec);
}

// ---------------------------------------------------------------------------
// Step 2 – Reassemble Whisper caption tokens into complete words
// ---------------------------------------------------------------------------

function reassembleCaptions(caps: Caption[]): AudioWord[] {
  const words: AudioWord[] = [];

  for (const cap of caps) {
    const raw = cap.text;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (!/[a-zA-Z0-9]/.test(trimmed)) continue;

    const clean = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!clean) continue;

    const isNewWord =
      raw.startsWith(" ") || raw.startsWith(">") || words.length === 0;

    if (isNewWord) {
      words.push({
        text: clean,
        startSec: cap.startMs / 1000,
        endSec: cap.endMs / 1000,
      });
    } else {
      const prev = words[words.length - 1];
      prev.text += clean;
      prev.endSec = cap.endMs / 1000;
    }
  }

  return words;
}

// ---------------------------------------------------------------------------
// Step 3 – Parse script into phrases (split on {N} pause markers)
// ---------------------------------------------------------------------------

type ScriptPhrase = { words: string[] };

function parseScriptPhrases(script: string): ScriptPhrase[] {
  const phrases: ScriptPhrase[] = [];
  let current: string[] = [];

  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    const content = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : line;
    const tokens = content.match(/\{\d+\}|[A-Za-z0-9']+/g) ?? [];

    for (const t of tokens) {
      if (/^\{\d+\}$/.test(t)) {
        if (current.length > 0) {
          phrases.push({ words: [...current] });
          current = [];
        }
      } else {
        current.push(t.toLowerCase().replace(/[^a-z0-9]/g, ""));
      }
    }

    if (current.length > 0) {
      phrases.push({ words: [...current] });
      current = [];
    }
  }

  return phrases;
}

// ---------------------------------------------------------------------------
// Step 4 – Fuzzy word matching
// ---------------------------------------------------------------------------

function fuzzyMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 2 && b.length >= 2) {
    if (a.startsWith(b) || b.startsWith(a)) return true;
  }
  if (a.length >= 3 && b.length >= 3 && a.substring(0, 2) === b.substring(0, 2)) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Step 5 – Build phrase matches (audio + video timing per phrase)
// ---------------------------------------------------------------------------

type PhraseMatch = {
  words: string[];
  audioStartSec: number;
  audioEndSec: number;
  videoStartSec: number;
  videoEndSec: number;
};

function buildPhraseMatches(
  phrases: ScriptPhrase[],
  audioWords: AudioWord[],
  videoTs: VideoTimestamp[],
  totalVideoDurationSec: number,
): PhraseMatch[] {
  const sortedVideo = [...videoTs].sort((a, b) => a.timestamp - b.timestamp);
  const matches: PhraseMatch[] = [];

  let audioIdx = 0;
  let videoIdx = 0;

  for (const phrase of phrases) {
    let phraseAudioStart = -1;
    let phraseAudioEnd = -1;
    let phraseVideoStart = -1;

    for (const scriptWord of phrase.words) {
      let audioMatched = false;
      for (let a = audioIdx; a < Math.min(audioIdx + 5, audioWords.length); a++) {
        if (fuzzyMatch(scriptWord, audioWords[a].text)) {
          // Greedily consume following audio words that form a compound
          // e.g. script "codemachine" matches audio "code" then "machine"
          let lastIdx = a;
          let combined = audioWords[a].text;
          while (lastIdx + 1 < audioWords.length) {
            const nextCombined = combined + audioWords[lastIdx + 1].text;
            if (
              scriptWord === nextCombined ||
              scriptWord.startsWith(nextCombined)
            ) {
              combined = nextCombined;
              lastIdx++;
            } else {
              break;
            }
          }

          if (phraseAudioStart < 0) phraseAudioStart = audioWords[a].startSec;
          phraseAudioEnd = audioWords[lastIdx].endSec;
          audioIdx = lastIdx + 1;
          audioMatched = true;
          break;
        }
      }
      if (!audioMatched && audioIdx < audioWords.length) {
        if (phraseAudioStart < 0)
          phraseAudioStart = audioWords[audioIdx].startSec;
        phraseAudioEnd = audioWords[audioIdx].endSec;
        audioIdx++;
      }

      const vw =
        videoIdx < sortedVideo.length
          ? sortedVideo[videoIdx].word
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
          : "";
      if (fuzzyMatch(scriptWord, vw)) {
        if (phraseVideoStart < 0)
          phraseVideoStart = sortedVideo[videoIdx].timestamp;
        videoIdx++;
      }
    }

    if (phraseAudioStart >= 0) {
      matches.push({
        words: phrase.words,
        audioStartSec: phraseAudioStart,
        audioEndSec: phraseAudioEnd,
        videoStartSec:
          phraseVideoStart >= 0
            ? phraseVideoStart
            : matches.length > 0
              ? matches[matches.length - 1].videoEndSec
              : 0,
        videoEndSec: 0,
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    matches[i].videoEndSec =
      i + 1 < matches.length
        ? matches[i + 1].videoStartSec
        : totalVideoDurationSec;
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Step 6 – Build segments with waveform-verified silence cuts
//
// Uses Whisper word boundaries as APPROXIMATE targets, then snaps each
// cut point to a real silence region found in the actual audio waveform.
// ---------------------------------------------------------------------------

function buildWaveformAwareSegments(
  phraseMatches: PhraseMatch[],
  silenceRegions: SilenceRegion[],
  audioWords: AudioWord[],
  wordBoundaries: number[],
): WordSegment[] {
  const resolveCut = (minSec: number, maxSec: number, fallbackSec: number): number => {
    const silenceCut = findCutInRange(minSec, maxSec, fallbackSec, silenceRegions);
    const baseCut =
      silenceCut !== null
        ? silenceCut
        : findNearestBoundary(fallbackSec, wordBoundaries, minSec, maxSec);
    return snapCutOutOfWord(baseCut, minSec, maxSec, audioWords, wordBoundaries);
  };

  // First compute a single cut point between each pair of adjacent phrases.
  // Each cut is shared: phrase N's audioEnd = phrase N+1's audioStart.
  // This guarantees no overlaps and no gaps.
  const cuts: number[] = [];

  for (let i = 0; i < phraseMatches.length - 1; i++) {
    const cur = phraseMatches[i];
    const nxt = phraseMatches[i + 1];

    const MARGIN = 0.15;
    const rangeMin = cur.audioEndSec - MARGIN;
    const rangeMax = nxt.audioStartSec + MARGIN;
    const whisperMid =
      cur.audioEndSec + (nxt.audioStartSec - cur.audioEndSec) / 2;

    cuts.push(resolveCut(rangeMin, rangeMax, whisperMid));
  }

  // Build segments using the shared cut points
  const segments: WordSegment[] = [];

  for (let i = 0; i < phraseMatches.length; i++) {
    const m = phraseMatches[i];

    const audioStartSec =
      i === 0
        ? resolveCut(0, m.audioStartSec, Math.max(0, m.audioStartSec - 0.05))
        : cuts[i - 1];

    const audioEndSec =
      i === phraseMatches.length - 1
        ? resolveCut(m.audioEndSec, m.audioEndSec + 0.3, m.audioEndSec + 0.15)
        : cuts[i];

    segments.push({
      videoStartSec: m.videoStartSec,
      videoEndSec: m.videoEndSec,
      audioStartSec,
      audioEndSec,
    });
  }

  // -----------------------------------------------------------------------
  // Redistribute video time so audio always fits within its video slot.
  // If audioDuration > videoDuration, steal time from the next segment
  // (which has surplus). This guarantees the rendering never needs to
  // truncate audio to prevent overlap.
  // -----------------------------------------------------------------------
  for (let i = 0; i < segments.length - 1; i++) {
    const audioDur = segments[i].audioEndSec - segments[i].audioStartSec;
    const videoDur = segments[i].videoEndSec - segments[i].videoStartSec;
    const deficit = audioDur - videoDur;

    if (deficit > 0) {
      segments[i].videoEndSec += deficit;
      segments[i + 1].videoStartSec += deficit;
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// 1. Read WAV and analyze waveform
const wavPath = join(PUBLIC_DIR, `audio/${name}.wav`);
console.log(`Reading WAV: ${wavPath}`);
const { samples, sampleRate } = readWavSamples(wavPath);
console.log(
  `  ${samples.length} samples, ${sampleRate}Hz, ${(samples.length / sampleRate).toFixed(2)}s`,
);

const { rms, windowSec } = computeRmsWindows(samples, sampleRate, WINDOW_MS);
console.log(`  ${rms.length} RMS windows (${WINDOW_MS}ms each)`);

const silenceRegions = findSilenceRegions(
  rms,
  windowSec,
  SILENCE_THRESHOLD_DB,
  MIN_SILENCE_MS,
);
console.log(
  `  ${silenceRegions.length} silence regions found (threshold: ${SILENCE_THRESHOLD_DB}dB, min: ${MIN_SILENCE_MS}ms)\n`,
);

console.log("Silence regions in audio:");
for (const r of silenceRegions) {
  const durMs = (r.endSec - r.startSec) * 1000;
  console.log(
    `  ${r.startSec.toFixed(3)}s – ${r.endSec.toFixed(3)}s  (${durMs.toFixed(0)}ms)`,
  );
}

// 2. Reassemble Whisper tokens + parse script + match phrases
const audioWords = reassembleCaptions(captions);
const wordBoundaries = buildWordBoundaries(audioWords);
const phrases = parseScriptPhrases(scriptText);

const lastVideoTs = [...videoTimestamps].sort(
  (a, b) => b.timestamp - a.timestamp,
)[0];
const totalVideoDurationSec = lastVideoTs.timestamp + 2;

const phraseMatches = buildPhraseMatches(
  phrases,
  audioWords,
  videoTimestamps,
  totalVideoDurationSec,
);

// 3. Build segments — snapped to real silence in the waveform
const segments = buildWaveformAwareSegments(
  phraseMatches,
  silenceRegions,
  audioWords,
  wordBoundaries,
);

// Write output
const outDir = join(PUBLIC_DIR, "segments");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${name}.json`);
writeFileSync(outPath, JSON.stringify(segments, null, 2));

// Report
console.log(`\nGenerated ${segments.length} segments → ${outPath}\n`);

// Overlap validation
let hasOverlap = false;
for (let i = 0; i < segments.length; i++) {
  const ad = segments[i].audioEndSec - segments[i].audioStartSec;
  const vd = segments[i].videoEndSec - segments[i].videoStartSec;
  if (ad > vd + 0.001) {
    console.log(`  ⚠ OVERLAP seg ${i}: audio ${ad.toFixed(3)}s > video ${vd.toFixed(3)}s`);
    hasOverlap = true;
  }
}
if (!hasOverlap) {
  console.log("Overlap check: ALL CLEAR — audio fits within video for every segment\n");
}

console.log("Segments (cuts snapped to real silence):");
for (let i = 0; i < segments.length; i++) {
  const s = segments[i];
  const label =
    i < phraseMatches.length ? phraseMatches[i].words.join(" ") : "?";
  const audioDur = s.audioEndSec - s.audioStartSec;
  const videoDur = s.videoEndSec - s.videoStartSec;
  console.log(
    `  [${String(i).padStart(2)}] video ${s.videoStartSec.toFixed(2)}–${s.videoEndSec.toFixed(2)}s (${videoDur.toFixed(2)}s)  ` +
      `audio ${s.audioStartSec.toFixed(3)}–${s.audioEndSec.toFixed(3)}s (${audioDur.toFixed(3)}s)  // ${label}`,
  );
}
