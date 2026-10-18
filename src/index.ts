import { statSync } from "node:fs";
import { relative } from "node:path";
import type { ReactNode } from "react";
import { renderWithRetry } from "./render.ts";
import { filterStories, loadPreviewDecorators } from "./lib/discover.ts";
import type { ComponentSource } from "./lib/sourcemaps.ts";
import type {
  Args,
  ArgsStoryFn,
  DecoratorFunction,
  Meta,
  Parameters,
  StoryContext,
  StoryObj,
} from "./csf.ts";

export * from "./csf.ts";

export interface StoryDef {
  name: string;
  file: string;

  root: string;
  meta: Meta;

  story: StoryObj | ((args?: any, context?: any) => ReactNode);

  args: Args;

  parameters: Parameters;

  render?: ArgsStoryFn;

  decorators: DecoratorFunction[];

  context: StoryContext;
  width?: number;
  height?: number;
  settleMs?: number;
  source?: ComponentSource;
}

export interface RunStoriesOptions {
  only?: string;
  previewModule?: string;
}

export interface RunStoriesResult {
  ok: number;
  fail: number;
  outDir: string;
}

export {
  renderStory,
  renderWithRetry,
  sleep,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
} from "./render.ts";
export {
  decodePng,
  decodePngFile,
  encodePng,
  encodePngFile,
  type PngImage,
} from "./lib/png.ts";

function reportOk(out: string, projectRoot: string): void {
  const size = statSync(out).size;
  console.log(`  ✓ ${relative(projectRoot, out)} (${size} bytes)`);
}

function reportFail(story: StoryDef, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.log(`  ✗ ${story.name}: ${msg}`);
}

interface ResolvedRunOptions {
  previewDecorators: DecoratorFunction[];
  only?: string;
}

async function resolveRunOptions(
  opts?: RunStoriesOptions,
): Promise<ResolvedRunOptions> {
  return {
    previewDecorators: opts?.previewModule
      ? await loadPreviewDecorators(opts.previewModule)
      : [],
    only: opts?.only,
  };
}

export async function runStories(
  stories: StoryDef[],
  projectRoot: string,
  opts?: RunStoriesOptions,
): Promise<RunStoriesResult> {
  const { previewDecorators, only } = await resolveRunOptions(opts);

  const list = filterStories(stories, only);

  let ok = 0;
  let fail = 0;
  for (const story of list) {
    const { out, error } = await renderWithRetry(
      story,
      projectRoot,
      previewDecorators,
    );
    if (out) {
      reportOk(out, projectRoot);
      ok++;
      continue;
    }
    reportFail(story, error);
    fail++;
  }

  const outDir = projectRoot;
  console.log(`\n${ok} ok, ${fail} failed → ${outDir}`);
  return { ok, fail, outDir };
}
