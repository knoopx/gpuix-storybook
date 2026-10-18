import { defineMeta } from "storybook";
import { ThemeSwitcher } from "./ThemeSwitcher.tsx";
import { StoryThemeProvider } from "./StoryTheme.tsx";

export default defineMeta({
  title: "Components/ThemeSwitcher",
  component: ThemeSwitcher,
  parameters: { width: 560, height: 280 },
});


export function Overview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <StoryThemeProvider>
        <ThemeSwitcher />
      </StoryThemeProvider>
      <StoryThemeProvider initial={{ scheme: "dark", accent: "teal" }}>
        <ThemeSwitcher />
      </StoryThemeProvider>
      <StoryThemeProvider initial={{ scheme: "light", accent: "red" }}>
        <ThemeSwitcher />
      </StoryThemeProvider>
    </div>
  );
}


export function Default() {
  return (
    <StoryThemeProvider>
      <ThemeSwitcher />
    </StoryThemeProvider>
  );
}


export function TealAccent() {
  return (
    <StoryThemeProvider initial={{ scheme: "dark", accent: "teal" }}>
      <ThemeSwitcher />
    </StoryThemeProvider>
  );
}
