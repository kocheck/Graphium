export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
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
