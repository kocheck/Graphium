import { KonvaEventObject } from 'konva/lib/Node';

/**
 * Get the pointer position from a Konva event
 * Extracts the canvas-relative pointer position from any pointer event type.
 */
export const getPointerPosition = (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
  const stage = e.target.getStage();
  if (!stage) return null;
  return stage.getRelativePointerPosition();
};

/**
 * Get pressure value from a pointer event (for pressure-sensitive drawing)
 */
export const getPointerPressure = (
  e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>,
): number => {
  const evt = e.evt;
  if ('pressure' in evt && typeof evt.pressure === 'number') {
    return evt.pressure;
  }
  return 0.5; // Default
};

/**
 * Check if the event is a multi-touch gesture (2+ fingers)
 */
export const isMultiTouchGesture = (
  e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>,
): boolean => {
  const evt = e.evt;
  return 'touches' in evt && Array.isArray(evt.touches) && evt.touches.length >= 2;
};
