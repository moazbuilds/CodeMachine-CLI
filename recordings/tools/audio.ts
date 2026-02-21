import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const RECORDINGS = join(ROOT, "recordings");
const SUBTITLES = join(RECORDINGS, "subtitles");
const OUTPUT = join(RECORDINGS, "output");

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

const raw = await Bun.file(subtitlePath).text();
const text = raw
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l)
  .join(" ");

const provider = (process.env.TTS_PROVIDER || "elevenlabs").toLowerCase();

console.log(`Script: ${name}`);
console.log(`Provider: ${provider}`);
console.log(`Text: ${text}`);

const audioDir = join(OUTPUT, "audio");
await mkdir(audioDir, { recursive: true });
const outputPath = join(audioDir, `${name}.mp3`);

if (provider === "google") {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_CLOUD_API_KEY not found in .env");
    process.exit(1);
  }

  const voiceName = "en-US-Chirp3-HD-Charon";
  console.log(`Voice: ${voiceName}`);

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name: voiceName },
        audioConfig: { audioEncoding: "MP3" },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error(`Google Cloud TTS error (${response.status}): ${err}`);
    process.exit(1);
  }

  const json = (await response.json()) as { audioContent: string };
  const buffer = Buffer.from(json.audioContent, "base64");
  await writeFile(outputPath, buffer);
} else {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("ELEVENLABS_API_KEY not found in .env");
    process.exit(1);
  }

  const voiceId = "pqHfZKP75CvOlQylNhV4"; // Bill
  const modelId = "eleven_v3";
  console.log(`Voice: Bill (${voiceId})`);
  console.log(`Model: ${modelId}`);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
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

  const buffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(buffer));
}

console.log(`\nAudio saved: ${outputPath}`);
