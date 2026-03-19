# Type Safety & Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `HexColor`/`PixelSize` branded types, fix `createGridGeometry` crash-on-unknown-type, and validate untrusted data at the campaign-load boundary.

**Architecture:** Define nominal branded types in `src/types/domain.ts` with runtime validators. Propagate brands through domain interfaces (`Drawing`, `MapData`), store, hooks, and component props. Cast at known-safe entry points (defaults, `<input type="color">`). Validate at the one untrusted boundary (campaign JSON loading). Fix `createGridGeometry` to warn+fallback instead of throw.

**Tech Stack:** TypeScript 5, Zustand 5, React 18, Vitest

---

## Task 1: Add `HexColor`, `PixelSize` types and factory functions

**Files:**

- Modify: `src/types/domain.ts` (add after line 6, before `// ===== TOKEN TYPES =====`)
- Modify: `src/utils/gridGeometry.test.ts` (add tests for factory functions — place at top of describe block)

**Step 1: Write the failing tests**

Add to `src/utils/gridGeometry.test.ts` — import the new factories and write tests. Since the factories don't exist yet, this should fail to compile:

```ts
import { toHexColor, toPixelSize } from '../../types/domain';

describe('toHexColor', () => {
  it('accepts #rgb', () => {
    expect(toHexColor('#fff')).toBe('#fff');
  });
  it('accepts #rrggbb', () => {
    expect(toHexColor('#ff0000')).toBe('#ff0000');
  });
  it('accepts #rrggbbaa', () => {
    expect(toHexColor('#ff000080')).toBe('#ff000080');
  });
  it('rejects rgba strings', () => {
    expect(() => toHexColor('rgba(255,0,0,0.5)')).toThrow('Invalid hex color');
  });
  it('rejects empty string', () => {
    expect(() => toHexColor('')).toThrow('Invalid hex color');
  });
  it('rejects plain text', () => {
    expect(() => toHexColor('red')).toThrow('Invalid hex color');
  });
});

describe('toPixelSize', () => {
  it('accepts positive integer', () => {
    expect(toPixelSize(50)).toBe(50);
  });
  it('rounds fractional values', () => {
    expect(toPixelSize(50.7)).toBe(51);
  });
  it('rejects zero', () => {
    expect(() => toPixelSize(0)).toThrow('Invalid pixel size');
  });
  it('rejects negative', () => {
    expect(() => toPixelSize(-1)).toThrow('Invalid pixel size');
  });
  it('rejects NaN', () => {
    expect(() => toPixelSize(NaN)).toThrow('Invalid pixel size');
  });
  it('rejects Infinity', () => {
    expect(() => toPixelSize(Infinity)).toThrow('Invalid pixel size');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:run -- --reporter=verbose src/utils/gridGeometry.test.ts
```

Expected: compile error — `toHexColor`/`toPixelSize` not found in `domain.ts`.

**Step 3: Add types and factories to `src/types/domain.ts`**

Insert after line 6 (after the JSDoc comment block, before `// ===== TOKEN TYPES =====`):

```ts
// ===== BRANDED PRIMITIVE TYPES =====

/**
 * A CSS hex color string accepted by Konva canvas rendering.
 * Valid formats: #rgb, #rrggbb, #rrggbbaa
 *
 * Note: Konva renders to <canvas> — CSS variables (var(--app-*)) are NOT valid here.
 * Use resolved hex strings only. See CLAUDE.md "Konva + CSS variables" gotcha.
 */
export type HexColor = string & { readonly __brand: 'HexColor' };

/**
 * A positive finite pixel dimension (grid cell size, stroke width, etc.)
 * Always a positive integer — toPixelSize rounds fractional values.
 */
export type PixelSize = number & { readonly __brand: 'PixelSize' };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

/**
 * Validates and brands a string as a HexColor.
 * Throws if the string is not a valid CSS hex color.
 *
 * @example toHexColor('#ff0000')  // ok
 * @example toHexColor('red')      // throws
 */
export function toHexColor(value: string): HexColor {
  if (!HEX_COLOR_RE.test(value)) {
    throw new Error(`Invalid hex color: "${value}"`);
  }
  return value as HexColor;
}

/**
 * Validates and brands a number as a PixelSize.
 * Throws if value is not a positive finite number.
 * Rounds fractional values to the nearest integer.
 *
 * @example toPixelSize(50)   // ok → 50
 * @example toPixelSize(50.7) // ok → 51
 * @example toPixelSize(0)    // throws
 */
export function toPixelSize(value: number): PixelSize {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid pixel size: ${value}`);
  }
  return Math.round(value) as PixelSize;
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test:run -- --reporter=verbose src/utils/gridGeometry.test.ts
```

Expected: all new tests PASS, existing tests still pass.

**Step 5: Commit**

```bash
git add src/types/domain.ts src/utils/gridGeometry.test.ts
git commit -m "feat: add HexColor and PixelSize branded types with validators"
```

---

## Task 2: Fix `createGridGeometry` to warn + fallback instead of throw

**Files:**

- Modify: `src/utils/gridGeometry.ts` (lines 406-422)
- Modify: `src/utils/gridGeometry.test.ts` (find existing throw test and update it)

**Step 1: Find and update the existing throw test**

Search `gridGeometry.test.ts` for the test that expects `createGridGeometry` to throw on unknown types. It likely looks like:

```ts
expect(() => createGridGeometry('UNKNOWN' as GridType)).toThrow(...)
```

Change it to verify the fallback behavior:

```ts
it('returns SquareGridGeometry for unknown grid type', () => {
  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const geometry = createGridGeometry('UNKNOWN' as GridType);
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('unknown grid type'));
  // Verify it behaves as square grid — pixelToGrid should return integer coords
  const cell = geometry.pixelToGrid(100, 100, 50);
  expect(Number.isFinite(cell.q)).toBe(true);
  expect(Number.isFinite(cell.r)).toBe(true);
  consoleSpy.mockRestore();
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- --reporter=verbose src/utils/gridGeometry.test.ts
```

Expected: the updated test FAILS (currently throws instead of warning).

**Step 3: Update `createGridGeometry` default case in `src/utils/gridGeometry.ts`**

Replace lines 418-421 (the `default` case):

```ts
    default: {
      // Unknown gridType from a corrupted or future-version campaign file.
      // Degrade gracefully rather than crashing the React component tree.
      // The `never` annotation keeps TypeScript exhaustiveness checking intact —
      // adding a new GridType without updating this switch will be a compile error.
      const unknown: never = gridType;
      console.warn(
        `createGridGeometry: unknown grid type "${String(unknown)}", falling back to square grid`,
      );
      return new SquareGridGeometry();
    }
```

**Step 4: Run tests to verify they pass**

```bash
npm run test:run -- --reporter=verbose src/utils/gridGeometry.test.ts
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/utils/gridGeometry.ts src/utils/gridGeometry.test.ts
git commit -m "fix: createGridGeometry warns and falls back on unknown grid type instead of throwing"
```

---

## Task 3: Apply `HexColor`/`PixelSize` to `Drawing` and `MapData` interfaces

This task updates the domain interfaces. It will introduce compile errors in downstream files — those are fixed in Tasks 4–10.

**Files:**

- Modify: `src/types/domain.ts` (Drawing interface lines 79-89, MapData interface lines 118-131)

**Step 1: No test to write** — the type changes are enforced at compile time. The existing tests will break due to raw `string`/`number` being passed where `HexColor`/`PixelSize` are now required.

**Step 2: Update `Drawing` interface** (lines 79-89 of `src/types/domain.ts`):

```ts
export interface Drawing {
  id: string;
  tool: 'marker' | 'eraser' | 'wall';
  points: number[]; // [x1, y1, x2, y2, ...] coordinate pairs
  color: HexColor;
  size: PixelSize; // Base stroke size (multiplied by pressure for variable width)
  pressures?: number[]; // Optional: [p1, p2, p3, ...] pressure values (0.0-1.0)
  scale?: number;
  x?: number;
  y?: number;
}
```

**Step 3: Update `MapData` interface** (lines 118-131 of `src/types/domain.ts`):

```ts
export interface MapData {
  id: string;
  name: string;
  tokens: Token[];
  drawings: Drawing[];
  doors: Door[];
  stairs: Stairs[];
  map: MapConfig | null;
  gridSize: PixelSize;
  gridType: GridType;
  gridColor: HexColor; // Hex color for grid lines (e.g., '#222222')
  exploredRegions: ExploredRegion[];
  isDaylightMode: boolean;
}
```

**Step 4: Verify compile errors exist (don't fix yet)**

```bash
npm run type-check 2>&1 | head -40
```

Expected: multiple TS errors about `string` not assignable to `HexColor`, `number` not assignable to `PixelSize`. This is expected — do NOT commit yet.

**No commit** — this task produces intentional compile errors fixed in Tasks 4–10.

---

## Task 4: Fix `DungeonGenerator.ts`

**Files:**

- Modify: `src/utils/DungeonGenerator.ts`
- Modify: `tests/unit/dungeon-generator.test.ts` (update any Drawing mock objects)

**Step 1: Update `DungeonGeneratorOptions` interface** in `src/utils/DungeonGenerator.ts`

Find the interface (around line 138-160) and update:

```ts
import type { HexColor, PixelSize } from '../types/domain';

export interface DungeonGeneratorOptions {
  numRooms: number;
  minRoomSize?: number;
  maxRoomSize?: number;
  gridSize?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  wallColor?: HexColor;
  wallSize?: PixelSize;
}
```

**Step 2: Fix constructor defaults** (around line 229-240):

```ts
wallColor: options.wallColor ?? ('#ff0000' as HexColor),
wallSize: options.wallSize ?? (8 as PixelSize),
```

**Step 3: Fix `pieceToDrawings` Drawing construction** (around line 1001)

The `drawings.push({...})` calls create `Drawing` objects. The `color: wallColor` and `size: wallSize` fields will now be correctly typed since `this.options.wallColor` is `HexColor` and `this.options.wallSize` is `PixelSize`. No change needed here — TypeScript will accept them.

**Step 4: Check and fix dungeon generator tests**

```bash
npm run type-check 2>&1 | grep "dungeon-generator"
```

If the test file creates Drawing objects with raw `string`/`number` for `color`/`size`, cast them:

```ts
color: '#ff0000' as HexColor,
size: 8 as PixelSize,
```

**Step 5: Run DungeonGenerator tests**

```bash
npm run test:run -- --reporter=verbose tests/unit/dungeon-generator.test.ts
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/utils/DungeonGenerator.ts tests/unit/dungeon-generator.test.ts
git commit -m "feat: apply HexColor/PixelSize to DungeonGeneratorOptions"
```

---

## Task 5: Fix `gameStore.ts`

**Files:**

- Modify: `src/store/gameStore.ts`
- Modify: `src/store/gameStore.test.ts`

**Step 1: Update `GameState` interface** (lines 63-74)

```ts
export interface GameState {
  // ...
  gridSize: PixelSize;
  gridColor: HexColor;
  // ... rest unchanged
}
```

Add the import at the top of `gameStore.ts`:

```ts
import { DEFAULT_GRID_COLOR, toHexColor, toPixelSize } from '../types/domain';
import type { HexColor, PixelSize } from '../types/domain';
```

**Step 2: Update `createDefaultMap`** (lines 24-37)

```ts
const createDefaultMap = (name: string = 'New Map'): MapData => ({
  id: crypto.randomUUID(),
  name,
  tokens: [],
  drawings: [],
  doors: [],
  stairs: [],
  map: null,
  gridSize: 50 as PixelSize,
  gridType: 'LINES',
  gridColor: DEFAULT_GRID_COLOR as HexColor,
  exploredRegions: [],
  isDaylightMode: false,
});
```

**Step 3: Update `loadCampaign` action** (lines 213-226)

The loaded campaign JSON is untrusted — validate `gridSize` and `gridColor` here. For `drawings`, trust the saved data (it was validated when created) but migrate the types:

```ts
set({
  campaign,
  tokens: activeMap.tokens || [],
  drawings: (activeMap.drawings || []).map((d) => ({
    ...d,
    color: (d.color ?? '#df4b26') as HexColor,
    size: Math.max(1, Math.round(d.size ?? 5)) as PixelSize,
  })),
  doors: activeMap.doors || [],
  stairs: activeMap.stairs || [],
  gridSize: toPixelSize(activeMap.gridSize || 50),
  gridType: activeMap.gridType || 'LINES',
  gridColor: (() => {
    try {
      return toHexColor(activeMap.gridColor ?? DEFAULT_GRID_COLOR);
    } catch {
      console.warn(`[gameStore] Invalid gridColor "${activeMap.gridColor}", using default`);
      return DEFAULT_GRID_COLOR as HexColor;
    }
  })(),
  map: activeMap.map ?? null,
  exploredRegions: activeMap.exploredRegions || [],
  isDaylightMode: activeMap.isDaylightMode || false,
});
```

**Step 4: Update `setGridSize` and `setGridColor` action signatures** (lines 543, 545)

```ts
setGridSize: (size: PixelSize) => set({ gridSize: size }),
setGridColor: (color: HexColor) => set({ gridColor: color }),
```

**Step 5: Fix `gameStore.test.ts`**

Find all places that call `setGridSize(n)` or `setGridColor(s)` with raw values and add casts:

```ts
setGridSize(50 as PixelSize);
setGridColor('#222222' as HexColor);
```

Find any test that creates Drawing objects inline and cast their `color`/`size` fields:

```ts
color: '#ff0000' as HexColor,
size: 8 as PixelSize,
```

**Step 6: Run store tests**

```bash
npm run test:run -- --reporter=verbose src/store/gameStore.test.ts
```

Expected: all pass.

**Step 7: Commit**

```bash
git add src/store/gameStore.ts src/store/gameStore.test.ts
git commit -m "feat: apply HexColor/PixelSize to gameStore — validate at campaign load boundary"
```

---

## Task 6: Fix `useToolState.ts`

**Files:**

- Modify: `src/hooks/useToolState.ts`
- Modify: `src/hooks/__tests__/useToolState.test.ts`

**Step 1: Update `UseToolStateReturn` interface**

In `src/hooks/useToolState.ts`, add import:

```ts
import type { HexColor, PixelSize } from '../types/domain';
```

Update the interface fields:

```ts
export interface UseToolStateReturn {
  // Marker colors
  color: HexColor;
  setColor: (color: HexColor) => void;
  handleColorChange: (newColor: HexColor) => void;
  recentColors: HexColor[];

  // Wall tool color and stroke width — applied to both manual canvas drawing
  // and procedural dungeon generation (DungeonGeneratorDialog)
  wallColor: HexColor;
  setWallColor: (color: HexColor) => void;
  wallSize: PixelSize;
  setWallSize: (size: PixelSize) => void;

  // ... other fields unchanged
}
```

**Step 2: Cast state initializers** (around lines 56-79)

```ts
const [color, setColor] = useState<HexColor>('#df4b26' as HexColor);
const [recentColors, setRecentColors] = useState<HexColor[]>([
  '#df4b26' as HexColor,
  '#3b82f6' as HexColor,
  '#22c55e' as HexColor,
]);

const [wallColor, setWallColor] = useState<HexColor>('#ff0000' as HexColor);
const [wallSize, setWallSize] = useState<PixelSize>(8 as PixelSize);
```

**Step 3: Update `handleColorChange`** (around line 60)

The `newColor` parameter becomes `HexColor` — the call site (`<input type="color">`) casts before calling, so no change to the function body is needed. Just update the signature:

```ts
const handleColorChange = (newColor: HexColor): void => {
  setColor(newColor);
  setRecentColors((prev) => {
    const filtered = prev.filter((c) => c.toLowerCase() !== newColor.toLowerCase());
    return [newColor, ...filtered].slice(0, 3) as HexColor[];
  });
};
```

**Step 4: Fix `useToolState.test.ts`**

Find tests that check initial `color`, `wallColor`, `wallSize` values — no change needed to the assertions (the values are the same). But if the test calls `setWallColor('...')` or `setColor('...')`, cast the argument:

```ts
act(() => {
  result.current.setWallColor('#123456' as HexColor);
});
act(() => {
  result.current.setWallSize(12 as PixelSize);
});
```

**Step 5: Run hook tests**

```bash
npm run test:run -- --reporter=verbose src/hooks/__tests__/useToolState.test.ts
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/hooks/useToolState.ts src/hooks/__tests__/useToolState.test.ts
git commit -m "feat: apply HexColor/PixelSize to useToolState"
```

---

## Task 7: Fix `CanvasManager.tsx`

**Files:**

- Modify: `src/components/Canvas/CanvasManager.tsx`

**Step 1: Add import**

Add to imports:

```ts
import type { HexColor, PixelSize } from '../../types/domain';
```

**Step 2: Update `CanvasManagerProps`** (lines 120-129)

```ts
interface CanvasManagerProps {
  tool?: 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
  color?: HexColor;
  doorOrientation?: 'horizontal' | 'vertical';
  wallColor?: HexColor;
  wallSize?: PixelSize;
  isWorldView?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  measurementMode?: 'ruler' | 'blast' | 'cone';
}
```

**Step 3: Cast defaults in function signature** (lines 146-155)

```ts
function CanvasManager({
  tool = 'select',
  color = CANVAS_COLORS.markerDefault as HexColor,
  doorOrientation = 'horizontal',
  wallColor = '#ff0000' as HexColor,
  wallSize = 8 as PixelSize,
  isWorldView = false,
  onSelectionChange,
}: CanvasManagerProps): JSX.Element {
```

**Step 4: Run type-check to confirm no errors in this file**

```bash
npm run type-check 2>&1 | grep "CanvasManager"
```

Expected: no errors from this file.

**Step 5: Commit**

```bash
git add src/components/Canvas/CanvasManager.tsx
git commit -m "feat: apply HexColor/PixelSize to CanvasManagerProps"
```

---

## Task 8: Fix `useCanvasInteraction.ts`

**Files:**

- Modify: `src/components/Canvas/hooks/useCanvasInteraction.ts`

**Step 1: Add imports**

```ts
import type { HexColor, PixelSize } from '../../../types/domain';
```

**Step 2: Update `UseCanvasInteractionProps`** — change `color`, `wallColor`, `wallSize` fields:

```ts
color: HexColor;
// ...
wallColor: HexColor;
wallSize: PixelSize;
```

**Step 3: Cast `drawSize` literals** in the drawing branch (around line 259):

```ts
let drawColor: HexColor = color;
let drawSize: PixelSize = 5 as PixelSize;

if (tool === 'eraser') {
  drawColor = '#000000' as HexColor;
  drawSize = 20 as PixelSize;
} else if (tool === 'wall') {
  drawColor = wallColor;
  drawSize = wallSize;
}
```

**Step 4: Run type-check**

```bash
npm run type-check 2>&1 | grep "useCanvasInteraction"
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/components/Canvas/hooks/useCanvasInteraction.ts
git commit -m "feat: apply HexColor/PixelSize to useCanvasInteraction props"
```

---

## Task 9: Fix `DungeonGeneratorDialog.tsx` and its tests

**Files:**

- Modify: `src/components/Dialogs/DungeonGeneratorDialog.tsx`
- Modify: `src/components/Dialogs/DungeonGeneratorDialog.test.tsx`

**Step 1: Add import and update props interface**

```ts
import type { HexColor, PixelSize } from '../../types/domain';

interface DungeonGeneratorDialogProps {
  wallColor: HexColor;
  wallSize: PixelSize;
}
```

**Step 2: Update test `defaultProps`** in `DungeonGeneratorDialog.test.tsx`:

```ts
const defaultProps = {
  wallColor: '#ff0000' as HexColor,
  wallSize: 8 as PixelSize,
};
```

Also update the props-forwarding test:

```ts
render(<DungeonGeneratorDialog wallColor={'#123456' as HexColor} wallSize={12 as PixelSize} />);
```

**Step 3: Run dialog tests**

```bash
npm run test:run -- --reporter=verbose src/components/Dialogs/DungeonGeneratorDialog.test.tsx
```

Expected: all pass including the props-forwarding test.

**Step 4: Commit**

```bash
git add src/components/Dialogs/DungeonGeneratorDialog.tsx src/components/Dialogs/DungeonGeneratorDialog.test.tsx
git commit -m "feat: apply HexColor/PixelSize to DungeonGeneratorDialogProps"
```

---

## Task 10: Fix `MapSettingsSheet.tsx`

**Files:**

- Modify: `src/components/MapSettingsSheet.tsx`

**Step 1: Add import**

```ts
import type { HexColor } from '../types/domain';
```

**Step 2: Update `pendingGridColor` state** (around line 74)

```ts
const [pendingGridColor, setPendingGridColor] = useState<HexColor>(gridColor);
```

**Step 3: Cast color picker `onChange` handlers** (around lines 404-408)

```ts
onChange={(e) =>
  mode === 'CREATE'
    ? setPendingGridColor(e.target.value as HexColor)
    : setGridColor(e.target.value as HexColor)
}
```

The `as HexColor` cast is safe here because `<input type="color">` always produces `#rrggbb` format.

**Step 4: Check if `pendingGridColor` is passed anywhere else that needs a cast**

Search the file for other usages of `pendingGridColor` or `setPendingGridColor` and ensure they're compatible.

**Step 5: Run type-check**

```bash
npm run type-check 2>&1 | grep "MapSettingsSheet"
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/components/MapSettingsSheet.tsx
git commit -m "feat: apply HexColor to MapSettingsSheet grid color picker"
```

---

## Task 11: Fix `App.tsx` call sites

**Files:**

- Modify: `src/App.tsx`

**Step 1: Check call sites for `setGridColor` and `wallColor`/`wallSize` props**

`App.tsx` passes `toolState.wallColor` and `toolState.wallSize` to `CanvasManager` and `DungeonGeneratorDialog`. After the `useToolState` fix (Task 6), these are already `HexColor`/`PixelSize` — no cast needed.

Run type-check to confirm:

```bash
npm run type-check 2>&1 | grep "App.tsx"
```

Expected: no errors. If any appear, they'll be about `setGridColor` or color values passed as raw strings — cast them with `as HexColor`.

**Step 2: Commit if any changes were made**

```bash
git add src/App.tsx
git commit -m "feat: apply HexColor/PixelSize casts in App.tsx"
```

---

## Task 12: Final verification

**Step 1: Full type-check**

```bash
npm run type-check 2>&1
```

Expected: `0 errors`

**Step 2: Lint**

```bash
npm run lint 2>&1
```

Expected: `0 errors, 0 warnings`

**Step 3: Full test suite**

```bash
npm run test:run 2>&1 | tail -5
```

Expected: all tests pass (≥ 988)

**Step 4: Build**

```bash
npm run build:web 2>&1 | tail -5
```

Expected: `✓ built in X.XXs`

**Step 5: Commit if any cleanup was needed, then summarize**

All four architectural gaps are now resolved:

- `HexColor`/`PixelSize` enforce valid values at compile time across the entire codebase
- `createGridGeometry` degrades gracefully on unknown grid types from future/corrupted campaign files
- Campaign loading validates `gridSize`/`gridColor` from untrusted JSON
- `Drawing` objects can only be constructed with validated color and size values
