import { join } from "node:path";
import { access, mkdir } from "node:fs/promises";
import { $ } from "bun";
import {
  installWhisperCpp,
  downloadWhisperModel,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

const ROOT = join(import.meta.dir, "../..");
const RECORDINGS = join(ROOT, "recordings");
const OUTPUT = join(RECORDINGS, "output");
const WHISPER_PATH = join(RECORDINGS, "vendor/whisper.cpp");
const WHISPER_VERSION = "1.5.5";
const MODEL = "medium.en";

const name = process.argv[2];

if (!name) {
  console.error("Usage: bun transcribe <name>");
  console.error("Example: bun transcribe test-ali");
  process.exit(1);
}

const mp3Path = join(OUTPUT, "audio", `${name}.mp3`);

if (!(await access(mp3Path).then(() => true, () => false))) {
  console.error(`Audio not found: ${mp3Path}`);
  process.exit(1);
}

// Convert mp3 to 16KHz wav for whisper
const wavPath = join(OUTPUT, "audio", `${name}.wav`);
console.log("=== Converting to 16KHz WAV ===");
await $`ffmpeg -i ${mp3Path} -ar 16000 ${wavPath} -y`.quiet();

// Install whisper.cpp if needed
console.log("\n=== Setting up Whisper.cpp ===");
await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
await downloadWhisperModel({ model: MODEL, folder: WHISPER_PATH });

// Transcribe
console.log(`\n=== Transcribing ${name} ===`);
const whisperOutput = await transcribe({
  model: MODEL,
  whisperPath: WHISPER_PATH,
  whisperCppVersion: WHISPER_VERSION,
  inputPath: wavPath,
  tokenLevelTimestamps: true,
});

const { captions } = toCaptions({ whisperCppOutput: whisperOutput });

// Write captions JSON
await mkdir(join(OUTPUT, "captions"), { recursive: true });
const captionsPath = join(OUTPUT, "captions", `${name}.json`);
await Bun.write(captionsPath, JSON.stringify(captions, null, 2));

console.log(`\nCaptions (${captions.length} words):`);
for (const c of captions) {
  console.log(`  [${(c.startMs / 1000).toFixed(2)}s] ${c.text}`);
}
console.log(`\nSaved: ${captionsPath}`);
