import type { ReactNode } from "react";
import { defineMeta } from "storybook";
import { HeaderBar } from "./HeaderBar.tsx";
import { StoryThemeProvider } from "./StoryTheme.tsx";
import { SIDEBAR_W } from "../lib/layout.ts";




const themeDecorator = (fn: () => ReactNode): ReactNode => (
  <StoryThemeProvider>{fn()}</StoryThemeProvider>
);

const noopSet = (_s: string): void => {};
const noopCopy = (): void => {};

export default defineMeta({
  title: "Components/HeaderBar",
  component: HeaderBar,
  decorators: [themeDecorator],
  args: { search: "", setSearch: noopSet, onCopy: noopCopy },
  parameters: { width: SIDEBAR_W + 420, height: 120 },
});


export function Overview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <HeaderBar search="" setSearch={noopSet} onCopy={noopCopy} />
      <HeaderBar search="accordion" setSearch={noopSet} onCopy={noopCopy} />
    </div>
  );
}


export function Default() {
  return <HeaderBar search="" setSearch={noopSet} onCopy={noopCopy} />;
}


export function WithQuery() {
  return <HeaderBar search="accordion" setSearch={noopSet} onCopy={noopCopy} />;
}
