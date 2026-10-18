import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { TestRenderer } from "@gpuix/native/testing";
import { createRoot, flushSync } from "@gpuix/react";
import { createElement, type ReactNode } from "react";
import { pick } from "./lib/util.ts";
import type { StoryDef } from "./index.ts";
import type {
  Args,
  DecoratorFunction,
  PartialStoryFn,
  StoryContext,
} from "./csf.ts";

export const DEFAULT_WIDTH = 640;
export const DEFAULT_HEIGHT = 480;

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export { sleep };

function dimFrom(
  story: StoryDef,
  key: "width" | "height" | "settleMs",
  fallback?: number,
): number | undefined {
  return pick(
    [story[key], story.parameters[key], story.meta.parameters?.[key]],
    fallback,
  );
}

function resolveDimensions(story: StoryDef): {
  width: number;
  height: number;
  settleMs?: number;
} {
  return {
    width: dimFrom(story, "width", DEFAULT_WIDTH) ?? DEFAULT_WIDTH,
    height: dimFrom(story, "height", DEFAULT_HEIGHT) ?? DEFAULT_HEIGHT,
    settleMs: dimFrom(story, "settleMs"),
  };
}

function buildStoryComponent(
  story: StoryDef,
): ((props: { args: Record<string, any> }) => ReactNode) | null {
  const storyFn =
    typeof story.story === "function" ? (story.story as any) : null;
  return storyFn
    ? (props: { args: Record<string, any> }) =>
        storyFn(props.args, story.context)
    : null;
}

function baseRender(story: StoryDef): (args: Record<string, any>) => ReactNode {
  const StoryComponent = buildStoryComponent(story);
  return (args: Record<string, any>): ReactNode => {
    if (StoryComponent) return createElement(StoryComponent, { args });
    if (story.render) return story.render(args, story.context);
    if (story.meta.component)
      return createElement(story.meta.component as any, args);
    return null;
  };
}

function baseStoryFn(story: StoryDef): PartialStoryFn {
  const render = baseRender(story);
  return (update) =>
    render({ ...story.args, ...((update?.args as Record<string, any>) ?? {}) });
}

function applyDecorators(
  fn: PartialStoryFn,
  decorators: DecoratorFunction[],
  context: StoryContext,
): PartialStoryFn {
  let current: PartialStoryFn = fn;
  for (const d of decorators) {
    const node = d(current, context);
    current = () => node;
  }
  return current;
}

async function attemptRender(
  story: StoryDef,
  projectRoot?: string,
  previewDecorators: DecoratorFunction[] = [],
): Promise<{ out: string | null; error: unknown }> {
  try {
    return {
      out: await renderStory(story, projectRoot, previewDecorators),
      error: null,
    };
  } catch (err) {
    return { out: null, error: err };
  }
}

export async function renderWithRetry(
  story: StoryDef,
  projectRoot?: string,
  previewDecorators: DecoratorFunction[] = [],
): Promise<{ out: string | null; error: unknown }> {
  const first = await attemptRender(story, projectRoot, previewDecorators);
  if (first.out) return first;
  await sleep(500);
  return attemptRender(story, projectRoot, previewDecorators);
}

function captureStoryPng(
  story: StoryDef,
  args: Args,
  out: string,
  previewDecorators: DecoratorFunction[],
): void {
  const { width, height, settleMs } = resolveDimensions(story);

  const element = applyDecorators(
    baseStoryFn(story),
    [...(story.decorators ?? []), ...previewDecorators],
    story.context as StoryContext,
  )({ args });

  mkdirSync(dirname(out), { recursive: true });

  const renderer = new TestRenderer({ width, height });
  const root = createRoot(renderer, {});
  flushSync(() => root.render(element));

  renderer.flush();
  if (settleMs && settleMs > 0) renderer.advanceTime(settleMs);

  renderer.captureScreenshot(out);
  root.unmount();
}

export function storyPngPath(story: StoryDef, projectRoot?: string): string {
  const root = story.root ?? projectRoot;
  if (!root) throw new Error("storyPngPath: no root for story");
  return join(
    root,
    dirname(story.file),
    story.meta.title ?? "story",
    `${story.name}.png`,
  );
}

function renderStoryWithArgs(
  story: StoryDef,
  args: Args,
  projectRoot?: string,
  previewDecorators: DecoratorFunction[] = [],
): string {
  const out = storyPngPath(story, projectRoot);
  captureStoryPng(story, args, out, previewDecorators);
  return out;
}

export async function renderStory(
  story: StoryDef,
  projectRoot?: string,
  previewDecorators: DecoratorFunction[] = [],
): Promise<string> {
  return renderStoryWithArgs(story, story.args, projectRoot, previewDecorators);
}
