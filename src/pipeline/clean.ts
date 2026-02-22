import { readdir, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const RECORDINGS = join(ROOT, "recordings");
const INPUTS = join(RECORDINGS, "inputs");
const OUTPUTS = join(RECORDINGS, "outputs");
const ARCHIVE = join(RECORDINGS, ".archive");

const INPUTS_SKIP = new Set(["ascii"]);
const OUTPUTS_SKIP = new Set<string>();

function archiveStamp(now: Date): string {
  return now.toISOString().replaceAll(":", "-");
}

async function listProjectDirs(root: string, skip: Set<string>): Promise<Set<string>> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const projects = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("_")) continue;
    if (skip.has(entry.name)) continue;
    projects.add(entry.name);
  }

  return projects;
}

const stamp = archiveStamp(new Date());
const inputProjects = await listProjectDirs(INPUTS, INPUTS_SKIP);
const outputProjects = await listProjectDirs(OUTPUTS, OUTPUTS_SKIP);
const projects = new Set<string>([...inputProjects, ...outputProjects]);

if (projects.size === 0) {
  await mkdir(INPUTS, { recursive: true });
  await mkdir(OUTPUTS, { recursive: true });
  console.log("Nothing to archive. Inputs and outputs are already clean.");
  process.exit(0);
}

for (const project of [...projects].sort()) {
  const fromInput = join(INPUTS, project);
  const fromOutput = join(OUTPUTS, project);
  const archiveProjectRun = join(ARCHIVE, project, stamp);
  const toInput = join(archiveProjectRun, "inputs");
  const toOutput = join(archiveProjectRun, "outputs");

  if (inputProjects.has(project)) {
    await mkdir(archiveProjectRun, { recursive: true });
    await rename(fromInput, toInput);
    console.log(`Archived input:  ${fromInput} -> ${toInput}`);
  }

  if (outputProjects.has(project)) {
    await mkdir(archiveProjectRun, { recursive: true });
    await rename(fromOutput, toOutput);
    console.log(`Archived output: ${fromOutput} -> ${toOutput}`);
  }
}

await mkdir(INPUTS, { recursive: true });
await mkdir(OUTPUTS, { recursive: true });

console.log(`Archived ${projects.size} project(s). Active inputs/outputs cleaned.`);
