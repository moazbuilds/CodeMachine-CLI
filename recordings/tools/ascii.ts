import { access, mkdir, readdir, rm } from "node:fs/promises";
import { join, parse } from "node:path";
import { spawn } from "node:child_process";

type OutputFormat = "auto" | "png" | "gif";

type Frame = {
  index: number;
  holdSeconds?: number;
  text: string;
};

type CliOptions = {
  project: string;
  name?: string;
  format: OutputFormat;
  fps: number;
  width: number;
  height: number;
  x: number;
  y: number;
  pointSize: number;
  interlineSpacing: number;
  bg: string;
  fg: string;
  font: string;
};

const ROOT = join(import.meta.dir, "../..");
const ASCIIS_ROOT = join(ROOT, "asciis");

function printUsage(): never {
  console.error("Usage: bun recordings/tools/ascii.ts <project> [options]");
  console.error("");
  console.error("Options:");
  console.error("  --name <file-base>     Render only one file in project");
  console.error("  --format <auto|png|gif>  Output format (default: auto)");
  console.error("  --fps <number>         GIF fps for frame timing (default: 6)");
  console.error("  --width <number>       Canvas width (default: 1280)");
  console.error("  --height <number>      Canvas height (default: 720)");
  console.error("  --x <number>           Text X offset (default: 100)");
  console.error("  --y <number>           Text Y offset (default: 260)");
  console.error("  --point-size <number>  Font size (default: 56)");
  console.error("  --line-spacing <number>  Line spacing (default: 12)");
  console.error("  --bg <color>           Background color (default: #0b0f14)");
  console.error("  --fg <color>           Foreground color (default: #e5e7eb)");
  console.error("  --font <name>          ImageMagick font name (default: DejaVu-Sans-Mono)");
  console.error("");
  console.error("Frame file format:");
  console.error("  Single frame: plain ascii text");
  console.error("  Multi frame: use blocks like `frame 1|0.25:` then frame body");
  console.error("");
  console.error("Examples:");
  console.error("  bun recordings/tools/ascii.ts claudeclaw-chaoslab");
  console.error("  bun recordings/tools/ascii.ts claudeclaw-chaoslab --name face --format gif --fps 8");
  process.exit(1);
}

function parseNumber(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid value for ${flag}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  const project = argv[2];
  if (!project || project.startsWith("-")) printUsage();

  const options: CliOptions = {
    project,
    format: "auto",
    fps: 6,
    width: 1280,
    height: 720,
    x: 100,
    y: 260,
    pointSize: 56,
    interlineSpacing: 12,
    bg: "#0b0f14",
    fg: "#e5e7eb",
    font: "DejaVu-Sans-Mono",
  };

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (!next && arg !== "--help") throw new Error(`Missing value for ${arg}`);

    switch (arg) {
      case "--help":
        printUsage();
      case "--name":
        options.name = next;
        i++;
        break;
      case "--format":
        if (next !== "auto" && next !== "png" && next !== "gif") {
          throw new Error(`Unsupported --format: ${next}`);
        }
        options.format = next;
        i++;
        break;
      case "--fps":
        options.fps = parseNumber(next, "--fps");
        i++;
        break;
      case "--width":
        options.width = parseNumber(next, "--width");
        i++;
        break;
      case "--height":
        options.height = parseNumber(next, "--height");
        i++;
        break;
      case "--x":
        options.x = parseNumber(next, "--x");
        i++;
        break;
      case "--y":
        options.y = parseNumber(next, "--y");
        i++;
        break;
      case "--point-size":
        options.pointSize = parseNumber(next, "--point-size");
        i++;
        break;
      case "--line-spacing":
        options.interlineSpacing = parseNumber(next, "--line-spacing");
        i++;
        break;
      case "--bg":
        options.bg = next;
        i++;
        break;
      case "--fg":
        options.fg = next;
        i++;
        break;
      case "--font":
        options.font = next;
        i++;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parseFrames(source: string): Frame[] {
  const lines = source.replace(/\r/g, "").split("\n");
  const marker = /^\s*frame\s+(\d+)(?:\s*\|\s*(\d+(?:\.\d+)?))?\s*:\s*(.*)$/i;

  let hasMarker = false;
  let current: Frame | null = null;
  const frames: Frame[] = [];

  for (const line of lines) {
    const match = line.match(marker);
    if (match) {
      hasMarker = true;
      if (current && current.text.trim()) frames.push(current);
      current = {
        index: Number(match[1]),
        holdSeconds: match[2] ? Number(match[2]) : undefined,
        text: match[3] ?? "",
      };
      continue;
    }

    if (!current) continue;
    current.text = `${current.text}\n${line}`.replace(/^\n/, "");
  }

  if (hasMarker) {
    if (current && current.text.trim()) frames.push(current);
    return frames.sort((a, b) => a.index - b.index);
  }

  const text = source.trimEnd();
  if (!text.trim()) return [];
  return [{ index: 1, text }];
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: "inherit" });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("which", [command], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("exit", (code) => resolve(code === 0));
  });
}

function frameDelayCs(frame: Frame, fps: number): number {
  const hold = frame.holdSeconds ?? 1 / fps;
  return Math.max(1, Math.round(hold * 100));
}

async function renderFramePng(frame: Frame, filePath: string, opt: CliOptions): Promise<void> {
  await runCommand("convert", [
    "-size",
    `${opt.width}x${opt.height}`,
    `xc:${opt.bg}`,
    "-font",
    opt.font,
    "-pointsize",
    String(opt.pointSize),
    "-fill",
    opt.fg,
    "-interline-spacing",
    String(opt.interlineSpacing),
    "-annotate",
    `+${opt.x}+${opt.y}`,
    frame.text,
    filePath,
  ]);
}

async function renderAsciiFile(inputPath: string, outRoot: string, opt: CliOptions): Promise<void> {
  const name = parse(inputPath).name;
  const source = await Bun.file(inputPath).text();
  const frames = parseFrames(source);

  if (frames.length === 0) {
    console.warn(`Skipping empty file: ${inputPath}`);
    return;
  }

  const effectiveFormat: Exclude<OutputFormat, "auto"> =
    opt.format === "auto" ? (frames.length > 1 ? "gif" : "png") : opt.format;

  if (effectiveFormat === "png" && frames.length === 1) {
    const pngOut = join(outRoot, `${name}.png`);
    await renderFramePng(frames[0], pngOut, opt);
    console.log(`Created PNG: ${pngOut}`);
    return;
  }

  const frameDir = join(outRoot, `${name}-frames`);
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  const framePaths: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const framePath = join(frameDir, `frame_${String(i + 1).padStart(4, "0")}.png`);
    await renderFramePng(frames[i], framePath, opt);
    framePaths.push(framePath);
  }

  if (effectiveFormat === "png") {
    console.log(`Created PNG sequence: ${frameDir}`);
    return;
  }

  const gifOut = join(outRoot, `${name}.gif`);
  const args: string[] = [];
  for (let i = 0; i < framePaths.length; i++) {
    args.push("-delay", String(frameDelayCs(frames[i], opt.fps)), framePaths[i]);
  }
  args.push("-loop", "0", gifOut);
  await runCommand("convert", args);
  console.log(`Created GIF: ${gifOut}`);
}

async function main(): Promise<void> {
  const opt = parseArgs(process.argv);
  if (!(await commandExists("convert"))) {
    throw new Error("ImageMagick `convert` is required but was not found.");
  }

  const projectDir = join(ASCIIS_ROOT, opt.project);
  if (!(await access(projectDir).then(() => true, () => false))) {
    throw new Error(`Project folder not found: ${projectDir}`);
  }

  const outDir = join(projectDir, "out");
  await mkdir(outDir, { recursive: true });

  const files = await readdir(projectDir, { withFileTypes: true });
  const txtFiles = files
    .filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))
    .map((entry) => entry.name)
    .sort();

  const targets =
    opt.name !== undefined
      ? txtFiles.filter((file) => parse(file).name === opt.name)
      : txtFiles;

  if (targets.length === 0) {
    throw new Error(
      opt.name
        ? `No file named ${opt.name}.txt in ${projectDir}`
        : `No .txt files found in ${projectDir}`,
    );
  }

  for (const file of targets) {
    await renderAsciiFile(join(projectDir, file), outDir, opt);
  }
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
