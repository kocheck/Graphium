export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Culled tokens stay mounted so inbound TOKEN_DRAG_MOVE can still find a Konva node. */
export function shouldRenderTokenVisuals(
  hiddenByFog: boolean,
  isDragging: boolean,
  inViewport: boolean,
): boolean {
  if (hiddenByFog) {
    return false;
  }
  return isDragging || inViewport;
}

export function isTokenInViewport(
  x: number,
  y: number,
  size: number,
  bounds: ViewportBounds,
  padding: number,
): boolean {
  return (
    x + size >= bounds.x - padding &&
    y + size >= bounds.y - padding &&
    x <= bounds.x + bounds.width + padding &&
    y <= bounds.y + bounds.height + padding
  );
}
