/**
 * PixiJS color utilities.
 *
 * Pure helper functions for converting CSS color strings into the numeric
 * `{ color, alpha }` format expected by PixiJS Graphics fill/stroke calls.
 * No pixi.js import required — the return type is plain TypeScript.
 */

/**
 * Parses a CSS color string (hex, rgb, rgba) into PixiJS-compatible components.
 *
 * Supported formats:
 * - `#rrggbb`  — 6-digit hex
 * - `#rgb`     — 3-digit hex shorthand (expanded to 6 digits)
 * - `rgb(r, g, b)`
 * - `rgba(r, g, b, a)`
 *
 * Falls back to `{ color: 0, alpha: 1 }` (black, opaque) if the string cannot
 * be parsed.
 */
export function parseRgba(css: string): { color: number; alpha: number } {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(css);
  if (!m) {
    // Try parsing a hex color string like '#f7edda' or '#abc'
    if (css.startsWith('#')) {
      const hex = css.slice(1);
      const fullHex = hex.length === 3 ? hex.replace(/[0-9a-fA-F]/g, (c) => c + c) : hex;
      return { color: parseInt(fullHex, 16), alpha: 1 };
    }
    return { color: 0x000000, alpha: 1 };
  }
  // m[1]–m[3] are guaranteed non-null by the regex capture groups above
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const r = parseInt(m[1]!, 10);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const g = parseInt(m[2]!, 10);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const b = parseInt(m[3]!, 10);
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  return { color: (r << 16) | (g << 8) | b, alpha: a };
}

/**
 * Converts a CSS hex color string (#rrggbb or #rgb) to normalized [r, g, b] floats (0–1).
 * Used for PixiJS shader vec3/vec4 color uniforms.
 */
export function hexToRgbFloats(hex: string): [number, number, number] {
  const { color } = parseRgba(hex);
  return [((color >> 16) & 0xff) / 255, ((color >> 8) & 0xff) / 255, (color & 0xff) / 255];
}
