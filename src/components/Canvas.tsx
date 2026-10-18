import { Component, createElement, type ReactNode } from "react";
import { Icon, T, useAdwaita } from "adwaita-gpuix";
import type { DecoratorFunction, Args, StoryObj } from "../csf.ts";
import type { StoryDef } from "../index.ts";
import { storyKey } from "../lib/groups.ts";
import { DEFAULT_W, DEFAULT_H } from "../lib/layout.ts";
import { pick } from "../lib/util.ts";
import { storyThemeDecorator } from "./StoryTheme.tsx";

type AnyDef = StoryObj | StoryDef;

function RenderError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        maxWidth: 480,
        padding: 24,
      }}
    >
      <Icon name="alert" size={28} color="#e5484d" />
      <T size="body" weight={700} color="#e5484d">
        Story failed to render
      </T>
      <T size="caption" color="#9a9a9a">{message}</T>
    </div>
  );
}

function StoryAdapter({
  def,
  args,
  ctx,
}: {
  def: AnyDef;
  args: Args;
  ctx: any;
}) {
  const renderStory = (): ReactNode => {
    if (typeof (def as StoryDef).story === "function")
      return ((def as StoryDef).story as (a?: any, c?: any) => ReactNode)(
        args,
        ctx,
      );
    if (def.render) return def.render(args, ctx);
    const component = (def as StoryDef).meta?.component;
    if (component) return createElement(component as any, args);
    return null;
  };
  try {
    return renderStory();
  } catch (err) {
    return <RenderError error={err} />;
  }
}

function CenterPanel({ children }: { children: ReactNode }) {
  const { colors } = useAdwaita();
  return (
    <div
      style={{
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0,
        minWidth: 0,
        backgroundColor: colors.view_bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

type CanvasFn = (update?: { args?: Args }) => ReactNode;

function applyDecorators(
  fn: CanvasFn,
  decorators: DecoratorFunction[],
  ctx: any,
): CanvasFn {
  let current = fn;
  for (const d of decorators) {
    const node = d(current, ctx);
    current = () => node;
  }
  return current;
}

function canvasWidth(def: AnyDef): number {
  return pick(
    [
      (def as StoryDef).width,
      def.parameters?.width,
      (def as StoryDef).meta?.parameters?.width,
    ],
    DEFAULT_W,
  );
}

function canvasHeight(def: AnyDef): number {
  return pick(
    [
      (def as StoryDef).height,
      def.parameters?.height,
      (def as StoryDef).meta?.parameters?.height,
    ],
    DEFAULT_H,
  );
}

function canvasSize(def: AnyDef): { width: number; height: number } {
  return { width: canvasWidth(def), height: canvasHeight(def) };
}

function sizedBox(def: AnyDef, args: Args, ctx: any): ReactNode {
  const { width, height } = canvasSize(def);
  const baseRender = (a: Record<string, any>): ReactNode =>
    createElement(StoryAdapter, { def, args: a, ctx });
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {baseRender(args)}
    </div>
  );
}

function StoryCanvasInner({
  def,
  args,
  previewDecorators,
}: {
  def: AnyDef;
  args: Args;
  previewDecorators: DecoratorFunction[];
}) {
  const ctx = {
    ...((def as StoryDef).context ?? {}),
    name: def.name,
    args,
    argTypes: (def as StoryObj).argTypes,
  };

  const defDecorators: DecoratorFunction[] = Array.isArray(def.decorators)
    ? def.decorators
    : def.decorators
      ? [def.decorators]
      : [];
  const decorators: DecoratorFunction[] = [
    ...defDecorators,
    storyThemeDecorator,
    ...previewDecorators,
  ];
  const decorated = applyDecorators(
    () => <CenterPanel>{sizedBox(def, args, ctx)}</CenterPanel>,
    decorators,
    ctx,
  );
  return <>{decorated()}</>;
}

class CanvasErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) return <RenderError error={this.state.error} />;
    return this.props.children;
  }
}

function EmptyCanvas() {
  const { colors } = useAdwaita();
  return (
    <CenterPanel>
      <T size="body" color={colors.dim_fg}>
        Select a story to begin
      </T>
    </CenterPanel>
  );
}

export function Canvas({
  def,
  args,
  previewDecorators,
}: {
  def: StoryObj | StoryDef | null;
  args: Args;
  previewDecorators: DecoratorFunction[];
}) {
  return (
    <div
      style={{
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {def ? (
        <CanvasErrorBoundary>
          <StoryCanvasInner
            key={storyKey(def)}
            def={def}
            args={args}
            previewDecorators={previewDecorators}
          />
        </CanvasErrorBoundary>
      ) : (
        <EmptyCanvas />
      )}
    </div>
  );
}
