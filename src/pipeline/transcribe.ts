import { join } from "node:path";
import { access, mkdir } from "node:fs/promises";
import { $ } from "bun";

const ROOT = join(import.meta.dir, "../..");
const RECORDINGS = join(ROOT, "recordings");
const OUTPUT = join(RECORDINGS, "outputs");
const WHISPER_PATH = join(ROOT, "vendors/whisper.cpp");
const WHISPER_VERSION = "1.5.5";
const MODEL = "medium.en";
const REMOTION_INSTALL_PKG = join(
  ROOT,
  "apps/remotion/node_modules/@remotion/install-whisper-cpp",
);

const name = process.argv[2];

if (!name) {
  console.error("Usage: bun transcribe <name>");
  console.error("Example: bun transcribe test-ali");
  process.exit(1);
}

const runOutputDir = join(OUTPUT, name);
const mp3Path = join(runOutputDir, "audio", `${name}.mp3`);

const remotionWhisper = (await import(REMOTION_INSTALL_PKG)) as {
  installWhisperCpp: (args: { to: string; version: string }) => Promise<void>;
  downloadWhisperModel: (args: { model: string; folder: string }) => Promise<void>;
  transcribe: (args: {
    model: string;
    whisperPath: string;
    whisperCppVersion: string;
    inputPath: string;
    tokenLevelTimestamps: boolean;
  }) => Promise<unknown>;
  toCaptions: (args: { whisperCppOutput: unknown }) => { captions: Array<{ text: string; startMs: number }> };
};

if (!(await access(mp3Path).then(() => true, () => false))) {
  console.error(`Audio not found: ${mp3Path}`);
  process.exit(1);
}

// Convert mp3 to 16KHz wav for whisper
const wavPath = join(runOutputDir, "audio", `${name}.wav`);
console.log("=== Converting to 16KHz WAV ===");
await $`ffmpeg -i ${mp3Path} -ar 16000 ${wavPath} -y`.quiet();

// Install whisper.cpp if needed
console.log("\n=== Setting up Whisper.cpp ===");
await remotionWhisper.installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
await remotionWhisper.downloadWhisperModel({ model: MODEL, folder: WHISPER_PATH });

// Transcribe
console.log(`\n=== Transcribing ${name} ===`);
const whisperOutput = await remotionWhisper.transcribe({
  model: MODEL,
  whisperPath: WHISPER_PATH,
  whisperCppVersion: WHISPER_VERSION,
  inputPath: wavPath,
  tokenLevelTimestamps: true,
});

const { captions } = remotionWhisper.toCaptions({ whisperCppOutput: whisperOutput });

// Write captions JSON
await mkdir(join(runOutputDir, "captions"), { recursive: true });
const captionsPath = join(runOutputDir, "captions", `${name}.json`);
await Bun.write(captionsPath, JSON.stringify(captions, null, 2));

console.log(`\nCaptions (${captions.length} words):`);
for (const c of captions) {
  console.log(`  [${(c.startMs / 1000).toFixed(2)}s] ${c.text}`);
}
console.log(`\nSaved: ${captionsPath}`);
