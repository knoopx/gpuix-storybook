import { spawn } from "node:child_process";
import { relative } from "node:path";
import type { StoryDef } from "../index.ts";
import { storyPngPath } from "../render.ts";

const WLCOPY_BIN = process.env.WLCOPY_BIN ?? "wl-copy";

export interface CopyStoryResult {
  ok: boolean;
  error?: string;
}

function sourceLine(story: StoryDef, projectRoot?: string): string {
  if (!story.source) return "unknown";
  const root = story.root ?? projectRoot;
  return root
    ? `${relative(root, story.source.file)}:${story.source.line}`
    : `${story.source.file}:${story.source.line}`;
}

function screenshotLine(story: StoryDef, projectRoot?: string): string {
  const root = story.root ?? projectRoot;
  try {
    const out = storyPngPath(story, projectRoot);
    return root ? relative(root, out) : out;
  } catch {
    return "unknown";
  }
}

export function buildCopyText(story: StoryDef, projectRoot?: string): string {
  const label = (name: string) => (name + ":").padEnd(10);
  return (
    [
      `${label("story")} ${story.meta.title} > ${story.name}`,
      `${label("file")} ${story.file}`,
      `${label("component")} ${story.source?.name ?? "unknown"}`,
      `${label("source")} ${sourceLine(story, projectRoot)}`,
      `${label("screenshot")} ${screenshotLine(story, projectRoot)}`,
    ].join("\n") + "\n"
  );
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function copyStoryToClipboard(
  story: StoryDef,
  projectRoot?: string,
): Promise<CopyStoryResult> {
  const text = buildCopyText(story, projectRoot);
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: CopyStoryResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const child = spawn(WLCOPY_BIN, [], {
      stdio: ["pipe", "ignore", "ignore"],
    });
    child.on("error", (err) => done({ ok: false, error: errMessage(err) }));
    child.on("close", (code) =>
      done(
        code === 0
          ? { ok: true }
          : { ok: false, error: `${WLCOPY_BIN} exited with code ${code}` },
      ),
    );
    child.stdin.end(text);
  });
}
