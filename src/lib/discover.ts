import { existsSync, readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, relative } from "node:path";
import type {
  Args,
  ArgsStoryFn,
  DecoratorFunction,
  Meta,
  Parameters,
  StoryContext,
  StoryObj,
} from "../csf.ts";
import type { StoryDef } from "../index.ts";
import { resolveComponentSource } from "./sourcemaps.ts";

interface StoryModule {
  default?: Meta;
  [key: string]: unknown;
}

export type { StoryModule };

const normalize = <T>(v: T[] | T | undefined): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

function visitEntry(dir: string, e: Dirent, out: string[]): void {
  const p = join(dir, e.name);
  if (e.isDirectory()) {
    walkTsx(p, out);
    return;
  }
  if (e.isFile() && e.name.endsWith(".tsx")) out.push(p);
}

function walkTsx(dir: string, out: string[] = []): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) visitEntry(dir, e, out);
  return out;
}

function mergeArgs(meta: Meta, src: { args?: Args }): Args {
  return { ...(meta.args ?? {}), ...(src.args ?? {}) };
}

function mergeParameters(meta: Meta, extra?: Parameters): Parameters {
  return { ...(meta.parameters ?? {}), ...(extra ?? {}) };
}

function mergeDecorators(
  fnDecs: DecoratorFunction<any>[] | DecoratorFunction<any> | undefined,
  metaDecs: DecoratorFunction<any>[] | DecoratorFunction<any> | undefined,
): DecoratorFunction[] {
  return [...normalize(fnDecs), ...normalize(metaDecs)] as DecoratorFunction[];
}

function buildContext(
  meta: Meta,
  name: string,
  args: Args,
  story: StoryObj,
): StoryContext {
  const title = meta.title ?? "Unknown";
  return {
    componentId: title,
    title,
    kind: title,
    id: `${title}--${name}`,
    name,
    story: name,
    tags: [],
    component: meta.component,
    parameters: mergeParameters(meta, story.parameters),
    initialArgs: args,
    argTypes: (meta.argTypes ?? {}) as StoryContext["argTypes"],
    args,
    viewMode: "story",
    canvas: null,
  };
}

export function filterStories(stories: StoryDef[], only?: string): StoryDef[] {
  if (!only) return stories;
  const t = only;
  return stories.filter(
    (s) =>
      s.name.includes(t) ||
      (s.meta.title ?? "").includes(t) ||
      s.file.includes(t),
  );
}

interface StoryDefParts {
  name: string;
  file: string;
  root: string;
  meta: Meta;
  story: StoryDef["story"];
  args: Args;
  parameters: Parameters;
  render?: ArgsStoryFn;
  decorators: DecoratorFunction[];
  width?: number;
  height?: number;
  settleMs?: number;
}

function createStoryDef(meta: Meta, parts: StoryDefParts): StoryDef {
  return {
    ...parts,
    context: buildContext(
      meta,
      parts.name,
      parts.args,
      parts.story as StoryObj,
    ),
  };
}

type StoryFn = ((args?: any, context?: any) => any) & {
  args?: Args;
  render?: ArgsStoryFn;
  decorators?: DecoratorFunction[] | DecoratorFunction;
  parameters?: Parameters;
  name?: string;
};

type StoryEntry = StoryObj & {
  width?: number;
  height?: number;
  settleMs?: number;
};

function buildFunctionStoryDef(
  meta: Meta,
  rel: string,
  root: string,
  name: string,
  fn: StoryFn,
): StoryDef {
  const storyName = fn.name ?? name;
  const args = mergeArgs(meta, fn);
  const storyObj: StoryObj = {
    args: fn.args,
    render: fn.render,
    parameters: fn.parameters,
    decorators: fn.decorators,
  };
  return createStoryDef(meta, {
    name: storyName,
    file: rel,
    root,
    meta,
    story: fn as (args?: any, context?: any) => any,
    args,
    parameters: mergeParameters(meta, fn.parameters),
    render: fn.render,
    decorators: mergeDecorators(fn.decorators, meta.decorators),
    width: (fn as any).width,
    height: (fn as any).height,
    settleMs: (fn as any).settleMs,
  });
}

function buildObjectStoryDef(
  meta: Meta,
  rel: string,
  root: string,
  name: string,
  s: StoryEntry,
): StoryDef {
  const storyName = s.name ?? name;
  const args = mergeArgs(meta, s);
  return createStoryDef(meta, {
    name: storyName,
    file: rel,
    root,
    meta,
    story: s as StoryObj,
    args,
    parameters: mergeParameters(meta, s.parameters),
    render: s.render ?? meta.render,
    decorators: mergeDecorators(s.decorators, meta.decorators),
    width: s.width,
    height: s.height,
    settleMs: s.settleMs,
  });
}

function pushStory(
  stories: StoryDef[],
  meta: Meta,
  rel: string,
  projectRoot: string,
  name: string,
  value: unknown,
): void {
  if (typeof value === "function") {
    stories.push(
      buildFunctionStoryDef(meta, rel, projectRoot, name, value as StoryFn),
    );
    return;
  }
  if (value && typeof value === "object") {
    stories.push(
      buildObjectStoryDef(meta, rel, projectRoot, name, value as StoryEntry),
    );
  }
}

function isMeta(meta: unknown): meta is Meta {
  return !!meta && typeof (meta as Meta).title === "string";
}

function collectStories(
  mod: StoryModule,
  meta: Meta,
  rel: string,
  projectRoot: string,
): StoryDef[] {
  const stories: StoryDef[] = [];
  for (const [name, value] of Object.entries(mod)) {
    if (name === "default") continue;
    pushStory(stories, meta, rel, projectRoot, name, value);
  }
  return stories;
}

export function buildStoryDefs(
  mod: StoryModule,
  rel: string,
  projectRoot: string,
): StoryDef[] {
  const meta = mod?.default as Meta | undefined;
  if (!isMeta(meta)) return [];
  return collectStories(mod, meta, rel, projectRoot);
}

function annotateSource(
  def: StoryDef,
  file: string,
  projectRoot: string,
): void {
  try {
    def.source = resolveComponentSource(file, projectRoot) ?? undefined;
  } catch {}
}

async function discoverFile(
  file: string,
  projectRoot: string,
): Promise<StoryDef[]> {
  let mod: StoryModule;
  try {
    mod = (await import(file)) as StoryModule;
  } catch {
    return [];
  }
  const rel = relative(projectRoot, file);
  const defs = buildStoryDefs(mod, rel, projectRoot);
  for (const def of defs) annotateSource(def, file, projectRoot);
  return defs;
}

export async function discover(projectRoot: string): Promise<StoryDef[]> {
  const files = walkTsx(join(projectRoot, "src"));
  const stories: StoryDef[] = [];
  for (const file of files)
    stories.push(...(await discoverFile(file, projectRoot)));
  return stories;
}

function filterDecorators(v: unknown): DecoratorFunction[] {
  if (!Array.isArray(v)) return [];
  return v.filter((d): d is DecoratorFunction => typeof d === "function");
}

export async function loadPreviewDecorators(
  previewModule: string,
): Promise<DecoratorFunction[]> {
  if (!existsSync(previewModule)) return [];
  const mod = (await import(previewModule)) as { decorators?: unknown };
  return filterDecorators(mod.decorators);
}

export function resolvePreviewModule(projectRoot: string): string {
  return join(projectRoot, ".storybook", "main.tsx");
}
