#!/usr/bin/env bun
import { resolve } from "node:path";
import { launchBrowser } from "./screens/BrowserApp.tsx";

const args = process.argv.slice(2);
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith("-")) positional.push(a);
}

const projectRoot = resolve(positional[0] ?? process.cwd());
await launchBrowser(projectRoot);
