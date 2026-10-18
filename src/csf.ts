import type { ReactNode } from "react";

export type StoryResult = ReactNode;

export interface GpuixRenderer {
  component: ((args: any) => ReactNode) | ((args: any) => ReactNode)[];

  storyResult: StoryResult;

  canvasElement: unknown;
  args: unknown;
  csf4: false;
}

export interface Args {
  [name: string]: any;
}

export interface StrictArgs {
  [name: string]: unknown;
}

export interface InputType {
  control?:
    | string
    | false
    | {
        type?: string;
        disable?: boolean;
        options?: readonly any[];
        labels?: Record<string, string>;
        [key: string]: any;
      };
  description?: string;
  name?: string;
  options?: readonly any[];
  type?: any;
  [key: string]: any;
}

export type ArgTypes<TArgs = Args> = { [name in keyof TArgs]: InputType };
export type StrictArgTypes<TArgs = Args> = {
  [name in keyof TArgs]: InputType & { name: string };
};

export interface Parameters {
  [name: string]: any;
}

export interface StrictParameters {
  [name: string]: unknown;
}

export type StoryId = string;
export type ComponentId = string;
export type ComponentTitle = string;
export type StoryName = string;
export type Tag = string;

export interface StoryIdentifier {
  componentId: ComponentId;
  title: ComponentTitle;

  kind: ComponentTitle;
  id: StoryId;
  name: StoryName;

  story: StoryName;
  tags: Tag[];
}

export interface StoryContextUpdate<TArgs = Args> {
  args?: TArgs;
  [key: string]: any;
}

export interface StoryContext<TArgs = Args> extends StoryIdentifier {
  component?: GpuixRenderer["component"];
  parameters: Parameters;
  initialArgs: TArgs;
  argTypes: StrictArgTypes<TArgs>;
  args: TArgs;
  viewMode: "story" | "docs";
  canvas: unknown;
}

export type StoryContextForRender<TArgs = Args> = StoryContext<TArgs>;

export type ArgsStoryFn<TArgs = Args> = (
  args: TArgs,
  context: StoryContextForRender<TArgs>,
) => StoryResult;

export type LegacyStoryFn<TArgs = Args> = (
  context: StoryContextForRender<TArgs>,
) => StoryResult;

export type StoryFn<TArgs = Args> = LegacyStoryFn<TArgs> | ArgsStoryFn<TArgs>;

export type PartialStoryFn<TArgs = Args> = (
  update?: StoryContextUpdate<Partial<TArgs>>,
) => StoryResult;

export type DecoratorFunction<TArgs = Args> = (
  fn: PartialStoryFn<TArgs>,
  c: StoryContextForRender<TArgs>,
) => StoryResult;

export interface BaseAnnotations<TArgs = Args> {
  decorators?: DecoratorFunction<TArgs>[] | DecoratorFunction<TArgs>;

  parameters?: Parameters;

  args?: Partial<TArgs>;

  argTypes?: Partial<ArgTypes<TArgs>>;

  render?: ArgsStoryFn<TArgs>;

  tags?: Tag[];
}

export interface ComponentAnnotations<
  TArgs = Args,
> extends BaseAnnotations<TArgs> {
  title?: ComponentTitle;

  id?: ComponentId;

  includeStories?: string[] | RegExp;

  excludeStories?: string[] | RegExp;

  component?: GpuixRenderer["component"];

  subcomponents?: Record<string, GpuixRenderer["component"]>;
  globals?: Partial<Args>;
}

export type StoryAnnotations<
  TArgs = Args,
  TRequiredArgs = Partial<TArgs>,
> = BaseAnnotations<TArgs> & {
  name?: StoryName;

  storyName?: StoryName;
  globals?: Partial<Args>;
} & ({} extends TRequiredArgs
    ? { args?: TRequiredArgs }
    : { args: TRequiredArgs });

export type Meta<TArgs = Args> = ComponentAnnotations<TArgs>;
export type StoryObj<TArgs = Args> = StoryAnnotations<TArgs>;
export type Decorator<TArgs = StrictArgs> = DecoratorFunction<TArgs>;
export type AnnotatedStoryFn<TArgs = Args> = ArgsStoryFn<TArgs> &
  StoryAnnotations<TArgs>;

export function defineMeta<TArgs = Args>(meta: Meta<TArgs>): Meta<TArgs> {
  return meta;
}

export function defineStory<TArgs = Args>(
  story: StoryObj<TArgs>,
): StoryObj<TArgs> {
  return story;
}
