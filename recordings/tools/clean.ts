import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

const OUTPUT = join(import.meta.dir, "../output");

for (const dir of ["frames", "screenshots", "video", "timestamps"]) {
  await rm(join(OUTPUT, dir), { recursive: true, force: true });
}
// Recreate all except frames — VHS needs to create that itself
await mkdir(join(OUTPUT, "screenshots"), { recursive: true });
await mkdir(join(OUTPUT, "video"), { recursive: true });
await mkdir(join(OUTPUT, "timestamps"), { recursive: true });

console.log("Output cleaned.");
