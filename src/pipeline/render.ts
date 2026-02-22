import { $ } from "bun";
import { join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const ROOT = join(import.meta.dir, "../..");
const COMPS_DIR = join(ROOT, "recordings/apps/remotion");
const OUTPUTS_DIR = join(ROOT, "recordings/outputs");

const name = process.argv[2];
if (!name) {
  console.error("Usage: bun src/pipeline/render.ts <name> [output.mp4] [extra remotion args...]");
  process.exit(1);
}

let argIndex = 3;
let outputPath = join(OUTPUTS_DIR, name, "video", `${name}-final.mp4`);
if (process.argv[3] && !process.argv[3]!.startsWith("-")) {
  outputPath = resolve(process.argv[3]!);
  argIndex = 4;
}

const extraArgs = process.argv.slice(argIndex);
const propsArg = `--props=${JSON.stringify({ name })}`;

console.log(`Rendering Sync for: ${name}`);
console.log(`Output: ${outputPath}`);
await mkdir(join(OUTPUTS_DIR, name, "video"), { recursive: true });

await $`npx remotion render Sync ${outputPath} ${propsArg} ${extraArgs}`.cwd(COMPS_DIR);

console.log("Running black-frame cleanup in place...");
await $`bun src/pipeline/blackguard.ts ${outputPath}`.cwd(ROOT);

console.log(`Done: ${outputPath}`);
