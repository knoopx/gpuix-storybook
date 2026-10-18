import { defineMeta } from "storybook";
import { ACCENTS, T } from "adwaita-gpuix";
import {
  ACCENT_OPTIONS,
  SCHEME_OPTIONS,
  StoryThemeProvider,
  useStoryTheme,
} from "./StoryTheme.tsx";

function ThemeReadout() {
  const { theme } = useStoryTheme();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "center",
      }}
    >
      <T size="body">scheme: {theme.scheme}</T>
      <T size="body">accent: {theme.accent ?? "default"}</T>
    </div>
  );
}

export default defineMeta({
  title: "Components/StoryTheme",
  component: StoryThemeProvider,
  parameters: { width: 560, height: 300 },
});


export function Overview() {
  return (
    <StoryThemeProvider>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
        }}
      >
        <ThemeReadout />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <T size="caption" weight={700}>
            SCHEME_OPTIONS
          </T>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {SCHEME_OPTIONS.map((s) => (
              <T key={s} size="body">
                {s}
              </T>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <T size="caption" weight={700}>
            ACCENT_OPTIONS
          </T>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {ACCENT_OPTIONS.map((a) => (
              <div
                key={a}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: ACCENTS[a],
                  }}
                />
                <T size="caption">{a}</T>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StoryThemeProvider>
  );
}


export function Default() {
  return (
    <StoryThemeProvider>
      <ThemeReadout />
    </StoryThemeProvider>
  );
}


export function Provider() {
  return (
    <StoryThemeProvider initial={{ scheme: "dark", accent: "purple" }}>
      <ThemeReadout />
    </StoryThemeProvider>
  );
}
