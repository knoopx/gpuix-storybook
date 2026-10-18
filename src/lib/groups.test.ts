import { describe, expect, test } from "vitest";
import type { StoryDef } from "../index.ts";
import { makeStoryDef } from "./storyDef.ts";
import { buildGroups, filterGroups, type GroupNode } from "./groups.ts";

const stories: StoryDef[] = [
  makeStoryDef(
    "variants",
    "Adwaita/Button",
    "src/stories/Adwaita/Button.stories.tsx",
  ),
  makeStoryDef("sizes", "Adwaita/Button", "src/stories/Adwaita/Button.stories.tsx"),
  makeStoryDef("basic", "Adwaita/Alert", "src/stories/Adwaita/Alert.stories.tsx"),
  makeStoryDef("empty", "Vcs/Branch", "src/stories/Vcs/Branch.stories.tsx"),
  makeStoryDef(
    "deep",
    "Adwaita/Form/Field/Label",
    "src/stories/Adwaita/Form/Field/Label.stories.tsx",
  ),
];

const groups = buildGroups(stories);

function titles(g: GroupNode[]): string[] {
  const walk = (n: GroupNode): string[] =>
    n.items
      .flatMap((it) => it.stories.map((s) => s.name))
      .concat(n.children.flatMap(walk));
  return g.flatMap(walk);
}

function childKeys(n: GroupNode): string[] {
  return n.children.map((c) => c.key);
}

function itemTitles(n: GroupNode): string[] {
  return n.items.map((it) => it.title);
}

function expectButtonOnly(out: GroupNode[], storyTitles: string[]): void {
  expect(out.map((g) => g.key)).toEqual(["Adwaita"]);
  expect(itemTitles(out[0])).toEqual(["Adwaita/Button"]);
  expect(out[0].children).toEqual([]);
  expect(titles(out).sort()).toEqual(storyTitles);
}

describe("buildGroups", () => {
  test("groups by section key and item title", () => {
    expect(groups.map((g) => g.key)).toEqual(["Adwaita", "Vcs"]);

    expect(itemTitles(groups[0])).toEqual(["Adwaita/Alert", "Adwaita/Button"]);

    expect(childKeys(groups[0])).toEqual(["Adwaita/Form"]);
  });

  test("nested titles nest recursively by all '/' segments", () => {
    const form = groups[0].children.find((c) => c.key === "Adwaita/Form");
    expect(form?.label).toBe("Form");
    expect(form?.items).toEqual([]);
    const field = form?.children.find((c) => c.key === "Adwaita/Form/Field");
    expect(field?.label).toBe("Field");
    expect(field?.children).toEqual([]);
    expect(field?.items).toEqual([
      {
        title: "Adwaita/Form/Field/Label",
        label: "Label",
        stories: [stories[4]],
      },
    ]);
  });

  test("leaf nodes carry stories under their item", () => {
    const button = groups[0].items.find((it) => it.title === "Adwaita/Button");
    expect(button).toEqual({
      title: "Adwaita/Button",
      label: "Button",
      stories: [stories[0], stories[1]],
    });

    expect(childKeys(groups[0])).toEqual(["Adwaita/Form"]);
  });

  test("nodes and items are sorted by label", () => {
    expect(groups.map((g) => g.key)).toEqual(["Adwaita", "Vcs"]);
    expect(groups[0].items.map((it) => it.label)).toEqual(["Alert", "Button"]);
    expect(childKeys(groups[0])).toEqual(["Adwaita/Form"]);
    expect(groups[1].items.map((it) => it.label)).toEqual(["Branch"]);
  });
});

describe("filterGroups", () => {
  test("empty query returns groups unchanged", () => {
    expect(filterGroups(groups, "")).toBe(groups);
    expect(filterGroups(groups, "   ")).toBe(groups);
  });

  test("section match keeps the whole section", () => {
    const out = filterGroups(groups, "adwaita");
    expect(out.map((g) => g.key)).toEqual(["Adwaita"]);
    expect(titles(out).sort()).toEqual(["basic", "deep", "sizes", "variants"]);
  });

  test("item label match keeps all stories in the item", () => {
    expectButtonOnly(filterGroups(groups, "button"), ["sizes", "variants"]);
  });

  test("story name match keeps only that story", () => {
    const out = filterGroups(groups, "basic");
    expect(titles(out)).toEqual(["basic"]);
    expect(itemTitles(out[0])).toEqual(["Adwaita/Alert"]);
    expect(out[0].children).toEqual([]);
  });

  test("file match keeps stories from that file", () => {
    const out = filterGroups(groups, "Alert.stories");
    expect(titles(out)).toEqual(["basic"]);
  });

  test("matching is case-insensitive", () => {
    expect(filterGroups(groups, "VCS").map((g) => g.key)).toEqual(["Vcs"]);
    expect(titles(filterGroups(groups, "SIZES"))).toEqual(["sizes"]);
  });

  test("no match returns empty groups", () => {
    expect(filterGroups(groups, "zzz")).toEqual([]);
  });

  test("story match prunes sibling items that do not match", () => {
    expectButtonOnly(filterGroups(groups, "sizes"), ["sizes"]);
  });

  test("nested segment match keeps the whole nested subtree", () => {
    const out = filterGroups(groups, "field");
    expect(out.map((g) => g.key)).toEqual(["Adwaita"]);
    expect(childKeys(out[0])).toEqual(["Adwaita/Form"]);
    expect(childKeys(out[0].children[0])).toEqual(["Adwaita/Form/Field"]);
    expect(titles(out)).toEqual(["deep"]);
  });
});
