import type { ReactNode } from "react";
import { defineMeta, defineStory, type Args } from "storybook";
import { Button, T } from "adwaita-gpuix";
import { Canvas } from "./Canvas.tsx";
import { StoryThemeProvider } from "./StoryTheme.tsx";




const themeDecorator = (fn: () => ReactNode): ReactNode => (
  <StoryThemeProvider>{fn()}</StoryThemeProvider>
);


const GREETING = defineStory<Args>({
  render: (args?: Args) => (
    <Button
      label={typeof args?.label === "string" ? args.label : "Hello from a story"}
      variant="suggested"
    />
  ),
});


const COMPACT = defineStory<Args>({
  render: () => <T size="body" weight={600}>320×200 canvas</T>,
  parameters: { width: 320, height: 200 },
});


const BOOM = defineStory<Args>({
  render: () => {
    throw new Error("deliberate render failure");
  },
});

export default defineMeta({
  title: "Components/Canvas",
  component: Canvas,
  decorators: [themeDecorator],
  args: { def: GREETING, args: {}, previewDecorators: [] },
  parameters: { width: 640, height: 480 },
});


export function Overview() {
  return <Canvas def={GREETING} args={{}} previewDecorators={[]} />;
}


export function Sized() {
  return <Canvas def={COMPACT} args={{}} previewDecorators={[]} />;
}


export function RenderFailure() {
  return <Canvas def={BOOM} args={{}} previewDecorators={[]} />;
}


export function Empty() {
  return <Canvas def={null} args={{}} previewDecorators={[]} />;
}
