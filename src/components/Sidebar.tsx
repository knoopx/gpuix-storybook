import type { ReactNode } from "react";
import { Icon, T, useAdwaita } from "adwaita-gpuix";
import type { StoryDef } from "../index.ts";
import { storyKey, type GroupNode, type ItemGroup } from "../lib/groups.ts";
import { SIDEBAR_W } from "../lib/layout.ts";

const ROW_BASE = 12;
const ROW_LEVEL = 16;
const CHEVRON_SLOT = 16;

const itemKey = (it: ItemGroup) => `itm:${it.title}`;

function ChevronSlot({ open, dim }: { open?: boolean; dim: boolean }) {
  const t = useAdwaita();
  const { colors } = t;
  return (
    <div
      style={{
        width: CHEVRON_SLOT,
        flexShrink: 0,
        display: "flex",
        justifyContent: "center",
      }}
    >
      {dim ? null : (
        <Icon
          name={open ? "chevronDown" : "chevronRight"}
          size={13}
          color={colors.dim_fg}
        />
      )}
    </div>
  );
}

function FolderRow({
  label,
  open,
  onToggle,
  paddingLeft,
}: {
  label: string;
  open: boolean;
  onToggle?: () => void;
  paddingLeft: number;
}) {
  const t = useAdwaita();
  const { colors } = t;
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 32,
        paddingLeft,
        paddingRight: 12,
        cursor: onToggle ? "pointer" : undefined,
      }}
    >
      <ChevronSlot open={open} dim={false} />
      <Icon name="folder" size={15} color={colors.fg} />
      <T size="body" weight={600} color={colors.fg} style={{ flexShrink: 0 }}>
        {label}
      </T>
    </div>
  );
}

function ItemRow({
  label,
  open,
  collapsible,
  onToggle,
  paddingLeft,
}: {
  label: string;
  open: boolean;
  collapsible: boolean;
  onToggle: () => void;
  paddingLeft: number;
}) {
  const t = useAdwaita();
  const { colors } = t;
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 28,
        paddingLeft,
        paddingRight: 12,
        cursor: collapsible ? "pointer" : undefined,
      }}
    >
      {collapsible ? (
        <ChevronSlot open={open} dim={false} />
      ) : (
        <ChevronSlot dim />
      )}
      <Icon name="fileText" size={14} color={colors.dim_fg} />
      <T size="body" color={colors.fg} style={{ flexShrink: 0 }}>
        {label}
      </T>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  const t = useAdwaita();
  const { colors } = t;
  return (
    <div
      style={{
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 16,
      }}
    >
      <Icon
        name={filtered ? "search" : "inbox"}
        size={22}
        color={colors.dim_fg}
      />
      <T size="caption" color={colors.dim_fg} style={{ textAlign: "center" }}>
        {filtered
          ? "No stories match your filter"
          : "Library is empty"}
      </T>
    </div>
  );
}

function StoryRow({
  label,
  selected,
  onSelect,
  paddingLeft,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  paddingLeft: number;
}) {
  const t = useAdwaita();
  const { colors, radii } = t;
  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 30,
        marginLeft: 8,
        marginRight: 8,
        paddingLeft,
        paddingRight: 12,
        borderRadius: radii.row,
        backgroundColor: selected ? colors.accent : "transparent",
        cursor: "pointer",
      }}
    >
      <ChevronSlot dim />
      <Icon
        name="bookmark"
        size={14}
        color={selected ? colors.accent_fg : colors.dim_fg}
      />
      <T
        size="body"
        color={selected ? colors.accent_fg : colors.fg}
        style={{ flexShrink: 0 }}
      >
        {label}
      </T>
    </div>
  );
}

export function Sidebar({
  groups,
  selectedId,
  onSelect,
  expanded,
  toggleGroup,
  filtered,
}: {
  groups: GroupNode[];
  selectedId: string | null;
  onSelect: (def: StoryDef) => void;
  expanded: Set<string>;
  toggleGroup: (key: string) => void;
  filtered: GroupNode[] | null;
}) {
  const t = useAdwaita();
  const { colors } = t;

  const storyRow = (s: StoryDef, paddingLeft: number) => (
    <StoryRow
      key={storyKey(s)}
      label={s.name}
      selected={storyKey(s) === selectedId}
      onSelect={() => onSelect(s)}
      paddingLeft={paddingLeft}
    />
  );

  const renderNode = (node: GroupNode, depth: number): ReactNode => {
    const isRoot = depth === 0;
    const open = isRoot || expanded.has(node.key);
    const folderPad = ROW_BASE + ROW_LEVEL * depth;
    const itemPad = ROW_BASE + ROW_LEVEL * (depth + 1);
    const storyPad = ROW_BASE + ROW_LEVEL * (depth + 2);
    return (
      <div key={node.key}>
        <FolderRow
          label={node.label}
          open={open}
          onToggle={isRoot ? undefined : () => toggleGroup(node.key)}
          paddingLeft={folderPad}
        />
        {open ? (
          <>
            {node.children.map((c) => renderNode(c, depth + 1))}
            {node.items.map((it) => {
              const ik = itemKey(it);
              const itemOpen = expanded.has(ik);
              const collapsible = it.stories.length > 0;
              return (
                <div key={it.title}>
                  <ItemRow
                    label={it.label}
                    open={itemOpen}
                    collapsible={collapsible}
                    onToggle={() => toggleGroup(ik)}
                    paddingLeft={itemPad}
                  />
                  {itemOpen
                    ? it.stories.map((s) => storyRow(s, storyPad))
                    : null}
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div
      style={{
        width: SIDEBAR_W,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.sidebar_bg,
        borderRightWidth: 1,
        borderColor: colors.border,
      }}
    >
      {}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 16,
          paddingRight: 12,
          paddingTop: 12,
          height: 30,
        }}
      >
        <T size="caption" weight={700} color={colors.dim_fg}>
          LIBRARY
        </T>
      </div>

      {}
      <div
        style={{
          flexGrow: 1,
          flexShrink: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflowY: "scroll",
          overflowX: "hidden",
        }}
      >
        {(filtered ?? groups).length === 0 ? (
          <EmptyState filtered={filtered !== null} />
        ) : (
          (filtered ?? groups).map((g) => renderNode(g, 0))
        )}
      </div>
    </div>
  );
}
