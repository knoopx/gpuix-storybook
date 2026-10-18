import type { Args } from "../csf.ts";

function isPlainObject(v: unknown): v is object {
  return !!v && typeof v === "object" && typeof v !== "function";
}

function cloneValue(v: unknown): unknown {
  if (!isPlainObject(v)) return v;
  try {
    return structuredClone(v);
  } catch {
    return v;
  }
}

export function cloneArgs(args: Args): Args {
  const out: Args = {};
  for (const [k, v] of Object.entries(args)) out[k] = cloneValue(v);
  return out;
}

export const isHexColor = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-fA-F]{3,7}$/.test(v);
