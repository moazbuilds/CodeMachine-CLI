import { mkdir, writeFile, access, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

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

function extractLineContent(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return "";

  const colonIdx = trimmed.indexOf(":");
  if (colonIdx >= 0) {
    const header = trimmed.slice(0, colonIdx).trim();
    if (/^[A-Za-z_][\w-]*\|\d+(\.\d+)?$/.test(header)) {
      return trimmed.slice(colonIdx + 1).trim();
    }
  }

  return trimmed;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeNarrationText(source: string): string {
  return source
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\{\d+(\.\d+)?\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSsmlFromScript(source: string): string {
  if (/<\s*speak[\s>]/i.test(source)) {
    return source.trim();
  }

  const content = source
    .split("\n")
    .map((line) => extractLineContent(line))
    .filter(Boolean)
    .join(" ")
    .replace(/\[[^\]]+\]/g, " ")
    .trim();

  const ssmlBody = escapeXml(content).replace(
    /\{(\d+(?:\.\d+)?)\}/g,
    (_match, sec) => `<break time="${sec}s"/>`,
  );

  return `<speak>${ssmlBody}</speak>`;
}

function stripSsmlTags(ssml: string): string {
  return ssml
    .replace(/<break\b[^>]*>/gi, " ")
    .replace(/<\/?speak[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const text = normalizeNarrationText(
  raw
    .split("\n")
    .map((line) => extractLineContent(line))
    .filter(Boolean)
    .join(" "),
);
const ssml = buildSsmlFromScript(raw);
const spokenFromSsml = stripSsmlTags(ssml);

const provider = (process.env.TTS_PROVIDER || "elevenlabs").toLowerCase();

console.log(`Script: ${name}`);
console.log(`Provider: ${provider}`);
console.log(`Text: ${text}`);
console.log(`SSML: ${ssml}`);

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
        input: { ssml },
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
} else if (provider === "gemini") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found in .env");
    process.exit(1);
  }

  const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-pro-preview-tts";
  const voiceName = process.env.GEMINI_TTS_VOICE || "Kore";
  console.log(`Model: ${model}`);
  console.log(`Voice: ${voiceName}`);

  const prompt =
    `Read this script exactly as written. ` +
    `Apply SSML <break time=\"...\"/> pauses naturally and do not speak markup tags.\n\n` +
    `Spoken text:\n${spokenFromSsml}\n\n` +
    `SSML to follow:\n${ssml}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    console.error(`Gemini API error (${response.status}): ${err}`);
    process.exit(1);
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: {
            mimeType?: string;
            data?: string;
          };
        }>;
      };
    }>;
  };

  const inline = json.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data,
  )?.inlineData;

  if (!inline?.data) {
    console.error("Gemini returned no audio data");
    process.exit(1);
  }

  const pcmData = Buffer.from(inline.data, "base64");
  const rateMatch = inline.mimeType?.match(/rate=(\d+)/i);
  const sampleRate = Number.parseInt(rateMatch?.[1] || "24000", 10);

  const pcmPath = join(audioDir, `${name}.gemini.pcm`);
  await writeFile(pcmPath, pcmData);

  await $`ffmpeg -f s16le -ar ${sampleRate} -ac 1 -i ${pcmPath} -c:a libmp3lame -q:a 2 ${outputPath} -y`.quiet();
  await rm(pcmPath, { force: true });
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
