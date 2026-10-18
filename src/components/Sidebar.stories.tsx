import { defineMeta, type StoryDef } from "storybook";
import { Sidebar } from "./Sidebar.tsx";
import { buildGroups, filterGroups, storyKey } from "../lib/groups.ts";
import { makeStoryDef } from "../lib/storyDef.ts";

const FILE = "src/components/Sidebar.stories.tsx";

const STORIES: StoryDef[] = [
  makeStoryDef("Default", "Components/Button", FILE),
  makeStoryDef("Disabled", "Components/Button", FILE),
  makeStoryDef("Basic", "Components/Alert", FILE),
  makeStoryDef("Greeting", "Components/Greeting", FILE),
];

const GROUPS = buildGroups(STORIES);
const SELECTED = storyKey(STORIES[0]);

function allExpandedKeys(): Set<string> {
  const keys = new Set<string>();
  const walk = (n: (typeof GROUPS)[number]): void => {
    keys.add(n.key);
    for (const it of n.items) keys.add(`itm:${it.title}`);
    for (const c of n.children) walk(c);
  };
  for (const g of GROUPS) walk(g);
  return keys;
}

const noopSelect = (_def: StoryDef): void => {};
const noopToggle = (_key: string): void => {};

export default defineMeta({
  title: "Components/Sidebar",
  component: Sidebar,
  args: {
    groups: GROUPS,
    selectedId: SELECTED,
    onSelect: noopSelect,
    expanded: allExpandedKeys(),
    toggleGroup: noopToggle,
    filtered: null,
  },
  parameters: { width: 300, height: 480 },
});


export function Overview() {
  return (
    <Sidebar
      groups={GROUPS}
      selectedId={SELECTED}
      onSelect={noopSelect}
      expanded={allExpandedKeys()}
      toggleGroup={noopToggle}
      filtered={null}
    />
  );
}


export function Collapsed() {
  return (
    <Sidebar
      groups={GROUPS}
      selectedId={null}
      onSelect={noopSelect}
      expanded={new Set()}
      toggleGroup={noopToggle}
      filtered={null}
    />
  );
}


export function Filtered() {
  return (
    <Sidebar
      groups={GROUPS}
      selectedId={SELECTED}
      onSelect={noopSelect}
      expanded={allExpandedKeys()}
      toggleGroup={noopToggle}
      filtered={filterGroups(GROUPS, "button")}
    />
  );
}


export function EmptyLibrary() {
  return (
    <Sidebar
      groups={[]}
      selectedId={null}
      onSelect={noopSelect}
      expanded={new Set()}
      toggleGroup={noopToggle}
      filtered={null}
    />
  );
}


export function FilteredEmpty() {
  return (
    <Sidebar
      groups={GROUPS}
      selectedId={null}
      onSelect={noopSelect}
      expanded={new Set()}
      toggleGroup={noopToggle}
      filtered={filterGroups(GROUPS, "zzz-no-match")}
    />
  );
}
