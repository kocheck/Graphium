/**
 * Saved-window-position validation.
 *
 * DMs move the World View onto a projector or TV and later unplug it. A window
 * restored to coordinates on a display that is no longer attached opens
 * off-screen, so saved positions are only reused when enough of the window
 * would land on a display that is connected now.
 */

export interface SavedBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimum visible strip (px) of the window that must land on a connected display. */
const MIN_VISIBLE_PX = 100;

const overlap = (aStart: number, aLength: number, bStart: number, bLength: number): number =>
  Math.max(0, Math.min(aStart + aLength, bStart + bLength) - Math.max(aStart, bStart));

/**
 * Returns the saved bounds, dropping `x`/`y` when the window would not be
 * reachable on any of `workAreas` (the window manager then centers it).
 */
export const restorableBounds = (saved: SavedBounds, workAreas: Rect[]): SavedBounds => {
  const { x, y, width, height } = saved;
  if (x === undefined || y === undefined) {
    return { width, height };
  }
  const isReachable = workAreas.some(
    (area) =>
      overlap(x, width, area.x, area.width) >= Math.min(MIN_VISIBLE_PX, width) &&
      overlap(y, height, area.y, area.height) >= Math.min(MIN_VISIBLE_PX, height),
  );
  return isReachable ? { width, height, x, y } : { width, height };
};
