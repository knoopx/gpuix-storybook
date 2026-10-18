import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface ComponentSource {
  name: string;
  file: string;
  line: number;
}

const isFile = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

function findComponentIdentifier(src: string): string | null {
  const m = src.match(/\bcomponent:\s*([A-Za-z_$][\w$]*)/);
  return m ? m[1] : null;
}

interface ImportBinding {
  local: string;
  imported: string;
  module: string;
}

function parseNamedImports(named: string, mod: string): ImportBinding[] {
  const out: ImportBinding[] = [];
  for (const part of named.split(",")) {
    const [orig, alias] = part.trim().split(/\s+as\s+/);
    if (orig)
      out.push({
        local: (alias ?? orig).trim(),
        imported: orig.trim(),
        module: mod,
      });
  }
  return out;
}

function findImports(src: string): ImportBinding[] {
  const out: ImportBinding[] = [];
  const re =
    /import\s*(?:([A-Za-z_$][\w$]*)\s*,\s*)?(?:\{([^}]*)\}|\*)?\s*from\s*["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) {
    const def = m[1];
    const named = m[2];
    const mod = m[3];
    if (def) out.push({ local: def, imported: "default", module: mod });
    if (named) out.push(...parseNamedImports(named, mod));
  }
  return out;
}

function isRootDir(dir: string, projectRoot: string): boolean {
  return dir === projectRoot || dir === dirname(dir);
}

function findNodeModules(startDir: string, projectRoot: string): string | null {
  let dir = startDir;
  for (;;) {
    const nm = join(dir, "node_modules");
    if (existsSync(nm)) return nm;
    if (isRootDir(dir, projectRoot)) return null;
    dir = dirname(dir);
  }
}

const fileCandidates = (base: string) => [
  base,
  `${base}.tsx`,
  `${base}.ts`,
  join(base, "index.tsx"),
  join(base, "index.ts"),
];

function tryFileCandidates(base: string): string | null {
  for (const c of fileCandidates(base)) if (isFile(c)) return c;
  return null;
}

function splitPackageSpec(spec: string): { pkgName: string; sub: string } {
  const segs = spec.split("/");
  const pkgName = spec.startsWith("@") ? segs.slice(0, 2).join("/") : segs[0];
  const sub = segs.slice(pkgName.split("/").length).join("/");
  return { pkgName, sub };
}

interface PkgJson {
  main?: string;
  module?: string;
  exports?: string | Record<string, string | { default?: string } | undefined>;
}

function readPkgJson(pkgDir: string): PkgJson | null {
  try {
    return JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

type ExportFieldValue = string | { default?: string } | undefined;

function pickExportsEntry(
  exportsField: Record<string, ExportFieldValue> | undefined,
  sub: string,
): ExportFieldValue {
  if (!exportsField) return undefined;
  return exportsField["." + (sub ? `/${sub}` : "")] ?? exportsField["."];
}

function exportsEntry(
  exportsField: PkgJson["exports"],
  sub: string,
): ExportFieldValue {
  if (typeof exportsField === "string") return exportsField;
  return pickExportsEntry(exportsField, sub);
}

function entryToPath(entry: ExportFieldValue): string | null {
  if (typeof entry === "string") return entry;
  return entry?.default ?? null;
}

function resolvePkgEntry(pkg: PkgJson, sub: string): string | null {
  return entryToPath(exportsEntry(pkg.exports, sub) ?? pkg.main ?? pkg.module);
}

function isRelative(spec: string): boolean {
  return isAbsolute(spec) || spec.startsWith("./") || spec.startsWith("../");
}

function resolvePackageSpec(
  pkgName: string,
  sub: string,
  nm: string,
): string | null {
  const pkg = readPkgJson(join(nm, pkgName));
  if (!pkg) return null;
  const entry = resolvePkgEntry(pkg, sub);
  if (!entry) return null;
  return tryFileCandidates(join(join(nm, pkgName), entry));
}

function resolveModuleSpecifier(
  spec: string,
  fromFile: string,
  projectRoot: string,
): string | null {
  if (isRelative(spec))
    return tryFileCandidates(resolve(dirname(fromFile), spec));
  if (spec.startsWith("node:")) return null;

  const nm = findNodeModules(dirname(fromFile), projectRoot);
  if (!nm) return null;
  const { pkgName, sub } = splitPackageSpec(spec);
  return resolvePackageSpec(pkgName, sub, nm);
}

interface ExportLocation {
  file: string;
  line: number;
}

function findLine(lines: string[], re: RegExp): number | null {
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  return null;
}

const EXPORT_DEFAULT_RE = /^\s*export\s+default\b/;

function declarationRegex(name: string): RegExp {
  return new RegExp(
    `^\\s*export\\s+(?:async\\s+)?(?:function\\s*\\*?|class|const|let|var)\\s+${name}\\b`,
  );
}

function localDeclarationRegex(name: string): RegExp {
  return new RegExp(
    `^(?:export\\s+)?(?:async\\s+)?(?:function\\s*\\*?|class|const|let|var)\\s+${name}\\b`,
  );
}

interface ExportPart {
  orig: string;
  alias: string;
}

function parseExportParts(clause: string): ExportPart[] {
  const parts: ExportPart[] = [];
  for (const part of clause.split(",")) {
    const [orig, alias] = part.trim().split(/\s+as\s+/);
    if (orig) parts.push({ orig: orig.trim(), alias: (alias ?? orig).trim() });
  }
  return parts;
}

function reexportTarget(
  clause: string,
  name: string,
  mod: string,
  file: string,
  projectRoot: string,
  visited: Set<string>,
): ExportLocation | null {
  for (const { orig, alias } of parseExportParts(clause)) {
    if (alias !== name) continue;
    const sub = resolveModuleSpecifier(mod, file, projectRoot);
    if (sub) return findExportLine(sub, orig, projectRoot, visited);
  }
  return null;
}

function findReexportLine(
  src: string,
  name: string,
  file: string,
  projectRoot: string,
  visited: Set<string>,
): ExportLocation | null {
  for (const m of src.matchAll(
    /export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
  )) {
    const target = reexportTarget(m[1], name, m[2], file, projectRoot, visited);
    if (target) return target;
  }
  return null;
}

function localExportLine(
  clause: string,
  name: string,
  lines: string[],
): number | null {
  for (const { orig, alias } of parseExportParts(clause)) {
    if (alias !== name) continue;
    const local = findLine(lines, localDeclarationRegex(orig));
    if (local) return local;
  }
  return null;
}

function findLocalExportLine(
  src: string,
  lines: string[],
  name: string,
): number | null {
  for (const m of src.matchAll(/export\s*\{([^}]*)\}(?!\s*from)/g)) {
    const local = localExportLine(m[1], name, lines);
    if (local) return local;
  }
  return null;
}

function findDeclarationLine(lines: string[], name: string): number | null {
  if (name === "default") {
    const line = findLine(lines, EXPORT_DEFAULT_RE);
    if (line) return line;
  }
  return findLine(lines, declarationRegex(name));
}

function findIndirectExportLine(
  src: string,
  lines: string[],
  name: string,
  file: string,
  projectRoot: string,
  visited: Set<string>,
): ExportLocation | null {
  const reexport = findReexportLine(src, name, file, projectRoot, visited);
  if (reexport) return reexport;
  const local = findLocalExportLine(src, lines, name);
  if (local) return { file, line: local };
  return null;
}

function findExportLine(
  file: string,
  name: string,
  projectRoot: string,
  visited: Set<string>,
): ExportLocation | null {
  if (visited.has(file)) return null;
  visited.add(file);
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const line = findDeclarationLine(lines, name);
  if (line) return { file, line };
  return findIndirectExportLine(src, lines, name, file, projectRoot, visited);
}

function componentBinding(
  src: string,
): { ident: string; binding: ImportBinding } | null {
  const ident = findComponentIdentifier(src);
  if (!ident) return null;
  const binding = findImports(src).find((b) => b.local === ident);
  if (!binding) return null;
  return { ident, binding };
}

export function resolveComponentSource(
  storyFile: string,
  projectRoot: string,
): ComponentSource | null {
  const src = readFileSync(storyFile, "utf8");
  const cb = componentBinding(src);
  if (!cb) return null;
  const entry = resolveModuleSpecifier(
    cb.binding.module,
    storyFile,
    projectRoot,
  );
  if (!entry) return null;
  const found = findExportLine(
    entry,
    cb.binding.imported,
    projectRoot,
    new Set(),
  );
  if (!found) return null;
  return { name: cb.ident, ...found };
}
