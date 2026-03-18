/**
 * Maps a pressure value (0.0–1.0) to a pixel width by linearly interpolating
 * between a minimum and maximum multiplier applied to a base stroke width.
 *
 * @param pressure  - Stylus pressure in [0.0, 1.0]
 * @param baseWidth - Base stroke width in pixels
 * @param range     - Multiplier range: { min, max }
 * @returns Computed stroke width in pixels
 */
// eslint-disable-next-line import/no-unused-modules
export function pressureToWidth(
  pressure: number,
  baseWidth: number,
  range: { min: number; max: number },
): number {
  const multiplier = range.min + pressure * (range.max - range.min);
  return baseWidth * multiplier;
}
