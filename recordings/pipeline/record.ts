import { $ } from "bun";
import { readdir, mkdir, rm, access, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const RECORDINGS = join(ROOT, "recordings");
const OUTPUT = join(RECORDINGS, "output");

// Get tape name from args (default: test-ali)
const name = process.argv[2] || "test-ali";
const tapePath = join(RECORDINGS, "assets/tapes", `${name}.tape`);

if (!(await access(tapePath).then(() => true, () => false))) {
  console.error(`Tape not found: ${tapePath}`);
  process.exit(1);
}

async function probeDuration(filePath: string): Promise<number> {
  const out = await $`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${filePath}`.quiet().text();
  return Number.parseFloat(out.trim());
}

// ── Step 1: Clean output ──
console.log("=== Cleaning output ===");
for (const dir of ["frames", "screenshots", "video", "timestamps"]) {
  await rm(join(OUTPUT, dir), { recursive: true, force: true });
}
// Let VHS create frames/ itself — it won't write to an existing dir
await mkdir(join(OUTPUT, "screenshots"), { recursive: true });
await mkdir(join(OUTPUT, "video"), { recursive: true });
await mkdir(join(OUTPUT, "timestamps"), { recursive: true });

// ── Step 2: Run VHS from project root ──
console.log(`\n=== Recording: ${name}.tape ===`);
await $`/home/linuxbrew/.linuxbrew/bin/vhs ${tapePath}`
  .cwd(ROOT);

// ── Step 3: Match screenshots to frames ──
await $`bun ${join(import.meta.dir, "match.ts")} ${name}`;

// ── Step 4: Stretch video to match audio duration ──
const videoPath = join(OUTPUT, "video", `${name}.mp4`);
const audioPath = join(OUTPUT, "audio", `${name}.mp3`);
const timestampsPath = join(OUTPUT, "timestamps", `${name}.json`);

const audioExists = await access(audioPath).then(() => true, () => false);

if (audioExists) {
  const videoDuration = await probeDuration(videoPath);
  const audioDuration = await probeDuration(audioPath);
  const targetDuration = audioDuration * 1.05;

  console.log(`\n=== Duration check ===`);
  console.log(`Video: ${videoDuration.toFixed(2)}s`);
  console.log(`Audio: ${audioDuration.toFixed(2)}s`);
  console.log(`Target (audio +5%): ${targetDuration.toFixed(2)}s`);

  const maxDuration = audioDuration * 1.15;
  const needsRetime = videoDuration < targetDuration || videoDuration > maxDuration;

  if (needsRetime) {
    const factor = targetDuration / videoDuration;
    const direction = factor > 1 ? "Stretching" : "Shrinking";
    console.log(`\n=== ${direction} video by ${factor.toFixed(4)}x ===`);

    const retimePath = join(OUTPUT, "video", `${name}-retimed.mp4`);
    const filter = `setpts=${factor}*PTS`;
    await $`ffmpeg -y -i ${videoPath} -filter:v ${filter} -r 60 -an ${retimePath}`.quiet();
    await rm(videoPath);
    await rename(retimePath, videoPath);
    console.log(`Video ${direction.toLowerCase()}: ${videoDuration.toFixed(2)}s → ${targetDuration.toFixed(2)}s`);

    // Scale timestamps proportionally
    const raw = await readFile(timestampsPath, "utf8");
    const timestamps = JSON.parse(raw) as { word: string; screenshot: string; frame: string; frameNumber: number; timestamp: number }[];
    for (const entry of timestamps) {
      entry.timestamp = entry.timestamp * factor;
    }
    await writeFile(timestampsPath, JSON.stringify(timestamps, null, 2));
    console.log(`Timestamps scaled by ${factor.toFixed(4)}x`);
  } else {
    console.log(`Video duration is in range (${targetDuration.toFixed(2)}s–${maxDuration.toFixed(2)}s)`);
  }
} else {
  console.log(`\n=== No audio file found — skipping duration matching ===`);
}

const framesDir = join(OUTPUT, "frames");
const screenshotsDir = join(OUTPUT, "screenshots");

const allFrames = (await readdir(framesDir)).filter((f) => f.startsWith("frame-text-"));
const shots = (await readdir(screenshotsDir)).filter((f) => f.endsWith(".png"));

console.log(`\n=== Done ===`);
console.log(`Video:       ${videoPath}`);
console.log(`Frames:      ${framesDir}/ (${allFrames.length} frames)`);
console.log(`Screenshots: ${screenshotsDir}/ (${shots.length} shots)`);
console.log(`Timestamps:  ${timestampsPath}`);
