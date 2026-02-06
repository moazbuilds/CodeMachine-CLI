import { $ } from "bun";
import { readdir, mkdir, rm, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const RECORDINGS = join(ROOT, "recordings");
const OUTPUT = join(RECORDINGS, "output");
const FRAMERATE = 60;
const SIZE = "64x64!";
const TMP = "/tmp/vhs-match";

// Get tape name from args (default: test-ali)
const name = process.argv[2] || "test-ali";
const tapePath = join(RECORDINGS, "tapes", `${name}.tape`);

if (!(await access(tapePath).then(() => true, () => false))) {
  console.error(`Tape not found: ${tapePath}`);
  process.exit(1);
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
console.log("\n=== Matching screenshots to frames ===");

const framesDir = join(OUTPUT, "frames");
const screenshotsDir = join(OUTPUT, "screenshots");

const allFrames = (await readdir(framesDir))
  .filter((f) => f.startsWith("frame-text-"))
  .sort();

const shots = (await readdir(screenshotsDir))
  .filter((f) => f.endsWith(".png"))
  .sort();

if (!allFrames.length || !shots.length) {
  console.error("No frames or screenshots found. VHS may have failed.");
  process.exit(1);
}

// Downscale frames for comparison
await mkdir(join(TMP, "frames"), { recursive: true });
await mkdir(join(TMP, "shots"), { recursive: true });

console.log(`Downscaling ${allFrames.length} frames...`);
await Promise.all(
  allFrames.map((f) =>
    $`convert ${join(framesDir, f)} -resize ${SIZE} ${join(TMP, "frames", f)}`.quiet()
  )
);

// Match each screenshot
const results: { word: string; screenshot: string; frame: string; frameNumber: number; timestamp: number }[] = [];

for (const shotName of shots) {
  await $`convert ${join(screenshotsDir, shotName)} -resize ${SIZE} ${join(TMP, "shots", shotName)}`.quiet();

  let bestFrame = "";
  let bestRmse = Infinity;

  for (const frameName of allFrames) {
    const result = await $`compare -metric RMSE ${join(TMP, "shots", shotName)} ${join(TMP, "frames", frameName)} null: 2>&1 || true`
      .quiet()
      .text();

    const rmse = parseFloat(result.split(" ")[0]);
    if (rmse < bestRmse) {
      bestRmse = rmse;
      bestFrame = frameName;
    }
  }

  const frameNumber = parseInt(bestFrame.match(/(\d+)/)?.[1] || "0");
  const timestamp = frameNumber / FRAMERATE;
  const word = shotName.replace(".png", "").split("-").pop() || "";

  console.log(`  ${shotName} → ${bestFrame} (${timestamp.toFixed(3)}s)`);
  results.push({ word, screenshot: shotName, frame: bestFrame, frameNumber, timestamp });
}

// ── Step 4: Write timestamps ──
const outputPath = join(OUTPUT, "timestamps", `${name}.json`);
await writeFile(outputPath, JSON.stringify(results, null, 2));

await rm(TMP, { recursive: true });

console.log(`\n=== Done ===`);
console.log(`Video:       ${join(OUTPUT, "video", `${name}.mp4`)}`);
console.log(`Frames:      ${framesDir}/ (${allFrames.length} frames)`);
console.log(`Screenshots: ${screenshotsDir}/ (${shots.length} shots)`);
console.log(`Timestamps:  ${outputPath}`);
