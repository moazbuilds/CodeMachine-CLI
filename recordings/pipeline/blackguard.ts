import { $ } from "bun";
import { access, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type Interval = {
  start: number;
  end: number;
};

function usage(): never {
  console.error("Usage: bun recordings/pipeline/blackguard.ts <input.mp4> [output.mp4]");
  process.exit(1);
}

function toNum(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function mergeIntervals(raw: Interval[], epsilonSec = 0.001): Interval[] {
  if (raw.length === 0) return [];
  const sorted = [...raw].sort((a, b) => a.start - b.start);
  const out: Interval[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const prev = out[out.length - 1]!;
    if (cur.start <= prev.end + epsilonSec) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function clampInterval(i: Interval, duration: number): Interval | null {
  const start = Math.max(0, Math.min(duration, i.start));
  const end = Math.max(0, Math.min(duration, i.end));
  if (end <= start) return null;
  return { start, end };
}

const inputArg = process.argv[2];
if (!inputArg) usage();
const inputPath = resolve(inputArg);
const outputArg = process.argv[3];
const outputPath = outputArg ? resolve(outputArg) : inputPath;
const inPlace = outputPath === inputPath;

if (!(await access(inputPath).then(() => true, () => false))) {
  console.error(`Input not found: ${inputPath}`);
  process.exit(1);
}

const durationRaw = await $`ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 ${inputPath}`
  .quiet()
  .text();
const durationSec = toNum(durationRaw.trim());
if (durationSec <= 0) {
  console.error(`Could not read duration for ${inputPath}`);
  process.exit(1);
}

console.log(`Analyzing: ${inputPath}`);
console.log(`Duration: ${durationSec.toFixed(3)}s`);

const detectLog = await $`ffmpeg -hide_banner -i ${inputPath} -vf blackdetect=d=0.001:pic_th=0.98:pix_th=0.10 -an -f null - 2>&1 || true`
  .quiet()
  .text();

const detected: Interval[] = [];
const re = /black_start:(\d+(?:\.\d+)?)\s+black_end:(\d+(?:\.\d+)?)\s+black_duration:(\d+(?:\.\d+)?)/g;
let m: RegExpExecArray | null;
while ((m = re.exec(detectLog)) !== null) {
  const start = toNum(m[1]!);
  const end = toNum(m[2]!);
  if (end > start) detected.push({ start, end });
}

const merged = mergeIntervals(detected)
  .map((i) => clampInterval(i, durationSec))
  .filter((i): i is Interval => i !== null);

if (merged.length === 0) {
  console.log("No black intervals detected.");
  process.exit(0);
}

console.log(`Detected ${merged.length} black interval(s):`);
for (const i of merged) {
  console.log(`  ${i.start.toFixed(3)}s -> ${i.end.toFixed(3)}s (${(i.end - i.start).toFixed(3)}s)`);
}

const keep: Interval[] = [];
let cursor = 0;
for (const cut of merged) {
  if (cut.start > cursor) {
    keep.push({ start: cursor, end: cut.start });
  }
  cursor = Math.max(cursor, cut.end);
}
if (cursor < durationSec) {
  keep.push({ start: cursor, end: durationSec });
}

if (keep.length === 0) {
  console.error("Black detection removed the whole video. Aborting.");
  process.exit(1);
}

const tmpOut = inPlace
  ? join(dirname(inputPath), `.blackguard-${Date.now()}.mp4`)
  : outputPath;

const chains: string[] = [];
const concatInputs: string[] = [];
for (let i = 0; i < keep.length; i++) {
  const seg = keep[i]!;
  chains.push(
    `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[v${i}]`,
    `[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`,
  );
  concatInputs.push(`[v${i}][a${i}]`);
}
chains.push(`${concatInputs.join("")}concat=n=${keep.length}:v=1:a=1[v][a]`);
const filter = chains.join(";");

await $`ffmpeg -y -i ${inputPath} -filter_complex ${filter} -map [v] -map [a] -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k ${tmpOut}`
  .quiet();

if (inPlace) {
  await rm(inputPath, { force: true });
  await rename(tmpOut, inputPath);
}

console.log(`Black-interval cleanup complete: ${outputPath}`);
