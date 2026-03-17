# Canvas Performance Deep Dive: Rive Evaluation & PixiJS Migration Analysis

> Research document — no code changes. Produced March 2026.

---

## Context

The Graphium canvas (Konva v10.0.12 / react-konva v18.2.14) can feel sluggish during pan, zoom, token drag, and fog of war rendering. This document evaluates **Rive** as a potential replacement/enhancement and details a **PixiJS** migration as the strongest performance alternative.

---

## 1. Rive Verdict: NOT SUITABLE

**Rive is an animation playback engine, not an interactive canvas library.** It is designed for playing pre-authored animations via a WASM runtime — not for building interactive editors.

### What Rive lacks that Graphium needs

| Feature | Konva (current) | Rive |
|---|---|---|
| Freehand drawing (marker/eraser/wall) | Built-in | Not supported |
| Draggable objects with snap-to-grid | `draggable` prop | Manual from scratch |
| Transform handles (resize/rotate) | `Transformer` | Not supported |
| Per-object hit detection & events | Built-in | Limited to state machine inputs |
| Multi-layer composition with z-ordering | `Layer` component | Single artboard |
| Selection rectangle / multi-select | Built-in | Manual from scratch |
| Dynamic shape creation at runtime | React components | Must be pre-authored in Rive editor |

### As a supplementary layer

Rive _could_ overlay the Konva canvas for pre-authored animated effects:

- Token idle animations (breathing, hovering characters)
- Spell/ability visual effects (fireballs, healing auras)
- Environmental effects (flickering torches, rain, fog wisps)
- Status condition indicators (animated stunned stars, poison bubbles)

**Tradeoffs:** Adds ~150KB (WASM runtime), all animations must be pre-authored in Rive's editor, coordinate sync between two canvas layers adds complexity.

**Bottom line:** Nice-to-have for visual polish. Does **not** solve the performance problem.

---

## 2. Why the Canvas Feels Sluggish (Root Causes)

The codebase is already well-optimized (fog caching, viewport culling, RAF throttling, ref-based drag). The remaining sluggishness stems from:

### A. Konva is CPU-bound (Canvas 2D) — Primary suspect

Every shape on every layer is drawn by the CPU via `CanvasRenderingContext2D`. With 4 layers, 50+ tokens, grid lines, fog polygons, and drawings — the CPU does all pixel work. WebGL would offload this to the GPU.

### B. React reconciliation overhead

Each Konva shape (`<Rect>`, `<Line>`, `<Circle>`, `<Image>`) is a React component. With 100+ shapes, React's diffing runs on every state change even if most shapes didn't change.

### C. Fog of war compositing

Even with cached visibility polygons, the fog rendering uses custom `sceneFunc` with `globalCompositeOperation: "destination-out"` — expensive Canvas 2D compositing that runs every frame the fog layer redraws.

### D. Multiple full-canvas layers

Konva creates a separate `<canvas>` per `<Layer>`. Four layers at 2x pixel ratio on 1920×1080 = 4 × (3840×2160) ≈ **132 MB of canvas memory**.

### E. Large background images

Map images (4000×4000+) with blur/brightness filters applied via Konva are CPU-intensive.

---

## 3. PixiJS Migration (Recommended Path)

### Why PixiJS

- **WebGL/WebGPU-first** — GPU-accelerated rendering
- **Sprite batching** — all tokens rendered in 1 draw call vs N
- **GPU filters** — blur, brightness via GLSL shaders instead of CPU
- **Tree-shakeable** — modular imports via `@pixi/react` extend API
- **Benchmark**: 8k boxes @ 60fps (Chrome) vs Konva's 23fps

### Concept Mapping

| Konva | PixiJS Equivalent | Migration Difficulty |
|---|---|---|
| `Stage` | `<Application>` | Simple |
| `Layer` / `Group` | `Container` | Simple |
| `Rect, Circle, Line, Arc, Path` | `Graphics` class | Moderate — imperative API |
| `Image` (URLImage) | `Sprite` + `Texture` | Simple |
| `Transformer` | `@pixi-essentials/transformer` | Moderate — separate package |
| `Shape.sceneFunc` | Custom `Graphics` / GLSL shader | **Hard** — no direct equivalent |
| `cache()` / `clearCache()` | `cacheAsTexture` | Moderate |
| `Konva.Filters.Blur` | Built-in `BlurFilter` (GPU) | Simple |
| `draggable` prop | Manual pointer events | Moderate |
| `KonvaEventObject` | Federated pointer events | Moderate |

### Critical Challenges

#### 1. Pressure-Sensitive Drawing (HIGH RISK)

`PressureSensitiveLine.tsx` uses `Shape.sceneFunc` to render variable-width segments per pressure value. PixiJS has no `sceneFunc` equivalent.

**Options:**
- Custom class extending `Graphics` with per-segment width
- `Mesh` with dynamic geometry
- Custom GLSL shader (most performant)

#### 2. Fog of War Rendering (HIGH RISK)

`FogOfWarLayer.tsx` uses `Shape.sceneFunc` + `globalCompositeOperation` + `cache()`.

**Options:**
- Render visibility polygons to `RenderTexture`, apply as `AlphaMask`
- Custom fog fragment shader (most performant, soft edges possible)
- PixiJS `Graphics` polygons (least effort, less efficient)

**Upside:** GPU-based fog would be significantly faster than current CPU approach.

#### 3. Event System (MODERATE RISK)

PixiJS v8 changed `pointermove` to only fire over display objects (not canvas-wide). Must use `globalpointermove` for drawing, selection rect, measurement. Affects all hooks in `src/components/Canvas/hooks/`.

#### 4. Transformer (MODERATE RISK)

`@pixi-essentials/transformer` is less mature than Konva's built-in. May need custom rotation/scale handle implementation.

### What Stays the Same (No Changes Needed)

- All hooks (`useToolState`, `useMenuCommands`, `useRecentCampaigns`)
- State management (`gameStore.ts`, `uiStore.ts`)
- Services (`campaignService.ts`)
- Vision utils (`vision.ts`) — pure functions, no Konva dependency
- Domain types (`domain.ts`)

### @pixi/react v8 Status

- **Latest**: v8.0.5 (March 2025, stable)
- **Requires**: React 19, PixiJS v8
- **Maturity**: Production-ready, TypeScript-first, declarative JSX
- **Caveat**: Newer and smaller community than react-konva

### Migration Effort Estimate

| Component | Hours | Risk |
|---|---|---|
| Setup + dependency swap | 4 | Low |
| CanvasManager refactor (Stage → Application) | 16 | Low |
| Shape components (→ Graphics) | 24 | Medium |
| Token rendering (→ Sprite) + drag system | 16 | Medium |
| PressureSensitiveLine (shader or Mesh) | 32–48 | **High** |
| FogOfWarLayer (shader or RenderTexture mask) | 24 | **High** |
| Event system updates (all interaction hooks) | 16 | Medium |
| Transformer integration | 12 | Medium |
| GridOverlay + PaperNoiseOverlay | 8 | Low |
| Minimap (already raw canvas) | 4 | Low |
| Testing + optimization | 40 | Medium |
| **Total** | **~200 hours (~5 weeks)** | |

### Recommended Phased Approach

**Phase 1 — Proof of Concept (1 week)**
Migrate ONLY token rendering. Keep Konva for everything else. Validate Sprite performance, drag-and-drop, and event handling.

**Phase 2 — Grid & Background (3 days)**
Replace GridOverlay with PixiJS Graphics. Replace map background with Sprite. Benchmark large maps.

**Phase 3 — Fog of War (1 week)**
Implement GPU-based fog via RenderTexture + AlphaMask or custom shader. This is where the biggest performance gain lives.

**Phase 4 — Drawing System (1–2 weeks)**
Migrate freehand drawing to Graphics. Implement pressure-sensitive rendering via custom shader or Mesh. Highest-risk component.

**Phase 5 — Polish & Cutover (1 week)**
Transformer, measurement overlay, movement range. Remove Konva dependency. Full regression testing.

---

## 4. Quick Wins Without Migration (Alternative)

If the PixiJS migration is too large, these Konva optimizations can ship in 2–3 days:

1. **Merge layers** — reduce from 4 to 2–3 by caching static layers as bitmaps
2. **Dynamic pixel ratio** — drop to 1 during interactions, restore on idle (debounced 200ms)
3. **Fog on OffscreenCanvas** — render fog in a worker, composite as a single `<Image>`
4. **Token virtualization** — only render tokens within visible viewport + margin
5. **Map image downscaling** — render viewport-resolution thumbnail during pan/zoom

Expected impact: 30–60% improvement in frame times during interaction.

---

## 5. References

- [PixiJS v8 Launch](https://pixijs.com/blog/pixi-v8-launches)
- [@pixi/react v8](https://pixijs.com/blog/pixi-react-v8-live)
- [PixiJS v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8)
- [PixiJS Graphics API](https://pixijs.com/8.x/guides/components/scene-objects/graphics)
- [PixiJS Cache as Texture](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture)
- [PixiJS Event System](https://pixijs.com/8.x/guides/components/events)
- [PixiJS Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips)
- [Konva vs PixiJS Comparison (Aircada)](https://aircada.com/blog/pixijs-vs-konva)
- [Canvas Engines Comparison (GitHub)](https://github.com/slaylines/canvas-engines-comparison)
- [Rive](https://rive.app)
