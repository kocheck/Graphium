# PixiJS Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Konva with PixiJS v8 across the entire canvas for GPU-accelerated rendering, a GLSL fog of war shader, and a Mesh-based pressure-sensitive drawing system.

**Architecture:** Full phased replacement — Infrastructure → Static Layers → Tokens → Fog → Drawing → Cutover. Each phase has exit criteria; do not proceed until tests pass. Store, services, types, and vision utils are untouched throughout.

**Tech Stack:** pixi.js v8, @pixi/react v8, @pixi-essentials/transformer, React 19, TypeScript, Vitest, ESLint (.eslintrc.cjs)

**Design doc:** `docs/plans/2026-03-17-pixijs-migration-design.md`

---

## Phase 0 — Infrastructure

### Task 0.1: Audit React 19 compatibility

**Files:**

- Read: `package.json`

**Step 1: Run compatibility check**

```bash
npx react-codemod@latest --dry-run ./src
```

**Step 2: Check peer deps for React 19 blockers**

```bash
npm install --dry-run react@^19 react-dom@^19 2>&1 | grep -i "peer\|conflict\|warn"
```

Note any packages that conflict. Common ones: `@testing-library/react` (needs v15+ for React 19), `react-easy-crop` (check current version).

**Step 3: Commit audit notes**

```bash
git commit --allow-empty -m "chore: React 19 compatibility audit — see PR description"
```

---

### Task 0.2: Upgrade React 18 → 19

**Files:**

- Modify: `package.json`
- Modify: `src/main.tsx`

**Step 1: Install React 19**

```bash
npm install react@^19 react-dom@^19 @types/react@^19 @types/react-dom@^19 @testing-library/react@^16
```

**Step 2: Check for `ReactDOM.render` (removed in React 19)**

```bash
grep -r "ReactDOM\.render\|ReactDOM\.hydrate" src/
```

If found, replace with `createRoot`:

```tsx
// Before
ReactDOM.render(<App />, document.getElementById('root'));
// After
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<App />);
```

**Step 3: Check for legacy string refs (removed in React 19)**

```bash
grep -r "ref=['\"]" src/
```

Replace any found with callback refs or `useRef`.

**Step 4: Verify type-check passes**

```bash
npm run type-check
```

Expected: 0 errors (or only Konva-related errors that will be fixed in Task 0.4).

**Step 5: Verify tests still pass**

```bash
npm run test:run
```

Expected: all green.

**Step 6: Commit**

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "chore(deps): upgrade React 18 → 19"
```

---

### Task 0.3: Install PixiJS dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install PixiJS**

```bash
npm install pixi.js@^8 @pixi/react@^8 @pixi-essentials/transformer
```

**Step 2: Verify PixiJS imports resolve**

Create a temporary smoke test at `src/components/Canvas/__pixi-smoke-test.ts`:

```ts
import { Application, Container, Graphics, Sprite, Mesh, Filter } from 'pixi.js';
import { Stage } from '@pixi/react';
// If this file type-checks, PixiJS is installed correctly
export type _Smoke = Application | Container | Graphics | Sprite | Mesh | Filter | typeof Stage;
```

```bash
npm run type-check
```

**Step 3: Delete the smoke test file**

```bash
rm src/components/Canvas/__pixi-smoke-test.ts
```

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): install pixi.js v8 + @pixi/react v8"
```

---

### Task 0.4: Add no-konva ESLint rule

**Files:**

- Modify: `.eslintrc.cjs`

**Step 1: Add the rule** — inside the `rules` object, add after the `import/no-cycle` entry:

```js
// Enforce PixiJS migration — no Konva imports allowed
'no-restricted-imports': [
  'error',
  {
    paths: [
      {
        name: 'konva',
        message: 'Konva has been replaced with PixiJS. Use pixi.js instead.',
      },
      {
        name: 'react-konva',
        message: 'react-konva has been replaced with @pixi/react. Use pixi.js/@pixi/react instead.',
      },
    ],
    patterns: [
      {
        group: ['konva/*', 'konva/lib/*'],
        message: 'Konva has been replaced with PixiJS.',
      },
    ],
  },
],
```

**Step 2: Verify the rule triggers on Konva files (expected lint errors)**

```bash
npm run lint 2>&1 | grep -c "no-restricted-imports"
```

Expected: a non-zero count (all existing Konva imports will now be flagged — that's correct).

**Step 3: Commit**

```bash
git add .eslintrc.cjs
git commit -m "chore(lint): add no-konva ESLint rule to enforce PixiJS migration"
```

---

### Task 0.5: Remove Konva + scaffold PixiJS Application in CanvasManager

**Files:**

- Modify: `src/components/Canvas/CanvasManager.tsx`

**Goal:** Replace `<Stage>` with `<Application>` from `@pixi/react`. Nothing visual will work yet except a blank canvas — that's expected. Konva layers, shapes, and hooks are commented out (not deleted — they're the migration reference). `react-konva` and `konva` imports are removed.

**Step 1: At the top of `CanvasManager.tsx`, replace Konva imports:**

```tsx
// REMOVE these:
// import { Stage, Layer, Line, Rect, Transformer, Group, Text, Circle } from 'react-konva';
// import type { KonvaEventObject } from 'konva/lib/Node';

// ADD these:
import { Application } from '@pixi/react';
import type { Application as PixiApplication } from 'pixi.js';
```

**Step 2: Replace the `<Stage>` JSX with `<Application>`:**

```tsx
// REMOVE the <Stage ...> block entirely.
// REPLACE with:
<Application
  width={dimensions.width}
  height={dimensions.height}
  onInit={(app: PixiApplication) => {
    // app is the PixiJS Application instance — store in ref if needed
  }}
  options={{
    backgroundColor: 0x1a1008, // --app-canvas-bg (dark parchment)
    antialias: true,
    resolution: PERFORMANCE_CONFIG.maxPixelRatio,
    autoDensity: true,
  }}
/>
```

**Step 3: Comment out (do not delete) all Konva layer components and hooks:**

```tsx
// TODO Phase 1: GridOverlay, PaperNoiseOverlay, URLImage (map background)
// TODO Phase 2: TokenLayer, useTokenDrag, useCanvasSelection, Transformer
// TODO Phase 3: FogOfWarLayer
// TODO Phase 4: PressureSensitiveLine, useCanvasDrawing
// TODO Phase 5: DoorLayer, StairsLayer, MeasurementOverlay, MovementRangeOverlay
```

**Step 4: Verify app boots with blank canvas**

```bash
npm run dev
```

Expected: app opens, canvas area shows a blank dark rectangle, no console errors.

**Step 5: Verify type-check with Konva errors gone**

```bash
npm run type-check
```

Expected: 0 errors (or only errors in commented-out files that haven't been migrated yet).

**Step 6: Commit**

```bash
git add src/components/Canvas/CanvasManager.tsx
git commit -m "feat(canvas): replace Konva Stage with PixiJS Application scaffold"
```

---

### Phase 0 Exit Criteria

- [ ] `npm run type-check` — 0 errors
- [ ] `npm run test:run` — all pass
- [ ] `npm run lint` — only `no-restricted-imports` errors on not-yet-migrated files (no new errors)
- [ ] App boots and shows blank dark canvas

---

## Phase 1 — Static Layers

### Task 1.1: Pan/zoom Container + viewport clamping

**Files:**

- Create: `src/components/Canvas/PixiViewport.tsx`
- Create: `src/components/Canvas/hooks/usePixiViewport.ts`

**Context:** In Konva, pan/zoom was managed by setting `x/y/scaleX/scaleY` on the Stage. In PixiJS, we use a root `Container` node whose transform we update. All world-space children go inside this container.

**Step 1: Write the failing test**

Create `src/components/Canvas/hooks/__tests__/usePixiViewport.test.ts`:

```ts
import { clampViewport } from '../usePixiViewport';

describe('clampViewport', () => {
  it('prevents panning beyond map bounds with padding', () => {
    const result = clampViewport(
      { x: 99999, y: 99999 },
      { scale: 1, mapWidth: 2000, mapHeight: 2000, viewWidth: 800, viewHeight: 600 },
    );
    expect(result.x).toBeLessThanOrEqual(1000); // VIEWPORT_CLAMP_PADDING
    expect(result.y).toBeLessThanOrEqual(1000);
  });

  it('allows panning within bounds', () => {
    const result = clampViewport(
      { x: -100, y: -100 },
      { scale: 1, mapWidth: 2000, mapHeight: 2000, viewWidth: 800, viewHeight: 600 },
    );
    expect(result.x).toBe(-100);
    expect(result.y).toBe(-100);
  });
});
```

**Step 2: Run to confirm fail**

```bash
npm run test:run -- --reporter=verbose src/components/Canvas/hooks/__tests__/usePixiViewport.test.ts
```

Expected: FAIL — `clampViewport` not found.

**Step 3: Create `src/components/Canvas/hooks/usePixiViewport.ts`**

```ts
import { useRef, useCallback } from 'react';

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
  scale: React.MutableRefObject<number>;
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
  const scale = useRef(1);
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback(
    (x: number, y: number, s: number) => {
      const container = worldContainerRef.current;
      if (!container) return;
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
      if (!container) return;
      const oldScale = scale.current;
      const direction = e.deltaY < 0 ? 1 : -1;
      const newScale = Math.min(
        Math.max(oldScale * Math.pow(ZOOM_SCALE_BY, direction), MIN_SCALE),
        MAX_SCALE,
      );
      scale.current = newScale;
      // Zoom toward cursor
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const worldX = (mouseX - container.position.x) / oldScale;
      const worldY = (mouseY - container.position.y) / oldScale;
      const newX = mouseX - worldX * newScale;
      const newY = mouseY - worldY * newScale;
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
      if (!isPanning.current) return;
      const container = worldContainerRef.current;
      if (!container) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      applyTransform(container.position.x + dx, container.position.y + dy, scale.current);
    },
    [applyTransform],
  );

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const container = worldContainerRef.current;
    if (!container) return { x: screenX, y: screenY };
    return {
      x: (screenX - container.position.x) / scale.current,
      y: (screenY - container.position.y) / scale.current,
    };
  }, []);

  return {
    worldContainerRef,
    scale,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    screenToWorld,
  };
}
```

**Step 4: Run tests to confirm pass**

```bash
npm run test:run -- --reporter=verbose src/components/Canvas/hooks/__tests__/usePixiViewport.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/Canvas/hooks/usePixiViewport.ts src/components/Canvas/hooks/__tests__/usePixiViewport.test.ts
git commit -m "feat(canvas): add usePixiViewport with clamp + zoom-to-cursor"
```

---

### Task 1.2: Map background Sprite

**Files:**

- Create: `src/components/Canvas/MapBackground.tsx`

**Context:** `URLImage.tsx` currently loads images via Konva's `<Image>`. In PixiJS, images are `Sprite` + `Texture`. We use `Assets.load()` to fetch and cache the texture.

**Step 1: Create `src/components/Canvas/MapBackground.tsx`**

```tsx
import { useEffect, useRef } from 'react';

import { Assets, Sprite, type Container } from 'pixi.js';

interface MapBackgroundProps {
  imageUrl: string | null;
  worldContainer: Container | null;
  brightness?: number; // 0–2, default 1
  blur?: number; // pixels, default 0
}

export function MapBackground({
  imageUrl,
  worldContainer,
  brightness = 1,
  blur = 0,
}: MapBackgroundProps): null {
  const spriteRef = useRef<Sprite | null>(null);

  useEffect(() => {
    if (!worldContainer || !imageUrl) return;

    let cancelled = false;
    void Assets.load<Texture>(imageUrl).then((texture) => {
      if (cancelled) return;
      const sprite = new Sprite(texture);
      sprite.zIndex = 0;
      // Brightness via ColorMatrixFilter
      if (brightness !== 1 || blur > 0) {
        const filters = [];
        if (brightness !== 1) {
          const { ColorMatrixFilter } = await import('pixi.js');
          const cm = new ColorMatrixFilter();
          cm.brightness(brightness, false);
          filters.push(cm);
        }
        if (blur > 0) {
          const { BlurFilter } = await import('pixi.js');
          filters.push(new BlurFilter({ strength: blur }));
        }
        sprite.filters = filters;
      }
      worldContainer.addChildAt(sprite, 0);
      spriteRef.current = sprite;
    });

    return () => {
      cancelled = true;
      if (spriteRef.current) {
        worldContainer.removeChild(spriteRef.current);
        spriteRef.current.destroy();
        spriteRef.current = null;
      }
    };
  }, [imageUrl, worldContainer, brightness, blur]);

  return null;
}
```

**Step 2: Wire into CanvasManager**

In `CanvasManager.tsx`, inside the `<Application>` `onInit` callback, pass `worldContainer` to `MapBackground`. Uncomment the map background section in the TODO list.

**Step 3: Test manually**

```bash
npm run dev
```

Load a campaign with a map image. Expected: map renders as full background image.

**Step 4: Commit**

```bash
git add src/components/Canvas/MapBackground.tsx src/components/Canvas/CanvasManager.tsx
git commit -m "feat(canvas): map background as PixiJS Sprite with filter support"
```

---

### Task 1.3: Grid overlay

**Files:**

- Modify: `src/components/Canvas/GridOverlay.tsx`

**Context:** Current `GridOverlay.tsx` uses `react-konva` `<Line>` components. Replace with imperative PixiJS `Graphics`.

**Step 1: Write the failing test**

`src/components/Canvas/__tests__/GridOverlay.test.ts`:

```ts
import { buildGridGeometry } from '../GridOverlay';

describe('buildGridGeometry', () => {
  it('generates correct number of horizontal lines for square grid', () => {
    const lines = buildGridGeometry({
      gridSize: 100,
      mapWidth: 400,
      mapHeight: 300,
      gridType: 'square',
    });
    // 3 interior horizontal lines (y=100, y=200, y=300 edges not counted)
    expect(lines.horizontal.length).toBe(4); // 300/100 + 1 = 4
    expect(lines.vertical.length).toBe(5); // 400/100 + 1 = 5
  });
});
```

**Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/Canvas/__tests__/GridOverlay.test.ts
```

**Step 3: Rewrite `GridOverlay.tsx`**

Export a pure `buildGridGeometry` function (testable) and a React component that imperatively draws to a `Graphics` object:

```tsx
import { useEffect, useRef } from 'react';
import { Graphics, type Container } from 'pixi.js';

interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface GridGeometry {
  horizontal: GridLine[];
  vertical: GridLine[];
}

interface BuildGridOptions {
  gridSize: number;
  mapWidth: number;
  mapHeight: number;
  gridType: 'square' | 'hex';
}

export function buildGridGeometry({
  gridSize,
  mapWidth,
  mapHeight,
}: BuildGridOptions): GridGeometry {
  const horizontal: GridLine[] = [];
  const vertical: GridLine[] = [];
  for (let y = 0; y <= mapHeight; y += gridSize) {
    horizontal.push({ x1: 0, y1: y, x2: mapWidth, y2: y });
  }
  for (let x = 0; x <= mapWidth; x += gridSize) {
    vertical.push({ x1: x, y1: 0, x2: x, y2: mapHeight });
  }
  return { horizontal, vertical };
}

interface GridOverlayProps {
  gridSize: number;
  gridColor: string;
  gridOpacity: number;
  mapWidth: number;
  mapHeight: number;
  gridType: 'square' | 'hex';
  worldContainer: Container | null;
}

export function GridOverlay({
  gridSize,
  gridColor,
  gridOpacity,
  mapWidth,
  mapHeight,
  gridType,
  worldContainer,
}: GridOverlayProps): null {
  const graphicsRef = useRef<Graphics | null>(null);

  useEffect(() => {
    if (!worldContainer) return;
    const g = new Graphics();
    g.zIndex = 10;
    worldContainer.addChild(g);
    graphicsRef.current = g;
    return () => {
      worldContainer.removeChild(g);
      g.destroy();
      graphicsRef.current = null;
    };
  }, [worldContainer]);

  useEffect(() => {
    const g = graphicsRef.current;
    if (!g) return;
    g.clear();
    const color = parseInt(gridColor.replace('#', ''), 16);
    const { horizontal, vertical } = buildGridGeometry({ gridSize, mapWidth, mapHeight, gridType });
    g.setStrokeStyle({ width: 1, color, alpha: gridOpacity });
    [...horizontal, ...vertical].forEach(({ x1, y1, x2, y2 }) => {
      g.moveTo(x1, y1).lineTo(x2, y2);
    });
    g.stroke();
  }, [gridSize, gridColor, gridOpacity, mapWidth, mapHeight, gridType]);

  return null;
}
```

**Step 4: Run tests**

```bash
npm run test:run -- src/components/Canvas/__tests__/GridOverlay.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/Canvas/GridOverlay.tsx src/components/Canvas/__tests__/GridOverlay.test.ts
git commit -m "feat(canvas): rewrite GridOverlay with PixiJS Graphics"
```

---

### Task 1.4: PaperNoiseOverlay

**Files:**

- Modify: `src/components/Canvas/PaperNoiseOverlay.tsx`

**Context:** Currently renders a noise texture via Konva. Replace with a PixiJS `Sprite` using a pre-generated noise `Texture` or the existing noise image asset.

**Step 1: Rewrite to use a PixiJS tiling Sprite**

```tsx
import { useEffect, useRef } from 'react';
import { Assets, TilingSprite, type Container } from 'pixi.js';

interface PaperNoiseOverlayProps {
  worldContainer: Container | null;
  mapWidth: number;
  mapHeight: number;
  opacity?: number;
}

export function PaperNoiseOverlay({
  worldContainer,
  mapWidth,
  mapHeight,
  opacity = 0.04,
}: PaperNoiseOverlayProps): null {
  const spriteRef = useRef<TilingSprite | null>(null);

  useEffect(() => {
    if (!worldContainer) return;
    let cancelled = false;
    void Assets.load<Texture>('/noise.png').then((texture) => {
      if (cancelled) return;
      const sprite = new TilingSprite({ texture, width: mapWidth, height: mapHeight });
      sprite.zIndex = 5;
      sprite.alpha = opacity;
      sprite.blendMode = 'multiply';
      worldContainer.addChild(sprite);
      spriteRef.current = sprite;
    });
    return () => {
      cancelled = true;
      if (spriteRef.current) {
        worldContainer.removeChild(spriteRef.current);
        spriteRef.current.destroy();
        spriteRef.current = null;
      }
    };
  }, [worldContainer, mapWidth, mapHeight, opacity]);

  return null;
}
```

**Step 2: Test manually**

```bash
npm run dev
```

Expected: subtle paper texture overlays the map.

**Step 3: Commit**

```bash
git add src/components/Canvas/PaperNoiseOverlay.tsx
git commit -m "feat(canvas): rewrite PaperNoiseOverlay with PixiJS TilingSprite"
```

---

### Phase 1 Exit Criteria

- [ ] Map image renders correctly
- [ ] Grid renders at correct size and color
- [ ] Paper noise overlay visible
- [ ] Pan (middle-click drag) works
- [ ] Zoom (scroll wheel) works with zoom-to-cursor
- [ ] `npm run type-check` — 0 errors
- [ ] `npm run test:run` — all pass

---

## Phase 2 — Token Layer

### Task 2.1: Texture cache + token Sprite rendering

**Files:**

- Create: `src/components/Canvas/TextureCache.ts`
- Modify: `src/components/Canvas/TokenLayer.tsx`

**Step 1: Write the failing test**

`src/components/Canvas/__tests__/TextureCache.test.ts`:

```ts
import { getOrLoadTexture } from '../TextureCache';

describe('getOrLoadTexture', () => {
  it('returns the same promise for duplicate URLs (deduplication)', () => {
    const p1 = getOrLoadTexture('https://example.com/token.png');
    const p2 = getOrLoadTexture('https://example.com/token.png');
    expect(p1).toBe(p2); // Same promise object = deduplicated
  });
});
```

**Step 2: Create `src/components/Canvas/TextureCache.ts`**

```ts
import { Assets } from 'pixi.js';
import type { Texture } from 'pixi.js';

const inFlight = new Map<string, Promise<Texture>>();

export function getOrLoadTexture(url: string): Promise<Texture> {
  const existing = inFlight.get(url);
  if (existing) return existing;
  const promise = Assets.load<Texture>(url);
  inFlight.set(url, promise);
  return promise;
}

export function evictTexture(url: string): void {
  inFlight.delete(url);
  void Assets.unload(url);
}
```

**Step 3: Run tests**

```bash
npm run test:run -- src/components/Canvas/__tests__/TextureCache.test.ts
```

**Step 4: Rewrite `TokenLayer.tsx`**

Replace the 8-line Konva stub with a PixiJS component that renders each token as a `Sprite`:

```tsx
import { useEffect, useRef } from 'react';
import { Container, Sprite, type Application } from 'pixi.js';
import { getOrLoadTexture } from './TextureCache';
import { useGameStore } from '../../store/gameStore';
import type { Token } from '../../types/domain';

interface TokenLayerProps {
  app: Application | null;
  worldContainer: Container | null;
  gridSize: number;
}

export function TokenLayer({ worldContainer, gridSize }: TokenLayerProps): null {
  const tokens = useGameStore((s) => s.tokens);
  const containerRef = useRef<Container | null>(null);
  const spritesRef = useRef<Map<string, Sprite>>(new Map());

  useEffect(() => {
    if (!worldContainer) return;
    const c = new Container();
    c.zIndex = 50;
    worldContainer.addChild(c);
    containerRef.current = c;
    return () => {
      worldContainer.removeChild(c);
      c.destroy({ children: true });
    };
  }, [worldContainer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentIds = new Set(tokens.map((t) => t.id));

    // Remove sprites for deleted tokens
    for (const [id, sprite] of spritesRef.current) {
      if (!currentIds.has(id)) {
        container.removeChild(sprite);
        sprite.destroy();
        spritesRef.current.delete(id);
      }
    }

    // Add/update sprites
    tokens.forEach((token) => {
      const existing = spritesRef.current.get(token.id);
      const size = gridSize * token.scale;

      if (!existing && token.imageUrl) {
        void getOrLoadTexture(token.imageUrl).then((texture) => {
          const sprite = new Sprite(texture);
          sprite.width = size;
          sprite.height = size;
          sprite.position.set(token.x, token.y);
          sprite.eventMode = 'static';
          sprite.cursor = 'pointer';
          container.addChild(sprite);
          spritesRef.current.set(token.id, sprite);
        });
      } else if (existing) {
        existing.width = size;
        existing.height = size;
        existing.position.set(token.x, token.y);
      }
    });
  }, [tokens, gridSize]);

  return null;
}
```

**Step 5: Test manually in dev**

```bash
npm run dev
```

Expected: tokens render on canvas.

**Step 6: Commit**

```bash
git add src/components/Canvas/TextureCache.ts src/components/Canvas/__tests__/TextureCache.test.ts src/components/Canvas/TokenLayer.tsx
git commit -m "feat(canvas): token rendering as PixiJS Sprites with texture deduplication"
```

---

### Task 2.2: Token drag system

**Files:**

- Modify: `src/components/Canvas/hooks/useTokenDrag.ts`

**Context:** Current `useTokenDrag` uses `KonvaEventObject`. Replace with `FederatedPointerEvent`. Key behavior: snap-to-grid on release, alt+drag to duplicate, multi-token drag.

**Step 1: Write failing test**

`src/components/Canvas/hooks/__tests__/useTokenDrag.test.ts`:

```ts
import { snapPositionToGrid } from '../useTokenDrag';

describe('snapPositionToGrid', () => {
  it('snaps to nearest grid cell', () => {
    expect(snapPositionToGrid({ x: 110, y: 90 }, 100)).toEqual({ x: 100, y: 100 });
  });

  it('snaps down when below half-cell', () => {
    expect(snapPositionToGrid({ x: 149, y: 149 }, 100)).toEqual({ x: 100, y: 100 });
  });

  it('snaps up when at or above half-cell', () => {
    expect(snapPositionToGrid({ x: 150, y: 150 }, 100)).toEqual({ x: 200, y: 200 });
  });
});
```

**Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/Canvas/hooks/__tests__/useTokenDrag.test.ts
```

**Step 3: Rewrite `useTokenDrag.ts`**

Key changes:

- Replace `KonvaEventObject` with `FederatedPointerEvent` from `pixi.js`
- Export `snapPositionToGrid` as a pure function (enables unit testing)
- Wire `pointerdown`, `globalpointermove`, `pointerup` on the PixiJS stage
- Keep the same return interface shape so CanvasManager wiring is minimal

```ts
import { useRef, useCallback, useState } from 'react';
import type { FederatedPointerEvent } from 'pixi.js';
import { useGameStore } from '../../../store/gameStore';

export function snapPositionToGrid(
  pos: { x: number; y: number },
  gridSize: number,
): { x: number; y: number } {
  return {
    x: Math.round(pos.x / gridSize) * gridSize,
    y: Math.round(pos.y / gridSize) * gridSize,
  };
}

// ... full hook implementation using FederatedPointerEvent
// Mirrors the existing hook's return interface for drop-in replacement
```

**Step 4: Run tests**

```bash
npm run test:run -- src/components/Canvas/hooks/__tests__/useTokenDrag.test.ts
```

**Step 5: Commit**

```bash
git add src/components/Canvas/hooks/useTokenDrag.ts src/components/Canvas/hooks/__tests__/useTokenDrag.test.ts
git commit -m "feat(canvas): rewrite useTokenDrag with FederatedPointerEvent + snap tests"
```

---

### Task 2.3: Selection rect + multi-select

**Files:**

- Modify: `src/components/Canvas/hooks/useCanvasSelection.ts`

**Context:** Selection rect uses `globalpointermove` in PixiJS v8 (fires over empty space). Replace `KonvaEventObject` with `FederatedPointerEvent`.

**Step 1: Write failing test**

```ts
import { rectsOverlap } from '../useCanvasSelection';

describe('rectsOverlap', () => {
  it('returns true when rects overlap', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50, w: 100, h: 100 })).toBe(
      true,
    );
  });
  it('returns false when rects are adjacent', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 100, h: 100 }, { x: 100, y: 0, w: 100, h: 100 })).toBe(
      false,
    );
  });
});
```

**Step 2: Export `rectsOverlap` from the hook and implement**

**Step 3: Run and verify tests pass**

```bash
npm run test:run -- src/components/Canvas/hooks/__tests__/useCanvasSelection.test.ts
```

**Step 4: Commit**

```bash
git add src/components/Canvas/hooks/useCanvasSelection.ts src/components/Canvas/hooks/__tests__/useCanvasSelection.test.ts
git commit -m "feat(canvas): rewrite useCanvasSelection with PixiJS globalpointermove"
```

---

### Task 2.4: Transformer (resize/rotate handles)

**Files:**

- Modify: `src/components/Canvas/TokenLayer.tsx`

**Context:** Use `@pixi-essentials/transformer`. The `Transformer` wraps selected sprites and provides scale/rotate handles.

**Step 1: Install (already done in Task 0.3). Wire into TokenLayer:**

```tsx
import { Transformer } from '@pixi-essentials/transformer';

// Inside TokenLayer, when selectedIds changes:
useEffect(() => {
  if (!containerRef.current) return;
  // Remove old transformer
  transformerRef.current?.destroy();

  const selectedSprites = selectedIds
    .map((id) => spritesRef.current.get(id))
    .filter((s): s is Sprite => s !== undefined);

  if (selectedSprites.length === 0) return;

  const transformer = new Transformer({
    group: selectedSprites,
    // onChange: update store positions
  });
  containerRef.current.addChild(transformer);
  transformerRef.current = transformer;
}, [selectedIds]);
```

**Step 2: Test manually**

```bash
npm run dev
```

Expected: clicking a token selects it and shows transform handles.

**Step 3: Commit**

```bash
git add src/components/Canvas/TokenLayer.tsx
git commit -m "feat(canvas): add @pixi-essentials/transformer for token resize/rotate"
```

---

### Phase 2 Exit Criteria

- [ ] Tokens render at correct positions and sizes
- [ ] Token drag with snap-to-grid works
- [ ] Multi-select via drag rect works
- [ ] Transform handles appear on selection
- [ ] FPS is stable at 60 with 5–20 tokens
- [ ] `npm run test:run` — all pass

---

## Phase 3 — Fog of War (GLSL Shader)

### Task 3.1: Fog shader uniform calculation utilities

**Files:**

- Create: `src/components/Canvas/shaders/fogUniforms.ts`
- Create: `src/components/Canvas/shaders/__tests__/fogUniforms.test.ts`

**Context:** The shader receives light sources as flat float arrays (not objects). These utility functions convert world-space token data into shader-compatible uniform arrays. They are pure functions — fully unit testable without a GPU.

**Step 1: Write the failing tests**

`src/components/Canvas/shaders/__tests__/fogUniforms.test.ts`:

```ts
import { tokensToLightUniforms, worldToUV } from '../fogUniforms';

describe('worldToUV', () => {
  it('converts world coords to UV 0–1 range', () => {
    const uv = worldToUV({ x: 500, y: 250 }, { mapWidth: 1000, mapHeight: 500 });
    expect(uv).toEqual({ u: 0.5, v: 0.5 });
  });

  it('clamps to 0–1', () => {
    const uv = worldToUV({ x: -100, y: 9999 }, { mapWidth: 1000, mapHeight: 500 });
    expect(uv.u).toBe(0);
    expect(uv.v).toBe(1);
  });
});

describe('tokensToLightUniforms', () => {
  it('packs token light data into flat Float32Array', () => {
    const tokens = [
      {
        id: 'a',
        x: 500,
        y: 250,
        visionRadius: 100,
        lightColor: [1, 0.8, 0.5] as [number, number, number],
      },
    ];
    const result = tokensToLightUniforms(tokens, { mapWidth: 1000, mapHeight: 500, gridSize: 50 });
    // Each token: [u, v, radiusUV, r, g, b, falloff, _pad] = 8 floats
    expect(result.length).toBe(8);
    expect(result[0]).toBeCloseTo(0.5); // u
    expect(result[1]).toBeCloseTo(0.5); // v
  });

  it('returns zero-filled array for no tokens', () => {
    const result = tokensToLightUniforms([], { mapWidth: 1000, mapHeight: 500, gridSize: 50 });
    expect(result.every((v) => v === 0)).toBe(true);
  });
});
```

**Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/Canvas/shaders/__tests__/fogUniforms.test.ts
```

**Step 3: Create `src/components/Canvas/shaders/fogUniforms.ts`**

```ts
const MAX_LIGHTS = 32; // Must match shader constant
const FLOATS_PER_LIGHT = 8; // [u, v, radius, r, g, b, falloff, _pad]

interface LightToken {
  id: string;
  x: number;
  y: number;
  visionRadius: number;
  lightColor: [number, number, number]; // RGB 0–1
}

interface MapDimensions {
  mapWidth: number;
  mapHeight: number;
  gridSize: number;
}

export function worldToUV(
  pos: { x: number; y: number },
  dims: { mapWidth: number; mapHeight: number },
): { u: number; v: number } {
  return {
    u: Math.min(Math.max(pos.x / dims.mapWidth, 0), 1),
    v: Math.min(Math.max(pos.y / dims.mapHeight, 0), 1),
  };
}

export function tokensToLightUniforms(tokens: LightToken[], dims: MapDimensions): Float32Array {
  const data = new Float32Array(MAX_LIGHTS * FLOATS_PER_LIGHT);
  tokens.slice(0, MAX_LIGHTS).forEach((token, i) => {
    const { u, v } = worldToUV({ x: token.x, y: token.y }, dims);
    const radiusUV = (token.visionRadius * dims.gridSize) / Math.max(dims.mapWidth, dims.mapHeight);
    const offset = i * FLOATS_PER_LIGHT;
    data[offset + 0] = u;
    data[offset + 1] = v;
    data[offset + 2] = radiusUV;
    data[offset + 3] = token.lightColor[0];
    data[offset + 4] = token.lightColor[1];
    data[offset + 5] = token.lightColor[2];
    data[offset + 6] = 2.0; // Quadratic falloff exponent
    data[offset + 7] = 0.0; // pad
  });
  return data;
}
```

**Step 4: Run tests**

```bash
npm run test:run -- src/components/Canvas/shaders/__tests__/fogUniforms.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/Canvas/shaders/fogUniforms.ts src/components/Canvas/shaders/__tests__/fogUniforms.test.ts
git commit -m "feat(fog): fog shader uniform calculation utilities with tests"
```

---

### Task 3.2: GLSL fragment shader

**Files:**

- Create: `src/components/Canvas/shaders/fog.frag.glsl`

**Context:** This shader runs on the GPU. It renders a full-screen quad and for each fragment computes whether it is inside any token's visibility area and how bright it should be.

**Step 1: Create `src/components/Canvas/shaders/fog.frag.glsl`**

```glsl
precision mediump float;

// Texture coordinates from vertex shader
varying vec2 vUvs;

// Fog uniforms
uniform float uFogAlpha;        // Base fog opacity (0–1)
uniform float uRevealAll;       // 1.0 = DM reveal mode, 0.0 = normal
uniform int uLightCount;        // Active light count
uniform vec3 uFogColor;         // Fog color (RGB)
uniform vec3 uExploredColor;    // Explored-but-not-visible color

// Light source data (MAX_LIGHTS × 8 floats packed as vec4 pairs)
// Layout: [u, v, radiusUV, r, g, b, falloff, _pad]
#define MAX_LIGHTS 32
uniform vec4 uLightsA[MAX_LIGHTS]; // [u, v, radiusUV, r]
uniform vec4 uLightsB[MAX_LIGHTS]; // [g, b, falloff, _pad]

void main() {
  if (uRevealAll > 0.5) {
    gl_FragColor = vec4(0.0); // Fully transparent — everything visible
    return;
  }

  vec3 totalLight = vec3(0.0);
  float maxVisibility = 0.0;

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;

    vec2 lightPos = uLightsA[i].xy;
    float radius = uLightsA[i].z;
    vec3 lightColor = vec3(uLightsA[i].w, uLightsB[i].x, uLightsB[i].y);
    float falloff = uLightsB[i].z;

    float dist = distance(vUvs, lightPos);
    if (dist < radius) {
      float t = 1.0 - (dist / radius);
      float intensity = pow(t, falloff); // Quadratic falloff
      totalLight += lightColor * intensity;
      maxVisibility = max(maxVisibility, intensity);
    }
  }

  // Areas with any visibility are clear; full fog elsewhere
  float fogStrength = (1.0 - maxVisibility) * uFogAlpha;
  vec3 fogTint = mix(uExploredColor, uFogColor, clamp(fogStrength, 0.0, 1.0));
  gl_FragColor = vec4(fogTint, fogStrength);
}
```

**Step 2: Configure Vite to import GLSL as strings**

In `vite.config.ts`, add the GLSL asset type:

```ts
assetsInclude: ['**/*.glsl', '**/*.vert', '**/*.frag'];
```

Or use `vite-plugin-glsl`:

```bash
npm install -D vite-plugin-glsl
```

Add to `vite.config.ts`:

```ts
import glsl from 'vite-plugin-glsl';
// plugins: [..., glsl()]
```

**Step 3: Add GLSL type declaration**

Create `src/types/glsl.d.ts`:

```ts
declare module '*.glsl' {
  const value: string;
  export default value;
}
declare module '*.frag' {
  const value: string;
  export default value;
}
declare module '*.vert' {
  const value: string;
  export default value;
}
```

**Step 4: Verify type-check**

```bash
npm run type-check
```

**Step 5: Commit**

```bash
git add src/components/Canvas/shaders/fog.frag.glsl src/types/glsl.d.ts vite.config.ts package.json
git commit -m "feat(fog): GLSL fragment shader for GPU fog of war"
```

---

### Task 3.3: FogOfWarFilter (PixiJS Filter wrapping the shader)

**Files:**

- Create: `src/components/Canvas/FogOfWarFilter.ts`
- Create: `src/components/Canvas/shaders/__tests__/FogOfWarFilter.test.ts`

**Context:** PixiJS `Filter` is the bridge between a GLSL shader and the scene graph. `FogOfWarFilter` extends `Filter`, declares all uniforms, and exposes a typed interface for updating them.

**Step 1: Write the failing test**

```ts
import { FogOfWarFilter } from '../FogOfWarFilter';

describe('FogOfWarFilter', () => {
  it('initializes with default fog alpha of 0.94', () => {
    const filter = new FogOfWarFilter();
    expect(filter.fogAlpha).toBe(0.94);
  });

  it('revealAll=true sets uRevealAll uniform to 1', () => {
    const filter = new FogOfWarFilter();
    filter.revealAll = true;
    expect(filter.uniforms['uRevealAll']).toBe(1.0);
  });

  it('revealAll=false sets uRevealAll uniform to 0', () => {
    const filter = new FogOfWarFilter();
    filter.revealAll = false;
    expect(filter.uniforms['uRevealAll']).toBe(0.0);
  });
});
```

**Step 2: Create `src/components/Canvas/FogOfWarFilter.ts`**

```ts
import { Filter } from 'pixi.js';
import fogFragSrc from './shaders/fog.frag.glsl';
import { tokensToLightUniforms } from './shaders/fogUniforms';
import type { LightToken, MapDimensions } from './shaders/fogUniforms';

export class FogOfWarFilter extends Filter {
  private _fogAlpha = 0.94;
  private _revealAll = false;

  constructor() {
    super({
      glProgram: {
        fragment: fogFragSrc,
      },
      resources: {
        uniforms: {
          uFogAlpha: { value: 0.94, type: 'f32' },
          uRevealAll: { value: 0.0, type: 'f32' },
          uLightCount: { value: 0, type: 'i32' },
          uFogColor: { value: [0.0, 0.0, 0.0], type: 'vec3<f32>' },
          uExploredColor: { value: [0.05, 0.03, 0.02], type: 'vec3<f32>' },
          uLightsA: { value: new Float32Array(32 * 4), type: 'vec4<f32>' },
          uLightsB: { value: new Float32Array(32 * 4), type: 'vec4<f32>' },
        },
      },
    });
  }

  get fogAlpha(): number {
    return this._fogAlpha;
  }
  set fogAlpha(v: number) {
    this._fogAlpha = v;
    this.uniforms['uFogAlpha'] = v;
  }

  get revealAll(): boolean {
    return this._revealAll;
  }
  set revealAll(v: boolean) {
    this._revealAll = v;
    this.uniforms['uRevealAll'] = v ? 1.0 : 0.0;
  }

  updateLights(tokens: LightToken[], dims: MapDimensions): void {
    const data = tokensToLightUniforms(tokens, dims);
    // Deinterleave into A (u,v,radius,r) and B (g,b,falloff,pad) vec4 arrays
    const a = new Float32Array(32 * 4);
    const b = new Float32Array(32 * 4);
    for (let i = 0; i < 32; i++) {
      const src = i * 8;
      a[i * 4 + 0] = data[src + 0];
      a[i * 4 + 1] = data[src + 1];
      a[i * 4 + 2] = data[src + 2];
      a[i * 4 + 3] = data[src + 3];
      b[i * 4 + 0] = data[src + 4];
      b[i * 4 + 1] = data[src + 5];
      b[i * 4 + 2] = data[src + 6];
      b[i * 4 + 3] = data[src + 7];
    }
    this.uniforms['uLightsA'] = a;
    this.uniforms['uLightsB'] = b;
    this.uniforms['uLightCount'] = Math.min(tokens.length, 32);
  }
}
```

**Step 3: Run tests**

```bash
npm run test:run -- src/components/Canvas/shaders/__tests__/FogOfWarFilter.test.ts
```

**Step 4: Commit**

```bash
git add src/components/Canvas/FogOfWarFilter.ts src/components/Canvas/shaders/__tests__/FogOfWarFilter.test.ts
git commit -m "feat(fog): FogOfWarFilter — PixiJS Filter wrapping GLSL fog shader"
```

---

### Task 3.4: FogOfWarLayer component

**Files:**

- Modify: `src/components/Canvas/FogOfWarLayer.tsx`

**Step 1: Rewrite `FogOfWarLayer.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { FogOfWarFilter } from './FogOfWarFilter';
import { useGameStore } from '../../store/gameStore';
import { calculateVisibilityPolygon, getWallSegments } from '../../utils/vision';
import type { ResolvedTokenData } from '../../hooks/useTokenData';

interface FogOfWarLayerProps {
  worldContainer: Container | null;
  tokens: ResolvedTokenData[];
  gridSize: number;
  mapWidth: number;
  mapHeight: number;
  isDMView: boolean;
}

export function FogOfWarLayer({
  worldContainer,
  tokens,
  gridSize,
  mapWidth,
  mapHeight,
  isDMView,
}: FogOfWarLayerProps): null {
  const walls = useGameStore((s) => s.drawings.filter((d) => d.tool === 'wall'));
  const doors = useGameStore((s) => s.doors);
  const filterRef = useRef<FogOfWarFilter | null>(null);
  const fogSpriteRef = useRef<Sprite | null>(null);

  // Mount fog sprite + filter
  useEffect(() => {
    if (!worldContainer) return;
    const filter = new FogOfWarFilter();
    const fogSprite = new Sprite(Texture.WHITE);
    fogSprite.width = mapWidth;
    fogSprite.height = mapHeight;
    fogSprite.zIndex = 100;
    fogSprite.filters = [filter];
    worldContainer.addChild(fogSprite);
    filterRef.current = filter;
    fogSpriteRef.current = fogSprite;
    return () => {
      worldContainer.removeChild(fogSprite);
      fogSprite.destroy();
      filter.destroy();
    };
  }, [worldContainer, mapWidth, mapHeight]);

  // Update lights when tokens/walls change
  useEffect(() => {
    const filter = filterRef.current;
    if (!filter) return;
    filter.revealAll = isDMView;
    if (isDMView) return;

    const wallSegments = getWallSegments(walls, doors);
    const pcTokens = tokens.filter((t) => t.isPlayerCharacter && t.visionRadius > 0);

    const lightTokens = pcTokens.map((token) => ({
      id: token.id,
      x: token.x,
      y: token.y,
      visionRadius: token.visionRadius,
      lightColor: [1.0, 0.85, 0.6] as [number, number, number], // warm torch default
    }));

    filter.updateLights(lightTokens, { mapWidth, mapHeight, gridSize });
  }, [tokens, walls, doors, gridSize, mapWidth, mapHeight, isDMView]);

  return null;
}
```

**Step 2: Test manually**

```bash
npm run dev
```

Expected: fog renders, PC tokens reveal areas around them, DM toggle reveals all.

**Step 3: Commit**

```bash
git add src/components/Canvas/FogOfWarLayer.tsx
git commit -m "feat(fog): FogOfWarLayer with GLSL shader — GPU-accelerated fog of war"
```

---

### Phase 3 Exit Criteria

- [ ] Fog renders correctly — dark areas outside visibility polygons
- [ ] PC tokens reveal circular light areas with falloff
- [ ] DM reveal toggle works
- [ ] FPS stable at 60 with 5 tokens + 50 walls
- [ ] `npm run test:run` — all fog uniform tests pass

---

## Phase 4 — Drawing System

### Task 4.1: Stroke vertex buffer geometry utilities

**Files:**

- Create: `src/components/Canvas/drawing/strokeGeometry.ts`
- Create: `src/components/Canvas/drawing/__tests__/strokeGeometry.test.ts`

**Context:** The `PressureSensitiveLine` Mesh needs a function that takes an array of `{x, y, pressure}` samples and returns `{vertices, indices}` for a triangle strip. This is pure math — fully testable without PixiJS.

**Step 1: Write the failing tests**

```ts
import { buildStrokeGeometry } from '../strokeGeometry';

describe('buildStrokeGeometry', () => {
  it('returns empty geometry for fewer than 2 samples', () => {
    const result = buildStrokeGeometry([{ x: 0, y: 0, pressure: 1 }], 10);
    expect(result.vertices.length).toBe(0);
    expect(result.indices.length).toBe(0);
  });

  it('generates 4 vertices for a single segment (2 samples)', () => {
    const result = buildStrokeGeometry(
      [
        { x: 0, y: 0, pressure: 1 },
        { x: 100, y: 0, pressure: 1 },
      ],
      10,
    );
    expect(result.vertices.length).toBe(8); // 4 vertices × 2 coords
    expect(result.indices.length).toBe(6); // 2 triangles = 6 indices
  });

  it('scales quad width by pressure value', () => {
    const full = buildStrokeGeometry(
      [
        { x: 0, y: 0, pressure: 1.0 },
        { x: 100, y: 0, pressure: 1.0 },
      ],
      10,
    );
    const half = buildStrokeGeometry(
      [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 100, y: 0, pressure: 0.5 },
      ],
      10,
    );
    // Half pressure → half width → vertices are closer to center line
    const fullTopY = full.vertices[1]!; // top-left y
    const halfTopY = half.vertices[1]!;
    expect(Math.abs(halfTopY)).toBeLessThan(Math.abs(fullTopY));
  });
});
```

**Step 2: Run to confirm fail**

```bash
npm run test:run -- src/components/Canvas/drawing/__tests__/strokeGeometry.test.ts
```

**Step 3: Create `src/components/Canvas/drawing/strokeGeometry.ts`**

```ts
interface StrokeSample {
  x: number;
  y: number;
  pressure: number; // 0.0–1.0
}

interface StrokeGeometry {
  vertices: Float32Array;
  indices: Uint16Array;
}

const MIN_PRESSURE = 0.1;

export function buildStrokeGeometry(samples: StrokeSample[], baseWidth: number): StrokeGeometry {
  if (samples.length < 2) {
    return { vertices: new Float32Array(0), indices: new Uint16Array(0) };
  }

  const vertexCount = samples.length * 2; // top + bottom per sample
  const vertices = new Float32Array(vertexCount * 2);
  const segmentCount = samples.length - 1;
  const indices = new Uint16Array(segmentCount * 6);

  samples.forEach((sample, i) => {
    const pressure = Math.max(sample.pressure, MIN_PRESSURE);
    const halfWidth = (baseWidth * pressure) / 2;

    // Normal direction: perpendicular to stroke direction
    let nx = 0;
    let ny = 1;
    if (i < samples.length - 1) {
      const next = samples[i + 1]!;
      const dx = next.x - sample.x;
      const dy = next.y - sample.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        nx = -dy / len;
        ny = dx / len;
      }
    } else if (i > 0) {
      const prev = samples[i - 1]!;
      const dx = sample.x - prev.x;
      const dy = sample.y - prev.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        nx = -dy / len;
        ny = dx / len;
      }
    }

    const vi = i * 4;
    vertices[vi + 0] = sample.x + nx * halfWidth;
    vertices[vi + 1] = sample.y + ny * halfWidth;
    vertices[vi + 2] = sample.x - nx * halfWidth;
    vertices[vi + 3] = sample.y - ny * halfWidth;
  });

  for (let i = 0; i < segmentCount; i++) {
    const v = i * 2;
    const ii = i * 6;
    indices[ii + 0] = v;
    indices[ii + 1] = v + 1;
    indices[ii + 2] = v + 2;
    indices[ii + 3] = v + 1;
    indices[ii + 4] = v + 3;
    indices[ii + 5] = v + 2;
  }

  return { vertices, indices };
}
```

**Step 4: Run tests**

```bash
npm run test:run -- src/components/Canvas/drawing/__tests__/strokeGeometry.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/Canvas/drawing/strokeGeometry.ts src/components/Canvas/drawing/__tests__/strokeGeometry.test.ts
git commit -m "feat(drawing): stroke vertex buffer geometry utilities with tests"
```

---

### Task 4.2: PressureSensitiveLine as PixiJS Mesh

**Files:**

- Modify: `src/components/Canvas/PressureSensitiveLine.tsx`

**Step 1: Write the failing test for pressure-to-width mapping**

`src/components/Canvas/drawing/__tests__/pressureWidth.test.ts`:

```ts
import { pressureToWidth } from '../pressureWidth';

describe('pressureToWidth', () => {
  it('maps full pressure to max width', () => {
    expect(pressureToWidth(1.0, 10, { min: 0.5, max: 2.0 })).toBe(20);
  });
  it('maps zero pressure to min width', () => {
    expect(pressureToWidth(0.0, 10, { min: 0.5, max: 2.0 })).toBe(5);
  });
  it('interpolates linearly', () => {
    expect(pressureToWidth(0.5, 10, { min: 0.5, max: 2.0 })).toBeCloseTo(12.5);
  });
});
```

**Step 2: Create `src/components/Canvas/drawing/pressureWidth.ts`**

```ts
export function pressureToWidth(
  pressure: number, // 0.0–1.0
  baseWidth: number,
  range: { min: number; max: number },
): number {
  const multiplier = range.min + pressure * (range.max - range.min);
  return baseWidth * multiplier;
}
```

**Step 3: Rewrite `PressureSensitiveLine.tsx`**

```tsx
import { useEffect, useRef, memo } from 'react';
import { Mesh, MeshGeometry, Shader, type Container } from 'pixi.js';
import { buildStrokeGeometry } from './drawing/strokeGeometry';

interface PressureSensitiveLineProps {
  points: number[]; // [x1, y1, x2, y2, ...]
  pressures?: number[]; // [p1, p2, ...] 0.0–1.0
  stroke: string; // hex color
  strokeWidth: number;
  opacity?: number;
  worldContainer: Container | null;
  id: string;
}

export const PressureSensitiveLine = memo(function PressureSensitiveLine({
  points,
  pressures,
  stroke,
  strokeWidth,
  opacity = 1,
  worldContainer,
  id,
}: PressureSensitiveLineProps): null {
  const meshRef = useRef<Mesh | null>(null);

  useEffect(() => {
    if (!worldContainer) return;

    // Convert flat points array to samples
    const samples = [];
    for (let i = 0; i < points.length - 2; i += 2) {
      samples.push({
        x: points[i]!,
        y: points[i + 1]!,
        pressure: pressures?.[i / 2] ?? 1.0,
      });
    }

    const { vertices, indices } = buildStrokeGeometry(samples, strokeWidth);
    if (vertices.length === 0) return;

    const geometry = new MeshGeometry({ positions: vertices, indices });
    const colorHex = parseInt(stroke.replace('#', ''), 16);
    const shader = Shader.from({
      // Simple solid-color shader for strokes
      vertex: `
        attribute vec2 aPosition;
        uniform mat3 uProjectionMatrix;
        uniform mat3 uWorldTransformMatrix;
        void main() {
          gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
        }
      `,
      fragment: `
        precision mediump float;
        uniform vec4 uColor;
        void main() { gl_FragColor = uColor; }
      `,
      resources: {
        uniforms: {
          uColor: {
            value: [
              ((colorHex >> 16) & 255) / 255,
              ((colorHex >> 8) & 255) / 255,
              (colorHex & 255) / 255,
              opacity,
            ],
            type: 'vec4<f32>',
          },
        },
      },
    });

    const mesh = new Mesh({ geometry, shader });
    mesh.zIndex = 30;
    worldContainer.addChild(mesh);
    meshRef.current = mesh;

    return () => {
      worldContainer.removeChild(mesh);
      mesh.destroy();
    };
  }, [points, pressures, stroke, strokeWidth, opacity, worldContainer]);

  return null;
});
```

**Step 4: Run tests**

```bash
npm run test:run
```

**Step 5: Commit**

```bash
git add src/components/Canvas/PressureSensitiveLine.tsx src/components/Canvas/drawing/pressureWidth.ts src/components/Canvas/drawing/__tests__/pressureWidth.test.ts
git commit -m "feat(drawing): PressureSensitiveLine as PixiJS Mesh with dynamic geometry"
```

---

### Task 4.3: Freehand drawing + eraser + wall strokes

**Files:**

- Create: `src/components/Canvas/DrawingLayer.tsx`
- Modify: `src/components/Canvas/hooks/useCanvasDrawing.ts`

**Step 1: Create `DrawingLayer.tsx`**

Renders all completed `Drawing` domain objects from the store. Each drawing with `tool === 'marker'` or `tool === 'wall'` renders as a `PressureSensitiveLine`. Eraser strokes use PixiJS `BlendMode.ERASE` on a container:

```tsx
import { useGameStore } from '../../store/gameStore';
import { PressureSensitiveLine } from './PressureSensitiveLine';
import type { Container } from 'pixi.js';

export function DrawingLayer({ worldContainer }: { worldContainer: Container | null }): null {
  const drawings = useGameStore((s) => s.drawings);

  return drawings.map((drawing) => (
    <PressureSensitiveLine
      key={drawing.id}
      id={drawing.id}
      points={drawing.points}
      pressures={drawing.pressures}
      stroke={drawing.color}
      strokeWidth={drawing.strokeWidth}
      worldContainer={worldContainer}
    />
  )) as unknown as null;
}
```

**Step 2: Rewrite `useCanvasDrawing.ts`**

Replace `KonvaEventObject` with `FederatedPointerEvent`. The hook accumulates points/pressures from `globalpointermove` and dispatches a completed drawing to the store on `pointerup`.

**Step 3: Test manually**

```bash
npm run dev
```

Draw with marker tool. Expected: strokes render with pressure variation.

**Step 4: Commit**

```bash
git add src/components/Canvas/DrawingLayer.tsx src/components/Canvas/hooks/useCanvasDrawing.ts
git commit -m "feat(drawing): DrawingLayer + useCanvasDrawing with PixiJS pointer events"
```

---

### Phase 4 Exit Criteria

- [ ] Marker strokes render with pressure-variable width
- [ ] Eraser removes stroke areas
- [ ] Wall tool strokes render
- [ ] Long strokes (200+ samples) stay at 60fps
- [ ] `npm run test:run` — all stroke geometry tests pass

---

## Phase 5 — Remaining Components + Cutover

### Task 5.1: DoorLayer + DoorShape

**Files:**

- Modify: `src/components/Canvas/DoorLayer.tsx`
- Modify: `src/components/Canvas/DoorShape.tsx`

Replace Konva `<Rect>`, `<Arc>`, `<Line>` with PixiJS `Graphics`. Door state (open/closed) changes the drawn arc angle. Hit detection uses PixiJS `eventMode = 'static'` on the graphics object.

Commit after working.

---

### Task 5.2: StairsLayer + StairsShape

**Files:**

- Modify: `src/components/Canvas/StairsLayer.tsx`
- Modify: `src/components/Canvas/StairsShape.tsx`

Same pattern as DoorShape — imperative `Graphics` drawing.

Commit after working.

---

### Task 5.3: MeasurementOverlay

**Files:**

- Modify: `src/components/Canvas/MeasurementOverlay.tsx`

Ruler, blast (circle), and cone shapes via `Graphics`. These render on top of everything (high `zIndex`).

Write unit tests for `calculateConeVertices` and `calculateBlastRadius` if not already tested.

Commit after working.

---

### Task 5.4: MovementRangeOverlay

**Files:**

- Modify: `src/components/Canvas/MovementRangeOverlay.tsx`

Grid cell highlighting via `Graphics` filled rects. Reuses existing grid math.

Commit after working.

---

### Task 5.5: Minimap

**Files:**

- Modify: `src/components/Canvas/Minimap.tsx`

The Minimap is already raw canvas (not Konva). Wire it to a PixiJS `app.renderer.extract.canvas()` snapshot instead of the Konva stage reference.

Commit after working.

---

### Task 5.6: Assert zero Konva imports

**Step 1: Add a CI assertion**

```bash
grep -r "from 'konva\|from \"konva\|from 'react-konva\|from \"react-konva" src/ && echo "FAIL: Konva imports found" && exit 1 || echo "PASS: No Konva imports"
```

**Step 2: Remove Konva from package.json**

```bash
npm uninstall konva react-konva
```

**Step 3: Run full type-check and lint**

```bash
npm run type-check && npm run lint
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): remove konva + react-konva — migration complete"
```

---

### Task 5.7: Full regression pass

**Step 1: Run all tests**

```bash
npm run test:run
npm run test:a11y
```

**Step 2: Run type-check and lint**

```bash
npm run type-check
npm run lint
```

**Step 3: Manual smoke test checklist**

- [ ] Load a campaign with map, tokens, fog, drawings, doors, stairs
- [ ] Pan and zoom smoothly
- [ ] Drag tokens — snap to grid
- [ ] Multi-select and transform tokens
- [ ] Fog reveals correctly for PC tokens
- [ ] DM reveal toggle works
- [ ] Draw with marker — pressure variation visible
- [ ] Eraser removes drawing area
- [ ] Place doors — open/close works
- [ ] Place stairs
- [ ] Measure distance (ruler)
- [ ] Measure blast / cone
- [ ] Movement range overlay
- [ ] Minimap renders
- [ ] World View (read-only) works
- [ ] Open both DM Window + World Window — sync works

**Step 4: Final commit**

```bash
git commit -m "feat(canvas): PixiJS migration complete — full Konva replacement"
```

---

## Phase 5 Exit Criteria

- [ ] Zero `konva`/`react-konva` imports in `src/`
- [ ] All features smoke-tested
- [ ] `npm run test:run` — all pass
- [ ] `npm run type-check` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] FPS stable at 60 with 20+ tokens + fog active

---

## Quick Reference: Key Konva → PixiJS Mappings

| Konva                                      | PixiJS v8                                      |
| ------------------------------------------ | ---------------------------------------------- |
| `<Stage>`                                  | `<Application>` (`@pixi/react`)                |
| `<Layer>` / `<Group>`                      | `Container`                                    |
| `<Image>`                                  | `Sprite` + `Assets.load()`                     |
| `<Rect>`, `<Line>`, `<Circle>`             | `Graphics` (imperative)                        |
| `<Shape sceneFunc>`                        | `Mesh` + custom geometry                       |
| `Konva.Filters.Blur`                       | `BlurFilter` (GPU)                             |
| `Konva.Filters.Brighten`                   | `ColorMatrixFilter.brightness()`               |
| `onMouseMove` on Stage                     | `app.stage.on('globalpointermove', ...)`       |
| `e.target.getStage().getPointerPosition()` | `e.global`                                     |
| World coords from screen                   | `container.toLocal(e.global)`                  |
| `shape.cache()`                            | `container.cacheAsTexture(true)`               |
| `KonvaEventObject<PointerEvent>`           | `FederatedPointerEvent`                        |
| `draggable` prop                           | Manual `pointerdown`/`pointermove`/`pointerup` |
| `Transformer` component                    | `@pixi-essentials/transformer`                 |
