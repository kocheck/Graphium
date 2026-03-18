# Type Safety & Resilience Design

**Date:** 2026-03-17
**Branch:** `claude/refactor-modular-architecture-GUfVC`
**Status:** Approved

---

## Problem

Four related architectural gaps surfaced during PR review:

1. `createGridGeometry` throws on unknown `gridType` — crashes the React component tree with no user-facing recovery path if a campaign file contains an unrecognized grid type.
2. `pixelToGrid` divides by `gridSize` with no guard — a zero or NaN `gridSize` produces `Infinity`/`NaN` coordinates silently stored in React state.
3. Color values (`Drawing.color`, `gridColor`, `wallColor`) are plain `string` — invalid CSS colors reach Konva and produce invisible/broken strokes with no compile-time or runtime warning.
4. Numeric sizes (`Drawing.size`, `wallSize`, `gridSize`) are plain `number` — zero, negative, NaN, and Infinity values can reach rendering code silently.

Issues 2–4 share a root cause: no type-level contract distinguishing validated values from raw input.

---

## Decision

**Approach A: Full branded types end-to-end**, with a `createGridGeometry` graceful fallback.

- Define `HexColor` and `PixelSize` nominal branded types in `types/domain.ts`
- Apply them to domain types, store setters, hook interfaces, and component props
- Validate at entry points (campaign loading); cast at known-safe points (defaults, color picker)
- Change `createGridGeometry` default case to warn + fallback instead of throw

This makes invalid states unrepresentable at compile time and degrades gracefully at runtime.

---

## Design

### 1. Branded types and factory functions (`src/types/domain.ts`)

```ts
/** A CSS hex color string accepted by Konva: #rgb, #rrggbb, or #rrggbbaa */
export type HexColor = string & { readonly __brand: 'HexColor' };

/** A positive finite pixel dimension (gridSize, stroke width, etc.) */
export type PixelSize = number & { readonly __brand: 'PixelSize' };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

export function toHexColor(value: string): HexColor {
  if (!HEX_COLOR_RE.test(value)) {
    throw new Error(`Invalid hex color: "${value}"`);
  }
  return value as HexColor;
}

export function toPixelSize(value: number): PixelSize {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid pixel size: ${value}`);
  }
  return Math.round(value) as PixelSize;
}
```

`toPixelSize` rounds to the nearest integer — no fractional pixel sizes allowed downstream.

---

### 2. Domain type changes (`src/types/domain.ts`, `src/utils/DungeonGenerator.ts`)

```ts
// Drawing
export interface Drawing {
  color: HexColor; // was: string
  size: PixelSize; // was: number
  // ...
}

// MapData
export interface MapData {
  gridSize: PixelSize; // was: number
  gridColor: HexColor; // was: string
  // ...
}

// DungeonGeneratorOptions
export interface DungeonGeneratorOptions {
  wallColor: HexColor; // was: string
  wallSize: PixelSize; // was: number
}
```

---

### 3. Store, hook, and component interfaces

**`gameStore.ts`** store setters:

```ts
setGridSize: (size: PixelSize) => set({ gridSize: size }),
setGridColor: (color: HexColor) => set({ gridColor: color }),
```

**`useToolState.ts`** return type:

```ts
color: HexColor;
setColor: (color: HexColor) => void;
handleColorChange: (newColor: HexColor) => void;
wallColor: HexColor;
setWallColor: (color: HexColor) => void;
wallSize: PixelSize;
setWallSize: (size: PixelSize) => void;
```

**`CanvasManagerProps`**:

```ts
color?: HexColor;
wallColor?: HexColor;
wallSize?: PixelSize;
```

**`DungeonGeneratorDialogProps`**:

```ts
wallColor: HexColor;
wallSize: PixelSize;
```

---

### 4. `createGridGeometry` graceful fallback (`src/utils/gridGeometry.ts`)

```ts
default: {
  const unknown: never = gridType;
  console.warn(
    `createGridGeometry: unknown grid type "${String(unknown)}", falling back to square`
  );
  return new SquareGridGeometry();
}
```

The `never` annotation preserves TypeScript exhaustiveness checking — adding a new `GridType` value without updating the switch will produce a compile error. At runtime, unknown values (from future/corrupted campaign files) warn and fall back instead of crashing.

---

### 5. Entry point casts

**Known-safe defaults** — cast directly, no runtime validation:

```ts
// useToolState.ts
useState<HexColor>('#df4b26' as HexColor)
useState<HexColor>('#ff0000' as HexColor)
useState<PixelSize>(8 as PixelSize)

// gameStore.ts default map
gridSize: 50 as PixelSize,
gridColor: '#222222' as HexColor,
```

**`<input type="color">` handlers** — browser guarantees `#rrggbb` output:

```ts
onChange={(e) => setGridColor(e.target.value as HexColor)}
```

**Campaign file loading** — only untrusted entry point; use validators:

```ts
gridSize: toPixelSize(activeMap.gridSize ?? 50),
gridColor: toHexColor(activeMap.gridColor ?? '#222222'),
color: toHexColor(drawing.color ?? '#df4b26'),
size: toPixelSize(drawing.size ?? 5),
```

---

## Affected Files

| File                                                  | Change                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/types/domain.ts`                                 | Add `HexColor`, `PixelSize`, `toHexColor`, `toPixelSize`; update `Drawing`, `MapData` |
| `src/utils/gridGeometry.ts`                           | Change `default` throw to warn + fallback                                             |
| `src/utils/DungeonGenerator.ts`                       | Update `DungeonGeneratorOptions` field types                                          |
| `src/store/gameStore.ts`                              | Update `setGridSize`, `setGridColor` signatures; update defaults                      |
| `src/hooks/useToolState.ts`                           | Update `UseToolStateReturn` field types; update defaults                              |
| `src/components/Canvas/CanvasManager.tsx`             | Update `CanvasManagerProps` field types                                               |
| `src/components/Dialogs/DungeonGeneratorDialog.tsx`   | Update `DungeonGeneratorDialogProps` field types                                      |
| `src/components/MapSettingsSheet.tsx`                 | Cast color picker output to `HexColor`                                                |
| `src/services/campaignService.ts`                     | Validate loaded JSON at campaign load boundary                                        |
| `src/components/Canvas/hooks/useCanvasInteraction.ts` | Update `UseCanvasInteractionProps` wall field types                                   |

---

## Verification

```bash
npm run type-check   # 0 errors
npm run lint         # 0 errors
npm run test:run     # all tests pass
npm run build:web    # build succeeds
```
