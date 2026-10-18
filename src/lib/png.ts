import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

export interface PngImage {
  width: number;
  height: number;

  data: Buffer;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export const SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePngFile(path: string): PngImage {
  return decodePng(readFileSync(path));
}

interface PngChunks {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
  idat: Buffer[];
  palette: Buffer | null;
  trns: Buffer | null;
}

function parseChunks(buf: Buffer): PngChunks {
  const chunks: PngChunks = {
    width: 0,
    height: 0,
    bitDepth: 0,
    colorType: 0,
    interlace: 0,
    idat: [],
    palette: null,
    trns: null,
  };

  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;

    switch (type) {
      case "IHDR": {
        if (len !== 13) throw new Error("bad IHDR length");
        chunks.width = data.readUInt32BE(0);
        chunks.height = data.readUInt32BE(4);
        chunks.bitDepth = data[8];
        chunks.colorType = data[9];
        chunks.interlace = data[12];
        break;
      }
      case "PLTE":
        chunks.palette = Buffer.from(data);
        break;
      case "tRNS":
        chunks.trns = Buffer.from(data);
        break;
      case "IDAT":
        chunks.idat.push(Buffer.from(data));
        break;
      case "IEND":
        break;
    }
  }
  return chunks;
}

function validateIHDR(c: PngChunks): number {
  if (c.width === 0 || c.height === 0) throw new Error("bad IHDR dimensions");
  if (c.bitDepth !== 8) throw new Error(`unsupported bit depth ${c.bitDepth}`);
  if (c.interlace !== 0) throw new Error("interlaced PNGs are not supported");
  const channels = [1, 0, 3, 1, 2, 0, 4][c.colorType];
  if (!channels) throw new Error(`unsupported color type ${c.colorType}`);
  return channels;
}

function predict(
  filter: number,
  cur: number,
  a: number,
  b: number,
  c: number,
): number {
  switch (filter) {
    case 0:
      return cur;
    case 1:
      return cur + a;
    case 2:
      return cur + b;
    case 3:
      return cur + ((a + b) >> 1);
    case 4:
      return cur + paeth(a, b, c);
    default:
      throw new Error(`unknown PNG filter type ${filter}`);
  }
}

function unfilterRow(
  src: Buffer,
  rowStart: number,
  y: number,
  rowBytes: number,
  channels: number,
): void {
  const filter = src[rowStart];
  for (let x = 0; x < rowBytes; x++) {
    const a = x >= channels ? src[rowStart + 1 + x - channels] : 0;
    const upBase = y > 0 ? (y - 1) * (rowBytes + 1) + 1 : -1;
    const b = y > 0 ? src[upBase + x] : 0;
    const c = x >= channels && y > 0 ? src[upBase + x - channels] : 0;
    src[rowStart + 1 + x] =
      predict(filter, src[rowStart + 1 + x], a, b, c) & 0xff;
  }
}

type RgbaConverter = (
  src: Buffer,
  pi: number,
  out: Buffer,
  ci: number,
  palette: Buffer | null,
  trns: Buffer | null,
) => void;

const convertGray: RgbaConverter = (src, pi, out, ci, _palette, trns) => {
  const g = src[pi];
  out[ci] = g;
  out[ci + 1] = g;
  out[ci + 2] = g;
  out[ci + 3] = trns && g === trns[0] ? 0 : 255;
};

const convertRgb: RgbaConverter = (src, pi, out, ci, _palette, trns) => {
  out[ci] = src[pi];
  out[ci + 1] = src[pi + 1];
  out[ci + 2] = src[pi + 2];
  out[ci + 3] =
    trns &&
    src[pi] === trns[0] &&
    src[pi + 1] === trns[1] &&
    src[pi + 2] === trns[2]
      ? 0
      : 255;
};

const convertPalette: RgbaConverter = (src, pi, out, ci, palette, trns) => {
  const idx = src[pi];
  if (!palette || idx * 3 + 2 >= palette.length)
    throw new Error("palette index out of range");
  out[ci] = palette[idx * 3];
  out[ci + 1] = palette[idx * 3 + 1];
  out[ci + 2] = palette[idx * 3 + 2];
  out[ci + 3] = trns && idx < trns.length ? trns[idx] : 255;
};

const convertRgba: RgbaConverter = (src, pi, out, ci) => {
  out[ci] = src[pi];
  out[ci + 1] = src[pi + 1];
  out[ci + 2] = src[pi + 2];
  out[ci + 3] = src[pi + 3];
};

const RGBA_CONVERTERS: (RgbaConverter | undefined)[] = [
  convertGray,
  undefined,
  convertRgb,
  convertPalette,
  undefined,
  undefined,
  convertRgba,
];

export function decodePng(buf: Buffer): PngImage {
  if (buf.subarray(0, 8).equals(SIGNATURE) === false)
    throw new Error("not a PNG file (bad signature)");

  const chunks = parseChunks(buf);
  const channels = validateIHDR(chunks);
  const { width, height, colorType, palette, trns } = chunks;

  const rowBytes = width * channels;
  const raw = inflateSync(Buffer.concat(chunks.idat));
  const expected = (rowBytes + 1) * height;
  if (raw.length < expected)
    throw new Error(`PNG data truncated (${raw.length} < ${expected} bytes)`);

  const src = Buffer.alloc(expected);
  raw.copy(src, 0, 0, expected);
  const out = Buffer.alloc(width * height * 4);

  const convert = RGBA_CONVERTERS[colorType]!;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1);
    const rowOut = y * width * 4;
    unfilterRow(src, rowStart, y, rowBytes, channels);

    for (let px = 0; px < width; px++) {
      convert(
        src,
        rowStart + 1 + px * channels,
        out,
        rowOut + px * 4,
        palette,
        trns,
      );
    }
  }

  return { width, height, data: out };
}

export function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body, 0, body.length), 0);
  return Buffer.concat([len, body, crc]);
}

export function encodePng(img: PngImage): Buffer {
  const { width, height, data } = img;
  if (data.length !== width * height * 4)
    throw new Error("PNG data length does not match dimensions");

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function encodePngFile(img: PngImage, path: string): void {
  writeFileSync(path, encodePng(img));
}
