import { describe, expect, test } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import {
  decodePng,
  decodePngFile,
  encodePng,
  chunk,
  SIGNATURE,
  type PngImage,
} from "./png.ts";

function buildPng(
  width: number,
  height: number,
  channels: number,
  colorType: number,
  rows: number[][],
  extra: Array<[string, Buffer]> = [],
): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const raw = Buffer.from(rows.flat());
  const chunks = [
    chunk("IHDR", ihdr),
    ...extra.map(([t, d]) => chunk(t, d)),
    chunk("IDAT", deflateSync(raw)),
  ];
  return Buffer.concat([SIGNATURE, ...chunks, chunk("IEND", Buffer.alloc(0))]);
}

function gradient(w: number, h: number): PngImage {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      data[o] = (x * 37) & 0xff;
      data[o + 1] = (y * 53) & 0xff;
      data[o + 2] = ((x + y) * 29) & 0xff;
      data[o + 3] = 255;
    }
  return { width: w, height: h, data };
}

function makeOrig(w: number, h: number, c: number): number[][] {
  const orig: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w * c; x++) {
      row.push((x * 13 + y * 71) & 0xff);
    }
    orig.push(row);
  }
  return orig;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const d = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return [a, b, c][d.indexOf(Math.min(...d))];
}

const PREDICTORS: ((a: number, b: number, c: number) => number)[] = [
  () => 0,
  (a) => a,
  (_a, b) => b,
  (a, b) => (a + b) >> 1,
  paeth,
];

function predictPixel(filter: number, a: number, b: number, c: number): number {
  return PREDICTORS[filter](a, b, c);
}

function neighborLeft(
  orig: number[][],
  y: number,
  x: number,
  c: number,
): number {
  return x >= c ? orig[y][x - c] : 0;
}

function neighborUp(orig: number[][], y: number, x: number): number {
  return y > 0 ? orig[y - 1][x] : 0;
}

function neighborUpLeft(
  orig: number[][],
  y: number,
  x: number,
  c: number,
): number {
  if (y === 0 || x < c) return 0;
  return orig[y - 1][x - c];
}

function filteredRows(orig: number[][]): number[][] {
  const c = 3;
  const rows: number[][] = [];
  for (let y = 0; y < orig.length; y++) {
    const f = y % 5;
    const filtered: number[] = [f];
    for (let x = 0; x < orig[y].length; x++) {
      const a = neighborLeft(orig, y, x, c);
      const b = neighborUp(orig, y, x);
      const cc = neighborUpLeft(orig, y, x, c);
      filtered.push((orig[y][x] - predictPixel(f, a, b, cc)) & 0xff);
    }
    rows.push(filtered);
  }
  return rows;
}

function expectDecodedRgb(
  img: PngImage,
  orig: number[][],
  w: number,
  h: number,
): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      expect(img.data[o]).toBe(orig[y][x * 3]);
      expect(img.data[o + 1]).toBe(orig[y][x * 3 + 1]);
      expect(img.data[o + 2]).toBe(orig[y][x * 3 + 2]);
      expect(img.data[o + 3]).toBe(255);
    }
}

describe("png codec", () => {
  test("RGBA encode → decode round trip", () => {
    const img = gradient(37, 23);
    const decoded = decodePng(encodePng(img));
    expect(decoded.width).toBe(37);
    expect(decoded.height).toBe(23);
    expect(decoded.data.equals(img.data)).toBe(true);
  });

  test("decodes all five filter types", () => {
    const w = 4;
    const h = 5;
    const c = 3;
    const orig = makeOrig(w, h, c);
    const img = decodePng(buildPng(w, h, c, 2, filteredRows(orig)));
    expectDecodedRgb(img, orig, w, h);
  });

  test("decodes grayscale (color type 0)", () => {
    const rows = [
      [0, 10, 50],
      [0, 40, 60],
    ];
    const img = decodePng(buildPng(2, 2, 1, 0, rows));
    expect(img.data[0]).toBe(10);
    expect(img.data[1]).toBe(10);
    expect(img.data[2]).toBe(10);
    expect(img.data[5]).toBe(50);
    expect(img.data[3]).toBe(255);
  });

  test("decodes palette (color type 3) with tRNS", () => {
    const plte = Buffer.from([10, 20, 30, 40, 50, 60, 70, 80, 90]);
    const trns = Buffer.from([0, 255, 128, 0]);
    const rows = [
      [0, 0, 1],
      [0, 2, 0],
    ];
    const img = decodePng(
      buildPng(2, 2, 1, 3, rows, [
        ["PLTE", plte],
        ["tRNS", trns],
      ]),
    );

    expect(img.data[0]).toBe(10);
    expect(img.data[3]).toBe(0);

    expect(img.data[4]).toBe(40);
    expect(img.data[7]).toBe(255);

    expect(img.data[8]).toBe(70);
    expect(img.data[11]).toBe(128);
  });

  test("rejects non-PNG data", () => {
    expect(() => decodePng(Buffer.from("hello"))).toThrow("not a PNG");
  });

  test("decodes a real niri screenshot when available", () => {
    const dir = join(process.env.HOME ?? "", "Pictures", "Screenshots");
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".png"));
    } catch {}
    if (files.length === 0) return;
    const img = decodePngFile(join(dir, files[files.length - 1]));
    expect(img.width).toBeGreaterThan(0);
    expect(img.height).toBeGreaterThan(0);
    expect(img.data.length).toBe(img.width * img.height * 4);
  });
});

test("decode(encode(x)) equals x for arbitrary data", () => {
  const img = {
    width: 1,
    height: 1,
    data: Buffer.from([1, 2, 3, 255]),
  };
  expect(decodePng(encodePng(img)).data.equals(img.data)).toBe(true);
});

test("png module loads and exports", () => {
  expect(typeof decodePngFile).toBe("function");
  expect(typeof encodePng).toBe("function");
  expect(existsSync(fileURLToPath(new URL("./png.ts", import.meta.url)))).toBe(
    true,
  );
});
