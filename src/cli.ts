#!/usr/bin/env bun
import { statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESOLVED_GUARD,
  bootstrapGpuixLibs,
  type LibResolution,
} from "./lib/gpuix-libs.ts";
import type { StoryDef } from "./index.ts";
import type * as Discover from "./lib/discover.ts";

const cliPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(cliPath, "../..");

let loaderPlan: LibResolution = { appended: [], unresolved: [], bindings: [] };

function fixNativeLoader(): void {
  const alreadyFixed = process.env[RESOLVED_GUARD] === "1";
  loaderPlan = bootstrapGpuixLibs([resolve(packageRoot, "..")], (line) =>
    console.log(line),
  );
  if (loaderPlan.appended.length === 0 || alreadyFixed) return;

  const status = spawnSync(
    process.execPath,
    [cliPath, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: process.env,
    },
  ).status;
  process.exit(status ?? 0);
}

async function renderModule(): Promise<typeof import("./index.ts")> {
  return import("./index.ts");
}

async function discoverModule(): Promise<typeof import("./lib/discover.ts")> {
  return import("./lib/discover.ts");
}

function parseArg(
  a: string,
  i: number,
  args: string[],
  vf: Set<string>,
  bf: Set<string>,
  out: { positional: string[]; flags: Record<string, string | boolean> },
): void {
  if (vf.has(a)) out.flags[a] = args[i + 1];
  else if (bf.has(a)) out.flags[a] = true;
  else if (!a.startsWith("-")) out.positional.push(a);
}

function parseArgs(
  args: string[],
  valueFlags: string[],
  boolFlags: string[],
): { positional: string[]; flags: Record<string, string | boolean> } {
  const out = {
    positional: [] as string[],
    flags: {} as Record<string, string | boolean>,
  };
  const vf = new Set(valueFlags);
  const bf = new Set(boolFlags);
  for (let i = 0; i < args.length; i++) parseArg(args[i], i, args, vf, bf, out);
  return out;
}

function printDiscovered(stories: StoryDef[], projectRoot: string): never {
  for (const s of stories)
    console.log(`  ${s.meta.title} > ${s.name}  (${s.file})`);
  console.log(`\n${stories.length} stories discovered → ${projectRoot}`);
  process.exit(0);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function findStory(
  defs: StoryDef[],
  title: string,
  name: string,
): StoryDef | undefined {
  return defs.find((s) => s.meta.title === title && s.name === name);
}

async function renderOne(
  projectRoot: string,
  storyFileRel: string,
  title: string,
  name: string,
  previewModule: string,
): Promise<void> {
  const { buildStoryDefs, loadPreviewDecorators, loadPreviewParameters } =
    await discoverModule();
  const { renderWithRetry } = await renderModule();
  const file = join(projectRoot, storyFileRel);
  let mod: Discover.StoryModule;
  try {
    mod = (await import(file)) as Discover.StoryModule;
  } catch (e) {
    fail(
      `  ✗ ${title} > ${name}: failed to import ${storyFileRel}: ${errMsg(e)}`,
    );
  }
  const defs = buildStoryDefs(mod, storyFileRel, projectRoot);
  const story = findStory(defs, title, name);
  if (!story)
    fail(`  ✗ ${title} > ${name}: story not found in ${storyFileRel}`);
  const previewDecorators = await loadPreviewDecorators(previewModule);
  story.parameters = {
    ...(await loadPreviewParameters(previewModule)),
    ...story.parameters,
  };
  const { out, error } = await renderWithRetry(
    story,
    projectRoot,
    previewDecorators,
  );
  if (!out) fail(`  ✗ ${title} > ${name}: ${errMsg(error)}`);
  const size = statSync(out).size;
  console.log(`  ✓ ${relative(projectRoot, out)} (${size} bytes)`);
}

async function runOne(args: string[]): Promise<void> {
  if (args.length < 5) {
    console.error(
      "usage: storybook --one <projectRoot> <storyFile> <title> <name> <previewModule>",
    );
    process.exit(2);
  }
  const [projectRoot, storyFileRel, title, name, previewModule] = args;
  await renderOne(
    resolve(projectRoot),
    storyFileRel,
    title,
    name,
    previewModule,
  );
  process.exit(0);
}

function printUsage(): never {
  console.log(
    "usage: storybook [projectRoot] [--only <term>] [--dry-run] [--browser]\n" +
      "  captures keep the declared window width and fit their height to what is painted",
  );
  process.exit(0);
}

async function runBrowser(projectRoot: string): Promise<void> {
  const { launchBrowser } = await import("./screens/BrowserApp.tsx");
  await launchBrowser(projectRoot);
}

function storyTitle(story: StoryDef): string {
  return story.meta.title ?? "Unknown";
}

async function renderOneStory(
  story: StoryDef,
  projectRoot: string,
  previewModule: string,
): Promise<boolean> {
  const node = process.execPath;
  const { sleep } = await renderModule();
  for (let attempt = 0; attempt < 2; attempt++) {
    const code = spawnSync(
      node,
      [
        cliPath,
        "--one",
        projectRoot,
        story.file,
        storyTitle(story),
        story.name,
        previewModule,
      ],
      { stdio: "inherit" },
    ).status;
    if (code === 0) return true;
  }
  return false;
}

async function renderAll(
  projectRoot: string,
  stories: StoryDef[],
  only: string | undefined,
): Promise<void> {
  const { filterStories, resolvePreviewModule } = await discoverModule();
  const previewModule = resolvePreviewModule(projectRoot);

  let ok = 0;
  let fail = 0;
  for (const story of filterStories(stories, only)) {
    if (await renderOneStory(story, projectRoot, previewModule)) ok++;
    else fail++;
  }

  console.log(`\n${ok} ok, ${fail} failed → ${projectRoot}`);
  process.exit(fail > 0 ? 1 : 0);
}

function parseCliOptions(args: string[]): {
  projectRoot: string;
  only?: string;
  dryRun: boolean;
  browser: boolean;
  help: boolean;
} {
  const { positional, flags } = parseArgs(
    args,
    ["--only"],
    ["--dry-run", "--browser", "--help"],
  );
  return {
    projectRoot: resolve(positional[0] ?? process.cwd()),
    only: (flags["--only"] as string | undefined) ?? process.env.STORYBOOK_ONLY,
    dryRun: flags["--dry-run"] === true,
    browser: flags["--browser"] === true,
    help: flags["--help"] === true,
  };
}

async function requireTestRenderer(): Promise<void> {
  const { hasNativeTestRenderer } = await import("@gpuix/native/testing");
  if (hasNativeTestRenderer) return;
  console.error(
    "storybook: no test-support build of @gpuix/native is loaded, so PNG capture is unavailable.",
  );
  console.error(
    `  this package pins @gpuix/native to file:../../knoopx/gpuix/packages/native; its Linux
  binding needs a test-support feature build, and its RUNPATH libs must resolve
  (the loader silently falls back to the npm stub when they do not).
  bindings inspected: ${loaderPlan.bindings.length}
  lib dirs appended: ${loaderPlan.appended.length}
  unresolved NEEDED libs: ${loaderPlan.unresolved.join(", ") || "<none>"}
  LD_LIBRARY_PATH: ${process.env.LD_LIBRARY_PATH ?? "<unset>"}`,
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  fixNativeLoader();

  if (args[0] === "--one") {
    await runOne(args.slice(1));
    return;
  }

  const { projectRoot, only, dryRun, browser, help } = parseCliOptions(args);

  if (help) printUsage();

  if (browser) {
    await runBrowser(projectRoot);
    return;
  }

  const { discover } = await discoverModule();
  const stories = await discover(projectRoot);
  if (dryRun) printDiscovered(stories, projectRoot);
  await requireTestRenderer();
  await renderAll(projectRoot, stories, only);
}

main();
