import { useRef, useCallback } from 'react';
import type React from 'react';

import type { Container } from 'pixi.js';

const VIEWPORT_CLAMP_PADDING = 1000;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_SCALE_BY = 1.1;

interface ClampOptions {
  scale: number;
  mapWidth: number;
  mapHeight: number;
  viewWidth: number;
  viewHeight: number;
}

export function clampViewport(
  pos: { x: number; y: number },
  opts: ClampOptions,
): { x: number; y: number } {
  const minX = -(opts.mapWidth * opts.scale) + opts.viewWidth - VIEWPORT_CLAMP_PADDING;
  const maxX = VIEWPORT_CLAMP_PADDING;
  const minY = -(opts.mapHeight * opts.scale) + opts.viewHeight - VIEWPORT_CLAMP_PADDING;
  const maxY = VIEWPORT_CLAMP_PADDING;
  return {
    x: Math.min(Math.max(pos.x, minX), maxX),
    y: Math.min(Math.max(pos.y, minY), maxY),
  };
}

interface UsePixiViewportProps {
  mapWidth: number;
  mapHeight: number;
  viewWidth: number;
  viewHeight: number;
}

interface UsePixiViewportReturn {
  worldContainerRef: React.MutableRefObject<Container | null>;
  scaleRef: React.MutableRefObject<number>;
  handleWheel: (e: WheelEvent) => void;
  handlePointerDown: (e: PointerEvent) => void;
  handlePointerMove: (e: PointerEvent) => void;
  handlePointerUp: () => void;
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
}

export function usePixiViewport({
  mapWidth,
  mapHeight,
  viewWidth,
  viewHeight,
}: UsePixiViewportProps): UsePixiViewportReturn {
  const worldContainerRef = useRef<Container | null>(null);
  const scaleRef = useRef(1);
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback(
    (x: number, y: number, s: number) => {
      const container = worldContainerRef.current;
      if (!container) {
        return;
      }
      const clamped = clampViewport(
        { x, y },
        { scale: s, mapWidth, mapHeight, viewWidth, viewHeight },
      );
      container.position.set(clamped.x, clamped.y);
      container.scale.set(s);
    },
    [mapWidth, mapHeight, viewWidth, viewHeight],
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const container = worldContainerRef.current;
      if (!container) {
        return;
      }
      const oldScale = scaleRef.current;
      const direction = e.deltaY < 0 ? 1 : -1;
      const newScale = Math.min(
        Math.max(oldScale * Math.pow(ZOOM_SCALE_BY, direction), MIN_SCALE),
        MAX_SCALE,
      );
      scaleRef.current = newScale;
      // Zoom toward cursor
      const worldX = (e.clientX - container.position.x) / oldScale;
      const worldY = (e.clientY - container.position.y) / oldScale;
      const newX = e.clientX - worldX * newScale;
      const newY = e.clientY - worldY * newScale;
      applyTransform(newX, newY, newScale);
    },
    [applyTransform],
  );

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.button === 1 || e.button === 2) {
      isPanning.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isPanning.current) {
        return;
      }
      const container = worldContainerRef.current;
      if (!container) {
        return;
      }
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      applyTransform(container.position.x + dx, container.position.y + dy, scaleRef.current);
    },
    [applyTransform],
  );

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const container = worldContainerRef.current;
      if (!container) {
        return { x: screenX, y: screenY };
      }
      return {
        x: (screenX - container.position.x) / scaleRef.current,
        y: (screenY - container.position.y) / scaleRef.current,
      };
    },
    [],
  );

  return {
    worldContainerRef,
    scaleRef,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    screenToWorld,
  };
}
