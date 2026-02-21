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
  sourceVideoStartSec?: number;
  sourceVideoEndSec?: number;
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
const STRONG_PAUSE_MIN_SEC = 0.08;
const CUT_MARGIN_SEC = 0.15;
const START_PREROLL_SEC = 0.12;
const LINE_START_PREROLL_SEC = 0.02;
const LINE_START_MAX_EARLY_SEC = 0.02;
const ZERO_CROSS_SEARCH_MS = 8;
const CONNECTOR_TAIL_WORDS = new Set([
  "and",
  "or",
  "to",
  "of",
  "the",
  "a",
  "an",
  "for",
  "with",
  "in",
  "on",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
]);

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

function strongestSilenceOverlap(
  minSec: number,
  maxSec: number,
  silenceRegions: SilenceRegion[],
): number {
  let strongest = 0;
  for (const r of silenceRegions) {
    const overlapStart = Math.max(r.startSec, minSec);
    const overlapEnd = Math.min(r.endSec, maxSec);
    const overlap = overlapEnd - overlapStart;
    if (overlap > strongest) strongest = overlap;
  }
  return strongest;
}

function mergePhrasesForNaturalCuts(
  phraseMatches: PhraseMatch[],
  silenceRegions: SilenceRegion[],
): PhraseMatch[] {
  if (phraseMatches.length <= 1) return phraseMatches;

  const merged: PhraseMatch[] = [];
  let cur: PhraseMatch = {
    ...phraseMatches[0],
    words: [...phraseMatches[0].words],
  };

  for (let i = 1; i < phraseMatches.length; i++) {
    const nxt = phraseMatches[i];
    const crossedScriptLine = cur.lineIndex !== nxt.lineIndex;
    const tail = cur.words[cur.words.length - 1] ?? "";
    const connectorTail = CONNECTOR_TAIL_WORDS.has(tail);
    const strongestPause = strongestSilenceOverlap(
      cur.audioEndSec - CUT_MARGIN_SEC,
      nxt.audioStartSec + CUT_MARGIN_SEC,
      silenceRegions,
    );
    const weakPause = strongestPause < STRONG_PAUSE_MIN_SEC;

    if (!crossedScriptLine && (connectorTail || weakPause)) {
      cur = {
        words: [...cur.words, ...nxt.words],
        lineIndex: cur.lineIndex,
        audioStartSec: cur.audioStartSec,
        audioEndSec: nxt.audioEndSec,
        videoStartSec: cur.videoStartSec,
        videoEndSec: nxt.videoEndSec,
      };
      continue;
    }

    merged.push(cur);
    cur = {
      ...nxt,
      words: [...nxt.words],
    };
  }

  merged.push(cur);

  for (let i = 0; i < merged.length - 1; i++) {
    merged[i].videoEndSec = merged[i + 1].videoStartSec;
  }

  return merged;
}

function snapToNearestZeroCrossing(
  cutSec: number,
  minSec: number,
  maxSec: number,
  samples: Float32Array,
  sampleRate: number,
): number {
  if (samples.length < 2 || sampleRate <= 0) return cutSec;

  const loSec = Math.max(0, Math.min(minSec, maxSec));
  const hiSec = Math.max(0, Math.max(minSec, maxSec));
  const lo = Math.max(1, Math.floor(loSec * sampleRate));
  const hi = Math.min(samples.length - 1, Math.ceil(hiSec * sampleRate));
  if (lo >= hi) return cutSec;

  const center = Math.max(lo, Math.min(hi, Math.round(cutSec * sampleRate)));
  const radius = Math.max(1, Math.round((sampleRate * ZERO_CROSS_SEARCH_MS) / 1000));
  const searchLo = Math.max(lo, center - radius);
  const searchHi = Math.min(hi, center + radius);

  let bestCross = -1;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = searchLo; i <= searchHi; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    const crossed = (prev <= 0 && cur >= 0) || (prev >= 0 && cur <= 0);
    if (!crossed) continue;
    const dist = Math.abs(i - center);
    if (dist < bestDist) {
      bestDist = dist;
      bestCross = i;
    }
  }

  if (bestCross >= 0) return bestCross / sampleRate;

  let best = center;
  bestDist = Math.abs(samples[center]);
  for (let i = searchLo; i <= searchHi; i++) {
    const amp = Math.abs(samples[i]);
    if (amp < bestDist) {
      best = i;
      bestDist = amp;
    }
  }

  return best / sampleRate;
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
// Step 3 – Parse script into phrases (split on {N} markers + punctuation)
// ---------------------------------------------------------------------------

type ScriptPhrase = { words: string[]; lineIndex: number };

function parseScriptPhrases(script: string): ScriptPhrase[] {
  const phrases: ScriptPhrase[] = [];
  let current: string[] = [];

  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const colonIdx = line.indexOf(":");
    const content = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : line;
    const rawTokens =
      content.match(
        /\{\d+(?:\.\d+)?\}|[0-9]{1,2}:[0-9]{2}|[A-Za-z0-9']+/g,
      ) ?? [];
    const tokens: string[] = [];

    for (let i = 0; i < rawTokens.length; i++) {
      const t = rawTokens[i];
      const next = rawTokens[i + 1]?.toLowerCase();
      if (/^[0-9]+$/.test(t) && (next === "am" || next === "pm")) {
        tokens.push(`${t}${next}`);
        i++;
        continue;
      }
      tokens.push(t);
    }

    for (const t of tokens) {
      if (/^\{\d+(?:\.\d+)?\}$/.test(t)) {
        if (current.length > 0) {
          phrases.push({ words: [...current], lineIndex });
          current = [];
        }
      } else {
        current.push(t.toLowerCase().replace(/[^a-z0-9]/g, ""));
      }
    }

    if (current.length > 0) {
      phrases.push({ words: [...current], lineIndex });
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
  if (a.length >= 4 && b.length >= 4) {
    if (a.startsWith(b) || b.startsWith(a)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Step 5 – Build phrase matches (audio + video timing per phrase)
// ---------------------------------------------------------------------------

type PhraseMatch = {
  words: string[];
  lineIndex: number;
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
  const VIDEO_LOOKAHEAD = 48;
  const LINE_AUDIO_RESYNC_LOOKAHEAD = 260;
  const LINE_VIDEO_RESYNC_LOOKAHEAD = 160;

  let audioIdx = 0;
  let videoIdx = 0;
  let lastKnownVideoSec = sortedVideo.length > 0 ? sortedVideo[0].timestamp : 0;
  let lastMatchedAudioEndSec = 0;
  let lastMatchedVideoSec = lastKnownVideoSec;

  for (let p = 0; p < phrases.length; p++) {
    const phrase = phrases[p];
    const prevPhrase = p > 0 ? phrases[p - 1] : null;
    const isLineStart = p === 0 || prevPhrase?.lineIndex !== phrase.lineIndex;

    if (isLineStart && phrase.words.length > 0) {
      const lineFirstWord = phrase.words[0];
      const minAudioSec = Math.max(0, lastMatchedAudioEndSec - 0.25);
      let audioSearchStart = 0;
      while (
        audioSearchStart < audioWords.length &&
        audioWords[audioSearchStart].startSec < minAudioSec
      ) {
        audioSearchStart++;
      }
      const audioSearchEnd = Math.min(audioWords.length, audioSearchStart + LINE_AUDIO_RESYNC_LOOKAHEAD);
      for (let a = audioSearchStart; a < audioSearchEnd; a++) {
        if (fuzzyMatch(lineFirstWord, audioWords[a].text)) {
          audioIdx = a;
          break;
        }
      }

      const minVideoSec = Math.max(0, lastMatchedVideoSec - 0.5);
      let videoSearchStart = 0;
      while (
        videoSearchStart < sortedVideo.length &&
        sortedVideo[videoSearchStart].timestamp < minVideoSec
      ) {
        videoSearchStart++;
      }
      const videoSearchEnd = Math.min(sortedVideo.length, videoSearchStart + LINE_VIDEO_RESYNC_LOOKAHEAD);
      for (let v = videoSearchStart; v < videoSearchEnd; v++) {
        const vw = sortedVideo[v].word.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (fuzzyMatch(lineFirstWord, vw)) {
          videoIdx = v;
          break;
        }
      }
    }

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

      let matchedVideoIdx = -1;
      const searchEnd = Math.min(sortedVideo.length, videoIdx + VIDEO_LOOKAHEAD);
      for (let v = videoIdx; v < searchEnd; v++) {
        const vw = sortedVideo[v].word.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (fuzzyMatch(scriptWord, vw)) {
          matchedVideoIdx = v;
          break;
        }
      }
      if (matchedVideoIdx >= 0) {
        if (phraseVideoStart < 0) {
          phraseVideoStart = sortedVideo[matchedVideoIdx].timestamp;
        }
        lastKnownVideoSec = sortedVideo[matchedVideoIdx].timestamp;
        videoIdx = matchedVideoIdx + 1;
      }
    }

    if (phraseAudioStart >= 0) {
      const safeVideoStart =
        phraseVideoStart >= 0 ? phraseVideoStart : lastKnownVideoSec;
      lastKnownVideoSec = safeVideoStart;
      lastMatchedVideoSec = safeVideoStart;
      lastMatchedAudioEndSec = phraseAudioEnd;
      matches.push({
        words: phrase.words,
        lineIndex: phrase.lineIndex,
        audioStartSec: phraseAudioStart,
        audioEndSec: phraseAudioEnd,
        videoStartSec: safeVideoStart,
        videoEndSec: 0,
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const nextStart =
      i + 1 < matches.length
        ? matches[i + 1].videoStartSec
        : totalVideoDurationSec;
    matches[i].videoEndSec = Math.max(matches[i].videoStartSec + 0.04, nextStart);
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
  samples: Float32Array,
  sampleRate: number,
): WordSegment[] {
  const resolveCut = (minSec: number, maxSec: number, fallbackSec: number): number => {
    const silenceCut = findCutInRange(minSec, maxSec, fallbackSec, silenceRegions);
    const baseCut =
      silenceCut !== null
        ? silenceCut
        : findNearestBoundary(fallbackSec, wordBoundaries, minSec, maxSec);
    const zeroCrossCut = snapToNearestZeroCrossing(
      baseCut,
      minSec,
      maxSec,
      samples,
      sampleRate,
    );
    return snapCutOutOfWord(
      zeroCrossCut,
      minSec,
      maxSec,
      audioWords,
      wordBoundaries,
    );
  };

  const naturalPhrases = mergePhrasesForNaturalCuts(phraseMatches, silenceRegions);

  // For each boundary we compute two checkpoints:
  // - stopCut: where phrase N should end
  // - startCut: where phrase N+1 should start
  // This preserves pause timing better than a single shared midpoint cut.
  const boundaryCuts: Array<{ stopCut: number; startCut: number }> = [];

  for (let i = 0; i < naturalPhrases.length - 1; i++) {
    const cur = naturalPhrases[i];
    const nxt = naturalPhrases[i + 1];

    const rangeMin = cur.audioEndSec - CUT_MARGIN_SEC;
    const rangeMax = nxt.audioStartSec + CUT_MARGIN_SEC;
    const stopTarget = cur.audioEndSec;
    const startTarget = nxt.audioStartSec;

    const stopCut = resolveCut(
      rangeMin,
      Math.min(rangeMax, startTarget + CUT_MARGIN_SEC),
      stopTarget,
    );
    const startCutRaw = resolveCut(
      Math.max(rangeMin, stopCut),
      rangeMax,
      startTarget,
    );
    const startCut = Math.max(stopCut, startCutRaw);

    boundaryCuts.push({ stopCut, startCut });
  }

  // Build segments from the boundary stop/start checkpoints
  const segments: WordSegment[] = [];

  for (let i = 0; i < naturalPhrases.length; i++) {
    const m = naturalPhrases[i];
    const prev = i > 0 ? naturalPhrases[i - 1] : null;
    const isLineStart = i === 0 || (prev !== null && prev.lineIndex !== m.lineIndex);
    const startPreroll = isLineStart ? LINE_START_PREROLL_SEC : START_PREROLL_SEC;

    let audioStartSec =
      i === 0
        ? Math.max(
            0,
            resolveCut(0, m.audioStartSec, Math.max(0, m.audioStartSec - 0.05)) - startPreroll,
          )
        : Math.max(0, boundaryCuts[i - 1].startCut - startPreroll);

    // For new script lines, never start too early before the first matched word.
    if (isLineStart) {
      const lineStartFloor = Math.max(0, m.audioStartSec - LINE_START_MAX_EARLY_SEC);
      audioStartSec = Math.max(audioStartSec, lineStartFloor);
    }

    const audioEndSec =
      i === naturalPhrases.length - 1
        ? resolveCut(m.audioEndSec, m.audioEndSec + 0.3, m.audioEndSec + 0.15)
        : boundaryCuts[i].stopCut;

    segments.push({
      videoStartSec: m.videoStartSec,
      videoEndSec: m.videoEndSec,
      audioStartSec,
      audioEndSec,
      sourceVideoStartSec: m.videoStartSec,
      sourceVideoEndSec: m.videoEndSec,
    });
  }

  // Safety: keep each segment non-empty in audio.
  for (const s of segments) {
    if (s.audioEndSec <= s.audioStartSec + 0.04) {
      s.audioEndSec = s.audioStartSec + 0.04;
    }
  }

  // Timeline is audio-locked: each segment starts/ends exactly at its
  // audio checkpoints (relative to first segment audio start).
  if (segments.length > 0) {
    const baseAudio = segments[0].audioStartSec;
    for (const s of segments) {
      s.videoStartSec = Math.max(0, s.audioStartSec - baseAudio);
      s.videoEndSec = Math.max(s.videoStartSec + 0.04, s.audioEndSec - baseAudio);
    }
  }

  // Ensure each source video slice has a usable length.
  // If matching produced a zero/near-zero slice, extend it from the current
  // source start toward either the next source start or local audio duration.
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const sourceStart = s.sourceVideoStartSec ?? 0;
    let sourceEnd = s.sourceVideoEndSec ?? sourceStart;
    const sourceDur = sourceEnd - sourceStart;
    if (sourceDur >= 0.08) continue;

    const nextSourceStart =
      i + 1 < segments.length
        ? (segments[i + 1].sourceVideoStartSec ?? sourceStart)
        : sourceStart + 10;
    const audioDur = Math.max(0.08, s.audioEndSec - s.audioStartSec);
    sourceEnd = Math.max(
      sourceStart + 0.08,
      Math.min(nextSourceStart, sourceStart + audioDur),
    );
    s.sourceVideoEndSec = sourceEnd;
  }

  // Enforce monotonic source progress to avoid visual "freeze" when
  // multiple segments collapse to the same anchor timestamp.
  if (segments.length > 0) {
    const sourceMaxSec = Math.max(
      phraseMatches[phraseMatches.length - 1]?.videoEndSec ?? 0,
      segments[segments.length - 1].sourceVideoEndSec ?? 0,
    );
    let sourceCursor = Math.max(0, segments[0].sourceVideoStartSec ?? 0);

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const audioDur = Math.max(0.08, s.audioEndSec - s.audioStartSec);
      const remaining = segments.length - i - 1;
      const minTailReserve = remaining * 0.08;
      const maxEndForThis = Math.max(sourceCursor + 0.08, sourceMaxSec - minTailReserve);

      let start = Math.max(sourceCursor, s.sourceVideoStartSec ?? sourceCursor);
      let end = Math.max(start + 0.08, s.sourceVideoEndSec ?? start + audioDur);

      if (end - start < audioDur) {
        end = start + audioDur;
      }
      if (end > maxEndForThis) {
        end = maxEndForThis;
        start = Math.min(start, end - 0.08);
      }
      if (start < 0) start = 0;
      if (end <= start) end = start + 0.08;

      s.sourceVideoStartSec = start;
      s.sourceVideoEndSec = end;
      sourceCursor = end;
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
const lastAudioEndSec = audioWords.length > 0 ? audioWords[audioWords.length - 1].endSec : 0;
const totalVideoDurationSec = Math.max(lastVideoTs.timestamp + 2, lastAudioEndSec + 2);

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
  samples,
  sampleRate,
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

// Sync quality warnings (non-fatal): surfaces likely drift/cut issues early.
let warningCount = 0;
const warn = (msg: string) => {
  warningCount++;
  console.log(`  ⚠ ${msg}`);
};

for (let i = 0; i < segments.length; i++) {
  const s = segments[i];
  const audioDur = s.audioEndSec - s.audioStartSec;
  const videoDur = s.videoEndSec - s.videoStartSec;
  if (audioDur <= 0 || videoDur <= 0) {
    warn(
      `seg ${i} has non-positive duration (audio ${audioDur.toFixed(3)}s, video ${videoDur.toFixed(3)}s)`,
    );
  }

  if (s.sourceVideoStartSec !== undefined && s.sourceVideoEndSec !== undefined) {
    const sourceDur = s.sourceVideoEndSec - s.sourceVideoStartSec;
    if (sourceDur < 0.08) {
      warn(
        `seg ${i} has tiny source slice (${sourceDur.toFixed(3)}s) from ${s.sourceVideoStartSec.toFixed(3)}s to ${s.sourceVideoEndSec.toFixed(3)}s`,
      );
    }
    const playbackRate = sourceDur / Math.max(0.001, videoDur);
    if (playbackRate < 0.65 || playbackRate > 1.6) {
      warn(
        `seg ${i} playbackRate outlier (${playbackRate.toFixed(2)}x) source ${sourceDur.toFixed(3)}s -> target ${videoDur.toFixed(3)}s`,
      );
    }
  }

  if (i > 0) {
    const prev = segments[i - 1];
    const vGap = s.videoStartSec - prev.videoEndSec;
    const aGap = s.audioStartSec - prev.audioEndSec;
    if (Math.abs(vGap) > 0.06) {
      warn(`video timeline jump between seg ${i - 1} and ${i}: ${vGap.toFixed(3)}s`);
    }
    if (Math.abs(aGap) > 0.06) {
      warn(`audio timeline jump between seg ${i - 1} and ${i}: ${aGap.toFixed(3)}s`);
    }
  }
}

if (warningCount === 0) {
  console.log("Sync quality check: ALL CLEAR — no structural timing warnings\n");
} else {
  console.log(`Sync quality check: ${warningCount} warning(s) detected\n`);
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
