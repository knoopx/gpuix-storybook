import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { TestRenderer } from "@gpuix/native/testing";
import { createRoot, flushSync } from "@gpuix/react";
import { createElement, type ReactNode } from "react";
import { pick } from "./lib/util.ts";
import { feedImages } from "./lib/images.ts";
import type { StoryDef } from "./index.ts";
import type {
  Args,
  DecoratorFunction,
  PartialStoryFn,
  StoryContext,
} from "./csf.ts";

const PROCESS_START = Date.now();

export const DEFAULT_WIDTH = 640;
export const DEFAULT_HEIGHT = 1080;

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

const PUMP_FRAMES = 12;
const FRAME_MS = 16;

const FIT_MARGIN = 8;
const FIT_SHRINK_STEP = 8;
const FIT_MIN = 480;

interface Rect {
  x: number;
  y: number;
  right: number;
  bottom: number;
}

const UNBOUNDED: Rect = {
  x: -1_000_000,
  y: -1_000_000,
  right: 1_000_000,
  bottom: 1_000_000,
};

const CLIPPING_OVERFLOW = new Set(["hidden", "scroll", "auto", "clip"]);

function clipTo(outer: Rect, inner: Rect): Rect {
  return {
    x: Math.max(outer.x, inner.x),
    y: Math.max(outer.y, inner.y),
    right: Math.min(outer.right, inner.right),
    bottom: Math.min(outer.bottom, inner.bottom),
  };
}

const FRAME_SLACK = 48;

interface NodeLike {
  type?: string;
  id?: number;
  text?: string;
  style?: Record<string, unknown>;
  children?: unknown[];
}

function paintsContent(n: NodeLike): boolean {
  if (String(n.type ?? "div") !== "div") return true;
  if (typeof n.text === "string" && n.text.length > 0) return true;
  const style = n.style ?? {};
  const border = Number(style.borderWidth ?? 0);
  return border > 0 || style.borderColor !== undefined;
}

export function paintedExtent(renderer: TestRenderer): {
  width: number;
  height: number;
} {
  const content: Rect[] = [];
  const frames: Rect[] = [];
  const seen = new Set<number>();
  const visit = (node: unknown, clip: Rect): void => {
    if (!node || typeof node !== "object") return;
    const n = node as NodeLike;
    let childClip = clip;
    if (typeof n.id === "number" && !seen.has(n.id)) {
      seen.add(n.id);
      let b: { x: number; y: number; width: number; height: number } | null =
        null;
      try {
        b = renderer.getElementBounds(n.id);
      } catch {
        b = null;
      }
      if (b) {
        const rect: Rect = {
          x: b.x,
          y: b.y,
          right: b.x + b.width,
          bottom: b.y + b.height,
        };
        const area = b.width * b.height;
        const shown = clipTo(clip, rect);
        (paintsContent(n) ? content : frames).push(shown);

        if (area > 1 && CLIPPING_OVERFLOW.has(String(n.style?.overflow ?? "")))
          childClip = shown;
      }
    }
    for (const child of n.children ?? [])
      visit(
        typeof child === "number" ? renderer.getElement(child) : child,
        childClip,
      );
  };
  visit(renderer.toJSON(), UNBOUNDED);

  const edge = (
    rects: Rect[],
    key: "right" | "bottom",
    painted: number,
  ): number =>
    Math.max(
      painted,
      ...rects
        .filter((r) => r[key] <= painted + FRAME_SLACK)
        .map((r) => r[key]),
    );

  const contentRight = Math.max(0, ...content.map((r) => r.right));
  const contentBottom = Math.max(0, ...content.map((r) => r.bottom));
  return {
    width: Math.ceil(edge(frames, "right", contentRight)),
    height: Math.ceil(edge(frames, "bottom", contentBottom)),
  };
}

function fitAxis(declaredSize: number, paintedSize: number): number {
  if (paintedSize <= 0) return declaredSize;
  const target = Math.min(paintedSize + FIT_MARGIN, declaredSize);
  return Math.max(
    FIT_MIN,
    Math.ceil(target / FIT_SHRINK_STEP) * FIT_SHRINK_STEP,
  );
}

export function fitCanvas(
  declared: { width: number; height: number },
  painted: { width: number; height: number },
): { width: number; height: number } {
  return {
    width: declared.width,
    height: fitAxis(declared.height, painted.height),
  };
}

export async function paintStory(
  element: ReactNode,
  dims: { width: number; height: number; settleMs?: number },
): Promise<{ renderer: TestRenderer; dispose: () => void }> {
  const renderer = new TestRenderer({ width: dims.width, height: dims.height });
  const root = createRoot(renderer, {});
  flushSync(() => root.render(element));
  renderer.flush();
  for (let frame = 0; frame < PUMP_FRAMES; frame++) {
    await new Promise<void>((turn) => setTimeout(turn, 0));
    renderer.advanceTime(FRAME_MS);
    renderer.flush();
  }
  if (dims.settleMs && dims.settleMs > 0) {
    renderer.advanceTime(dims.settleMs);
    renderer.flush();
  }
  return { renderer, dispose: () => root.unmount() };
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
  return attemptRender(story, projectRoot, previewDecorators);
}

export async function captureStoryPng(
  story: StoryDef,
  args: Args,
  out: string,
  previewDecorators: DecoratorFunction[],
): Promise<void> {
  const { width, height, settleMs } = resolveDimensions(story);

  const element = applyDecorators(
    baseStoryFn(story),
    [...(story.decorators ?? []), ...previewDecorators],
    story.context as StoryContext,
  )({ args });

  mkdirSync(dirname(out), { recursive: true });

  const t0 = Date.now();
  let last = t0;
  const mark = (label: string): void => {
    if (process.env.STORYBOOK_TIME !== "1") return;
    const now = Date.now();
    console.log(
      `  \u00b7 time ${label} +${now - last}ms (total ${now - PROCESS_START}ms, boot ${t0 - PROCESS_START}ms)`,
    );
    last = now;
  };

  let dims = { width, height };
  let painted = await paintStory(element, { ...dims, settleMs });
  mark("paint 1");
  const images = feedImages(painted.renderer);
  if (images > 0) console.log(`  \u00b7 images fed: ${images}`);

  const fitted = fitCanvas(dims, paintedExtent(painted.renderer));
  if (fitted.width !== dims.width || fitted.height !== dims.height) {
    painted.dispose();
    console.log(
      `  \u00b7 canvas fit ${width}x${height} \u2192 ${fitted.width}x${fitted.height}`,
    );
    dims = fitted;
    painted = await paintStory(element, { ...dims, settleMs });
    feedImages(painted.renderer);
  }

  mark("fitted");
  painted.renderer.captureScreenshot(out);
  mark("captured");
  painted.dispose();
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

async function renderStoryWithArgs(
  story: StoryDef,
  args: Args,
  projectRoot?: string,
  previewDecorators: DecoratorFunction[] = [],
): Promise<string> {
  const out = storyPngPath(story, projectRoot);
  await captureStoryPng(story, args, out, previewDecorators);
  return out;
}

export async function renderStory(
  story: StoryDef,
  projectRoot?: string,
  previewDecorators: DecoratorFunction[] = [],
): Promise<string> {
  return renderStoryWithArgs(story, story.args, projectRoot, previewDecorators);
}
