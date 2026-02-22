import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Segment = {
  videoStartSec: number;
  videoEndSec: number;
  lineIndex?: number;
};

export type FinalSceneProps = {
  name: string;
  baseVideoName: string;
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

const SegmentAsciiTrack: React.FC<{ name: string }> = ({ name }) => {
  const { fps } = useVideoConfig();
  const [segments, setSegments] = useState<Segment[] | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(staticFile(`outputs/${name}/segments/${name}.json`));
        if (!res.ok) {
          setSegments([]);
          return;
        }
        const parsed: Segment[] = await res.json();
        setSegments(parsed);
      } catch {
        setSegments([]);
      }
    };

    load();
  }, [name]);

  if (!segments || segments.length === 0) {
    return null;
  }

  return (
    <>
      {segments.map((segment, index) => {
        const from = Math.round(segment.videoStartSec * fps);
        const end =
          index + 1 < segments.length
            ? Math.round(segments[index + 1].videoStartSec * fps)
            : Math.round(segment.videoEndSec * fps);
        const duration = Math.max(1, end - from);
        const asset = ASCII_SEQUENCE[index % ASCII_SEQUENCE.length];

        return (
          <Sequence
            key={`${index}-${asset}`}
            from={from}
            durationInFrames={duration}
            layout="none"
            premountFor={Math.round(fps * 0.3)}
          >
            <AsciiPanel src={asset} durationInFrames={duration} />
          </Sequence>
        );
      })}
    </>
  );
};

const AsciiPanel: React.FC<{ src: string; durationInFrames: number }> = ({
  src,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const enter = 14;
  const exit = 12;

  const opacity = interpolate(
    frame,
    [0, enter, durationInFrames - exit, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const y = interpolate(
    frame,
    [0, enter, durationInFrames - exit, durationInFrames],
    [36, 0, 0, -16],
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
          marginBottom: 44,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.15)",
          background:
            "linear-gradient(145deg, rgba(10,14,22,0.95), rgba(18,28,43,0.90))",
          boxShadow: "0 22px 56px rgba(0,0,0,0.52)",
          overflow: "hidden",
          padding: 20,
          opacity,
          transform: `translateY(${y}px)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 10px 24px rgba(0, 0, 0, 0.45))",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const FinalSceneComposition: React.FC<FinalSceneProps> = ({
  name,
  baseVideoName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shrinkStart = Math.round(fps * 1.1);
  const shrinkEnd = Math.round(fps * 3.8);

  const scale = interpolate(frame, [0, shrinkStart, shrinkEnd], [1, 1, 0.66], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const y = interpolate(frame, [0, shrinkStart, shrinkEnd], [0, 0, -246], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const radius = interpolate(frame, [0, shrinkStart, shrinkEnd], [0, 0, 28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% -10%, #304869 0%, #0b1220 58%, #05070d 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.34) 100%)",
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 5%" }}>
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            overflow: "hidden",
            borderRadius: radius,
            border: radius > 0 ? "1px solid rgba(255,255,255,0.2)" : "none",
            boxShadow: radius > 0 ? "0 34px 92px rgba(0,0,0,0.56)" : "none",
            transform: `translateY(${y}px) scale(${scale})`,
            backgroundColor: "#0c121e",
          }}
        >
          <OffthreadVideo
            src={staticFile(`outputs/${name}/video/${baseVideoName}.mp4`)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </AbsoluteFill>
      <SegmentAsciiTrack name={name} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 220px rgba(0, 0, 0, 0.5)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
