import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const RECORDINGS = join(ROOT, "recordings");
const SUBTITLES = join(RECORDINGS, "subtitles");
const OUTPUT = join(RECORDINGS, "output");

const VOICE_ID = "pqHfZKP75CvOlQylNhV4"; // Bill
const MODEL_ID = "eleven_v3";

const name = process.argv[2];

if (!name) {
  console.error("Usage: bun audio <script-name>");
  console.error("Example: bun audio test-ali");
  process.exit(1);
}

const subtitlePath = join(SUBTITLES, `${name}.txt`);

if (!(await access(subtitlePath).then(() => true, () => false))) {
  console.error(`Subtitle not found: ${subtitlePath}`);
  process.exit(1);
}

const apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error("ELEVENLABS_API_KEY not found in .env");
  process.exit(1);
}

const raw = await Bun.file(subtitlePath).text();
const text = raw
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l)
  .join(" ");

console.log(`Script: ${name}`);
console.log(`Text: ${text}`);
console.log(`Model: ${MODEL_ID}`);

const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
  {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1.2,
      },
    }),
  }
);

if (!response.ok) {
  const err = await response.text();
  console.error(`ElevenLabs API error (${response.status}): ${err}`);
  process.exit(1);
}

const audioDir = join(OUTPUT, "audio");
await mkdir(audioDir, { recursive: true });

const outputPath = join(audioDir, `${name}.mp3`);
const buffer = await response.arrayBuffer();
await writeFile(outputPath, Buffer.from(buffer));

console.log(`\nAudio saved: ${outputPath}`);
