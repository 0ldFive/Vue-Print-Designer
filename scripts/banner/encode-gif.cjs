const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "../..");
const FRAME_ROOT = path.join(ROOT, ".tmp-banner");
const OUT_DIR = path.join(ROOT, "docs/images");
const DELAY = 10;
const HOLD = 470;
const TRANSPARENT = 255;

function decodePng(buffer) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idat = [];

  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced png is not supported");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported color type ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[offset];
    offset += 1;
    const line = raw.subarray(offset, offset + stride);
    offset += stride;
    const out = new Uint8Array(stride);

    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? out[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      const value = line[i];
      let shifted = value;
      if (filter === 1) {
        shifted = (value + a) & 0xff;
      } else if (filter === 2) {
        shifted = (value + b) & 0xff;
      } else if (filter === 3) {
        shifted = (value + ((a + b) >> 1)) & 0xff;
      } else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        shifted = (value + pred) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`unsupported filter ${filter}`);
      }
      out[i] = shifted;
    }

    for (let x = 0; x < width; x += 1) {
      const si = x * channels;
      const di = (y * width + x) * 4;
      rgba[di] = out[si];
      rgba[di + 1] = out[si + 1];
      rgba[di + 2] = out[si + 2];
      rgba[di + 3] = channels === 4 ? out[si + 3] : 255;
    }
    prev.set(out);
  }

  return { width, height, data: rgba };
}

const BRAND_COLORS = [
  [65, 184, 131],
  [53, 73, 94],
  [97, 218, 251],
  [221, 0, 49],
  [227, 79, 38],
  [239, 108, 52],
];

function buildPalette(frames, width, height) {
  const buckets = new Map();
  const step = Math.max(1, Math.floor(frames.length / 10));

  for (const [r, g, b] of BRAND_COLORS) {
    buckets.set((r << 16) | (g << 8) | b, { r, g, b, count: 1e9 });
  }

  for (let f = 0; f < frames.length; f += step) {
    const data = frames[f].data;
    for (let i = 0; i < width * height; i += 7) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const key = (r << 16) | (g << 8) | b;
      const weight = Math.max(r, g, b) - Math.min(r, g, b) > 55 ? 8 : 1;
      const entry = buckets.get(key);
      if (entry) {
        entry.count += weight;
      } else {
        buckets.set(key, { r, g, b, count: weight });
      }
    }
  }

  const colors = Array.from(buckets.values());
  colors.sort((a, b) => b.count - a.count);

  let palette = colors.slice(0, TRANSPARENT).map((c) => [c.r, c.g, c.b]);
  if (palette.length < TRANSPARENT) {
    while (palette.length < TRANSPARENT) palette.push([0, 0, 0]);
  }

  // refine: merge rare colors into nearest kept color to keep smooth gradients
  const kept = palette;
  palette = kept.map((c) => c.slice());
  while (palette.length < 256) palette.push([0, 0, 0]);
  palette[TRANSPARENT] = [0, 0, 0];

  const lut = new Uint8Array(262144);
  for (let r = 0; r < 64; r += 1) {
    for (let g = 0; g < 64; g += 1) {
      for (let b = 0; b < 64; b += 1) {
        const rr = (r << 2) | 2;
        const gg = (g << 2) | 2;
        const bb = (b << 2) | 2;
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < TRANSPARENT; i += 1) {
          const pr = palette[i][0];
          const pg = palette[i][1];
          const pb = palette[i][2];
          const d = (rr - pr) * (rr - pr) + (gg - pg) * (gg - pg) + (bb - pb) * (bb - pb);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        }
        lut[(r << 12) | (g << 6) | b] = best;
      }
    }
  }

  return { palette, lut };
}

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

function indexOf(lut, data, offset, x, y) {
  const jitter = (BAYER[((y & 7) << 3) | (x & 7)] / 63 - 0.5) * 6;
  let r = data[offset] + jitter;
  let g = data[offset + 1] + jitter;
  let b = data[offset + 2] + jitter;
  r = r < 0 ? 0 : r > 255 ? 255 : r;
  g = g < 0 ? 0 : g > 255 ? 255 : g;
  b = b < 0 ? 0 : b > 255 ? 255 : b;
  const key = ((r | 0) >> 2) << 12 | ((g | 0) >> 2) << 6 | ((b | 0) >> 2);
  return lut[key];
}

function diffRect(prev, next, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const i = row + x * 4;
      if (
        prev[i] !== next[i] ||
        prev[i + 1] !== next[i + 1] ||
        prev[i + 2] !== next[i + 2]
      ) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function lzwEncode(indices, minCodeSize) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let dict = new Map();
  let next = end + 1;
  let codeSize = minCodeSize + 1;
  const out = [];
  let acc = 0;
  let bits = 0;

  const emit = (code) => {
    acc |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      out.push(acc & 0xff);
      acc >>>= 8;
      bits -= 8;
    }
  };

  emit(clear);
  let current = indices[0];
  for (let i = 1; i < indices.length; i += 1) {
    const k = indices[i];
    const key = current * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      current = found;
      continue;
    }
    emit(current);
    if (next < 4096) {
      dict.set(key, next);
      next += 1;
      if (next > 1 << codeSize && codeSize < 12) codeSize += 1;
    } else {
      emit(clear);
      dict = new Map();
      next = end + 1;
      codeSize = minCodeSize + 1;
    }
    current = k;
  }
  emit(current);
  emit(end);
  if (bits > 0) out.push(acc & 0xff);
  return out;
}

function blockify(bytes) {
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const slice = bytes.slice(i, i + 255);
    chunks.push(Buffer.from([slice.length]), Buffer.from(slice));
  }
  chunks.push(Buffer.from([0]));
  return Buffer.concat(chunks);
}

function encodeGif(frames, palette, width, height, outPath) {
  const parts = [];
  parts.push(Buffer.from("GIF89a", "ascii"));
  const header = Buffer.alloc(7);
  header.writeUInt16LE(width, 0);
  header.writeUInt16LE(height, 2);
  header[4] = 0xf7;
  header[5] = 0;
  header[6] = 0;
  parts.push(header);

  const table = Buffer.alloc(768);
  for (let i = 0; i < 256; i += 1) {
    table[i * 3] = palette[i][0];
    table[i * 3 + 1] = palette[i][1];
    table[i * 3 + 2] = palette[i][2];
  }
  parts.push(table);

  parts.push(
    Buffer.from([0x21, 0xff, 0x0b]),
    Buffer.from("NETSCAPE2.0", "ascii"),
    Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]),
  );

  for (const frame of frames) {
    const gce = Buffer.alloc(8);
    gce[0] = 0x21;
    gce[1] = 0xf9;
    gce[2] = 0x04;
    gce[3] = 0x05;
    gce.writeUInt16LE(frame.delay, 4);
    gce[6] = TRANSPARENT;
    gce[7] = 0x00;
    parts.push(gce);

    const desc = Buffer.alloc(10);
    desc[0] = 0x2c;
    desc.writeUInt16LE(frame.left, 1);
    desc.writeUInt16LE(frame.top, 3);
    desc.writeUInt16LE(frame.width, 5);
    desc.writeUInt16LE(frame.height, 7);
    desc[9] = 0x00;
    parts.push(desc);

    parts.push(Buffer.from([0x08]));
    parts.push(blockify(lzwEncode(frame.indices, 8)));
  }

  parts.push(Buffer.from([0x3b]));
  fs.writeFileSync(outPath, Buffer.concat(parts));
}

function main() {
  if (!fs.existsSync(FRAME_ROOT)) {
    throw new Error(`missing frames dir: ${FRAME_ROOT}`);
  }

  const langs = fs
    .readdirSync(FRAME_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const lang of langs) {
    const dir = path.join(FRAME_ROOT, lang);
    const files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".png"))
      .sort();
    const decoded = files.map((name) => decodePng(fs.readFileSync(path.join(dir, name))));
    const { width, height } = decoded[0];
    const { palette, lut } = buildPalette(decoded, width, height);

    const frames = [];
    for (let i = 0; i < decoded.length; i += 1) {
      const current = decoded[i];
      const previous = i > 0 ? decoded[i - 1] : null;
      let rect = i === 0 ? { left: 0, top: 0, width, height } : diffRect(previous.data, current.data, width, height);

      if (!rect) {
        frames[frames.length - 1].delay += DELAY;
        continue;
      }

      const indices = new Uint8Array(rect.width * rect.height);
      for (let y = 0; y < rect.height; y += 1) {
        for (let x = 0; x < rect.width; x += 1) {
          const sx = rect.left + x;
          const sy = rect.top + y;
          const si = (sy * width + sx) * 4;
          const di = y * rect.width + x;
          if (previous) {
            const pi = si;
            if (
              previous.data[pi] === current.data[si] &&
              previous.data[pi + 1] === current.data[si + 1] &&
              previous.data[pi + 2] === current.data[si + 2]
            ) {
              indices[di] = TRANSPARENT;
              continue;
            }
          }
          indices[di] = indexOf(lut, current.data, si, sx, sy);
        }
      }

      frames.push({ ...rect, indices, delay: DELAY });
    }

    if (frames.length > 0) {
      frames[frames.length - 1].delay += HOLD;
    }

    const outPath = path.join(OUT_DIR, `banner-${lang}.gif`);
    encodeGif(frames, palette, width, height, outPath);
    const size = fs.statSync(outPath).size;
    console.log(`${lang}: ${frames.length} frames, ${(size / 1024).toFixed(0)} KB -> banner-${lang}.gif`);
  }
}

main();
