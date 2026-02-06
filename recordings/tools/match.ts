import { $ } from "bun";
import { readdir, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = join(import.meta.dir, "..");
const FRAMES_DIR = join(BASE, "output/frames");
const SCREENSHOTS_DIR = join(BASE, "output/screenshots");
const TIMESTAMPS_DIR = join(BASE, "output/timestamps");
const TMP = "/tmp/vhs-match";
const SIZE = "64x64!";
const FRAMERATE = 60;

await mkdir(join(TMP, "frames"), { recursive: true });
await mkdir(join(TMP, "shots"), { recursive: true });
await mkdir(TIMESTAMPS_DIR, { recursive: true });

// Downscale all frame-text files
console.log("=== Downscaling frames ===");
const allFrames = (await readdir(FRAMES_DIR))
  .filter((f) => f.startsWith("frame-text-"))
  .sort();

await Promise.all(
  allFrames.map((name) =>
    $`convert ${join(FRAMES_DIR, name)} -resize ${SIZE} ${join(TMP, "frames", name)}`.quiet()
  )
);
console.log(`Done (${allFrames.length} frames)`);

// Match each screenshot to a frame
console.log("\n=== Matching screenshots ===");
const shots = (await readdir(SCREENSHOTS_DIR))
  .filter((f) => f.endsWith(".png"))
  .sort();

const results: { word: string; screenshot: string; frame: string; frameNumber: number; timestamp: number }[] = [];

for (const shotName of shots) {
  await $`convert ${join(SCREENSHOTS_DIR, shotName)} -resize ${SIZE} ${join(TMP, "shots", shotName)}`.quiet();

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

  // Extract frame number and calculate timestamp
  const frameNumber = parseInt(bestFrame.match(/(\d+)/)?.[1] || "0");
  const timestamp = frameNumber / FRAMERATE;

  // Extract word from screenshot name (e.g. s1-w1-hello.png → hello)
  const word = shotName.replace(".png", "").split("-").pop() || "";

  console.log(`${shotName} → ${bestFrame} (frame ${frameNumber}, ${timestamp.toFixed(3)}s)`);

  results.push({ word, screenshot: shotName, frame: bestFrame, frameNumber, timestamp });
}

// Write timestamps JSON
const outputPath = join(TIMESTAMPS_DIR, "test-ali.json");
await writeFile(outputPath, JSON.stringify(results, null, 2));
console.log(`\n=== Timestamps written to ${outputPath} ===`);

await rm(TMP, { recursive: true });
