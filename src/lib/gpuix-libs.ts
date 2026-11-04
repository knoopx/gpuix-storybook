import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const RESOLVED_GUARD = "GPUIX_LIBS_RESOLVED";

export interface LibResolution {
  appended: string[];

  unresolved: string[];

  bindings: string[];
}

export function findBindings(roots: string[]): string[] {
  const out = new Set<string>();
  for (const root of roots) {
    const store = join(root, "node_modules", ".bun");
    let entries: string[];
    try {
      entries = readdirSync(store);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.startsWith("@gpuix+native")) continue;
      const dir = join(store, entry, "node_modules", "@gpuix");
      for (const pkg of ["native", "native-linux-x64-gnu"]) {
        const node = join(dir, pkg, "gpuix-native.linux-x64-gnu.node");
        if (existsSync(node)) out.add(node);
      }
    }
  }
  return [...out];
}

export function runpathDirs(binding: string): string[] {
  const out = spawnSync("objdump", ["-p", binding], { encoding: "utf8" });
  if (out.status !== 0) return [];
  const line = out.stdout.split("\n").find((l) => /^\s*R(UN)?PATH\s+/.test(l));
  if (!line) return [];
  return line
    .replace(/^\s*R(UN)?PATH\s+/, "")
    .trim()
    .split(":")
    .filter((p) => p.endsWith("/lib"));
}

export function missingLibs(binding: string, env: NodeJS.ProcessEnv): string[] {
  const out = spawnSync("ldd", [binding], {
    encoding: "utf8",
    env: { ...process.env, ...env } as NodeJS.ProcessEnv,
  });
  if (out.status !== 0) return [];
  return out.stdout
    .split("\n")
    .filter((l) => l.includes("not found"))
    .map((l) => l.trim().split(/\s+/)[0])
    .filter(Boolean);
}

export function storeRootFrom(runpaths: string[]): string {
  const first = runpaths.find((p) => p.length > 0);
  return first ? dirname(dirname(first)) : "";
}

export function libStem(lib: string): string {
  return lib.replace(/^lib/, "").replace(/\.so.*$/, "");
}

export function resolveLibPackage(
  lib: string,
  runpaths: string[],
  storeRoot: string,
): string | null {
  const stem = libStem(lib);
  for (const dir of runpaths) {
    const pkgDir = dir.replace(/\/+$/, "").replace(/\/lib$/, "");
    const name = basename(pkgDir).replace(/^[^-]+-/, "");
    if (!name.includes(stem)) continue;
    const exact = join(storeRoot, name, "lib", lib);
    if (existsSync(exact)) return join(storeRoot, name);
    let hit: string | null = null;
    for (const candidate of storePackages(storeRoot, name)) {
      if (existsSync(join(storeRoot, candidate, "lib", lib))) hit = candidate;
    }
    if (hit) return join(storeRoot, hit);
  }
  let best: string | null = null;
  for (const candidate of storePackages(storeRoot, stem)) {
    if (!existsSync(join(storeRoot, candidate, "lib", lib))) continue;
    const version = candidate.replace(/^[^-]+-/, "");
    if (!best || version.localeCompare(best.replace(/^[^-]+-/, "")) > 0)
      best = candidate;
  }
  return best ? join(storeRoot, best) : null;
}

function storePackages(storeRoot: string, needle: string): string[] {
  try {
    return readdirSync(storeRoot)
      .filter((n) => n.includes(needle) && !n.endsWith(".drv"))
      .filter((n) => {
        try {
          return statSync(join(storeRoot, n)).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

export function planLibs(
  bindings: string[],
  env: NodeJS.ProcessEnv,
): LibResolution {
  const appended: string[] = [];
  const unresolved: string[] = [];
  const provided = new Set(
    (env.LD_LIBRARY_PATH ?? "").split(":").filter(Boolean),
  );
  for (const binding of bindings) {
    const runpaths = runpathDirs(binding);
    const storeRoot = storeRootFrom(runpaths);
    if (!storeRoot) continue;
    for (const lib of missingLibs(binding, env)) {
      const pkg = resolveLibPackage(lib, runpaths, storeRoot);
      if (!pkg) {
        if (!unresolved.includes(lib)) unresolved.push(lib);
        continue;
      }
      const libDir = join(pkg, "lib");
      if (provided.has(libDir) || appended.includes(libDir)) continue;
      appended.push(libDir);
    }
  }
  return { appended, unresolved, bindings };
}

export function bootstrapGpuixLibs(
  roots: string[],
  log: (line: string) => void = () => {},
): LibResolution {
  const bindings = findBindings(roots);
  const plan = planLibs(bindings, process.env);
  if (plan.appended.length > 0) {
    const current = process.env.LD_LIBRARY_PATH ?? "";
    process.env.LD_LIBRARY_PATH = [current, ...plan.appended]
      .filter(Boolean)
      .join(":");
  }
  process.env[RESOLVED_GUARD] = "1";
  for (const dir of plan.appended) log(`gpuix-libs: LD_LIBRARY_PATH += ${dir}`);
  for (const lib of plan.unresolved)
    log(`gpuix-libs: could not resolve NEEDED ${lib} for the gpuix binding`);
  return plan;
}
