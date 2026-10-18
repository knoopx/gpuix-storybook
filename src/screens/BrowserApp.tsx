import { useMemo, useRef, useState } from "react";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@gpuix/react";
import {
  AdwaitaProvider,
  useAdwaita,
  ToastProvider,
  useToast,
} from "adwaita-gpuix";
import type { DecoratorFunction, Args } from "../csf.ts";
import type { StoryDef } from "../index.ts";
import {
  discover,
  loadPreviewDecorators,
  resolvePreviewModule,
} from "../lib/discover.ts";
import { copyStoryToClipboard } from "../lib/clipboard.ts";
import { cloneArgs } from "../lib/args.ts";
import { buildGroups, filterGroups, storyKey } from "../lib/groups.ts";
import { HeaderBar } from "../components/HeaderBar.tsx";
import { Sidebar } from "../components/Sidebar.tsx";
import { Canvas } from "../components/Canvas.tsx";
import { PropertyPane } from "../components/PropertyPane.tsx";
import { StoryThemeProvider } from "../components/StoryTheme.tsx";

function canonicalPath(p: string): string {
  try {
    return realpathSync(resolve(p));
  } catch {
    return resolve(p);
  }
}

function initialSelectedId(stories: StoryDef[]): string | null {
  return stories[0] ? storyKey(stories[0]) : null;
}

function initialArgs(stories: StoryDef[]): Args {
  return cloneArgs(stories[0]?.args ?? {});
}

function toggled(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function previewDecoratorsFor(
  selected: StoryDef | null,
  byRoot: Map<string, DecoratorFunction[]>,
): DecoratorFunction[] {
  return selected ? (byRoot.get(selected.root) ?? []) : [];
}

function copyErrorMessage(err: unknown): string {
  return `Copy failed: ${err instanceof Error ? err.message : String(err)}`;
}

function BrowserLayout({
  colors,
  search,
  setSearch,
  onCopy,
  groups,
  filtered,
  expanded,
  toggleGroup,
  select,
  selectedId,
  selected,
  args,
  changeArg,
  previewDecorators,
}: {
  colors: ReturnType<typeof useAdwaita>["colors"];
  search: string;
  setSearch: (s: string) => void;
  onCopy: () => void;
  groups: ReturnType<typeof buildGroups>;
  filtered: ReturnType<typeof filterGroups> | null;
  expanded: Set<string>;
  toggleGroup: (key: string) => void;
  select: (def: StoryDef) => void;
  selectedId: string | null;
  selected: StoryDef | null;
  args: Args;
  changeArg: (key: string, value: unknown) => void;
  previewDecorators: DecoratorFunction[];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: colors.window_bg,
      }}
    >
      <HeaderBar search={search} setSearch={setSearch} onCopy={onCopy} />
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexGrow: 1,
          flexShrink: 1,
          minHeight: 0,
        }}
      >
        <Sidebar
          groups={groups}
          selectedId={selectedId}
          onSelect={select}
          expanded={expanded}
          toggleGroup={toggleGroup}
          filtered={filtered}
        />
        <div
          style={{
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Canvas
            def={selected}
            args={args}
            previewDecorators={previewDecorators}
          />
          {selected && Object.keys(args).length > 0 && (
            <PropertyPane def={selected} args={args} onChangeArg={changeArg} />
          )}
        </div>
      </div>
    </div>
  );
}

export function BrowserApp({
  stories,
  previewDecoratorsByRoot,
  projectRoot,
}: {
  stories: StoryDef[];
  previewDecoratorsByRoot: Map<string, DecoratorFunction[]>;
  projectRoot: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialSelectedId(stories),
  );
  const [args, setArgs] = useState<Args>(() => initialArgs(stories));
  const [search, setSearch] = useState("");
  const copyBusy = useRef(false);
  const toast = useToast();

  const groups = useMemo(() => buildGroups(stories), [stories]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const { colors } = useAdwaita();
  const selected = useMemo(
    () => stories.find((s) => storyKey(s) === selectedId) ?? null,
    [stories, selectedId],
  );

  const filtered = useMemo(
    () => (search.trim() ? filterGroups(groups, search) : null),
    [groups, search],
  );

  const select = (def: StoryDef) => {
    setSelectedId(storyKey(def));
    setArgs(cloneArgs(def.args));
  };

  const changeArg = (key: string, value: unknown) => {
    setArgs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleGroup = (key: string) => {
    setExpanded((prev) => toggled(prev, key));
  };

  const handleCopy = async () => {
    if (copyBusy.current) return;
    if (!selected) {
      toast("No story selected", { type: "warning" });
      return;
    }
    copyBusy.current = true;
    try {
      const res = await copyStoryToClipboard(selected, projectRoot);
      if (res.ok) {
        toast("Copied to clipboard", { type: "success" });
      } else {
        toast(`Copy failed: ${res.error}`, { type: "error" });
      }
    } catch (err) {
      toast(copyErrorMessage(err), { type: "error" });
    } finally {
      copyBusy.current = false;
    }
  };

  return (
    <BrowserLayout
      colors={colors}
      search={search}
      setSearch={setSearch}
      onCopy={handleCopy}
      groups={groups}
      filtered={filtered}
      expanded={expanded}
      toggleGroup={toggleGroup}
      select={select}
      selectedId={selectedId}
      selected={selected}
      args={args}
      changeArg={changeArg}
      previewDecorators={previewDecoratorsFor(
        selected,
        previewDecoratorsByRoot,
      )}
    />
  );
}

export async function launchBrowser(projectRoot: string): Promise<void> {
  const root = canonicalPath(projectRoot);

  const previewDecoratorsByRoot = new Map<string, DecoratorFunction[]>();
  const stories = await discover(root);
  previewDecoratorsByRoot.set(
    root,
    await loadPreviewDecorators(resolvePreviewModule(root)),
  );

  console.log(
    `storybook browser: ${stories.length} stories → ${projectRoot}`,
  );
  render(
    <AdwaitaProvider scheme="nightsky">
      <ToastProvider>
        <StoryThemeProvider>
          <BrowserApp
            stories={stories}
            previewDecoratorsByRoot={previewDecoratorsByRoot}
            projectRoot={projectRoot}
          />
        </StoryThemeProvider>
      </ToastProvider>
    </AdwaitaProvider>,
    { title: "storybook", width: 1440, height: 900 },
  );
}
