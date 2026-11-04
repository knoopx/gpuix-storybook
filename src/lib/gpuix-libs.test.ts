import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findBindings,
  libStem,
  planLibs,
  resolveLibPackage,
  storeRootFrom,
} from "./gpuix-libs.ts";

let root = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gpuix-libs-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function storePkg(name: string, files: string[]): string {
  const dir = join(root, name, "lib");
  mkdirSync(dir, { recursive: true });
  for (const f of files) writeFileSync(join(dir, f), "");
  return join(root, name);
}

describe("libStem", () => {
  test("strips lib prefix and so suffix", () => {
    expect(libStem("libfontconfig.so.1")).toBe("fontconfig");
    expect(libStem("libfreetype.so.6")).toBe("freetype");
    expect(libStem("libxkbcommon.so.0")).toBe("xkbcommon");
  });
});

describe("storeRootFrom", () => {
  test("reads the store root off a RUNPATH lib dir", () => {
    const dir = storePkg("aaa-fontconfig-2.18.3-lib", ["libfontconfig.so.1"]);
    expect(storeRootFrom([join(dir, "lib")])).toBe(root);
  });

  test("empty when no RUNPATH entry is given", () => {
    expect(storeRootFrom([])).toBe("");
  });
});

describe("resolveLibPackage", () => {
  test("prefers the exact package named by a RUNPATH entry", () => {
    const pinned = storePkg("zzz-fontconfig-2.18.3-lib", [
      "libfontconfig.so.1",
    ]);
    storePkg("aaa-fontconfig-3.0.0-lib", ["libfontconfig.so.1"]);
    const runpaths = [join(pinned, "lib")];
    expect(resolveLibPackage("libfontconfig.so.1", runpaths, root)).toBe(
      pinned,
    );
  });

  test("falls back to the newest store package when the pinned one is gone", () => {
    const gone = join(root, "aaa-fontconfig-1.0.0-lib");
    storePkg("bbb-fontconfig-2.18.3-lib", ["libfontconfig.so.1"]);
    storePkg("ccc-fontconfig-2.19.0-lib", ["libfontconfig.so.1"]);
    expect(
      resolveLibPackage("libfontconfig.so.1", [join(gone, "lib")], root),
    ).toBe(join(root, "ccc-fontconfig-2.19.0-lib"));
  });

  test("null when nothing in the store provides the lib", () => {
    const freetype = storePkg("aaa-freetype-2.14.3", ["libfreetype.so.6"]);
    expect(
      resolveLibPackage("libxcb.so.1", [join(freetype, "lib")], root),
    ).toBeNull();
  });

  test("ignores .drv entries", () => {
    const drv = join(root, "xyz-fontconfig-sys-6.0.1.drv");
    mkdirSync(join(drv, "lib"), { recursive: true });
    writeFileSync(join(drv, "lib", "libfontconfig.so.1"), "");
    expect(resolveLibPackage("libfontconfig.so.1", [], root)).toBeNull();
  });
});

describe("findBindings", () => {
  test("finds a binding in a bun store layout", () => {
    const pkg = join(
      root,
      "node_modules/.bun/@gpuix+native@file+foo/node_modules/@gpuix/native",
    );
    mkdirSync(pkg, { recursive: true });
    const node = join(pkg, "gpuix-native.linux-x64-gnu.node");
    writeFileSync(node, "");
    expect(findBindings([root])).toEqual([node]);
  });

  test("empty for a root without a bun store", () => {
    expect(findBindings([root])).toEqual([]);
  });
});

describe("planLibs", () => {
  test("no bindings, nothing to append", () => {
    expect(planLibs([], process.env)).toEqual({
      appended: [],
      unresolved: [],
      bindings: [],
    });
  });

  test("a file that is not an ELF binary is skipped", () => {
    const fake = join(root, "gpuix-native.linux-x64-gnu.node");
    writeFileSync(fake, "not an elf");
    expect(planLibs([fake], process.env).appended).toEqual([]);
  });
});
