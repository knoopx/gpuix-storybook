import type { ReactNode } from "react";
import {
  defineMeta,
  type Args,
  type InputType,
  type Parameters,
  type StoryDef,
} from "storybook";
import { AdwaitaProvider, Banner, Button, T, ToastProvider } from "adwaita-gpuix";
import { BrowserApp } from "./BrowserApp.tsx";
import { HeaderBar } from "../components/HeaderBar.tsx";
import { StoryThemeProvider } from "../components/StoryTheme.tsx";
import type { DecoratorFunction } from "../csf.ts";

const noopSetSearch = (_s: string): void => {};
const noopCopy = (): void => {};

interface MakeDefOptions {
  argTypes?: Record<string, InputType>;
  parameters?: Parameters;
}


function makeDef(
  name: string,
  title: string,
  file: string,
  args: Args,
  story: (args?: Args, context?: any) => ReactNode,
  opts: MakeDefOptions = {},
): StoryDef {
  const argTypes = (opts.argTypes ?? {}) as StoryDef["context"]["argTypes"];
  const parameters = opts.parameters ?? {};
  return {
    name,
    file,
    root: ".",
    meta: { title, parameters },
    story,
    args,
    parameters,
    decorators: [],
    context: {
      componentId: title,
      title,
      kind: title,
      id: `${title}--${name}`,
      name,
      story: name,
      tags: [],
      component: (a: Args) => story(a),
      parameters,
      initialArgs: args,
      argTypes,
      args,
      viewMode: "story",
      canvas: null,
    },
  };
}

const BUTTON_FILE = "src/components/Button.stories.tsx";
const BUTTON_ARG_TYPES: Record<string, InputType> = {
  variant: {
    name: "variant",
    options: ["default", "suggested", "destructive"],
  },
};
const BUTTON_PARAMETERS: Parameters = { width: 320, height: 160 };
const buttonStory = (args?: Args): ReactNode => (
  <Button
    label={args?.label}
    variant={args?.variant}
    disabled={args?.disabled}
  />
);

const BUTTON_DEFAULT = makeDef(
  "Default",
  "Components/Button",
  BUTTON_FILE,
  { label: "Push me", variant: "suggested" },
  buttonStory,
  { argTypes: BUTTON_ARG_TYPES, parameters: BUTTON_PARAMETERS },
);

const BUTTON_DISABLED = makeDef(
  "Disabled",
  "Components/Button",
  BUTTON_FILE,
  { label: "Push me", variant: "suggested", disabled: true },
  buttonStory,
  { argTypes: BUTTON_ARG_TYPES, parameters: BUTTON_PARAMETERS },
);

const ALERT_BASIC = makeDef(
  "Basic",
  "Components/Alert",
  "src/components/Alert.stories.tsx",
  {
    title: "Sync complete",
    body: "Your library is up to date. 128 new stories indexed.",
    tone: "success",
  },
  (args) => (
    <Banner
      title={args?.title}
      body={args?.body}
      tone={args?.tone}
      style={{ width: 440 }}
    />
  ),
  {
    argTypes: {
      tone: {
        name: "tone",
        options: ["info", "warning", "error", "success"],
      },
    },
    parameters: { width: 480, height: 140 },
  },
);

const GREETING = makeDef(
  "Greeting",
  "Components/Greeting",
  "src/components/Greeting.stories.tsx",
  { name: "Ada", mood: "happy" },
  (args) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "center",
      }}
    >
      <T size="title2" weight={700}>
        Hello, {args?.name}!
      </T>
      <T size="body" color="currentColor" style={{ opacity: 0.7 }}>
        Feeling {args?.mood} today? Your stories are ready to browse.
      </T>
    </div>
  ),
  {
    argTypes: {
      mood: {
        name: "mood",
        options: ["calm", "happy", "focused", "playful"],
      },
    },
    parameters: { width: 320, height: 120 },
  },
);

const HEADERBAR_OVERVIEW = makeDef(
  "Overview",
  "Components/HeaderBar",
  "src/components/HeaderBar.stories.tsx",
  { search: "accordion", setSearch: noopSetSearch, onCopy: noopCopy },
  (args) => (
    <HeaderBar
      search={args?.search}
      setSearch={args?.setSearch ?? noopSetSearch}
      onCopy={args?.onCopy}
    />
  ),
  { parameters: { width: 560, height: 120 } },
);

const BROWSER_OVERVIEW = makeDef(
  "Overview",
  "Screens/BrowserApp",
  "src/screens/BrowserApp.stories.tsx",
  {
    stories: [BUTTON_DEFAULT, GREETING],
    previewDecoratorsByRoot: new Map<string, DecoratorFunction[]>(),
    projectRoot: ".",
  },
  (args) => (
    <AdwaitaProvider scheme="nightsky">
      <ToastProvider>
        <StoryThemeProvider>
          <BrowserApp
            stories={args?.stories ?? [BUTTON_DEFAULT, GREETING]}
            previewDecoratorsByRoot={
              args?.previewDecoratorsByRoot ?? new Map()
            }
            projectRoot={args?.projectRoot ?? "."}
          />
        </StoryThemeProvider>
      </ToastProvider>
    </AdwaitaProvider>
  ),
  { parameters: { width: 640, height: 400 } },
);

const SAMPLES: StoryDef[] = [
  BUTTON_DEFAULT,
  BUTTON_DISABLED,
  ALERT_BASIC,
  GREETING,
  HEADERBAR_OVERVIEW,
  BROWSER_OVERVIEW,
];

const NO_DECORATORS: Map<string, DecoratorFunction[]> = new Map([
  [".", []],
]);

export default defineMeta({
  title: "Screens/BrowserApp",
  component: BrowserApp,
  args: {
    stories: SAMPLES,
    previewDecoratorsByRoot: NO_DECORATORS,
    projectRoot: ".",
  },
  parameters: { width: 1440, height: 900 },
});

export function Overview({
  stories,
  previewDecoratorsByRoot,
  projectRoot,
}: {
  stories?: StoryDef[];
  previewDecoratorsByRoot?: Map<string, DecoratorFunction[]>;
  projectRoot?: string;
}) {
  return (
    <AdwaitaProvider scheme="nightsky">
      <ToastProvider>
        <StoryThemeProvider>
          <BrowserApp
            stories={stories ?? SAMPLES}
            previewDecoratorsByRoot={
              previewDecoratorsByRoot ?? NO_DECORATORS
            }
            projectRoot={projectRoot ?? "."}
          />
        </StoryThemeProvider>
      </ToastProvider>
    </AdwaitaProvider>
  );
}

export function EmptyLibrary({
  previewDecoratorsByRoot,
  projectRoot,
}: {
  previewDecoratorsByRoot?: Map<string, DecoratorFunction[]>;
  projectRoot?: string;
}) {
  return (
    <AdwaitaProvider scheme="nightsky">
      <ToastProvider>
        <StoryThemeProvider>
          <BrowserApp
            stories={[]}
            previewDecoratorsByRoot={
              previewDecoratorsByRoot ?? NO_DECORATORS
            }
            projectRoot={projectRoot ?? "."}
          />
        </StoryThemeProvider>
      </ToastProvider>
    </AdwaitaProvider>
  );
}
