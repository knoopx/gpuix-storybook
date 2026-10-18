import type { StoryDef } from "../index.ts";
import type { StoryObj } from "../csf.ts";

export function storyKey(s: StoryObj | StoryDef): string {
  return `${(s as StoryDef).context?.id ?? (s as StoryObj).name}::${
    (s as StoryDef).file ?? ""
  }`;
}

export interface ItemGroup {
  title: string;
  label: string;
  stories: StoryDef[];
}

export interface GroupNode {
  key: string;
  label: string;
  items: ItemGroup[];
  children: GroupNode[];
}

interface BuildNode {
  node: GroupNode;
  children: Map<string, BuildNode>;
}

const GENERIC_DIR_SEGMENTS = new Set(["src", "stories", "components"]);

function subcategoryOf(file: string, group: string): string | null {
  const dirSegs = file.split("/").slice(0, -1);
  for (const seg of dirSegs) {
    if (GENERIC_DIR_SEGMENTS.has(seg.toLowerCase())) continue;
    if (seg.toLowerCase() === group.toLowerCase()) return null;
    return seg;
  }
  return null;
}

function sortItems(items: ItemGroup[]): void {
  items.sort((a, b) => a.label.localeCompare(b.label));
}

function itemLabel(title: string): string {
  const segs = title.split("/");
  return segs[segs.length - 1] ?? title;
}

function findOrCreateChild(
  parent: BuildNode,
  pathKey: string,
  seg: string,
): BuildNode {
  let b = parent.children.get(pathKey);
  if (!b) {
    b = {
      node: { key: pathKey, label: seg, items: [], children: [] },
      children: new Map(),
    };
    parent.children.set(pathKey, b);
  }
  return b;
}

function nodeSegments(s: StoryDef): string[] {
  const title = s.meta.title ?? "Unknown";
  let segs = title.split("/").filter(Boolean);
  if (segs.length === 0) segs = ["Unknown"];
  const sub = segs.length > 1 ? subcategoryOf(s.file, segs[0]) : null;
  return sub ? [segs[0], sub, ...segs.slice(1, -1)] : segs.slice(0, -1);
}

function attachStory(root: BuildNode, s: StoryDef): void {
  const title = s.meta.title ?? "Unknown";
  let cur = root;
  let pathKey = "";
  for (const seg of nodeSegments(s)) {
    pathKey = pathKey ? `${pathKey}/${seg}` : seg;
    cur = findOrCreateChild(cur, pathKey, seg);
  }
  let item = cur.node.items.find((it) => it.title === title);
  if (!item) {
    item = { title, label: itemLabel(title), stories: [] };
    cur.node.items.push(item);
  }
  item.stories.push(s);
}

function finalizeTree(children: Map<string, BuildNode>): GroupNode[] {
  return [...children.values()]
    .map((b) => {
      b.node.children = finalizeTree(b.children);
      sortItems(b.node.items);
      return b.node;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildGroups(stories: StoryDef[]): GroupNode[] {
  const rootNode: BuildNode = {
    node: { key: "", label: "", items: [], children: [] },
    children: new Map(),
  };
  for (const s of stories) attachStory(rootNode, s);
  return finalizeTree(rootNode.children);
}

function filterNode(node: GroupNode, q: string): GroupNode | null {
  if (node.key.toLowerCase().includes(q)) return node;
  const children: GroupNode[] = [];
  for (const c of node.children) {
    const f = filterNode(c, q);
    if (f) children.push(f);
  }
  const items = node.items
    .map((it) => ({
      ...it,
      stories: it.stories.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.file ?? "").toLowerCase().includes(q),
      ),
    }))
    .filter((it) => it.stories.length > 0);
  if (children.length === 0 && items.length === 0) return null;
  return { ...node, items, children };
}

export function filterGroups(groups: GroupNode[], query: string): GroupNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  const out: GroupNode[] = [];
  for (const g of groups) {
    const f = filterNode(g, q);
    if (f) out.push(f);
  }
  return out;
}
