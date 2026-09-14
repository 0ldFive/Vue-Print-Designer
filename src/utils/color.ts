/**
 * Color conversion utilities
 */

export interface HSVA {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
  a: number; // 0-1
}

export interface RGBA {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

export function hsvToRgb(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } {
  h = h % 360;
  if (h < 0) h += 360;
  s = Math.max(0, Math.min(1, s));
  v = Math.max(0, Math.min(1, v));

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rgbToHsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, v };
}

export function parseColor(color: string): HSVA | null {
  if (!color) return null;
  if (color === "transparent") return { h: 0, s: 0, v: 0, a: 0 };

  // Hex
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    let r = 0,
      g = 0,
      b = 0,
      a = 1;

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      a = parseInt(hex.substring(6, 8), 16) / 255;
    } else {
      return null;
    }

    const hsv = rgbToHsv(r, g, b);
    return { ...hsv, a };
  }

  // RGB/RGBA
  if (color.startsWith("rgb")) {
    const match = color.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
    );
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
      const hsv = rgbToHsv(r, g, b);
      return { ...hsv, a };
    }
  }

  return null;
}

export function toHex(h: number, s: number, v: number, a: number = 1): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  const toHexVal = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  if (a >= 1) {
    return `#${toHexVal(r)}${toHexVal(g)}${toHexVal(b)}`;
  } else {
    const alpha = Math.round(a * 255);
    return `#${toHexVal(r)}${toHexVal(g)}${toHexVal(b)}${toHexVal(alpha)}`;
  }
}

export function toRgbaString(
  h: number,
  s: number,
  v: number,
  a: number = 1,
): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(2))})`;
}

/**
 * Convert a hex color to space-separated RGB channels (e.g. "59 130 246"),
 * the format required by Tailwind colors declared as
 * `rgb(var(--x) / <alpha-value>)`.
 */
export function hexToRgbChannels(hex: string): string | null {
  const raw = (hex || "").trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/**
 * Expand brand hex variables with their matching RGB channel variables, so
 * Tailwind opacity modifiers (bg-blue-500/30 etc.) follow the active theme.
 * Entries that are not plain `--brand-<scale>` colors are kept untouched.
 */
export function expandBrandVars(
  vars: Record<string, string>,
): Record<string, string> {
  const expanded: Record<string, string> = { ...vars };
  Object.entries(vars).forEach(([key, value]) => {
    const match = /^--brand-(\d+)$/.exec(key);
    if (!match) return;
    const channels = hexToRgbChannels(value);
    if (channels) expanded[`--brand-${match[1]}-rgb`] = channels;
  });
  return expanded;
}
