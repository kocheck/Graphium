import { useEffect, useRef } from 'react';

import { Container } from 'pixi.js';

import type { Container as PixiContainer } from 'pixi.js';

/**
 * Mounts a PixiJS Container as a child of worldContainer at the given zIndex.
 * Returns a ref to the mounted container (null when worldContainer is null).
 * Handles addChild/removeChild/destroy lifecycle automatically.
 */
export function usePixiContainer(
  worldContainer: PixiContainer | null,
  zIndex: number,
): React.MutableRefObject<PixiContainer | null> {
  const containerRef = useRef<PixiContainer | null>(null);

  useEffect(() => {
    if (!worldContainer) {
      return;
    }
    const c = new Container();
    c.zIndex = zIndex;
    worldContainer.addChild(c);
    containerRef.current = c;
    return () => {
      worldContainer.removeChild(c);
      c.destroy({ children: true });
      containerRef.current = null;
    };
  }, [worldContainer, zIndex]);

  return containerRef;
}
