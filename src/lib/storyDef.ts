import type { StoryDef } from "../index.ts";

export function makeStoryDef(
  name: string,
  title: string,
  file: string,
  root = ".",
): StoryDef {
  return {
    name,
    file,
    root,
    meta: { title },
    story: () => null,
    args: {},
    parameters: {},
    decorators: [],
    context: {
      componentId: title,
      title,
      kind: title,
      id: `${title}--${name}`,
      name,
      story: name,
      tags: [],
      component: undefined,
      parameters: {},
      initialArgs: {},
      argTypes: {},
      args: {},
      viewMode: "story",
      canvas: null,
    },
  };
}
