import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const OUTPUT = join(ROOT, "recordings/outputs");

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(OUTPUT, { recursive: true });

console.log("All run outputs cleaned.");
