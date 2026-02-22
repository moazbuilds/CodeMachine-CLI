import { $ } from "bun";
import { join, resolve } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const COMPS_DIR = join(ROOT, "recordings/remotion");
const VIDEO_DIR = join(ROOT, "recordings/output/video");

const name = process.argv[2];
if (!name) {
  console.error("Usage: bun recordings/pipeline/render.ts <name> [output.mp4] [extra remotion args...]");
  process.exit(1);
}

let argIndex = 3;
let outputPath = join(VIDEO_DIR, `${name}-final.mp4`);
if (process.argv[3] && !process.argv[3]!.startsWith("-")) {
  outputPath = resolve(process.argv[3]!);
  argIndex = 4;
}

const extraArgs = process.argv.slice(argIndex);
const propsArg = `--props=${JSON.stringify({ name })}`;

console.log(`Rendering Sync for: ${name}`);
console.log(`Output: ${outputPath}`);

await $`npx remotion render Sync ${outputPath} ${propsArg} ${extraArgs}`.cwd(COMPS_DIR);

console.log("Running black-frame cleanup in place...");
await $`bun recordings/pipeline/blackguard.ts ${outputPath}`.cwd(ROOT);

console.log(`Done: ${outputPath}`);
