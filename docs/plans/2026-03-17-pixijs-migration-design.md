# PixiJS Migration Design

> Approved design document — March 17, 2026.
> Companion research: `docs/research/CANVAS_PERFORMANCE_ANALYSIS.md`

---

## Problem

The Konva canvas drops below 60fps with as few as 5 tokens when fog of war is active. Konva is CPU-bound (Canvas 2D) — every shape, fog polygon, and image filter runs on the CPU. The fog of war layer is the primary bottleneck and the primary creative opportunity: a WebGL-based fog enables soft light falloff, per-token light color, animated effects, and dynamic radius — none of which are possible with the current Canvas 2D compositing approach.

---

## Decision

Full phased replacement of Konva with PixiJS v8 + `@pixi/react` v8. No components are sacred. The goal is the best possible foundation, not the safest migration.

---

## Boundaries

### Unchanged (zero Konva dependency)

| Path                              | Notes                                                     |
| --------------------------------- | --------------------------------------------------------- |
| `src/store/`                      | gameStore + uiStore — PixiJS reads the same Zustand state |
| `src/services/campaignService.ts` | No canvas dependency                                      |
| `src/types/domain.ts`             | Pure types                                                |
| `src/utils/vision.ts`             | Pure raycasting — feeds directly into fog shader uniforms |
| `src/hooks/useToolState.ts`       | Tool state + keyboard shortcuts                           |
| `src/hooks/useMenuCommands.ts`    | Electron IPC                                              |
| `src/hooks/useRecentCampaigns.ts` | localStorage                                              |
| All non-canvas components         | Toolbar, Dialogs, HomeScreen, Managers                    |

### Replaced entirely

| Current                            | Replacement                                     |
| ---------------------------------- | ----------------------------------------------- |
| `react-konva` + `konva`            | `pixi.js v8` + `@pixi/react v8`                 |
| `src/components/Canvas/*.tsx`      | Rewritten per phase                             |
| `src/components/Canvas/hooks/*.ts` | Rewritten — PixiJS v8 event system              |
| `KonvaEventObject` types           | `FederatedPointerEvent`                         |
| React 18                           | React 19 (hard requirement of `@pixi/react v8`) |

---

## Technical Decisions

### Fog of War — Custom GLSL Fragment Shader

Visibility polygons from `vision.ts` (unchanged pure functions) are passed as uniforms into a custom WebGL fragment shader rendered as a full-screen PixiJS `Filter`. Each token contributes a light source with:

- Position (x, y) in world space
- Radius (maps to vision radius)
- Color (per-token light tint — torch = amber, moonlight = cool white, darkvision = grey)
- Falloff curve (linear, quadratic, or step — configurable per token type)
- Visibility polygon (occlusion geometry from raycasting)

The shader composites all light sources in a single GPU pass. Areas outside all visibility polygons render as full fog. Soft edges are achieved via distance-based alpha falloff in the shader rather than a blur filter.

**Why GLSL over RenderTexture+AlphaMask:** Animated effects (torch flicker via time uniform, noise-based fog wisps), per-token light color, and falloff curves all require shader-level control. RenderTexture+AlphaMask would require re-rendering on every frame for animated fog, negating the performance benefit.

**`vision.ts` integration:** The raycasting output (array of `Point[]` polygons per token) is serialized into shader-compatible flat float arrays passed as uniforms. The shader performs point-in-polygon tests in the fragment stage.

**Testing:** Unit tests for uniform calculation (radius → shader units, world coords → UV coords). Snapshot tests for fog at key configurations (single token, overlapping tokens, zero-vision token, all-revealed).

### PressureSensitiveLine — PixiJS Mesh + Dynamic Geometry

Each drawing stroke is a `Mesh` with a manually managed `MeshGeometry`. As pointer events arrive:

1. Pressure value maps to stroke half-width at that sample point
2. A quad (two triangles) is generated per segment using the perpendicular normal to the stroke direction
3. Vertices and indices are appended to the geometry buffer
4. Round caps are generated at stroke start/end via a fan of triangles

This produces smooth variable-width strokes with no trapezoid approximation artifacts. The geometry buffer grows incrementally — no full rebuild on each sample.

**Why Mesh over Graphics trapezoids:** Graphics trapezoids produce visible seams at segment joints and cap artifacts. Mesh geometry allows proper miter joins and round caps, and is more performant for long strokes (single draw call vs N Graphics operations).

**Testing:** Unit tests for vertex buffer generation (given pressure samples, assert correct vertex positions and normals). Unit tests for pressure → width mapping. Tests for edge cases: single-point stroke, zero-length segment, max pressure, min pressure.

---

## Phase Plan

### Phase 0 — Infrastructure (2–3 days)

- Upgrade React 18 → 19
- Audit all dependencies for React 19 compatibility; resolve breaking changes
- Install `pixi.js@^8`, `@pixi/react@^8`, `@pixi-essentials/transformer`
- Remove `react-konva`, `konva`
- Replace `CanvasManager`'s `<Stage>` with `<Application>` — blank PixiJS canvas rendering where Konva was
- Configure ESLint for PixiJS patterns (no-konva rule, enforce GLSL file linting)
- Nothing visual works yet except an empty canvas

**Exit criteria:** App boots, blank PixiJS canvas renders at correct dimensions, no TypeScript errors, all linting passes.

### Phase 1 — Static Layers (3–4 days)

- Map background image as `Sprite` + `Texture`
- Grid overlay rewritten as `Graphics` (lines drawn imperatively)
- `PaperNoiseOverlay` as tiled `Sprite`
- Pan + zoom wired to PixiJS `Container` transform (replaces Konva stage position/scale)
- Viewport clamping logic ported from `CanvasManager`

**Exit criteria:** Map renders with grid, pan/zoom works, no Konva imports remaining in these components.

### Phase 2 — Token Layer (1 week)

- Tokens rendered as `Sprite` with `Texture` cache (one texture per image URL)
- Drag-and-drop via PixiJS `FederatedPointerEvent` (replaces `useTokenDrag`)
- Selection rectangle via `Graphics` + `globalpointermove`
- Multi-select via pointer event aggregation
- `@pixi-essentials/transformer` for resize/rotate handles
- Token shadow/hover effects via `ColorMatrixFilter`
- `useTokenDrag` hook rewritten for PixiJS event system

**Exit criteria:** Tokens render, drag smoothly, can be selected/transformed. FPS stable at 60 with 5–20 tokens.

### Phase 3 — Fog of War (1 week)

- Custom GLSL fragment shader (see Technical Decisions above)
- Shader file: `src/components/Canvas/shaders/fog.frag.glsl`
- Shader uniforms interface: `FogUniforms` TypeScript type
- `FogOfWarLayer` rewritten as a PixiJS `Filter` applied to a full-screen container
- `vision.ts` output piped into shader uniforms on token move / wall change
- DM toggle (reveal/hide fog) as shader uniform
- Initial visual target: hard-edged visibility (parity with current), then add falloff + color in a follow-up

**Exit criteria:** Fog renders correctly, visibility polygons match current behavior, FPS stable at 60 with 5 tokens + 50 walls.

### Phase 4 — Drawing System (1–2 weeks)

- Freehand marker strokes as incremental `Graphics` (simple case — no pressure)
- `PressureSensitiveLine` rewritten as `Mesh` + dynamic geometry (see Technical Decisions above)
- Eraser tool via `Graphics` with `ERASE` blend mode or mask
- Wall tool strokes (already stored as `Drawing` domain objects — rendering only changes)
- `useCanvasDrawing` hook rewritten for PixiJS pointer events

**Exit criteria:** All drawing tools work. Pressure-sensitive strokes render smoothly with no artifacts. Long strokes (200+ samples) stay at 60fps.

### Phase 5 — Remaining + Cutover (1 week)

- `DoorLayer` + `DoorShape` → PixiJS `Graphics` + `Sprite`
- `StairsLayer` + `StairsShape` → PixiJS `Graphics`
- `MeasurementOverlay` (ruler, blast, cone) → `Graphics`
- `MovementRangeOverlay` → `Graphics`
- `Minimap` — already raw canvas, wire to PixiJS renderer snapshot
- Remove all remaining Konva imports; assert zero `konva`/`react-konva` in codebase
- Full regression pass across all tools and interactions
- World View (read-only mode) verified

**Exit criteria:** All features work. Zero Konva imports. All existing tests pass. New tests for Phase 3 + 4 components pass.

---

## Event System Changes

PixiJS v8 changed pointer event behavior. Key differences affecting all canvas hooks:

| Konva                                              | PixiJS v8 Equivalent                               |
| -------------------------------------------------- | -------------------------------------------------- |
| `onMouseMove` on Stage                             | `globalpointermove` on Application                 |
| `onPointerMove` on Layer                           | `globalpointermove` (fires over empty space)       |
| `onPointerDown` on Stage                           | `pointerdown` on Application stage                 |
| `KonvaEventObject<PointerEvent>`                   | `FederatedPointerEvent`                            |
| `e.target.getStage().getPointerPosition()`         | `e.global` (x, y in screen space)                  |
| World coords: `stage.getRelativePointerPosition()` | Apply inverse of container transform to `e.global` |

All 6 hooks in `src/components/Canvas/hooks/` need updating in their respective phases.

---

## Testing Strategy

Each phase ships with tests before moving to the next:

- **Shader uniforms** — pure TypeScript functions that calculate uniform values are unit tested independently of the GPU
- **Mesh geometry** — vertex buffer generation functions are unit tested with known pressure inputs
- **Rendering** — visual snapshot tests at key configurations
- **Interaction** — existing interaction tests ported to PixiJS event system
- **Performance** — manual FPS benchmarks at the exit criteria for each phase (Resource Monitor already in-app)

ESLint rules enforced throughout:

- No `konva`/`react-konva` imports after Phase 0
- GLSL files linted for uniform declaration consistency
- `FederatedPointerEvent` typed throughout (no `any` escape hatches)

---

## Dependencies

```
pixi.js@^8
@pixi/react@^8
@pixi-essentials/transformer
react@^19
react-dom@^19
@types/react@^19
```

Remove:

```
konva
react-konva
@types/konva (if present)
```
