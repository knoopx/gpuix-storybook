import { describe, expect, test } from "vitest";
import type { StoryDef } from "../index.ts";
import { makeStoryDef } from "./storyDef.ts";
import { buildCopyText } from "./clipboard.ts";

const root = "/proj";
const FILE = "src/stories/Adwaita/Button.stories.tsx";

function def(name: string, title: string): StoryDef {
  return makeStoryDef(name, title, FILE, root);
}

describe("buildCopyText", () => {
  test("includes a root-relative screenshot path", () => {
    const s = def("basic", "Adwaita/Button");
    const lines = buildCopyText(s, root).trim().split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[4]).toBe(
      "screenshot: src/stories/Adwaita/Adwaita/Button/basic.png",
    );
  });

  test("resolves the screenshot path from projectRoot when the story root is missing", () => {
    const s = def("basic", "Adwaita/Button");
    const s2 = { ...s, root: undefined } as unknown as StoryDef;
    const lines = buildCopyText(s2, root).trim().split("\n");
    expect(lines[4]).toBe(
      "screenshot: src/stories/Adwaita/Adwaita/Button/basic.png",
    );
  });

  test("reports unknown when no root is available", () => {
    const s = def("basic", "Adwaita/Button");
    const s2 = { ...s, root: undefined } as unknown as StoryDef;
    const lines = buildCopyText(s2).trim().split("\n");
    expect(lines[4]).toBe("screenshot: unknown");
  });

  test("keeps the existing lines", () => {
    const s = def("basic", "Adwaita/Button");
    const lines = buildCopyText(s, root).trim().split("\n");
    expect(lines[0]).toBe("story:     Adwaita/Button > basic");
    expect(lines[1]).toBe("file:      src/stories/Adwaita/Button.stories.tsx");
    expect(lines[2]).toBe("component: unknown");
    expect(lines[3]).toBe("source:    unknown");
  });
});
