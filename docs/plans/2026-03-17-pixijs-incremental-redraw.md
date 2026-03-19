# PixiJS Incremental Redraw Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace full destroy-and-rebuild with keyed-Map incremental updates in DoorLayer and StairsLayer, and split PressureSensitiveLine's single useEffect into shader + geometry effects to avoid recreating the shader on every geometry change.

**Architecture:** DoorLayer and StairsLayer hold a `Map<string, Graphics>` ref keyed by entity id; each effect run diffs the current array against the map — only destroyed entries are removed, new entries added, changed entries rebuilt. PressureSensitiveLine splits its effect in two: Effect 1 (deps: `stroke`, `opacity`, `worldContainer`) manages the Shader/UniformGroup and stores it in a ref; Effect 2 (deps: `id`, `points`, `pressures`, `strokeWidth`, `worldContainer`) creates/replaces MeshGeometry and creates the Mesh using the shader ref from Effect 1.

**Tech Stack:** PixiJS v8, React 19, TypeScript 5, Vitest

---

## Context

### Files to modify

- `src/components/Canvas/StairsLayer.tsx` — full rebuild on every `stairs` change
- `src/components/Canvas/DoorLayer.tsx` — full rebuild on every `doors`/`selectedIds`/`tool` change
- `src/components/Canvas/PressureSensitiveLine.tsx` — full Mesh + Shader recreate on every `points` change

### Key types (from `src/types/domain.ts`)

```ts
interface Door {
  id: string;
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  isOpen: boolean;
  isLocked: boolean;
  size: number;
  thickness?: number;
  swingDirection?: 'left' | 'right' | 'up' | 'down';
}

interface Stairs {
  id: string;
  x: number;
  y: number;
  direction: 'north' | 'south' | 'east' | 'west';
  type: 'up' | 'down';
  width: number;
  height: number;
}
```

### Stairs are static

Stairs have no mutable state — `type`, `direction`, `width`, `height` never change after placement. They can only be added or removed. The keyed-Map for StairsLayer therefore needs no "update" case.

### Testing pattern

This codebase tests **pure functions** exported from components (see `GridOverlay.test.ts`, `strokeGeometry.test.ts`). PixiJS rendering hooks are not integration-tested — only the pure utility functions are. Tests confirm all existing tests still pass after each change.

---

## Task 1: StairsLayer — keyed-Map add/remove

**Files:**

- Modify: `src/components/Canvas/StairsLayer.tsx`
- Test: `src/components/Canvas/__tests__/StairsLayer.test.ts` (new)

Stairs are static architectural elements: they are never modified after placement, only added or removed. The Map therefore only needs add/remove logic — no update case.

**Step 1: Write the failing test**

Create `src/components/Canvas/__tests__/StairsLayer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

/**
 * Tests for the `stairsKey` pure function exported from StairsLayer.
 *
 * StairsLayer uses an add/remove-only keyed Map. There is no update case
 * because Stairs has no mutable fields — only id, position, and static
 * visual properties that never change after placement.
 *
 * The stairsKey function is not strictly needed for the Map logic, but
 * exporting it lets us verify the identity check used to guard against
 * false "new stair" detection.
 */

// The function doesn't exist yet — this import will fail
import { stairsKey } from '../StairsLayer';
import type { Stairs } from '../../../types/domain';

const makeStairs = (overrides: Partial<Stairs> = {}): Stairs => ({
  id: 'stair-1',
  x: 100,
  y: 200,
  direction: 'north',
  type: 'up',
  width: 100,
  height: 100,
  ...overrides,
});

describe('stairsKey', () => {
  it('returns the stair id', () => {
    const s = makeStairs({ id: 'abc' });
    expect(stairsKey(s)).toBe('abc');
  });

  it('returns unique keys for different ids', () => {
    const a = makeStairs({ id: 'a' });
    const b = makeStairs({ id: 'b' });
    expect(stairsKey(a)).not.toBe(stairsKey(b));
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- --reporter=verbose src/components/Canvas/__tests__/StairsLayer.test.ts
```

Expected: FAIL — `stairsKey` not exported from StairsLayer.

**Step 3: Implement the incremental StairsLayer**

Replace the contents of `src/components/Canvas/StairsLayer.tsx`. Key changes:

1. Export a `stairsKey` pure function (returns `stair.id`)
2. Add `graphicsMapRef` ref holding `Map<string, Graphics>`
3. Add a cleanup effect that clears the map when `worldContainer` changes (so a new worldContainer starts fresh)
4. Replace the `clearContainer` + rebuild loop with a diff loop

Full implementation:

```tsx
/**
 * StairsLayer — PixiJS Graphics-based staircase rendering
 *
 * Renders all staircases imperatively using PixiJS Graphics. Replaces the
 * previous Konva StairsShape + StairsLayer pair (all drawing inline, no
 * StairsShape component needed).
 *
 * Visual design:
 *   - Filled background rectangle (light gray = up, dark gray = down)
 *   - 4 interior tread lines (horizontal for north/south, vertical for east/west)
 *   - Directional arrow (triangle) pointing in stairs.direction
 *
 * Interaction: none — stairs are static architectural elements.
 *
 * zIndex: 55 (below doors at 60, above tokens at 50)
 *
 * Incremental rendering: uses a Map<string, Graphics> keyed by stair id.
 * Only adds Graphics for new stairs and removes Graphics for deleted stairs.
 * No update case — stairs have no mutable state after placement.
 */

import { useEffect, useRef } from 'react';

import { Graphics } from 'pixi.js';

import { usePixiContainer } from './hooks/usePixiContainer';

import type { Stairs } from '../../types/domain';
import type { Container as PixiContainer } from 'pixi.js';

// Stairs rendering colors — sourced from theme tokens (see theme.css).
const STAIRS_COLORS = {
  fillUp: 0xc0c0c0, // --app-stairs-fill-up (light gray)
  fillDown: 0x808080, // --app-stairs-fill-down (dark gray)
  stroke: 0x1c1007, // --app-stairs-stroke (warm ink)
  arrowUp: 0x8c6914, // --app-stairs-arrow-up (antique brass)
  arrowDown: 0xe5484d, // --app-stairs-arrow-down (red)
} as const;

interface StairsLayerProps {
  worldContainer: PixiContainer | null;
  stairs: Stairs[];
}

/**
 * Returns the identity key for a stair. Stairs are static — only id matters.
 */
// eslint-disable-next-line import/no-unused-modules
export function stairsKey(stair: Stairs): string {
  return stair.id;
}

/**
 * Draws the background filled rectangle for a staircase.
 */
function drawStairsBackground(g: Graphics, stairs: Stairs): void {
  const halfWidth = stairs.width / 2;
  const halfHeight = stairs.height / 2;
  const fillColor = stairs.type === 'up' ? STAIRS_COLORS.fillUp : STAIRS_COLORS.fillDown;

  g.setStrokeStyle({ width: 2, color: STAIRS_COLORS.stroke, alpha: 1 });
  g.rect(-halfWidth, -halfHeight, stairs.width, stairs.height);
  g.fill({ color: fillColor, alpha: 1 });
  g.stroke();
}

/**
 * Draws stair tread lines (4 interior lines showing individual steps).
 */
function drawStairTreads(g: Graphics, stairs: Stairs): void {
  const halfWidth = stairs.width / 2;
  const halfHeight = stairs.height / 2;
  const numSteps = 5;

  g.setStrokeStyle({ width: 1, color: STAIRS_COLORS.stroke, alpha: 0.6 });

  if (stairs.direction === 'north' || stairs.direction === 'south') {
    // Horizontal treads
    const stepHeight = stairs.height / numSteps;
    for (let i = 1; i < numSteps; i++) {
      const y = i * stepHeight - halfHeight;
      g.moveTo(-halfWidth, y);
      g.lineTo(halfWidth, y);
    }
  } else {
    // Vertical treads (east/west)
    const stepWidth = stairs.width / numSteps;
    for (let i = 1; i < numSteps; i++) {
      const x = i * stepWidth - halfWidth;
      g.moveTo(x, -halfHeight);
      g.lineTo(x, halfHeight);
    }
  }
  g.stroke();
}

/**
 * Draws a filled directional arrow triangle indicating which way the stairs face.
 */
function drawDirectionalArrow(g: Graphics, stairs: Stairs): void {
  const arrowColor = stairs.type === 'up' ? STAIRS_COLORS.arrowUp : STAIRS_COLORS.arrowDown;
  const arrowSize = Math.min(stairs.width, stairs.height) * 0.3;

  g.setStrokeStyle({ width: 1, color: STAIRS_COLORS.stroke, alpha: 0.8 });

  switch (stairs.direction) {
    case 'north':
      g.moveTo(0, -arrowSize);
      g.lineTo(-arrowSize / 2, 0);
      g.lineTo(arrowSize / 2, 0);
      g.closePath();
      break;
    case 'south':
      g.moveTo(0, arrowSize);
      g.lineTo(-arrowSize / 2, 0);
      g.lineTo(arrowSize / 2, 0);
      g.closePath();
      break;
    case 'east':
      g.moveTo(arrowSize, 0);
      g.lineTo(0, -arrowSize / 2);
      g.lineTo(0, arrowSize / 2);
      g.closePath();
      break;
    case 'west':
      g.moveTo(-arrowSize, 0);
      g.lineTo(0, -arrowSize / 2);
      g.lineTo(0, arrowSize / 2);
      g.closePath();
      break;
    default:
      return;
  }

  g.fill({ color: arrowColor, alpha: 0.8 });
  g.stroke();
}

/**
 * Creates a single staircase Graphics object with all visual elements.
 */
function createStairsGraphics(stairs: Stairs): Graphics {
  const g = new Graphics();
  g.x = stairs.x;
  g.y = stairs.y;

  drawStairsBackground(g, stairs);
  drawStairTreads(g, stairs);
  drawDirectionalArrow(g, stairs);

  return g;
}

export function StairsLayer({ worldContainer, stairs }: StairsLayerProps): null {
  const containerRef = usePixiContainer(worldContainer, 55);
  const graphicsMapRef = useRef<Map<string, Graphics>>(new Map());

  // Clear the map when worldContainer changes — the old container (and its
  // Graphics children) was destroyed by usePixiContainer, so our refs are stale.
  useEffect(() => {
    return () => {
      graphicsMapRef.current.clear();
    };
  }, [worldContainer]);

  // Incremental add/remove — stairs have no mutable state so no update case.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const map = graphicsMapRef.current;
    const currentIds = new Set(stairs.map((s) => s.id));

    // Remove Graphics for deleted stairs
    for (const [id, g] of map) {
      if (!currentIds.has(id)) {
        container.removeChild(g);
        g.destroy();
        map.delete(id);
      }
    }

    // Add Graphics for new stairs
    for (const stair of stairs) {
      if (!map.has(stair.id)) {
        const g = createStairsGraphics(stair);
        container.addChild(g);
        map.set(stair.id, g);
      }
    }
  }, [containerRef, stairs]);

  return null;
}

// eslint-disable-next-line import/no-unused-modules
export default StairsLayer;
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- --reporter=verbose src/components/Canvas/__tests__/StairsLayer.test.ts
```

Expected: PASS.

**Step 5: Run full test suite and lint**

```bash
npm run test:run && npm run lint
```

Expected: all tests pass, no lint errors.

**Step 6: Commit**

```bash
git add src/components/Canvas/StairsLayer.tsx src/components/Canvas/__tests__/StairsLayer.test.ts
git commit -m "perf(StairsLayer): keyed-Map incremental add/remove (no full rebuild)"
```

---

## Task 2: DoorLayer — keyed-Map incremental update

**Files:**

- Modify: `src/components/Canvas/DoorLayer.tsx`
- Test: `src/components/Canvas/__tests__/DoorLayer.test.ts` (new)

Doors have mutable state: `isOpen`, `isLocked`, `x`, `y`, `orientation`, `size`, `thickness`, `swingDirection`. Selection state comes from outside (`selectedIds`). The `isWorldView` prop also affects rendering (no handlers in world view). The state key encodes all of these so a simple string comparison catches any change.

**Step 1: Write the failing test**

Create `src/components/Canvas/__tests__/DoorLayer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

// These functions don't exist yet — imports will fail
import { doorStateKey } from '../DoorLayer';
import type { Door } from '../../../types/domain';

const makeDoor = (overrides: Partial<Door> = {}): Door => ({
  id: 'door-1',
  x: 100,
  y: 200,
  orientation: 'horizontal',
  isOpen: false,
  isLocked: false,
  size: 50,
  ...overrides,
});

describe('doorStateKey', () => {
  it('returns the same key for identical door + isWorldView + isSelected', () => {
    const door = makeDoor();
    expect(doorStateKey(door, false, false)).toBe(doorStateKey(door, false, false));
  });

  it('returns different keys when isOpen changes', () => {
    const closed = makeDoor({ isOpen: false });
    const open = makeDoor({ isOpen: true });
    expect(doorStateKey(closed, false, false)).not.toBe(doorStateKey(open, false, false));
  });

  it('returns different keys when isLocked changes', () => {
    const unlocked = makeDoor({ isLocked: false });
    const locked = makeDoor({ isLocked: true });
    expect(doorStateKey(unlocked, false, false)).not.toBe(doorStateKey(locked, false, false));
  });

  it('returns different keys when isSelected changes', () => {
    const door = makeDoor();
    expect(doorStateKey(door, false, false)).not.toBe(doorStateKey(door, false, true));
  });

  it('returns different keys when isWorldView changes', () => {
    const door = makeDoor();
    expect(doorStateKey(door, false, false)).not.toBe(doorStateKey(door, true, false));
  });

  it('returns different keys when position changes', () => {
    const a = makeDoor({ x: 100 });
    const b = makeDoor({ x: 200 });
    expect(doorStateKey(a, false, false)).not.toBe(doorStateKey(b, false, false));
  });

  it('returns different keys when orientation changes', () => {
    const horiz = makeDoor({ orientation: 'horizontal' });
    const vert = makeDoor({ orientation: 'vertical' });
    expect(doorStateKey(horiz, false, false)).not.toBe(doorStateKey(vert, false, false));
  });

  it('returns different keys when swingDirection changes', () => {
    const left = makeDoor({ swingDirection: 'left' });
    const right = makeDoor({ swingDirection: 'right' });
    expect(doorStateKey(left, false, false)).not.toBe(doorStateKey(right, false, false));
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- --reporter=verbose src/components/Canvas/__tests__/DoorLayer.test.ts
```

Expected: FAIL — `doorStateKey` not exported from DoorLayer.

**Step 3: Implement the incremental DoorLayer**

Key changes to `src/components/Canvas/DoorLayer.tsx`:

1. Export `doorStateKey` pure function
2. Change map type from `Map<string, Graphics>` to `Map<string, { g: Graphics; key: string }>`
3. Add `graphicsMapRef` ref
4. Add `worldContainer` cleanup effect (same pattern as StairsLayer)
5. Replace the `clearContainer` + rebuild loop with a diff loop that skips unchanged doors

**`doorStateKey` function** — add near the top of the file, after the `DOOR_COLORS` const:

```ts
/**
 * Returns a string encoding all renderable state for a door.
 * Used to detect whether a door's Graphics need to be rebuilt.
 * Two calls with identical state will produce identical strings.
 */
// eslint-disable-next-line import/no-unused-modules
export function doorStateKey(door: Door, isWorldView: boolean, isSelected: boolean): string {
  return [
    door.isOpen,
    door.isLocked,
    door.x,
    door.y,
    door.orientation,
    door.size,
    door.thickness ?? 12,
    door.swingDirection ?? '',
    isWorldView,
    isSelected,
  ].join(':');
}
```

**New refs** — add inside `DoorLayer` function body, after `containerRef`:

```ts
const graphicsMapRef = useRef<Map<string, { g: Graphics; key: string }>>(new Map());
```

**Map cleanup effect** — add after the existing `toolRef`/`isWorldViewRef` lines:

```ts
// Clear the map when worldContainer changes — usePixiContainer already destroyed
// the container and all Graphics children, so our cached refs are stale.
useEffect(() => {
  return () => {
    graphicsMapRef.current.clear();
  };
}, [worldContainer]);
```

**Replace the redraw useEffect** (currently lines ~342–362) with:

```ts
// Incremental redraw — only rebuild Graphics for doors whose state changed.
useEffect(() => {
  const container = containerRef.current;
  if (!container) {
    return;
  }

  const map = graphicsMapRef.current;
  const currentIds = new Set(doors.map((d) => d.id));

  // Remove Graphics for deleted doors
  for (const [id, entry] of map) {
    if (!currentIds.has(id)) {
      container.removeChild(entry.g);
      entry.g.destroy();
      map.delete(id);
    }
  }

  // Add or update doors
  for (const door of doors) {
    const isSelected = selectedIds.includes(door.id);
    const key = doorStateKey(door, isWorldView, isSelected);
    const existing = map.get(door.id);

    if (existing) {
      if (existing.key === key) {
        continue; // State unchanged — skip
      }
      // State changed — destroy old Graphics and fall through to create new
      container.removeChild(existing.g);
      existing.g.destroy();
    }

    const g = createDoorGraphics(door, isWorldView, isSelected);
    if (!isWorldView) {
      makeHandlers(door, g);
    }
    container.addChild(g);
    map.set(door.id, { g, key });
  }
}, [containerRef, doors, isWorldView, selectedIds, makeHandlers]);
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- --reporter=verbose src/components/Canvas/__tests__/DoorLayer.test.ts
```

Expected: PASS.

**Step 5: Run full test suite and lint**

```bash
npm run test:run && npm run lint
```

Expected: all tests pass, no lint errors.

**Step 6: Commit**

```bash
git add src/components/Canvas/DoorLayer.tsx src/components/Canvas/__tests__/DoorLayer.test.ts
git commit -m "perf(DoorLayer): keyed-Map incremental update (skip unchanged doors)"
```

---

## Task 3: PressureSensitiveLine — split shader and geometry effects

**Files:**

- Modify: `src/components/Canvas/PressureSensitiveLine.tsx`
- Test: existing `src/components/Canvas/drawing/__tests__/pressureWidth.test.ts` (verify still passes)

**What changes:** The single `useEffect` that creates Mesh + Shader + Geometry from scratch is split into:

- **Effect 1** (deps: `stroke`, `opacity`, `worldContainer`): creates `UniformGroup` + `Shader`, stores in `shaderRef`. If a Mesh already exists, updates its shader.
- **Effect 2** (deps: `id`, `points`, `pressures`, `strokeWidth`, `worldContainer`): builds `MeshGeometry`. If a Mesh already exists, swaps its geometry (destroys old). Otherwise creates a new `Mesh` using `shaderRef.current`.

**Why this helps:** When only `points` change (e.g., future live drawing), Effect 1 does not run — the Shader/UniformGroup/GlProgram are reused. The `GlProgram` is already shared via `getSharedGlProgram()`, but avoiding `new UniformGroup` + `new Shader` per update still reduces allocations.

**Timing guarantee:** React runs effects in definition order. Effect 1 always runs before Effect 2 on the same render. So when both fire on initial mount, Effect 1 sets `shaderRef.current` before Effect 2 reads it. ✓

**Step 1: There are no new unit-testable pure functions to add here.** Verify the existing `pressureWidth` and `strokeGeometry` tests still pass before touching anything:

```bash
npm run test:run -- --reporter=verbose src/components/Canvas/drawing/__tests__/
```

Expected: PASS.

**Step 2: Implement the split effects**

Replace `src/components/Canvas/PressureSensitiveLine.tsx` with the following. The GLSL shaders, `getSharedGlProgram`, props interface, and `PressureSensitiveLine` memo wrapper are unchanged. Only the component body changes.

```tsx
/**
 * PressureSensitiveLine — PixiJS Mesh implementation
 *
 * Renders a variable-width stroke ribbon using a PixiJS Mesh driven by
 * buildStrokeGeometry(). The component is imperative: it adds a Mesh to
 * worldContainer on mount and removes it on unmount, returning null from JSX.
 *
 * Performance notes:
 * - Wrapped in React.memo — only re-renders when props change.
 * - Two separate effects split shader lifecycle from geometry lifecycle:
 *   Effect 1 (deps: stroke, opacity, worldContainer) — creates UniformGroup +
 *     Shader once; updates mesh.shader when color changes.
 *   Effect 2 (deps: id, points, pressures, strokeWidth, worldContainer) — creates
 *     MeshGeometry and either swaps mesh.geometry (if Mesh exists) or creates a
 *     new Mesh using the shader from Effect 1.
 * - This avoids recreating the Shader/UniformGroup on every geometry update.
 * - zIndex = 30 keeps strokes above the map background (10) and grid (20).
 */

import { useEffect, useRef, memo } from 'react';

import { GlProgram, Mesh, MeshGeometry, Shader, UniformGroup } from 'pixi.js';

import { buildStrokeGeometry } from './drawing/strokeGeometry';
import { hexToRgbFloats } from '../../utils/pixiColor';

import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// GLSL shaders (unchanged)
// ---------------------------------------------------------------------------

const VERTEX_GLSL = `
in vec2 aPosition;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`.trim();

const FRAGMENT_GLSL = `
uniform vec4 uColor;

out vec4 outColor;

void main(void) {
  outColor = uColor;
}
`.trim();

// ---------------------------------------------------------------------------
// Shared cached GlProgram (reused across all instances)
// ---------------------------------------------------------------------------

let _sharedGlProgram: GlProgram | null = null;

function getSharedGlProgram(): GlProgram {
  if (!_sharedGlProgram) {
    _sharedGlProgram = new GlProgram({ vertex: VERTEX_GLSL, fragment: FRAGMENT_GLSL });
  }
  return _sharedGlProgram;
}

// ---------------------------------------------------------------------------
// Props (unchanged)
// ---------------------------------------------------------------------------

interface PressureSensitiveLineProps {
  /** Unique DOM/Pixi id used as Mesh name for debug tooling */
  id: string;
  /** Flat coordinate array [x0, y0, x1, y1, …] */
  points: number[];
  /** Per-point pressure values [p0, p1, …], length === points.length / 2 */
  pressures?: number[];
  /** Hex colour string e.g. "#e87722" */
  stroke: string;
  /** Base stroke width in pixels (scaled by pressure) */
  strokeWidth: number;
  /** Alpha value 0.0–1.0, default 1.0 */
  opacity?: number;
  /** PixiJS Container to add the Mesh to */
  worldContainer: Container | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PressureSensitiveLineComponent({
  id,
  points,
  pressures,
  stroke,
  strokeWidth,
  opacity = 1,
  worldContainer,
}: PressureSensitiveLineProps): null {
  const meshRef = useRef<Mesh<MeshGeometry, Shader> | null>(null);
  const shaderRef = useRef<Shader | null>(null);

  // ---------------------------------------------------------------------------
  // Effect 1: Shader lifecycle
  // Recreates UniformGroup + Shader only when color or opacity changes.
  // If a Mesh already exists, updates its shader reference.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!worldContainer) {
      return;
    }

    const [r, g, b] = hexToRgbFloats(stroke);
    const uniformGroup = new UniformGroup({
      uColor: { value: new Float32Array([r, g, b, opacity]), type: 'vec4<f32>' },
    });
    const shader = new Shader({
      glProgram: getSharedGlProgram(),
      resources: { uniforms: uniformGroup },
    });

    shaderRef.current = shader;

    // If a Mesh is already live, hot-swap its shader so color changes
    // take effect without requiring a full mesh rebuild.
    if (meshRef.current) {
      meshRef.current.shader = shader;
    }

    return () => {
      shaderRef.current = null;
    };
  }, [stroke, opacity, worldContainer]);

  // ---------------------------------------------------------------------------
  // Effect 2: Mesh + geometry lifecycle
  // Creates MeshGeometry on every points/pressure/strokeWidth change.
  // If the Mesh already exists, swaps geometry in-place (avoids Mesh recreate).
  // Creates the Mesh on first run using shaderRef.current from Effect 1.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!worldContainer || points.length < 4) {
      return;
    }

    const shader = shaderRef.current;
    if (!shader) {
      return;
    }

    // Build geometry from current points
    const sampleCount = Math.floor(points.length / 2);
    const samples: Array<{ x: number; y: number; pressure: number }> = [];
    for (let i = 0; i < sampleCount; i++) {
      samples.push({
        x: points[i * 2] ?? 0,
        y: points[i * 2 + 1] ?? 0,
        pressure: pressures?.[i] ?? 1.0,
      });
    }

    const { vertices, indices } = buildStrokeGeometry(samples, strokeWidth);

    if (vertices.length === 0) {
      return;
    }

    const uvs = new Float32Array(vertices.length);
    const geometry = new MeshGeometry({ positions: vertices, uvs, indices });

    if (meshRef.current) {
      // Mesh already exists — swap geometry, destroy old
      const oldGeometry = meshRef.current.geometry;
      meshRef.current.geometry = geometry;
      oldGeometry.destroy();
    } else {
      // First render — create mesh and add to container
      const mesh = new Mesh({ geometry, shader });
      mesh.name = id;
      mesh.zIndex = 30;
      worldContainer.addChild(mesh);
      meshRef.current = mesh;
    }

    return () => {
      if (meshRef.current) {
        worldContainer.removeChild(meshRef.current);
        meshRef.current.destroy();
        meshRef.current = null;
      }
    };
  }, [id, points, pressures, strokeWidth, worldContainer]);

  return null;
}

/**
 * Memoized export — only re-renders when points, pressures, stroke, or
 * strokeWidth change.
 */
const PressureSensitiveLine = memo(PressureSensitiveLineComponent);

PressureSensitiveLine.displayName = 'PressureSensitiveLine';

export default PressureSensitiveLine;
```

**Step 3: Run the drawing tests and full suite**

```bash
npm run test:run -- --reporter=verbose src/components/Canvas/drawing/__tests__/
```

Expected: PASS.

```bash
npm run test:run && npm run lint
```

Expected: all tests pass, no lint errors.

**Step 4: Build verification**

```bash
npm run build:web
```

Expected: build completes without errors.

**Step 5: Commit**

```bash
git add src/components/Canvas/PressureSensitiveLine.tsx
git commit -m "perf(PressureSensitiveLine): split shader/geometry effects to avoid shader recreate on geometry change"
```

---

## Final Verification

After all three tasks are committed:

```bash
npm run test:run && npm run type-check && npm run lint && npm run build:web
```

Expected: all pass. The branch is ready to keep as-is or open as a PR.
