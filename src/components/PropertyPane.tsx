import { useState } from "react";
import {
  Button,
  Checkbox,
  ColorPicker,
  Input,
  JsonView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  T,
  useAdwaita,
} from "adwaita-gpuix";
import type { Args, InputType, StoryObj } from "../csf.ts";
import type { StoryDef } from "../index.ts";
import { isHexColor } from "../lib/args.ts";
import { PROPERTY_PANE_H } from "../lib/layout.ts";

function stringifyValue(value: object): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function previewValue(value: unknown): string {
  if (typeof value === "function")
    return `function ${value.name || "anonymous"}`;
  if (typeof value === "object") return stringifyValue(value as object);
  return String(value);
}

function objectOptions(property: InputType): readonly unknown[] | undefined {
  const c = property.control;
  if (!c || typeof c !== "object") return undefined;
  return c.options;
}

function argOptions(property?: InputType): readonly unknown[] | undefined {
  if (!property) return undefined;
  if (property.options) return property.options;
  return objectOptions(property);
}

function PropertyValue({
  name,
  value,
  onChange,
  property,
}: {
  name: string;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  property?: InputType;
}) {
  const options = argOptions(property);
  const selectOptions = usableSelectOptions(options, value);
  if (selectOptions)
    return (
      <SelectProperty
        name={name}
        value={value}
        options={selectOptions}
        onChange={onChange}
      />
    );
  return renderScalarProperty(name, value, onChange);
}

function isCustomOption(options: readonly unknown[], value: unknown): boolean {
  return typeof value === "string" && !options.includes(value);
}

function usableSelectOptions(
  options: readonly unknown[] | undefined,
  value: unknown,
): readonly unknown[] | undefined {
  if (!options || options.length === 0) return undefined;
  if (isCustomOption(options, value)) return undefined;
  return options;
}

function renderTextProperty(
  name: string,
  value: string,
  onChange: (key: string, value: unknown) => void,
) {
  return isHexColor(value) ? (
    <ColorPicker
      value={value}
      onChange={(s) => onChange(name, s)}
      style={{ maxWidth: 240 }}
    />
  ) : (
    <StringProperty name={name} value={value} onChange={onChange} />
  );
}

function renderScalarProperty(
  name: string,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
) {
  if (typeof value === "boolean")
    return (
      <Checkbox checked={value} onCheckedChange={(c) => onChange(name, c)} />
    );
  if (typeof value === "number")
    return <NumberProperty name={name} value={value} onChange={onChange} />;
  if (typeof value === "string")
    return renderTextProperty(name, value, onChange);
  if (typeof value === "object" && value !== null)
    return <JsonView src={value} name={name} collapsed={0} />;
  return <StaticPreview value={value} />;
}

function SelectProperty({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: unknown;
  options: readonly unknown[];
  onChange: (key: string, value: unknown) => void;
}) {
  const items = options.map((o) => ({ value: String(o), label: String(o) }));
  return (
    <Select
      items={items}
      value={typeof value === "string" ? value : undefined}
      onValueChange={(v) => onChange(name, v)}
      style={{ width: 240 }}
    >
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value}>
            {it.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NumberProperty({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <Input
      value={String(value)}
      type="number"
      onChange={(s) => {
        const n = Number(s);
        onChange(name, Number.isNaN(n) ? value : n);
      }}
      style={{ padding: 7, width: 220 }}
    />
  );
}

function StringProperty({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <Input
      value={value}
      onChange={(s) => onChange(name, s)}
      style={{ padding: 7, width: 260 }}
    />
  );
}

function StaticPreview({ value }: { value: unknown }) {
  const { colors } = useAdwaita();
  return (
    <T size="caption" color={colors.dim_fg} style={{ flexShrink: 0 }}>
      {previewValue(value)}
    </T>
  );
}

function ArgRow({
  name,
  value,
  property,
  isLast,
  onChange,
}: {
  name: string;
  value: unknown;
  property?: InputType;
  isLast: boolean;
  onChange: (key: string, value: unknown) => void;
}) {
  const { colors } = useAdwaita();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        minHeight: 40,
        paddingLeft: 16,
        paddingRight: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <T size="body" color={colors.fg} style={{ width: 220, flexShrink: 0 }}>
        {name}
      </T>
      <div
        style={{
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <PropertyValue
          name={name}
          value={value}
          onChange={onChange}
          property={property}
        />
      </div>
    </div>
  );
}

function ArgsEmptyState({ hasDef }: { hasDef: boolean }) {
  const { colors } = useAdwaita();
  return (
    <div
      style={{
        flexGrow: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <T size="body" color={colors.dim_fg}>
        {hasDef
          ? "This story has no args"
          : "Select a story to see its properties"}
      </T>
    </div>
  );
}

export function PropertyPane({
  def,
  args,
  onChangeArg,
}: {
  def: StoryObj | StoryDef | null;
  args: Args;
  onChangeArg: (key: string, value: unknown) => void;
}) {
  const { colors } = useAdwaita();
  const [collapsed, setCollapsed] = useState(false);

  const argEntries = def ? Object.entries(args) : [];
  const argTypes: Record<string, InputType> = def
    ? (((def as StoryDef).context?.argTypes ??
      (def as StoryObj).argTypes ??
      {}) as Record<string, InputType>)
    : {};

  return (
    <div
      style={{
        height: collapsed ? 37 : PROPERTY_PANE_H,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.headerbar_bg,
        borderTopWidth: 1,
        borderColor: colors.border,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          height: 36,
          flexShrink: 0,
          paddingLeft: 16,
          paddingRight: 16,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <T
          size="caption"
          weight={700}
          color={colors.dim_fg}
          style={{ width: 220, flexShrink: 0 }}
        >
          Property
        </T>
        <T
          size="caption"
          weight={700}
          color={colors.dim_fg}
          style={{ flexGrow: 1, flexShrink: 1 }}
        >
          Value
        </T>
        <Button
          variant="icon"
          size="sm"
          icon={collapsed ? "chevronUp" : "chevronDown"}
          onClick={() => setCollapsed((c) => !c)}
        />
      </div>

      {!collapsed && (
        <div
          style={{
            flexGrow: 1,
            flexShrink: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {argEntries.length === 0 ? (
            <ArgsEmptyState hasDef={!!def} />
          ) : (
            <div
              style={{
                flexGrow: 1,
                flexShrink: 1,
                minHeight: 0,
                overflowY: "scroll",
                overflowX: "hidden",
              }}
            >
              {argEntries.map(([name, value], i) => (
                <ArgRow
                  key={name}
                  name={name}
                  value={value}
                  property={argTypes[name]}
                  isLast={i === argEntries.length - 1}
                  onChange={onChangeArg}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
