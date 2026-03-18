/**
 * DoorLayer — PixiJS Graphics-based door rendering
 *
 * Renders all doors imperatively using PixiJS Graphics. Replaces the
 * previous Konva DoorShape + DoorLayer pair (Option A: all drawing inline).
 *
 * Visual states:
 *   Closed — white rectangle (standard tabletop symbol)
 *   Open   — swing arc (90°) + small edge rectangle at the hinge
 *   Locked — lock icon overlay (circle + padlock path)
 *
 * Interaction (DM mode only):
 *   click  → toggleDoor (unless locked)
 *   eraser tool click → deleteDoor callback
 *   right-click → context menu callback
 *
 * zIndex: 60 (above tokens at 50, drawn below fog at 70+)
 */

import { useEffect, useRef, useCallback } from 'react';

import { Container, Graphics } from 'pixi.js';

import type { Door } from '../../types/domain';
import type { Container as PixiContainer } from 'pixi.js';

// Door rendering colors — sourced from theme tokens (see theme.css).
// PixiJS Graphics uses 0x hex numbers for colors; alpha is passed separately.
const DOOR_COLORS = {
  fill: 0xf7edda, // --app-door-fill
  stroke: 0x1c1007, // --app-door-stroke
  sweepFill: 0xf7edda, // --app-door-sweep-fill (alpha 0.4 applied below)
  sweepStroke: 0x1c1007, // --app-door-sweep-stroke
  openingFill: 0xf7edda, // --app-door-opening-fill (alpha 0.6 applied below)
  lockHandle: 0xf7edda, // --app-door-lock-handle (alpha 0.9 applied below)
  lockedIcon: 0xe5484d, // --app-door-locked-icon
  lockedOutline: 0x8c0000, // --app-door-locked-outline
  boundingBox: 0x8c6914, // --app-door-bounding-box
} as const;

interface DoorLayerProps {
  worldContainer: PixiContainer | null;
  isWorldView: boolean;
  tool?: string;
  selectedIds?: string[];
  doors: Door[];
  onToggleDoor?: (id: string) => void;
  onDeleteDoor?: (id: string) => void;
  onDoorContextMenu?: (doorId: string, screenX: number, screenY: number) => void;
}

/**
 * Draws a single closed door (filled rectangle, centered at origin).
 */
function drawClosedDoor(g: Graphics, door: Door): void {
  const thickness = door.thickness ?? 12;
  const halfSize = door.size / 2;

  g.setStrokeStyle({ width: 2, color: DOOR_COLORS.stroke, alpha: 1 });

  if (door.orientation === 'horizontal') {
    g.rect(-halfSize, -thickness / 2, door.size, thickness);
  } else {
    g.rect(-thickness / 2, -halfSize, thickness, door.size);
  }
  g.fill({ color: DOOR_COLORS.fill, alpha: 1 });
  g.stroke();
}

/**
 * Draws an open door (swing arc + hinge edge rectangle).
 * swingAngle is in degrees (0–90).
 */
function drawOpenDoor(g: Graphics, door: Door, swingAngle: number = 90): void {
  const thickness = door.thickness ?? 12;
  const halfSize = door.size / 2;
  const innerRadius = halfSize - thickness / 2;
  const outerRadius = halfSize + thickness / 2;

  // Determine arc pivot and start angle (in radians for PixiJS)
  let arcX = 0;
  let arcY = 0;
  let startAngleDeg = 0;

  if (door.orientation === 'horizontal') {
    if (door.swingDirection === 'left') {
      arcX = -halfSize;
      arcY = 0;
      startAngleDeg = 0;
    } else {
      arcX = halfSize;
      arcY = 0;
      startAngleDeg = 90;
    }
  } else {
    if (door.swingDirection === 'up') {
      arcX = 0;
      arcY = -halfSize;
      startAngleDeg = 270;
    } else {
      arcX = 0;
      arcY = halfSize;
      startAngleDeg = 180;
    }
  }

  const startRad = (startAngleDeg * Math.PI) / 180;
  const endRad = ((startAngleDeg + swingAngle) * Math.PI) / 180;

  // Draw swing arc as a donut sector using moveTo/arc/lineTo/closePath
  g.setStrokeStyle({ width: 1, color: DOOR_COLORS.sweepStroke, alpha: 1 });

  // Outer arc: from startRad to endRad (counter-clockwise = false for PixiJS)
  g.moveTo(arcX + outerRadius * Math.cos(startRad), arcY + outerRadius * Math.sin(startRad));
  g.arc(arcX, arcY, outerRadius, startRad, endRad, false);
  // Line inward to inner arc end
  g.lineTo(arcX + innerRadius * Math.cos(endRad), arcY + innerRadius * Math.sin(endRad));
  // Inner arc backwards
  g.arc(arcX, arcY, innerRadius, endRad, startRad, true);
  g.closePath();

  g.fill({ color: DOOR_COLORS.sweepFill, alpha: 0.4 });
  g.stroke();

  // Hinge edge rectangle (shows door position when fully open)
  drawOpenDoorEdge(g, door, halfSize, thickness);
}

/**
 * Draws a small rectangle at the hinge point of an open door.
 */
function drawOpenDoorEdge(g: Graphics, door: Door, halfSize: number, thickness: number): void {
  let ex = 0;
  let ey = 0;
  let ew = thickness;
  let eh = halfSize;

  if (door.orientation === 'horizontal') {
    if (door.swingDirection === 'left') {
      ex = -halfSize - thickness / 2;
      ey = 0;
      ew = thickness;
      eh = halfSize;
    } else {
      ex = halfSize - thickness / 2;
      ey = 0;
      ew = thickness;
      eh = halfSize;
    }
  } else {
    if (door.swingDirection === 'up') {
      ex = 0;
      ey = -halfSize - thickness / 2;
      ew = halfSize;
      eh = thickness;
    } else {
      ex = 0;
      ey = halfSize - thickness / 2;
      ew = halfSize;
      eh = thickness;
    }
  }

  g.setStrokeStyle({ width: 1, color: DOOR_COLORS.stroke, alpha: 1 });
  g.rect(ex, ey, ew, eh);
  g.fill({ color: DOOR_COLORS.openingFill, alpha: 0.6 });
  g.stroke();
}

/**
 * Draws a lock icon (circle + simplified padlock) centered near the door.
 */
function drawLockIcon(g: Graphics, door: Door): void {
  const offsetX = door.orientation === 'vertical' ? 6 : 0;
  const offsetY = door.orientation === 'horizontal' ? 6 : 0;
  const cx = offsetX + 3;
  const cy = offsetY + 4;

  // Background circle
  g.setStrokeStyle({ width: 1, color: DOOR_COLORS.stroke, alpha: 1 });
  g.circle(cx, cy, 6);
  g.fill({ color: DOOR_COLORS.lockHandle, alpha: 0.9 });
  g.stroke();

  // Simple padlock body (small rectangle)
  g.setStrokeStyle({ width: 0.5, color: DOOR_COLORS.lockedOutline, alpha: 1 });
  g.rect(cx - 2.4, cy - 0.5, 4.8, 4);
  g.fill({ color: DOOR_COLORS.lockedIcon, alpha: 1 });
  g.stroke();

  // Shackle (arc on top of body)
  const shackleStartRad = Math.PI; // 180°
  const shackleEndRad = 0; // 0°
  g.arc(cx, cy - 0.5, 2, shackleStartRad, shackleEndRad, false);
  g.stroke();
}

/**
 * Draws a dashed selection bounding box around a door.
 */
function drawSelectionBox(g: Graphics, door: Door): void {
  const thickness = door.thickness ?? 12;
  const halfSize = door.size / 2;
  const pad = 4;

  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;

  if (door.orientation === 'horizontal') {
    sx = -halfSize - pad;
    sy = -thickness / 2 - pad;
    sw = door.size + pad * 2;
    sh = thickness + pad * 2;
  } else {
    sx = -thickness / 2 - pad;
    sy = -halfSize - pad;
    sw = thickness + pad * 2;
    sh = door.size + pad * 2;
  }

  // PixiJS v8 does not have built-in dash; draw four dashed sides manually
  const dashLen = 6;
  const gapLen = 3;
  g.setStrokeStyle({ width: 2, color: DOOR_COLORS.boundingBox, alpha: 1 });

  // Helper: draw a dashed horizontal or vertical line
  const dashLine = (x1: number, y1: number, x2: number, y2: number): void => {
    const totalLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const dx = (x2 - x1) / totalLen;
    const dy = (y2 - y1) / totalLen;
    let drawn = 0;
    let drawing = true;
    while (drawn < totalLen) {
      const segLen = Math.min(drawing ? dashLen : gapLen, totalLen - drawn);
      if (drawing) {
        g.moveTo(x1 + dx * drawn, y1 + dy * drawn);
        g.lineTo(x1 + dx * (drawn + segLen), y1 + dy * (drawn + segLen));
      }
      drawn += segLen;
      drawing = !drawing;
    }
  };

  dashLine(sx, sy, sx + sw, sy); // top
  dashLine(sx + sw, sy, sx + sw, sy + sh); // right
  dashLine(sx + sw, sy + sh, sx, sy + sh); // bottom
  dashLine(sx, sy + sh, sx, sy); // left
  g.stroke();
}

/**
 * Creates a single door Graphics object with all visual elements.
 */
function createDoorGraphics(door: Door, isWorldView: boolean, isSelected: boolean): Graphics {
  const g = new Graphics();
  // Position the graphics at door center
  g.x = door.x;
  g.y = door.y;

  if (door.isOpen) {
    drawOpenDoor(g, door, 90);
  } else {
    drawClosedDoor(g, door);
  }

  if (door.isLocked) {
    drawLockIcon(g, door);
  }

  if (isSelected && !isWorldView) {
    drawSelectionBox(g, door);
  }

  return g;
}

export function DoorLayer({
  worldContainer,
  isWorldView,
  tool,
  selectedIds = [],
  doors,
  onToggleDoor,
  onDeleteDoor,
  onDoorContextMenu,
}: DoorLayerProps): null {
  const containerRef = useRef<PixiContainer | null>(null);

  // Stable callback refs so the redraw effect doesn't need them as deps
  const onToggleDoorRef = useRef(onToggleDoor);
  const onDeleteDoorRef = useRef(onDeleteDoor);
  const onDoorContextMenuRef = useRef(onDoorContextMenu);
  onToggleDoorRef.current = onToggleDoor;
  onDeleteDoorRef.current = onDeleteDoor;
  onDoorContextMenuRef.current = onDoorContextMenu;

  const toolRef = useRef(tool);
  toolRef.current = tool;

  const isWorldViewRef = useRef(isWorldView);
  isWorldViewRef.current = isWorldView;

  // Mount/unmount the layer container alongside worldContainer
  useEffect(() => {
    if (!worldContainer) {
      return;
    }

    const c = new Container();
    c.zIndex = 60;
    worldContainer.addChild(c);
    containerRef.current = c;

    return () => {
      worldContainer.removeChild(c);
      c.destroy({ children: true });
      containerRef.current = null;
    };
  }, [worldContainer]);

  // Build stable click/context-menu handler factory using useCallback
  const makeHandlers = useCallback(
    (door: Door, g: Graphics) => {
      g.eventMode = 'static';
      g.cursor = 'pointer';

      g.on('pointerdown', (e) => {
        if (isWorldViewRef.current) {
          return;
        }
        if (e.button === 2) {
          return;
        } // handled by rightclick
        if (toolRef.current === 'eraser' && onDeleteDoorRef.current) {
          onDeleteDoorRef.current(door.id);
          return;
        }
        if (!door.isLocked && onToggleDoorRef.current) {
          onToggleDoorRef.current(door.id);
        }
      });

      g.on('rightclick', (e) => {
        if (isWorldViewRef.current) {
          return;
        }
        if (onDoorContextMenuRef.current) {
          onDoorContextMenuRef.current(door.id, e.clientX, e.clientY);
        }
      });
    },
    [], // no reactive deps — all accessed via refs
  );

  // Redraw all doors whenever door state, selection, or tool changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Remove and destroy old graphics
    container.removeChildren().forEach((c) => c.destroy({ children: true }));

    for (const door of doors) {
      const isSelected = selectedIds.includes(door.id);
      const g = createDoorGraphics(door, isWorldView, isSelected);

      if (!isWorldView) {
        makeHandlers(door, g);
      }

      container.addChild(g);
    }
  }, [doors, isWorldView, selectedIds, makeHandlers]);

  return null;
}

// eslint-disable-next-line import/no-unused-modules
export default DoorLayer;
