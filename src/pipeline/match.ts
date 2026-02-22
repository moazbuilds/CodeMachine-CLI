import { $ } from "bun";
import { cpus } from "node:os";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const OUTPUT = join(ROOT, "recordings/outputs");
const FRAMES_DIR = join(OUTPUT, "frames");
const SCREENSHOTS_DIR = join(OUTPUT, "screenshots");
const TIMESTAMPS_DIR = join(OUTPUT, "timestamps");
const SIZE = "64x64!";
const FRAMERATE = 60;
const PARALLELISM = Math.max(2, Math.min(cpus().length, 6));
const COARSE_STEP = 24;
const COARSE_ANCHORS = 3;
const REFINE_RADIUS = 48;
const UNCERTAIN_NORMALIZED_RMSE = 0.03;

type MatchResult = {
  word: string;
  screenshot: string;
  frame: string;
  frameNumber: number;
  timestamp: number;
};

type HashEntry = {
  name: string;
  hash: string;
};

type RmseMetric = {
  raw: number;
  normalized: number;
};

const tapeName = process.argv[2] || "test-ali";
const TMP = join("/tmp", `vhs-match-${tapeName}-${process.pid}`);

function extractFrameNumber(fileName: string): number {
  return Number.parseInt(fileName.match(/(\d+)/)?.[1] || "0", 10);
}

function extractWord(fileName: string): string {
  return fileName.replace(".png", "").split("-").pop() || "";
}

async function mapLimit<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  let active = 0;

  return await new Promise<R[]>((resolve, reject) => {
    const runNext = () => {
      while (active < limit && next < values.length) {
        const index = next++;
        active++;
        mapper(values[index]!, index)
          .then((value) => {
            results[index] = value;
            active--;
            if (next >= values.length && active === 0) {
              resolve(results);
              return;
            }
            runNext();
          })
          .catch(reject);
      }
    };

    if (values.length === 0) {
      resolve(results);
      return;
    }

    runNext();
  });
}

async function readHashes(fileNames: string[]): Promise<Map<string, string> | null> {
  const hashPath = join(FRAMES_DIR, ".hashes.json");
  try {
    const raw = await readFile(hashPath, "utf8");
    const parsed = JSON.parse(raw) as HashEntry[];
    const wanted = new Set(fileNames);
    const byName = new Map<string, string>();
    for (const entry of parsed) {
      if (wanted.has(entry.name)) {
        byName.set(entry.name, entry.hash);
      }
    }
    return byName;
  } catch {
    return null;
  }
}

function parseRmse(raw: string): number {
  // compare outputs: "1234.56 (0.0188)" on stderr
  const trimmed = raw.trim();
  const first = trimmed.split(/\s+/)[0];
  const rawRmse = Number.parseFloat(first || "");
  const normalizedMatch = trimmed.match(/\(([\d.]+)\)/);
  const normalized = Number.parseFloat(normalizedMatch?.[1] || "");
  return Number.isFinite(rawRmse) ? rawRmse : Number.POSITIVE_INFINITY;
}

function parseRmseMetric(raw: string): RmseMetric {
  const trimmed = raw.trim();
  const first = trimmed.split(/\s+/)[0];
  const rawRmse = Number.parseFloat(first || "");
  const normalizedMatch = trimmed.match(/\(([\d.]+)\)/);
  const normalized = Number.parseFloat(normalizedMatch?.[1] || "");
  return {
    raw: Number.isFinite(rawRmse) ? rawRmse : Number.POSITIVE_INFINITY,
    normalized: Number.isFinite(normalized) ? normalized : Number.POSITIVE_INFINITY,
  };
}

async function compareRmse(shotPath: string, framePath: string): Promise<RmseMetric> {
  const output = await $`compare -metric RMSE ${shotPath} ${framePath} null: 2>&1 || true`
    .quiet()
    .text();
  return parseRmseMetric(output);
}

function frameNumFromRep(rep: string): number {
  return extractFrameNumber(rep);
}

function rangeIndices(start: number, end: number, step = 1): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i += step) {
    out.push(i);
  }
  return out;
}

async function findBestFrameIndex(
  shotPath: string,
  repFrames: string[],
  searchStartIndex: number
): Promise<{ index: number; metric: RmseMetric }> {
  if (repFrames.length === 0) {
    throw new Error("No representative frames available for matching");
  }

  const start = Math.max(0, Math.min(searchStartIndex, repFrames.length - 1));
  const end = repFrames.length - 1;

  const coarseIndexes = rangeIndices(start, end, COARSE_STEP);
  if (coarseIndexes[coarseIndexes.length - 1] !== end) {
    coarseIndexes.push(end);
  }

  const coarseRank: { index: number; metric: RmseMetric }[] = [];
  for (const index of coarseIndexes) {
    const metric = await compareRmse(shotPath, repFrames[index]!);
    coarseRank.push({ index, metric });
  }
  coarseRank.sort((a, b) => a.metric.raw - b.metric.raw);

  const anchors = coarseRank.slice(0, COARSE_ANCHORS);
  const refineSet = new Set<number>();
  for (const anchor of anchors) {
    const from = Math.max(start, anchor.index - REFINE_RADIUS);
    const to = Math.min(end, anchor.index + REFINE_RADIUS);
    for (let i = from; i <= to; i++) {
      refineSet.add(i);
    }
  }

  // Keep sequence continuity preference around current cursor.
  for (let i = start; i <= Math.min(end, start + REFINE_RADIUS); i++) {
    refineSet.add(i);
  }

  let best = { index: anchors[0]?.index ?? start, metric: { raw: Number.POSITIVE_INFINITY, normalized: Number.POSITIVE_INFINITY } };
  for (const index of [...refineSet].sort((a, b) => a - b)) {
    const metric = await compareRmse(shotPath, repFrames[index]!);
    if (metric.raw < best.metric.raw) {
      best = { index, metric };
    }
  }

  // Accuracy guardrail: fallback to full scan if coarse/refine confidence is low.
  if (!Number.isFinite(best.metric.normalized) || best.metric.normalized > UNCERTAIN_NORMALIZED_RMSE) {
    for (let index = start; index <= end; index++) {
      const metric = await compareRmse(shotPath, repFrames[index]!);
      if (metric.raw < best.metric.raw) {
        best = { index, metric };
      }
    }
  }

  return best;
}

await mkdir(join(TMP, "frames"), { recursive: true });
await mkdir(join(TMP, "shots"), { recursive: true });
await mkdir(TIMESTAMPS_DIR, { recursive: true });

try {
  const allFrames = (await readdir(FRAMES_DIR))
    .filter((f) => f.startsWith("frame-text-"))
    .sort();

  if (allFrames.length === 0) {
    throw new Error(`No frame files found in ${FRAMES_DIR}`);
  }

  const hashByName = await readHashes(allFrames);
  const grouped = new Map<string, string[]>();
  for (const frameName of allFrames) {
    const hash = hashByName?.get(frameName);
    const key = hash ?? frameName;
    const list = grouped.get(key);
    if (list) {
      list.push(frameName);
    } else {
      grouped.set(key, [frameName]);
    }
  }

  const representativeFrameNames = [...grouped.values()].map((names) => names[0]!).sort();
  console.log(`=== Frame Groups: ${grouped.size} / ${allFrames.length} ===`);

  console.log("=== Downscaling representative frames ===");
  await mapLimit(representativeFrameNames, PARALLELISM, async (name) => {
    await $`convert ${join(FRAMES_DIR, name)} -resize ${SIZE} ${join(TMP, "frames", name)}`.quiet();
  });
  console.log(`Done (${representativeFrameNames.length} representative frames)`);

  const representativeFrames = representativeFrameNames.map((name) => join(TMP, "frames", name));
  const repNameByPath = new Map<string, string>(
    representativeFrames.map((framePath, i) => [framePath, representativeFrameNames[i]!])
  );

  console.log("\n=== Matching screenshots ===");
  const shots = (await readdir(SCREENSHOTS_DIR))
    .filter((f) => f.endsWith(".png"))
    .sort();

  if (shots.length === 0) {
    throw new Error(`No screenshots found in ${SCREENSHOTS_DIR}`);
  }

  const results: MatchResult[] = [];
  let lastFrameNumber = 0;
  let lastRepIndex = 0;

  for (const shotName of shots) {
    const shotPath = join(TMP, "shots", shotName);
    await $`convert ${join(SCREENSHOTS_DIR, shotName)} -resize ${SIZE} ${shotPath}`.quiet();

    const best = await findBestFrameIndex(shotPath, representativeFrames, lastRepIndex);
    const bestRepPath = representativeFrames[best.index]!;
    const bestRepName = repNameByPath.get(bestRepPath) ?? representativeFrameNames[best.index]!;
    const hashKey = hashByName?.get(bestRepName) ?? bestRepName;
    const equivalentFrames = grouped.get(hashKey) ?? [bestRepName];

    // Preserve sequential timing by preferring the nearest later frame when identical.
    let chosenFrame = equivalentFrames[0]!;
    const later = equivalentFrames.find((name) => extractFrameNumber(name) >= lastFrameNumber);
    if (later) {
      chosenFrame = later;
    } else {
      chosenFrame = equivalentFrames[equivalentFrames.length - 1]!;
    }

    const frameNumber = extractFrameNumber(chosenFrame);
    const timestamp = frameNumber / FRAMERATE;
    const word = extractWord(shotName);

    console.log(
      `${shotName} → ${chosenFrame} (frame ${frameNumber}, ${timestamp.toFixed(3)}s, nRMSE ${best.metric.normalized.toFixed(5)})`
    );

    results.push({
      word,
      screenshot: shotName,
      frame: chosenFrame,
      frameNumber,
      timestamp,
    });

    lastFrameNumber = frameNumber;
    lastRepIndex = best.index;
  }

  const outputPath = join(TIMESTAMPS_DIR, `${tapeName}.json`);
  await writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n=== Timestamps written to ${outputPath} ===`);
} finally {
  await rm(TMP, { recursive: true, force: true });
}
