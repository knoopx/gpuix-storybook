import { AdwaitaProvider } from "adwaita-gpuix";

export const decorators = [
  (fn: () => any) => (
    <AdwaitaProvider scheme="nightsky">{fn()}</AdwaitaProvider>
  ),
];
