export const snapToGrid = (
  x: number,
  y: number,
  gridSize: number,
  width: number = 0,
  height: number = 0
): { x: number; y: number } => {
  // If dimensions not provided, use simple top-left rounding (legacy behavior)
  if (!width || !height) {
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  }

  const snapDimension = (pos: number, size: number) => {
    const center = pos + size / 2;
    const cellCount = Math.round(size / gridSize);

    // Even (or 0): Snap to Intersection
    // Odd: Snap to Cell Center
    const isOdd = cellCount % 2 !== 0;

    let snapCenter;
    if (isOdd) {
      // Cell Center: (Index + 0.5) * gridSize
      // We use floor of center/gridSize to find the cell index
      snapCenter = (Math.floor(center / gridSize) + 0.5) * gridSize;
    } else {
      // Intersection: Index * gridSize
      snapCenter = Math.round(center / gridSize) * gridSize;
    }

    return snapCenter - size / 2;
  };

  return {
    x: snapDimension(x, width),
    y: snapDimension(y, height),
  };
};
