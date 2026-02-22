import { useState, useEffect, useCallback } from "react";
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useVideoConfig,
  OffthreadVideo,
  useCurrentFrame,
  interpolate,
  Img,
} from "remotion";
import { Audio } from "@remotion/media";

type VideoTimestamp = {
  word: string;
  screenshot: string;
  frame: string;
  frameNumber: number;
  timestamp: number;
};

type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

type WordAnchor = {
  word: string;
  videoStartSec: number;
  audioStartSec: number;
  pauseAfterUnits: number;
};

type WordSegment = {
  videoStartSec: number;
  videoEndSec: number;
  audioStartSec: number;
  audioEndSec: number;
  sourceVideoStartSec?: number;
  sourceVideoEndSec?: number;
  newLineStart?: boolean;
  lineIndex?: number;
};

export type SyncProps = {
  name: string;
  scriptText?: string;
  baseVideoName?: string;
};

type ScriptWord = {
  word: string;
  pauseAfterUnits: number;
};

const ASCII_SEQUENCE: string[] = [
  "ascii/claudeclaw/cc-title-never-sleeps.png",
  "ascii/claudeclaw/cc-why-divider.png",
  "ascii/claudeclaw/cc-zero-api-overhead.png",
  "ascii/claudeclaw/cc-subscription-native.png",
  "ascii/claudeclaw/cc-deploy-minutes-frames/frame_0001.png",
  "ascii/claudeclaw/cc-no-infra-headaches.png",
  "ascii/claudeclaw/cc-observability-dashboard-frames/frame_0001.png",
  "ascii/claudeclaw/cc-daemon-capabilities-frames/frame_0001.png",
  "ascii/claudeclaw/cc-endcap-brand.png",
];

// No more manual segments – generate-segments.ts produces silence-aware
// segments from Whisper captions + video timestamps + script pause markers.
// Run: bun recordings/pipeline/generate-segments.ts <name>

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function areLikelySameWord(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function parseScriptWordsWithPauses(scriptText: string): ScriptWord[] {
  const out: ScriptWord[] = [];
  const lines = scriptText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    const content = colonIdx >= 0 ? line.slice(colonIdx + 1) : line;
    const tokens = content.match(/\{\d+\}|[A-Za-z0-9']+/g) ?? [];

    for (const t of tokens) {
      const pauseMatch = t.match(/^\{(\d+)\}$/);
      if (pauseMatch) {
        if (out.length > 0) {
          out[out.length - 1].pauseAfterUnits += Number(pauseMatch[1]);
        }
        continue;
      }

      out.push({
        word: normalizeWord(t),
        pauseAfterUnits: 0,
      });
    }
  }

  return out;
}

function buildPauseMapByVideoIndex(
  sortedVideo: VideoTimestamp[],
  scriptWords: ScriptWord[]
): number[] {
  const pauses = new Array<number>(sortedVideo.length).fill(0);
  if (scriptWords.length === 0) return pauses;

  let scriptIdx = 0;
  for (let i = 0; i < sortedVideo.length; i++) {
    const vw = normalizeWord(sortedVideo[i].word);
    for (; scriptIdx < scriptWords.length; scriptIdx++) {
      if (areLikelySameWord(vw, scriptWords[scriptIdx].word)) {
        pauses[i] = scriptWords[scriptIdx].pauseAfterUnits;
        scriptIdx++;
        break;
      }
    }
  }

  return pauses;
}

function matchWordsToAudio(
  timestamps: VideoTimestamp[],
  captions: Caption[],
  scriptText?: string
): WordAnchor[] {
  const matches: WordAnchor[] = [];
  let captionIdx = 0;

  const sortedTimestamps = [...timestamps].sort((a, b) => a.timestamp - b.timestamp);
  const scriptWords = scriptText ? parseScriptWordsWithPauses(scriptText) : [];
  const pauseByVideoIdx = buildPauseMapByVideoIndex(sortedTimestamps, scriptWords);

  for (let tsIdx = 0; tsIdx < sortedTimestamps.length; tsIdx++) {
    const ts = sortedTimestamps[tsIdx];
    const videoWord = normalizeWord(ts.word);

    for (let j = captionIdx; j < captions.length; j++) {
      const capText = normalizeWord(captions[j].text.trim());
      // Skip punctuation-only tokens
      if (!capText) continue;

      if (areLikelySameWord(videoWord, capText)) {
        matches.push({
          word: videoWord,
          videoStartSec: ts.timestamp,
          audioStartSec: captions[j].startMs / 1000,
          pauseAfterUnits: pauseByVideoIdx[tsIdx] ?? 0,
        });
        captionIdx = j + 1;
        break;
      }
    }
  }

  return matches;
}

function buildWordSegments(
  anchors: WordAnchor[],
  captions: Caption[],
  totalVideoSec: number
): WordSegment[] {
  if (anchors.length === 0 || captions.length === 0) return [];

  const sortedAnchors = [...anchors].sort((a, b) => a.videoStartSec - b.videoStartSec);
  const lastCaptionEndSec = captions[captions.length - 1].endMs / 1000;
  const safeCuts = buildSafeCutPoints(captions);
  const segments: WordSegment[] = [];

  // Build phrase chunks: cut only after script-defined pauses (and final word).
  const chunkStartIndices: number[] = [0];
  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    if (sortedAnchors[i].pauseAfterUnits > 0) {
      chunkStartIndices.push(i + 1);
    }
  }

  for (let c = 0; c < chunkStartIndices.length; c++) {
    const startIdx = chunkStartIndices[c];
    const nextStartIdx = c + 1 < chunkStartIndices.length ? chunkStartIndices[c + 1] : -1;
    const startAnchor = sortedAnchors[startIdx];
    const endAnchor =
      nextStartIdx === -1 ? sortedAnchors[sortedAnchors.length - 1] : sortedAnchors[nextStartIdx - 1];
    const nextChunkStart = nextStartIdx === -1 ? undefined : sortedAnchors[nextStartIdx];

    const videoStartSec = startAnchor.videoStartSec;
    const videoEndSec = nextChunkStart ? nextChunkStart.videoStartSec : totalVideoSec;
    const audioStartSec = startAnchor.audioStartSec;
    const nextAudioStartSec = nextChunkStart ? nextChunkStart.audioStartSec : lastCaptionEndSec;

    // Prefer a safe cut near the upcoming chunk boundary, with wider window when script says there is a pause.
    const lookbackSec =
      endAnchor.pauseAfterUnits > 0
        ? Math.min(1.5, 0.25 + endAnchor.pauseAfterUnits * 0.35)
        : 0.12;
    let audioEndSec =
      nextChunkStart
        ? findSafeCutBefore(nextAudioStartSec, safeCuts, lookbackSec)
        : lastCaptionEndSec;

    if (audioEndSec <= audioStartSec + 0.06) {
      audioEndSec = findSafeCutAfter(audioStartSec + 0.06, safeCuts, 0.45);
    }
    if (audioEndSec <= audioStartSec + 0.06) {
      audioEndSec = nextAudioStartSec;
    }

    // Hard rule: never overlap the next chunk's first word.
    if (nextChunkStart) {
      audioEndSec = Math.min(audioEndSec, nextAudioStartSec);
    }

    segments.push({
      videoStartSec,
      videoEndSec,
      audioStartSec,
      audioEndSec,
    });
  }

  return segments;
}

function isSpeechToken(text: string): boolean {
  return /[a-z0-9]/i.test(text);
}

function buildSafeCutPoints(captions: Caption[]): number[] {
  const points = new Set<number>();
  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const curText = cur.text.trim();
    const curStart = cur.startMs / 1000;
    const curEnd = cur.endMs / 1000;

    // End of each spoken token is a safer cut point than arbitrary times.
    if (isSpeechToken(curText)) {
      points.add(curEnd);
    }

    // Punctuation tokens often align with pauses.
    if (!isSpeechToken(curText)) {
      points.add(curEnd);
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      const prevEnd = prev.endMs / 1000;
      const gap = curStart - prevEnd;

      // Explicit silence gap midpoint.
      if (gap >= 0.08) {
        points.add(prevEnd + gap / 2);
      }
    }
  }

  return [...points].sort((a, b) => a - b);
}

function findSafeCutBefore(
  targetSec: number,
  safeCuts: number[],
  lookbackSec: number
): number {
  const minSec = targetSec - lookbackSec;
  let best = targetSec;

  for (const p of safeCuts) {
    if (p > targetSec) break;
    if (p >= minSec) {
      best = p;
    }
  }

  return best;
}

function findSafeCutAfter(
  targetSec: number,
  safeCuts: number[],
  lookaheadSec: number
): number {
  const maxSec = targetSec + lookaheadSec;

  for (const p of safeCuts) {
    if (p < targetSec) continue;
    if (p <= maxSec) return p;
    break;
  }

  return targetSec;
}

const AudioSync: React.FC<{ name: string; scriptText?: string }> = ({
  name,
  scriptText,
}) => {
  const { fps, durationInFrames: totalFrames } = useVideoConfig();
  const [segments, setSegments] = useState<WordSegment[] | null>(null);
  const crossfadeFrames = Math.max(1, Math.round(fps * 0.03));

  const fetchData = useCallback(async () => {
    // Try pre-computed segments first (produced by generate-segments.ts)
    try {
      const segRes = await fetch(staticFile(`output/segments/${name}.json`));
      if (segRes.ok) {
        const precomputed: WordSegment[] = await segRes.json();
        setSegments(precomputed);
        return;
      }
    } catch {
      // Fall through to runtime matching
    }

    // Fallback: runtime matching from timestamps + captions
    try {
      const [tsRes, capRes] = await Promise.all([
        fetch(staticFile(`output/timestamps/${name}.json`)),
        fetch(staticFile(`output/captions/${name}.json`)),
      ]);

      const videoTimestamps: VideoTimestamp[] = await tsRes.json();
      const captions: Caption[] = await capRes.json();
      const resolvedScript = scriptText;
      const wordAnchors = matchWordsToAudio(
        videoTimestamps,
        captions,
        resolvedScript
      );
      const videoDurationSec = totalFrames / fps;
      const wordSegments = buildWordSegments(
        wordAnchors,
        captions,
        videoDurationSec
      );
      setSegments(wordSegments);
    } catch (e) {
      console.error("Failed to load sync data:", e);
    }
  }, [fps, name, scriptText, totalFrames]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!segments) return null;

  return (
    <>
      {segments.map((s, i) => {
        const fromFrame = Math.round(s.videoStartSec * fps);
        const audioStartFrame = Math.round(s.audioStartSec * fps);
        const audioFrames = Math.max(1, Math.round((s.audioEndSec - s.audioStartSec) * fps));
        const fadeInFrames = i > 0 ? crossfadeFrames : 0;
        const fadeOutFrames = i + 1 < segments.length ? crossfadeFrames : 0;
        const leadInFrames = Math.min(fadeInFrames, audioStartFrame);
        const trimBefore = Math.max(0, audioStartFrame - leadInFrames);
        const sequenceFrom = Math.max(0, fromFrame - leadInFrames);
        const durationInFrames = audioFrames + leadInFrames + fadeOutFrames;

        // Keep overlap bounded to the crossfade window.
        const nextAudioStartFrame =
          i + 1 < segments.length
            ? Math.round(segments[i + 1].audioStartSec * fps)
            : Number.POSITIVE_INFINITY;
        const thisAudioStartFrame = trimBefore;
        const nextFromFrame =
          i + 1 < segments.length
            ? Math.round(segments[i + 1].videoStartSec * fps)
            : Number.POSITIVE_INFINITY;
        const cappedDurationInFrames = Math.max(
          0,
          Math.min(
            durationInFrames,
            nextAudioStartFrame - thisAudioStartFrame + fadeOutFrames,
            nextFromFrame - sequenceFrom + fadeOutFrames,
          )
        );

        if (cappedDurationInFrames <= 0) return null;

        return (
          <Sequence
            key={i}
            from={sequenceFrom}
            durationInFrames={cappedDurationInFrames}
            layout="none"
          >
            <Audio
              src={staticFile(`output/audio/${name}.mp3`)}
              trimBefore={trimBefore}
              volume={(f) => {
                let v = 1;
                if (leadInFrames > 0 && f < leadInFrames) {
                  v = Math.min(v, f / leadInFrames);
                }
                const fadeOutStart = cappedDurationInFrames - fadeOutFrames;
                if (fadeOutFrames > 0 && f > fadeOutStart) {
                  v = Math.min(v, (cappedDurationInFrames - f) / fadeOutFrames);
                }
                return Math.max(0, Math.min(1, v));
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const VideoSync: React.FC<{ name: string; baseVideoName?: string }> = ({
  name,
  baseVideoName,
}) => {
  const { fps } = useVideoConfig();
  const [segments, setSegments] = useState<WordSegment[] | null>(null);
  const videoSrc = staticFile(`output/video/${baseVideoName ?? name}.mp4`);

  useEffect(() => {
    const load = async () => {
      try {
        const segRes = await fetch(staticFile(`output/segments/${name}.json`));
        if (!segRes.ok) {
          setSegments([]);
          return;
        }
        const precomputed: WordSegment[] = await segRes.json();
        setSegments(precomputed);
      } catch {
        setSegments([]);
      }
    };
    load();
  }, [name]);

  if (segments === null) return null;
  if (segments.length === 0) {
    return <OffthreadVideo src={videoSrc} muted style={{ width: "100%", height: "100%" }} />;
  }

  // Build a contiguous timeline with hard cuts.
  const placements: Array<{ from: number; duration: number }> = [];
  for (let i = 0; i < segments.length; i++) {
    const from =
      i === 0
        ? 0
        : placements[i - 1].from + placements[i - 1].duration;
    const nominalEnd =
      i + 1 < segments.length
        ? Math.round(segments[i + 1].videoStartSec * fps)
        : Math.round(segments[i].videoEndSec * fps);
    const duration = Math.max(1, nominalEnd - from);
    placements.push({ from, duration });
  }

  return (
    <>
      {segments.map((s, i) => {
        const sourceStartSec = s.sourceVideoStartSec ?? s.videoStartSec;
        const sourceEndSec = s.sourceVideoEndSec ?? s.videoEndSec;
        const sourceDurSec = Math.max(0.04, sourceEndSec - sourceStartSec);
        const targetDurSec = Math.max(1 / fps, placements[i].duration / fps);
        const playbackRate = sourceDurSec / targetDurSec;

        const fadeInFrames = 0;
        const fadeOutFrames = 0;

        return (
          <Sequence
            key={i}
            from={placements[i].from}
            durationInFrames={placements[i].duration}
            layout="none"
            premountFor={Math.round(fps * 0.4)}
          >
            <VideoClip
              src={videoSrc}
              trimBefore={Math.max(0, Math.round(sourceStartSec * fps))}
              playbackRate={playbackRate}
              fadeInFrames={fadeInFrames}
              fadeOutFrames={fadeOutFrames}
              durationInFrames={placements[i].duration}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const VideoClip: React.FC<{
  src: string;
  trimBefore: number;
  playbackRate: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  durationInFrames: number;
}> = ({
  src,
  trimBefore,
  playbackRate,
  fadeInFrames,
  fadeOutFrames,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  let opacity = 1;

  if (fadeInFrames > 0) {
    opacity = Math.min(
      opacity,
      interpolate(frame, [0, fadeInFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  }
  if (fadeOutFrames > 0) {
    const fadeOutStart = Math.max(0, durationInFrames - fadeOutFrames);
    opacity = Math.min(
      opacity,
      interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  }

  return (
    <OffthreadVideo
      src={src}
      muted
      trimBefore={trimBefore}
      playbackRate={playbackRate}
      style={{
        opacity,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
};

const AsciiShowcase: React.FC<{ name: string }> = ({ name }) => {
  const { fps } = useVideoConfig();
  const [segments, setSegments] = useState<WordSegment[] | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const segRes = await fetch(staticFile(`output/segments/${name}.json`));
        if (!segRes.ok) {
          setSegments([]);
          return;
        }
        const precomputed: WordSegment[] = await segRes.json();
        setSegments(precomputed);
      } catch {
        setSegments([]);
      }
    };
    load();
  }, [name]);

  if (segments === null || segments.length === 0) return null;

  return (
    <>
      {segments.map((segment, i) => {
        const from = Math.round(segment.videoStartSec * fps);
        const to =
          i + 1 < segments.length
            ? Math.round(segments[i + 1].videoStartSec * fps)
            : Math.round(segment.videoEndSec * fps);
        const duration = Math.max(1, to - from);
        const imgPath = ASCII_SEQUENCE[i % ASCII_SEQUENCE.length];

        return (
          <Sequence
            key={`${i}-${imgPath}`}
            from={from}
            durationInFrames={duration}
            layout="none"
            premountFor={Math.round(fps * 0.4)}
          >
            <AsciiCard src={imgPath} durationInFrames={duration} />
          </Sequence>
        );
      })}
    </>
  );
};

const AsciiCard: React.FC<{ src: string; durationInFrames: number }> = ({
  src,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const enterFrames = 14;
  const exitFrames = 10;
  const opacity = interpolate(
    frame,
    [0, enterFrames, durationInFrames - exitFrames, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const translateY = interpolate(
    frame,
    [0, enterFrames, durationInFrames - exitFrames, durationInFrames],
    [32, 0, 0, -20],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", pointerEvents: "none" }}>
      <div
        style={{
          width: "76%",
          height: "40%",
          marginBottom: 42,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.14)",
          background:
            "linear-gradient(150deg, rgba(11,15,24,0.95), rgba(18,26,41,0.90))",
          boxShadow: "0 22px 50px rgba(0, 0, 0, 0.52), 0 0 0 1px rgba(255,255,255,0.04) inset",
          opacity,
          transform: `translateY(${translateY}px)`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 22,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 10px 28px rgba(0,0,0,0.5))",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const SceneLayout: React.FC<{ name: string; baseVideoName?: string }> = ({
  name,
  baseVideoName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shrinkStart = Math.round(fps * 1.1);
  const shrinkEnd = Math.round(fps * 3.8);

  const scale = interpolate(
    frame,
    [0, shrinkStart, shrinkEnd],
    [1, 1, 0.66],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const translateY = interpolate(
    frame,
    [0, shrinkStart, shrinkEnd],
    [0, 0, -246],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const radius = interpolate(
    frame,
    [0, shrinkStart, shrinkEnd],
    [0, 0, 28],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% -10%, #2b3c56 0%, #0a0f18 58%, #05070c 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 28%, rgba(0,0,0,0.32) 100%)",
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: "0 5%",
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            overflow: "hidden",
            borderRadius: radius,
            border: radius > 0 ? "1px solid rgba(255,255,255,0.18)" : "none",
            boxShadow:
              radius > 0
                ? "0 34px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset"
                : "none",
            transform: `translateY(${translateY}px) scale(${scale})`,
            transformOrigin: "center center",
            backgroundColor: "#0d121c",
          }}
        >
          <VideoSync name={name} baseVideoName={baseVideoName} />
        </div>
      </AbsoluteFill>
      <AsciiShowcase name={name} />
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 220px rgba(0, 0, 0, 0.46)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const SyncComposition: React.FC<SyncProps> = ({
  name,
  scriptText,
  baseVideoName,
}) => {
  return (
    <AbsoluteFill>
      <SceneLayout name={name} baseVideoName={baseVideoName} />
      <AudioSync name={name} scriptText={scriptText} />
    </AbsoluteFill>
  );
};
