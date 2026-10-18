import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AdwaitaProvider,
  SCHEMES,
  ACCENTS,
  type ColorScheme,
  type AccentKey,
} from "adwaita-gpuix";
import type { DecoratorFunction } from "../csf.ts";

export interface StoryTheme {
  scheme: ColorScheme;
  accent: AccentKey | null;
}

interface StoryThemeContextValue {
  theme: StoryTheme;
  setScheme: (s: ColorScheme) => void;
  setAccent: (a: AccentKey | null) => void;
}

const StoryThemeContext = createContext<StoryThemeContextValue | null>(null);

export function StoryThemeProvider({
  initial = { scheme: "nightsky", accent: null },
  children,
}: {
  initial?: StoryTheme;
  children: ReactNode;
}) {
  const [scheme, setScheme] = useState<ColorScheme>(initial.scheme);
  const [accent, setAccent] = useState<AccentKey | null>(initial.accent);

  const value = useMemo<StoryThemeContextValue>(
    () => ({
      theme: { scheme, accent },
      setScheme,
      setAccent,
    }),
    [scheme, accent],
  );

  return (
    <StoryThemeContext.Provider value={value}>
      {children}
    </StoryThemeContext.Provider>
  );
}

export function useStoryTheme(): StoryThemeContextValue {
  const ctx = useContext(StoryThemeContext);
  if (!ctx)
    throw new Error(
      "useStoryTheme() must be used within a <StoryThemeProvider>",
    );
  return ctx;
}

function StoryThemeDecorator({ children }: { children: ReactNode }) {
  const { theme } = useStoryTheme();
  return (
    <AdwaitaProvider scheme={theme.scheme} accent={theme.accent}>
      {children}
    </AdwaitaProvider>
  );
}

export function storyThemeDecorator(
  fn: () => ReactNode,
  _ctx?: unknown,
): ReactNode {
  return <StoryThemeDecorator>{fn()}</StoryThemeDecorator>;
}

export const SCHEME_OPTIONS = SCHEMES as ColorScheme[];
export const ACCENT_OPTIONS = Object.keys(ACCENTS) as AccentKey[];
