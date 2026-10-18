import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  ACCENTS,
  useAdwaita,
  T,
  Icon,
  type ColorScheme,
  type AccentKey,
} from "adwaita-gpuix";
import { SelectItem as SelectItemPrimitive } from "@gpuix/react/select";
import {
  useStoryTheme,
  SCHEME_OPTIONS,
  ACCENT_OPTIONS,
} from "./StoryTheme.tsx";

const SCHEME_ITEMS = SCHEME_OPTIONS.map((s) => ({ value: s, label: s }));

const ACCENT_ITEMS: { value: string; text: string; color?: string }[] = [
  { value: "default", text: "default" },
  ...ACCENT_OPTIONS.map((a) => ({ value: a, text: a, color: ACCENTS[a] })),
];

function Swatch({ color }: { color?: string }) {
  const { colors } = useAdwaita();
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        flexShrink: 0,
        backgroundColor: color ?? "transparent",
        borderWidth: color ? 0 : 1,
        borderColor: colors.border,
      }}
    />
  );
}

function AccentLabel({ text, color }: { text: string; color?: string }) {
  const { colors } = useAdwaita();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Swatch color={color} />
      <T size="body" color={colors.fg}>
        {text}
      </T>
    </div>
  );
}

function AccentItem({
  value,
  text,
  color,
}: {
  value: string;
  text: string;
  color?: string;
}) {
  const { colors } = useAdwaita();
  return (
    <SelectItemPrimitive
      value={value}
      style={({ selected, highlighted }) => ({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: 8,
        cursor: "pointer",
        backgroundColor:
          selected || highlighted ? colors.accentTint : "transparent",
      })}
    >
      {({ selected }) => (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexGrow: 1,
            }}
          >
            <Swatch color={color} />
            <T size="body" color={colors.fg}>
              {text}
            </T>
          </div>
          {selected ? (
            <Icon name="success" size={12} color={colors.accent} />
          ) : null}
        </>
      )}
    </SelectItemPrimitive>
  );
}

export function ThemeSwitcher() {
  const { theme, setScheme, setAccent } = useStoryTheme();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Select
        items={SCHEME_ITEMS}
        value={theme.scheme}
        onValueChange={(v) => setScheme(v as ColorScheme)}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCHEME_ITEMS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={ACCENT_ITEMS.map((a) => ({
          value: a.value,
          label: <AccentLabel text={a.text} color={a.color} />,
        }))}
        value={theme.accent ?? "default"}
        onValueChange={(v) =>
          setAccent(v === "default" ? null : (v as AccentKey))
        }
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACCENT_ITEMS.map((a) => (
            <AccentItem
              key={a.value}
              value={a.value}
              text={a.text}
              color={a.color}
            />
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
