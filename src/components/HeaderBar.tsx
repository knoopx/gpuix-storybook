import {
  Icon,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  useAdwaita,
  type IconName,
} from "adwaita-gpuix";
import { HEADER_H, SIDEBAR_W } from "../lib/layout.ts";
import { ThemeSwitcher } from "./ThemeSwitcher.tsx";

function ToolBtn({
  name,
  color,
  onClick,
}: {
  name: IconName;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      <Icon name={name} size={16} color={color} />
    </div>
  );
}

export function HeaderBar({
  search,
  setSearch,
  onCopy,
}: {
  search: string;
  setSearch: (s: string) => void;
  onCopy?: () => void;
}) {
  const t = useAdwaita();
  const { colors } = t;
  return (
    <div
      style={{
        height: HEADER_H,
        flexShrink: 0,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: colors.headerbar_bg,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <div style={{ width: SIDEBAR_W - 24, flexShrink: 0 }}>
        <InputGroup>
          <InputGroupAddon style={{ paddingLeft: 12 }}>
            <Icon name="search" size={12} color={colors.dim_fg} />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={setSearch}
            type="search"
            style={{ minHeight: 26, padding: 4 }}
          />
        </InputGroup>
      </div>
      <div style={{ flexGrow: 1, flexShrink: 1 }} />
      <ThemeSwitcher />
      <ToolBtn name="copy" color={colors.dim_fg} onClick={onCopy} />
    </div>
  );
}
