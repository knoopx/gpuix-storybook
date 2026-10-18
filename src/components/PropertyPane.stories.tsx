import { defineMeta, defineStory, type Args } from "storybook";
import { PropertyPane } from "./PropertyPane.tsx";




const PLAYGROUND = defineStory<Args>({
  args: {
    label: "Hello",
    enabled: true,
    count: 42,
    color: "#3584e4",
    variant: "suggested",
    data: { nested: true, depth: 2 },
  },
  argTypes: {
    variant: { options: ["default", "suggested", "destructive"] },
  },
});


const NO_ARGS = defineStory<Args>({});

const noopChange = (_key: string, _value: unknown): void => {};

export default defineMeta({
  title: "Components/PropertyPane",
  component: PropertyPane,
  args: {
    def: PLAYGROUND,
    args: PLAYGROUND.args ?? {},
    onChangeArg: noopChange,
  },
  parameters: { width: 640, height: 380 },
});


export function Overview() {
  return (
    <PropertyPane
      def={PLAYGROUND}
      args={PLAYGROUND.args ?? {}}
      onChangeArg={noopChange}
    />
  );
}


export function NoArgs() {
  return <PropertyPane def={NO_ARGS} args={{}} onChangeArg={noopChange} />;
}


export function Empty() {
  return <PropertyPane def={null} args={{}} onChangeArg={noopChange} />;
}
