import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { TestRenderer } from "@gpuix/native/testing";

interface NodeLike {
  id?: number;
  type?: string;
  children?: unknown[];
}

const DATA_URL = /data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)/gi;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

const IMAGE_TYPES = new Set(["img", "image"]);

function sourcesOf(node: unknown): string[] {
  const found: string[] = [];
  const scan = (value: unknown, depth: number): void => {
    if (depth > 3 || value === null || value === undefined) return;
    if (typeof value === "string") {
      if (value.startsWith("data:image/") || IMAGE_EXT.test(value))
        found.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scan(item, depth + 1);
      return;
    }
    if (typeof value === "object") {
      for (const [key, item] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (key === "children") continue;
        scan(item, depth + 1);
      }
    }
  };
  scan(node, 0);
  return found;
}

function bytesOf(source: string): Buffer | null {
  const data = DATA_URL.exec(source);
  DATA_URL.lastIndex = 0;
  if (data) return Buffer.from(data[2], "base64");
  if (source.startsWith("file://")) return readFile(source.slice(7));
  if (IMAGE_EXT.test(source))
    return readFile(
      isAbsolute(source) ? source : resolve(process.cwd(), source),
    );
  return null;
}

function readFile(path: string): Buffer | null {
  try {
    return existsSync(path) ? readFileSync(path) : null;
  } catch {
    return null;
  }
}

export function feedImages(renderer: TestRenderer): number {
  const roots: unknown[] = [renderer.toJSON()];
  const seen = new Set<number>();
  let fed = 0;

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as NodeLike;
    if (typeof n.id === "number" && IMAGE_TYPES.has(String(n.type ?? ""))) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        for (const source of sourcesOf(n)) {
          const bytes = bytesOf(source);
          if (bytes === null || bytes.length === 0) continue;
          try {
            renderer.setImage(n.id as number, bytes);
            fed += 1;
            break;
          } catch {}
        }
      }
    }
    for (const child of n.children ?? [])
      visit(typeof child === "number" ? renderer.getElement(child) : child);
  };

  for (const root of roots) visit(root);
  renderer.flush();
  return fed;
}
