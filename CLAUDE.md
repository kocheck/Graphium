# Graphium Modular Architecture Refactor — Game Plan

> **Branch:** `claude/refactor-modular-architecture-GUfVC`
> **Created:** 2026-02-09
> **Status:** In Progress — Session 0 (Planning Complete)

## Project Vision

Graphium is being refactored from a working monolithic React+Konva application into a
modular architecture where **presentation is fully separable from business logic**. The
end state: a designer can swap the entire visual identity — theme, components, layout —
without touching game logic, state management, or canvas rendering. Every module has a
defined boundary, a typed interface, and test coverage. The application runs smoothly on
a Chromebook (4GB RAM, Intel Celeron) and meets WCAG 2.2 AA accessibility standards.

This is an **incremental refactor**, not a rewrite. At every session boundary, the app
must be fully functional. No big-bang changes.

---

## Architecture End-State

```
src/
├── types/                    # All domain types (Token, Drawing, Door, Campaign, etc.)
│   ├── domain.ts             # Core game entity types (extracted from gameStore)
│   ├── geometry.ts           # Point, WallSegment, etc. (exists)
│   ├── grid.ts               # Grid types (exists)
│   └── measurement.ts        # Measurement types (exists)
│
├── styles/                   # Visual Framework (importable without app logic)
│   ├── tokens/               # Design tokens
│   │   ├── theme.css         # Semantic CSS custom properties (exists, hardened)
│   │   └── brand.css         # Brand-specific overrides (logo, accent, font)
│   ├── primitives.css        # Styles for UI primitive components
│   ├── home-screen.css       # Extracted from HomeScreen.tsx inline styles
│   ├── fonts.css             # Font declarations (exists)
│   └── app.css               # App-level utility classes (exists, cleaned)
│
├── components/
│   ├── primitives/           # UI Primitives (design system layer)
│   │   ├── Button.tsx        # All button variants
│   │   ├── Dialog.tsx        # Modal/dialog wrapper with a11y
│   │   ├── Input.tsx         # Text input with theme tokens
│   │   ├── Card.tsx          # Surface/panel component
│   │   └── ToggleSwitch.tsx  # Moved from root, integrated with tokens
│   │
│   ├── Canvas/               # Canvas rendering (exists, decomposed)
│   │   ├── CanvasManager.tsx # Slim compositor (~300 lines)
│   │   ├── ContextMenu.tsx   # Extracted from CanvasManager
│   │   ├── hooks/            # Canvas-specific interaction hooks
│   │   │   ├── useCanvasKeyboard.ts
│   │   │   ├── useCanvasDrop.ts
│   │   │   ├── useCanvasSelection.ts
│   │   │   ├── useCanvasDrawing.ts
│   │   │   ├── useCanvasInteraction.ts (exists)
│   │   │   └── useTokenDrag.ts (exists)
│   │   └── [rendering layers - FogOfWarLayer, GridOverlay, etc.]
│   │
│   ├── Dialogs/              # Modal/dialog components
│   │   ├── ConfirmDialog.tsx
│   │   ├── PreferencesDialog.tsx
│   │   ├── AboutModal.tsx
│   │   └── DungeonGeneratorDialog.tsx
│   │
│   ├── ErrorBoundaries/      # Error boundary components
│   │   ├── PrivacyErrorBoundary.tsx
│   │   ├── AssetProcessingErrorBoundary.tsx
│   │   ├── DungeonGeneratorErrorBoundary.tsx
│   │   └── [other error boundaries]
│   │
│   ├── Managers/             # Non-visual coordination components
│   │   ├── SyncManager.tsx
│   │   ├── ThemeManager.tsx
│   │   ├── AutoSaveManager.tsx
│   │   ├── PauseManager.tsx
│   │   └── UpdateManager.tsx
│   │
│   ├── Mobile/               # Mobile-specific components
│   │   ├── MobileToolbar.tsx
│   │   ├── MobileBottomSheet.tsx
│   │   └── MobileSidebarDrawer.tsx
│   │
│   ├── AssetLibrary/         # Token library (exists)
│   └── DesignSystemPlayground/ # Component showcase (exists)
│
├── store/                    # State management
│   ├── gameStore.ts          # Domain-only state (tokens, drawings, campaign)
│   └── uiStore.ts            # UI ephemeral state (toast, dialogs, sidebar)
│   ├── touchSettingsStore.ts # Touch preferences (exists, clean)
│   └── preferencesStore.ts   # Tool preferences (exists, clean)
│
├── services/                 # Platform abstraction (exists, clean)
│   ├── IStorageService.ts
│   ├── ElectronStorageService.ts
│   ├── WebStorageService.ts
│   ├── campaignService.ts    # Campaign I/O orchestration (new)
│   └── storage.ts            # Service locator (exists)
│
├── hooks/                    # App-wide custom hooks
│   ├── useToolState.ts       # Tool selection, color, drawing mode
│   ├── useMenuCommands.ts    # IPC menu handler registration
│   ├── useRecentCampaigns.ts # localStorage recent files
│   ├── usePlatformDetection.ts
│   ├── useCommandPalette.ts  # (exists)
│   ├── useMediaQuery.ts      # (exists)
│   ├── useThemeColor.ts      # (exists)
│   └── useTokenData.ts       # (exists)
│
├── utils/                    # Pure utility functions
│   ├── vision.ts             # Raycasting, wall collision, vision polygons
│   └── [existing utils]
│
└── workers/                  # Web Workers (exists)
```

---

## Design System Contract

This is the **seam** between visual framework and application logic. The designer
operates above this line; the developer operates below it.

### Visual Layer (Designer Domain)

- `src/styles/**` — All CSS, tokens, brand config
- `src/components/primitives/**` — UI primitive components
- `src/styles/home-screen.css` — Landing page styles
- Tailwind utility classes in component JSX
- Any file whose primary purpose is visual presentation

### Logic Layer (Developer Domain)

- `src/store/**` — State management
- `src/services/**` — Platform abstraction, I/O
- `src/utils/**` — Pure business logic, algorithms
- `src/hooks/**` — State composition, side effects
- `src/workers/**` — Background processing
- `src/types/**` — Type definitions

### Contract Rules

1. **Primitives import from styles/ and types/ only** — never from store or services
2. **Store imports from types/ only** — never from components
3. **Services import from types/ only** — never from components or store
4. **Hooks may import from store, services, and types** — never from components
5. **Feature components compose primitives + hooks** — they are the integration layer
6. **Vision utils are pure functions** — no React, no Zustand, no side effects

### Enforcement

These boundaries will be enforced via ESLint `import/no-restricted-paths` rules
(see Session 12). Until then, enforce manually during review.

---

## Selected Refactors — Execution Order

All 30 recommendations accepted. Ordered by dependency graph with cleanup first.

| Order | ID   | Title                                     | Effort | Session |
| ----- | ---- | ----------------------------------------- | ------ | ------- |
| 1     | [1]  | Delete dead Vite boilerplate files        | S      | 1       |
| 2     | [5]  | Clean FogOfWarLayer diagnostic logging    | S      | 1       |
| 3     | [25] | Optimize static assets (icon.png)         | S      | 1       |
| 4     | [21] | Generate test coverage baseline           | S      | 1       |
| 5     | [2]  | Consolidate root documentation sprawl     | M      | 2       |
| 6     | [3]  | Reorganize component directory structure  | M      | 2       |
| 7     | [4]  | Extract domain types from gameStore       | S      | 2       |
| 8     | [6]  | Harden theme token system                 | M      | 3       |
| 9     | [30] | Optimize Radix color CSS imports          | S      | 3       |
| 10    | [7]  | Scope global transition rule              | S      | 3       |
| 11    | [28] | Add prefers-contrast support              | S      | 3       |
| 12    | [12] | Add brand configuration layer             | S      | 3       |
| 13    | [8]  | Create UI Primitive: Button               | M      | 4       |
| 14    | [10] | Create UI Primitives: Input, Card, Toggle | M      | 4       |
| 15    | [9]  | Create UI Primitive: Dialog/Modal         | M      | 5       |
| 16    | [11] | Extract HomeScreen inline CSS             | L      | 5       |
| 17    | [19] | Install eslint-plugin-jsx-a11y            | S      | 6       |
| 18    | [20] | Upgrade ESLint warns → errors             | S      | 6       |
| 19    | [23] | Add import boundary linting rules         | S      | 6       |
| 20    | [13] | Separate UI/domain state in gameStore     | M      | 7       |
| 21    | [14] | Extract vision/raycasting module          | M      | 8       |
| 22    | [17] | Extract HomeScreen business logic         | M      | 8       |
| 23    | [16] | Extract App.tsx coordination hooks        | M      | 9       |
| 24    | [18] | Create campaign service module            | M      | 9       |
| 25    | [15] | Split CanvasManager into focused modules  | XL     | 10      |
| 26    | [24] | Add code splitting with React.lazy        | M      | 11      |
| 27    | [26] | Konva performance budget for low-end      | M      | 11      |
| 28    | [27] | Add canvas accessibility layer            | L      | 12      |
| 29    | [29] | Complete keyboard navigation coverage     | M      | 12      |
| 30    | [22] | Unit tests for all extracted modules      | L      | 13      |

---

## Session Breakdown

---

### Session 1: Cleanup & Quick Wins

**Goal:** Remove dead weight, establish quality baseline, zero-risk changes.

#### Task 1.1 — Delete Dead Vite Boilerplate Files [1]

**Files to delete:**

- `src/App.css` (43 lines, Vite scaffold — zero imports)
- `src/assets/react.svg` (4.1KB, Vite logo — zero imports)
- `public/electron-vite.svg` (6.9KB — zero references)
- `public/electron-vite.animate.svg` (7.1KB — zero references)
- `public/vite.svg` (1.5KB — zero references)

**End State:** Five files removed. No import errors. App runs identically.
**Acceptance Criteria:**

- [ ] All 5 files deleted
- [ ] `npm run build:web` succeeds
- [ ] `npm run dev` starts without errors
- [ ] No dangling import warnings
      **Rollback:** `git checkout HEAD -- <files>` to restore any file.

#### Task 1.2 — Clean FogOfWarLayer Diagnostic Logging [5]

**Files:** `src/components/Canvas/FogOfWarLayer.tsx`
**Change:** Remove or gate the ~40 lines of `console.log` diagnostic output
(lines 59-100+). Replace with a single `const DEBUG_VISION = false` flag
at the top of the file. Wrap all diagnostic logging behind this flag.
**End State:** Dev console is clean during normal development. Diagnostics
are available by flipping one boolean.
**Acceptance Criteria:**

- [ ] No console output from FogOfWarLayer during normal dev usage
- [ ] `DEBUG_VISION = true` re-enables all diagnostic output
- [ ] No changes to rendering logic or behavior
      **Rollback:** Revert single file.

#### Task 1.3 — Optimize Static Assets [25]

**Files:** `public/icon.png` (927KB)
**Change:** Compress icon.png to <50KB using lossy PNG optimization (pngquant
or similar). Verify visual quality at 16x16, 32x32, 128x128, 512x512 sizes.
The existing `public/icon.svg` can serve as favicon if SVG is smaller.
**End State:** App icon loads faster. No visible quality loss.
**Acceptance Criteria:**

- [ ] icon.png is <100KB (target <50KB)
- [ ] App icon renders correctly in browser tab and Electron title bar
- [ ] No visual degradation at standard icon sizes
      **Rollback:** Restore original icon.png from git.

#### Task 1.4 — Generate Test Coverage Baseline [21]

**Files:** `vitest.config.ts`, `package.json` (scripts)
**Change:** Run `vitest run --coverage` and review output. Ensure coverage
config in vitest.config.ts is correct. Document baseline numbers in this file
(Session 1 notes). Add `npm run test:coverage` to CI-relevant scripts if not
already present.
**End State:** We know exactly which modules have 0% coverage.
**Acceptance Criteria:**

- [ ] Coverage report generates successfully
- [ ] Baseline numbers documented in session notes below
- [ ] Coverage thresholds understood (not enforced yet — that's Session 13)
      **Rollback:** No code changes to revert.

---

### Session 2: Repo Organization & Type Extraction

**Goal:** Clean directory structure, consolidate docs, extract types.

#### Task 2.1 — Consolidate Root Documentation [2]

**Changes:**

- Delete `ARCHITECTURE.md` from root (duplicate of `docs/architecture/ARCHITECTURE.md`)
- Move `LINTING.md` → `docs/guides/LINTING.md`
- Move `LINTING_MIGRATION_GUIDE.md` → `docs/guides/LINTING_MIGRATION_GUIDE.md`
- Move `RELEASE_AUDIT_REPORT.md` → `docs/planning/RELEASE_AUDIT_REPORT.md`
- Move `TOUCH_SUPPORT_MIGRATION.md` → `docs/features/TOUCH_SUPPORT_MIGRATION.md`
- Move `IPC_SYNC_VERIFICATION.md` → `docs/architecture/IPC_SYNC_VERIFICATION.md`
- Move `AUTO_UPDATER.md` → `docs/features/AUTO_UPDATER.md`
- Move `DEVICE_COMPATIBILITY.md` → `docs/guides/DEVICE_COMPATIBILITY.md`
- Move `FONT_SETUP.md` → `docs/guides/FONT_SETUP.md`
- Move `diagnose-dungeon.ts` → `tests/helpers/diagnose-dungeon.ts`
- Remove `diagnose-dungeon.ts` from `tsconfig.json` include array
- Keep at root: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`,
  `TESTING_STRATEGY.md` (referenced by CI), `.ai-rules.md`, `.cursorrules`
- Update any internal cross-references (links between docs)

**End State:** Root has ≤7 markdown files. All detailed docs live in docs/.
**Acceptance Criteria:**

- [ ] Root contains only: README.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE,
      TESTING_STRATEGY.md, CLAUDE.md, .ai-rules.md, .cursorrules
- [ ] All moved files have correct paths in any internal links
- [ ] `npm run build:web` succeeds (tsconfig change)
- [ ] No broken references in README.md
      **Rollback:** Revert commit — file moves only, no logic changes.

#### Task 2.2 — Reorganize Component Directory Structure [3]

**Create directories and move files:**

```
src/components/ErrorBoundaries/
  ← PrivacyErrorBoundary.tsx
  ← AssetProcessingErrorBoundary.tsx
  ← DungeonGeneratorErrorBoundary.tsx (+ test)
  ← TokenErrorBoundary.tsx (from Canvas/)
  ← ErrorFallbackUI.tsx
  ← UpdateErrorFallbackUI.tsx (+ test)
  ← PendingErrorsIndicator.tsx

src/components/Dialogs/
  ← ConfirmDialog.tsx
  ← PreferencesDialog.tsx
  ← AboutModal.tsx
  ← DungeonGeneratorDialog.tsx (+ test)
  ← ImageCropper.tsx

src/components/Managers/
  ← SyncManager.tsx
  ← ThemeManager.tsx
  ← AutoSaveManager.tsx
  ← PauseManager.tsx
  ← UpdateManager.tsx

src/components/Mobile/
  ← MobileToolbar.tsx
  ← MobileBottomSheet.tsx
  ← MobileSidebarDrawer.tsx
```

**Update all imports** in files that reference moved components.

**End State:** components/ root has ~15 files (App-level components like
Sidebar, HomeScreen, Toolbar, Toast, MapNavigator, etc.) plus feature folders.
**Acceptance Criteria:**

- [ ] All moved files are in their new locations
- [ ] All imports updated — zero TypeScript errors
- [ ] `npm run lint` passes
- [ ] `npm run build:web` succeeds
- [ ] App runs correctly in dev mode
      **Rollback:** Revert commit — moves + import updates only.

#### Task 2.3 — Extract Domain Types from gameStore [4]

**Files:**

- Create: `src/types/domain.ts`
- Modify: `src/store/gameStore.ts`

**Change:** Move these interfaces/types from gameStore.ts to domain.ts:
`TokenMetadata`, `Token`, `Drawing`, `MapConfig`, `GridType`, `MapData`,
`TokenLibraryItem`, `Campaign`, `ToastMessage`, `ConfirmDialog`, `ExploredRegion`,
`Door`, `Stairs`, `DEFAULT_GRID_COLOR`, `MAX_EXPLORED_REGIONS`

gameStore.ts re-exports everything from domain.ts for backward compatibility:

```typescript
export type { Token, Drawing, Door /* etc */ } from '../types/domain';
```

**End State:** Types are importable via `from '../types/domain'` without pulling
in Zustand. Existing imports from gameStore still work.
**Acceptance Criteria:**

- [ ] `src/types/domain.ts` contains all domain type definitions
- [ ] `src/store/gameStore.ts` re-exports all types (zero breaking changes)
- [ ] All existing imports still resolve
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
      **Rollback:** Revert commit — no runtime behavior change.

---

### Session 3: Theme System Foundation

**Goal:** Make the token system airtight. Every color flows through tokens.

#### Task 3.1 — Harden Theme Token System [6]

**Files:** `src/styles/theme.css`, `src/styles/app.css`, + all component files
with hardcoded colors

**New tokens to add to theme.css:**

```css
/* Canvas-specific */
--app-canvas-fog: rgba(0, 0, 0, 0.94);
--app-canvas-fog-explored: rgba(0, 0, 0, 0.6);
--app-canvas-selection: rgba(59, 130, 246, 0.3);
--app-canvas-selection-border: #3b82f6;
--app-canvas-snap-preview: rgba(37, 99, 235, 0.6);
--app-canvas-marker-default: #df4b26;

/* Toolbar (currently hardcoded in app.css) */
--app-toolbar-bg: #000000;
--app-toolbar-border: rgb(82, 82, 82);
--app-toolbar-button-bg: rgb(64, 64, 64);
--app-toolbar-button-text: rgb(229, 229, 229);
--app-toolbar-button-border: rgb(82, 82, 82);
--app-toolbar-button-hover: rgb(82, 82, 82);

/* Minimap */
--app-minimap-bg: rgba(100, 100, 100, 0.3);
--app-minimap-viewport: rgba(59, 130, 246, 0.2);

/* Door shapes */
--app-door-fill: white;
--app-door-stroke: black;
--app-door-locked-icon: #ef4444;
```

**Then sweep:** Replace all hardcoded hex/rgba values in component files with
the appropriate token. Target files (by count of hardcoded values):

- `DoorShape.tsx` (19 values)
- `ResourceMonitor.tsx` (15 values)
- `CanvasManager.tsx` (14 values)
- `TouchVisualFeedback.tsx` (9 values)
- `HomeScreen.tsx` (7 values)
- `Minimap.tsx` (5 values)
- `MeasurementOverlay.tsx` (4 values)
- `app.css` (6 values)
- All remaining files with hardcoded colors

**End State:** `grep -r "rgba\|#[0-9a-f]" src/components/ src/styles/app.css`
returns zero results outside of theme.css and brand.css.
**Acceptance Criteria:**

- [ ] All new tokens defined in theme.css (light + dark variants)
- [ ] Zero hardcoded color values in component files
- [ ] Visual appearance unchanged (verified manually in light + dark mode)
- [ ] `npm run build:web` succeeds
      **Rollback:** Revert commit — CSS token additions are additive, sweeps are mechanical.

#### Task 3.2 — Optimize Radix Color CSS Imports [30]

**Files:** `src/styles/theme.css`
**Change:** The dark-mode Radix imports (slate-dark.css, blue-dark.css, etc.)
are redundant because lines 58-136 manually re-declare all dark values under
`[data-theme='dark']`. Remove the 6 dark-mode CSS imports. Verify no component
directly references Radix variable names (e.g., `var(--slate-4)` instead of
`var(--app-bg-hover)`).
**End State:** 6 fewer CSS imports. Dark mode still works via manual declarations.
**Acceptance Criteria:**

- [ ] Dark mode CSS imports removed from theme.css
- [ ] Dark mode visually identical (test both themes)
- [ ] No component uses raw Radix variable names directly
      **Rollback:** Re-add the import lines.

#### Task 3.3 — Scope Global Transition Rule [7]

**Files:** `src/styles/theme.css`
**Change:** Replace the `* { transition-property: ... }` rule (line 291-295) with
scoped selectors: `.app-root`, `.sidebar`, `.btn`, `.btn-tool`, `.btn-mode`,
`.toolbar`, `[data-theme] .themed-transition`. Add `themed-transition` class
to elements that actually need smooth theme switching. Remove transitions from
canvas containers entirely.
**End State:** Theme transitions work on UI elements. Canvas performance unaffected.
**Acceptance Criteria:**

- [ ] Theme toggle still animates smoothly on sidebar, toolbar, buttons
- [ ] Canvas/Konva elements have no CSS transitions applied
- [ ] `prefers-reduced-motion: reduce` still disables all transitions
      **Rollback:** Restore `*` selector.

#### Task 3.4 — Add prefers-contrast Support [28]

**Files:** `src/styles/theme.css`
**Change:** Add a `@media (prefers-contrast: more)` block:

- Increase all borders from 1px to 2px
- Use step-12 text everywhere (--app-text-primary for all text roles)
- Add 2px outline to all interactive elements on focus
- Increase shadow opacity
  **End State:** Users with high-contrast preference get enhanced visibility.
  **Acceptance Criteria:**
- [ ] `@media (prefers-contrast: more)` block exists in theme.css
- [ ] All text uses highest contrast step
- [ ] Interactive elements have visible outlines
- [ ] Tested with Chrome DevTools contrast emulation
      **Rollback:** Remove the media query block.

#### Task 3.5 — Add Brand Configuration Layer [12]

**Files:** Create `src/styles/brand.css`
**Change:** Create a brand-specific override file that centralizes:

- Accent color override (currently in theme.css as `--app-accent-solid: #0070c1`)
- Font family reference
- Logo asset paths (currently hardcoded in LogoIcon.tsx, LogoLockup.tsx)
- App name string (for use in title, about modal)

Import brand.css in index.css after theme.css. Document: "To rebrand, edit
brand.css only."
**End State:** Single file controls visual brand identity.
**Acceptance Criteria:**

- [ ] `src/styles/brand.css` exists with documented override points
- [ ] Changing accent color in brand.css changes it everywhere
- [ ] App appearance unchanged with default brand values
      **Rollback:** Delete brand.css, remove import.

---

### Session 4: UI Primitives — Button, Input, Card

**Goal:** Create the first reusable design system components.

#### Task 4.1 — Create Button Primitive [8]

**Create:** `src/components/primitives/Button.tsx`
**Interface:**

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'tool';
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean; // For tool buttons
  isLoading?: boolean; // Shows spinner, disables interaction
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

**Built-in behavior:**

- Focus ring using `--app-accent-solid` (visible, 2px offset)
- Disabled state (opacity + cursor + aria-disabled)
- Loading state (spinner + aria-busy)
- Theme token colors for all variants
- `type="button"` default (prevent accidental form submission)

**Migration:** Replace 3-5 existing button usages as proof-of-concept (Sidebar
buttons, one dialog). Do NOT attempt to replace all buttons in this session.
**Acceptance Criteria:**

- [ ] Button component renders all 5 variants correctly
- [ ] Focus ring visible on keyboard tab
- [ ] Disabled and loading states work
- [ ] 3-5 existing buttons migrated as examples
- [ ] No visual regression in migrated locations
      **Rollback:** Delete component, revert migrated files.

#### Task 4.2 — Create Input, Card, ToggleSwitch Primitives [10]

**Create:**

- `src/components/primitives/Input.tsx` — Text input with label, error state
- `src/components/primitives/Card.tsx` — Surface panel with theme tokens
- Move `src/components/ToggleSwitch.tsx` → `src/components/primitives/ToggleSwitch.tsx`

**Input interface:**

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}
```

**Card interface:**

```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
```

**ToggleSwitch:** Already has good a11y (`role="switch"`, `aria-checked`).
Integrate theme tokens for colors. Update import paths everywhere.
**Acceptance Criteria:**

- [ ] All three primitives render correctly with theme tokens
- [ ] Input shows label, error state, helper text
- [ ] Card renders 3 variants
- [ ] ToggleSwitch works from new path, all existing usages updated
- [ ] Keyboard accessible (Tab, Space/Enter to toggle)
      **Rollback:** Delete new files, revert ToggleSwitch move.

---

### Session 5: UI Primitives — Dialog + HomeScreen CSS

**Goal:** Standardize modal pattern, extract the biggest inline CSS blob.

#### Task 5.1 — Create Dialog Primitive [9]

**Create:** `src/components/primitives/Dialog.tsx`
**Interface:**

```typescript
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

**Built-in behavior:**

- Focus trap (Tab cycles within dialog)
- Escape key closes
- Overlay click closes (configurable)
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- Scroll lock on body
- Reduced-motion: no open/close animation
- Auto-focus first focusable element on open
- Return focus to trigger element on close

**Migration:** Refactor PreferencesDialog and ConfirmDialog to use this wrapper.
Other dialogs migrated in later sessions.
**Acceptance Criteria:**

- [ ] Dialog renders with all a11y attributes
- [ ] Focus trap works (Tab, Shift+Tab cycle within)
- [ ] Escape closes, overlay click closes
- [ ] PreferencesDialog + ConfirmDialog migrated
- [ ] No visual regression
      **Rollback:** Delete Dialog.tsx, revert migrated components.

#### Task 5.2 — Extract HomeScreen Inline CSS [11]

**Files:**

- `src/components/HomeScreen.tsx` (remove ~1,000 lines of `<style>` block)
- Create: `src/styles/home-screen.css`

**Change:** Move all CSS from the inline `<style>` tag in HomeScreen.tsx to
`src/styles/home-screen.css`. Replace hardcoded color values with theme tokens.
Import the stylesheet in HomeScreen.tsx. Ensure all class names are preserved
(or converted to CSS modules if the team prefers).
**End State:** HomeScreen.tsx drops by ~1,000 lines. CSS is editable without
touching React logic.
**Acceptance Criteria:**

- [ ] No `<style>` tag remains in HomeScreen.tsx
- [ ] All styles in `src/styles/home-screen.css`
- [ ] All hardcoded colors replaced with theme tokens
- [ ] HomeScreen looks identical in light + dark mode
- [ ] Responsive behavior preserved (mobile breakpoints)
      **Rollback:** Revert both files.

---

### Session 6: Quality Tooling

**Goal:** Add automated guardrails for accessibility and module boundaries.

#### Task 6.1 — Install eslint-plugin-jsx-a11y [19]

**Files:** `.eslintrc.cjs`, `package.json`
**Change:** Install `eslint-plugin-jsx-a11y`. Add `plugin:jsx-a11y/recommended`
to extends array. Run `npm run lint` to see violations. Fix auto-fixable issues.
Document remaining violations count as baseline.
**Acceptance Criteria:**

- [ ] Plugin installed and configured
- [ ] `npm run lint` runs with a11y rules active
- [ ] Auto-fixable violations fixed
- [ ] Remaining violation count documented
      **Rollback:** Remove plugin from config and package.json.

#### Task 6.2 — Upgrade ESLint Warns to Errors [20]

**Files:** `.eslintrc.cjs`
**Change:** Address existing violations for each rule, then upgrade:

- `@typescript-eslint/no-explicit-any` → `error`
- `@typescript-eslint/no-misused-promises` → `error`
- `@typescript-eslint/no-unsafe-member-access` → `error`
- `@typescript-eslint/no-unsafe-call` → `error`
- `@typescript-eslint/no-unsafe-assignment` → `error`

This requires wrapping async event handlers (onSubmit, onClick) and adding
explicit types to JSON parsing and IPC calls. May be a significant effort
depending on violation count.
**Acceptance Criteria:**

- [ ] All 5 rules upgraded to `error`
- [ ] `npm run lint` passes with zero warnings for these rules
- [ ] No `any` types in non-test source files
      **Rollback:** Revert .eslintrc.cjs changes.

#### Task 6.3 — Add Import Boundary Linting [23]

**Files:** `.eslintrc.cjs`
**Change:** Add `import/no-restricted-paths` rules:

```javascript
'import/no-restricted-paths': ['error', {
  zones: [
    // Primitives cannot import from store or services
    { target: './src/components/primitives', from: './src/store' },
    { target: './src/components/primitives', from: './src/services' },
    // Store cannot import from components
    { target: './src/store', from: './src/components' },
    // Services cannot import from components
    { target: './src/services', from: './src/components' },
    // Utils cannot import from React/components
    { target: './src/utils', from: './src/components' },
  ]
}]
```

**Acceptance Criteria:**

- [ ] Import boundary rules configured
- [ ] `npm run lint` passes (no current violations)
- [ ] Attempting a boundary-violating import produces a lint error
      **Rollback:** Remove the rule from .eslintrc.cjs.

---

### Session 7: Store Separation

**Goal:** Split UI ephemeral state from domain state.

#### Task 7.1 — Create uiStore and Migrate UI State [13]

**Create:** `src/store/uiStore.ts`
**Migrate from gameStore:**

- `toast` + `showToast()` + `clearToast()`
- `confirmDialog` + `showConfirmDialog()` + `clearConfirmDialog()`
- `showResourceMonitor` + `setShowResourceMonitor()`
- `dungeonDialog` + `showDungeonDialog()` + `clearDungeonDialog()`
- `isGamePaused` + `setIsGamePaused()`
- `isMobileSidebarOpen` + `setMobileSidebarOpen()`
- `isCommandPaletteOpen` + `setCommandPaletteOpen()`

**gameStore keeps:** All domain state (tokens, drawings, doors, stairs,
campaign, grid, map, exploredRegions, vision, measurements, calibrating,
daylightMode).

**Migration strategy:**

1. Create uiStore with the migrated state
2. Add re-export aliases in gameStore for backward compat (deprecation warnings)
3. Update consumers one file at a time to import from uiStore
4. Remove re-exports from gameStore once all consumers migrated

**End State:** UI state changes don't trigger IPC sync. gameStore is domain-pure.
**Acceptance Criteria:**

- [ ] `src/store/uiStore.ts` exists with all UI state
- [ ] All consumers updated to use uiStore for UI state
- [ ] gameStore has zero UI state properties
- [ ] SyncManager only watches gameStore (no UI state in IPC)
- [ ] Toast, dialogs, sidebar all work correctly
- [ ] `npm run lint` passes
- [ ] `npm run test:run` passes
      **Rollback:** Revert commit. Backward-compat re-exports make this safe.

---

### Session 8: Logic Extraction I — Vision & HomeScreen

**Goal:** Extract pure business logic from rendering components.

#### Task 8.1 — Extract Vision/Raycasting Module [14]

**Create:** `src/utils/vision.ts`, `src/utils/__tests__/vision.test.ts`
**Extract from** `src/components/Canvas/FogOfWarLayer.tsx`:

- `castRay()` — Single ray from origin toward angle, returns hit point
- `computeVisionPolygon()` — 360° sweep for one token, returns polygon
- `getWallSegments()` — Extract wall segments from drawings + doors
- `isPointInPolygon()` — Point-in-polygon test (if present)

**FogOfWarLayer.tsx** becomes a thin component that calls `computeVisionPolygon()`
and renders the result via Konva shapes.
**Acceptance Criteria:**

- [ ] `src/utils/vision.ts` contains all raycasting logic
- [ ] `src/utils/vision.ts` has zero React/Konva imports
- [ ] FogOfWarLayer renders identically
- [ ] `vision.test.ts` covers: basic ray cast, wall blocking, door open/closed
- [ ] At least 80% statement coverage on vision.ts
      **Rollback:** Revert both files.

#### Task 8.2 — Extract HomeScreen Business Logic [17]

**Create:**

- `src/hooks/useRecentCampaigns.ts` — localStorage read/write for recent files
- `src/hooks/usePlatformDetection.ts` — navigator.userAgent checks

**Extract from** `src/components/HomeScreen.tsx`:

- localStorage recent campaign read/write → `useRecentCampaigns()`
- navigator/platform detection → `usePlatformDetection()`
- `getStorage()` campaign loading → stays but uses campaignService (Session 9)

**End State:** HomeScreen is presentation-focused. Logic is in testable hooks.
**Acceptance Criteria:**

- [ ] HomeScreen has zero direct localStorage calls
- [ ] HomeScreen has zero navigator.userAgent calls
- [ ] Hooks are independently testable
- [ ] HomeScreen renders and functions identically
      **Rollback:** Revert files.

---

### Session 9: Logic Extraction II — App.tsx & Campaign Service

**Goal:** Slim down App.tsx, centralize campaign I/O.

#### Task 9.1 — Extract App.tsx Coordination Hooks [16]

**Create:**

- `src/hooks/useToolState.ts` — tool, color, recentColors, doorOrientation,
  eraserSize, wallSize, measurementMode, stairsDirection, stairsType
- `src/hooks/useMenuCommands.ts` — IPC menu command handlers (save, load, new,
  undo, about, preferences, worldview, etc.)

**Extract from** `src/App.tsx` (~400 lines of useState + useEffect).
App.tsx becomes layout/routing: render HomeScreen or CanvasManager based on
campaign state, compose managers (Sync, Theme, AutoSave, Pause).
**Acceptance Criteria:**

- [ ] App.tsx is <250 lines
- [ ] Tool state managed via useToolState hook
- [ ] Menu commands handled via useMenuCommands hook
- [ ] All keyboard shortcuts still work
- [ ] All menu items still work (Electron)
      **Rollback:** Revert files.

#### Task 9.2 — Create Campaign Service Module [18]

**Create:** `src/services/campaignService.ts`
**Consolidate from** App.tsx, HomeScreen.tsx, AutoSaveManager.tsx:

- `saveCampaign()` — Sync store → call storage.saveCampaign()
- `loadCampaign()` — Call storage.loadCampaign() → hydrate store
- `autoSaveCampaign()` — Sync store → call storage.autoSaveCampaign()
- `startNewCampaign()` — Reset store → clean state
- `exportCampaign()` — Save-as with new path

Uses `IStorageService` internally. No React imports.
**Acceptance Criteria:**

- [ ] `campaignService.ts` has zero React/component imports
- [ ] All campaign I/O flows through this service
- [ ] Save, load, auto-save, new campaign all work
- [ ] Service has unit tests covering happy path + error cases
      **Rollback:** Revert files.

---

### Session 10: CanvasManager Decomposition

**Goal:** Break the 1,867-line monolith into focused, testable modules.
**This is the largest single task (XL effort). May span multiple sub-sessions.**

#### Task 10.1 — Extract Canvas Hooks

**Create:**

- `src/components/Canvas/hooks/useCanvasKeyboard.ts` — Key event handling
- `src/components/Canvas/hooks/useCanvasDrop.ts` — File drop + image processing
- `src/components/Canvas/hooks/useCanvasSelection.ts` — Selection rect + multi-select
- `src/components/Canvas/hooks/useCanvasDrawing.ts` — Marker/eraser/wall strokes

Each hook has a clear interface (accepts stage ref + relevant state, returns
handlers). CanvasManager calls each hook and wires handlers to Konva events.

#### Task 10.2 — Extract Context Menu Component

**Create:** `src/components/Canvas/ContextMenu.tsx`
Extract the right-click context menu rendering and logic from CanvasManager.

#### Task 10.3 — Slim CanvasManager

**Modify:** `src/components/Canvas/CanvasManager.tsx`
After extractions, CanvasManager should be ~300-400 lines:

- Konva `<Stage>` setup
- Layer composition (ordering)
- Hook wiring (keyboard, drop, selection, drawing, interaction, drag)
- Props passing to child layers

**Acceptance Criteria:**

- [ ] CanvasManager.tsx is <500 lines
- [ ] Each extracted hook has zero direct Zustand store access (receives via params or uses selectors)
- [ ] All canvas interactions work: draw, erase, select, move tokens, drop files,
      keyboard shortcuts, right-click menu
- [ ] `npm run test:run` passes
- [ ] No visual or behavioral regression
      **Rollback:** Revert all files in Canvas/ directory.

---

### Session 11: Performance Hardening

**Goal:** Reduce initial bundle size, optimize canvas for low-end devices.

#### Task 11.1 — Add Code Splitting with React.lazy [24]

**Files:** `src/App.tsx` (or wherever modals are rendered)
**Change:** Wrap infrequently-used components in `React.lazy()` + `<Suspense>`:

- `DesignSystemPlayground`
- `AboutModal`
- `DungeonGeneratorDialog`
- `PreferencesDialog`
- `CommandPalette`
- `ResourceMonitor`
- `UpdateManager`

**Measurement:** Record main chunk size before and after.
**Target:** 30-40% reduction in initial JS bundle.
**Acceptance Criteria:**

- [ ] All listed components are lazy-loaded
- [ ] Suspense fallback renders (loading indicator or null)
- [ ] No flash of unstyled content when modals open
- [ ] Main chunk size reduced (document before/after in session notes)
- [ ] All lazy components still function correctly
      **Rollback:** Remove React.lazy wrappers.

#### Task 11.2 — Set Konva Performance Budget [26]

**Files:** `src/components/Canvas/CanvasManager.tsx`, canvas layer components
**Changes:**

- Cap `pixelRatio` to 2 max (detect via `navigator.deviceMemory` or `navigator.hardwareConcurrency`)
- Apply `listening(false)` to static layers: GridOverlay, PaperNoiseOverlay
- Enable layer caching for FogOfWarLayer explored regions (don't re-render static fog)
- Add a `PERFORMANCE_MODE` config that reduces effects on low-end detection

**Target:** 60fps with 20 tokens, 5 drawings, grid visible, on simulated low-end.
**Acceptance Criteria:**

- [ ] pixelRatio capped on detected low-end devices
- [ ] Static layers have listening disabled
- [ ] FogOfWarLayer uses caching for explored regions
- [ ] No visual degradation on standard displays
      **Rollback:** Revert canvas changes.

---

### Session 12: Accessibility Hardening

**Goal:** Make the canvas usable without a mouse and announce state to screen readers.

#### Task 12.1 — Add Canvas Accessibility Layer [27]

**Create:** `src/components/Canvas/CanvasAccessibility.tsx`
**Features:**

- Off-screen ARIA live region (`aria-live="polite"`) for game state announcements
- Announce: token movement, door open/close, measurement results, tool changes
- `role="img"` + `aria-label` on canvas element with state summary
- Keyboard token selection: Tab through tokens, Enter to select, Arrow to move

**Integration:** Rendered alongside Konva Stage in CanvasManager, positioned
off-screen but available to screen readers.
**Acceptance Criteria:**

- [ ] Screen reader announces token movements
- [ ] Screen reader announces door state changes
- [ ] Canvas has descriptive aria-label
- [ ] Basic keyboard token selection works (Tab + Enter + Arrows)
- [ ] `npm run test:a11y` passes with no new violations
      **Rollback:** Remove component.

#### Task 12.2 — Complete Keyboard Navigation [29]

**Files:** Sidebar, MapNavigator, all Dialog components, global
**Changes:**

- Add `tabIndex` and `onKeyDown` to Sidebar token library items
- Add keyboard navigation to MapNavigator map list
- Ensure all Dialog primitives (from Session 5) handle focus correctly
- Add visible focus indicators: `outline: 2px solid var(--app-accent-solid);
outline-offset: 2px` on all interactive elements (global CSS rule)
- Add skip-to-content link (hidden until focused)

**Acceptance Criteria:**

- [ ] Every interactive element reachable via Tab key
- [ ] Focus indicators visible on all elements
- [ ] Skip-to-content link present and functional
- [ ] Sidebar token items keyboard-activatable
- [ ] MapNavigator items keyboard-navigable
- [ ] `npm run test:a11y` passes
      **Rollback:** Revert CSS + component changes.

---

### Session 13: Test Hardening

**Goal:** Achieve meaningful coverage on all extracted modules.

#### Task 13.1 — Unit Tests for Extracted Modules [22]

**Test files to create/expand:**

- `src/utils/__tests__/vision.test.ts` (expand from Session 8)
- `src/services/__tests__/campaignService.test.ts`
- `src/hooks/__tests__/useToolState.test.ts`
- `src/hooks/__tests__/useRecentCampaigns.test.ts`
- `src/hooks/__tests__/useMenuCommands.test.ts`
- `src/store/__tests__/uiStore.test.ts`
- `src/components/primitives/__tests__/Button.test.tsx`
- `src/components/primitives/__tests__/Dialog.test.tsx`
- `src/components/primitives/__tests__/Input.test.tsx`

**Coverage targets:**

- Pure utilities (vision.ts, etc.): 90%+
- Services (campaignService.ts): 80%+
- Hooks (useToolState, etc.): 70%+
- UI Primitives (Button, Dialog, Input): 80%+
- Store (uiStore): 80%+

**Acceptance Criteria:**

- [ ] All listed test files exist and pass
- [ ] Coverage meets targets per module
- [ ] `npm run test:run` passes with zero failures
- [ ] No test depends on component implementation details
      **Rollback:** Delete test files (no production code affected).

---

## Architecture Decision Records

### ADR-001: Zustand Store Split (UI vs Domain)

**Decision:** Split gameStore into gameStore (domain) + uiStore (UI ephemeral).
**Context:** gameStore mixes Toast/Dialog/Sidebar state with Token/Drawing/Campaign
state. UI state changes trigger IPC sync in SyncManager unnecessarily.
**Consequences:** Two stores to import from. Backward-compat re-exports ease migration.
SyncManager watches only gameStore, reducing IPC traffic.

### ADR-002: CSS Custom Properties over Tailwind for Theming

**Decision:** Keep theme tokens as CSS custom properties in theme.css, not as
Tailwind theme config. Use Tailwind for layout/spacing utilities only.
**Context:** Theme.css already has a comprehensive token system. Duplicating into
tailwind.config.js would create two sources of truth. CSS custom properties support
runtime theming (dark mode toggle) which Tailwind's JIT doesn't.
**Consequences:** Components use `var(--app-*)` for colors, Tailwind for layout.
Brand swapping works by overriding CSS properties, not rebuilding Tailwind.

### ADR-003: UI Primitives as Plain Components (No Library)

**Decision:** Build primitives as local components in src/components/primitives/,
not using a component library (Radix UI, Headless UI, etc.).
**Context:** Bundle size is critical for Chromebook target. Radix UI Primitives
add ~30-50KB gzipped. Our primitive needs are small (Button, Dialog, Input, Card,
Toggle). Building in-house gives full control over accessibility and perf.
**Consequences:** We own the accessibility implementation. Must test thoroughly.
But bundle stays minimal and we have zero external dependency risk.

### ADR-004: Vision Logic as Pure Functions

**Decision:** Extract raycasting/vision from FogOfWarLayer into pure utility
functions with no React or Konva dependency.
**Context:** Vision calculation is the most CPU-intensive operation. Pure functions
enable: unit testing with geometric assertions, Web Worker offloading (future),
and sharing between components without React coupling.
**Consequences:** FogOfWarLayer becomes a thin renderer. Vision logic is testable
with mathematical assertions. Future: move to Web Worker for off-thread calculation.

### ADR-005: Incremental File Moves with Re-Exports

**Decision:** When moving files (types, components, hooks), always add re-exports
at the old path to prevent breaking changes. Remove re-exports only after all
consumers are migrated.
**Context:** The codebase has 102 source files with complex import graphs. Moving
a file without re-exports would require updating every consumer atomically.
**Consequences:** Migrations can happen file-by-file. Temporary duplication of
export paths is acceptable. Clean up re-exports in a dedicated pass.

---

## Running Checklist

### Session 1: Cleanup & Quick Wins

- [x] Delete 5 dead Vite boilerplate files
- [x] Clean FogOfWarLayer diagnostic logging
- [x] Optimize icon.png to <100KB (72KB achieved)
- [x] Generate and document test coverage baseline

### Session 2: Repo Organization

- [x] Consolidate root documentation (move 8+ files to docs/)
- [x] Reorganize component directory structure (4 new folders)
- [x] Extract domain types to src/types/domain.ts

### Session 3: Theme System Foundation

- [ ] Add all missing theme tokens to theme.css
- [ ] Sweep all files to replace hardcoded colors
- [ ] Remove redundant Radix dark-mode CSS imports
- [ ] Scope global transition rule
- [ ] Add prefers-contrast support
- [ ] Create brand.css configuration layer

### Session 4: UI Primitives — Core

- [ ] Create Button primitive (5 variants, 3 sizes)
- [ ] Create Input primitive (label, error, helper)
- [ ] Create Card primitive (3 variants)
- [ ] Move ToggleSwitch to primitives/

### Session 5: UI Primitives — Dialog + HomeScreen

- [ ] Create Dialog primitive with full a11y
- [ ] Migrate PreferencesDialog + ConfirmDialog to use Dialog
- [ ] Extract HomeScreen inline CSS to stylesheet

### Session 6: Quality Tooling

- [ ] Install and configure eslint-plugin-jsx-a11y
- [ ] Upgrade 5 ESLint rules from warn → error
- [ ] Add import boundary linting rules

### Session 7: Store Separation

- [ ] Create uiStore.ts with UI state
- [ ] Migrate all consumers from gameStore UI state → uiStore
- [ ] Remove UI state from gameStore

### Session 8: Logic Extraction I

- [ ] Extract vision/raycasting to src/utils/vision.ts
- [ ] Write vision.test.ts (80%+ coverage)
- [ ] Extract HomeScreen business logic to hooks

### Session 9: Logic Extraction II

- [ ] Extract App.tsx coordination to useToolState + useMenuCommands
- [ ] Create campaignService.ts
- [ ] App.tsx under 250 lines

### Session 10: CanvasManager Decomposition

- [ ] Extract useCanvasKeyboard hook
- [ ] Extract useCanvasDrop hook
- [ ] Extract useCanvasSelection hook
- [ ] Extract useCanvasDrawing hook
- [ ] Extract ContextMenu component
- [ ] CanvasManager under 500 lines

### Session 11: Performance

- [ ] Lazy-load 7 modal/infrequent components
- [ ] Document bundle size before/after
- [ ] Cap Konva pixelRatio on low-end
- [ ] Disable listening on static layers
- [ ] Add FogOfWarLayer caching

### Session 12: Accessibility

- [ ] Create CanvasAccessibility live region
- [ ] Add keyboard token selection
- [ ] Complete keyboard navigation for Sidebar + MapNavigator
- [ ] Add visible focus indicators globally
- [ ] Add skip-to-content link

### Session 13: Test Hardening

- [ ] Unit tests for vision.ts (90%+)
- [ ] Unit tests for campaignService.ts (80%+)
- [ ] Unit tests for hooks (70%+)
- [ ] Unit tests for UI primitives (80%+)
- [ ] Unit tests for uiStore (80%+)
- [ ] Final coverage report

---

## Session Notes

> Update this section after each session with outcomes, blockers, and decisions.

### Session 0 — Planning (2026-02-09)

- Completed full codebase audit (24 findings)
- Generated 30 modularization recommendations across 5 categories
- All 30 accepted by operator
- Game plan committed to CLAUDE.md
- Branch: `claude/refactor-modular-architecture-GUfVC`

### Session 1 — Cleanup & Quick Wins (2026-02-09)

**Completed:**

- Deleted 5 dead Vite boilerplate files (App.css, react.svg, 3 public SVGs)
- Gated FogOfWarLayer diagnostics behind `DEBUG_VISION` flag (was ~40 lines of console.log per render)
- Optimized icon.png: 927KB → 72KB (92% reduction, 512x512, 128-color quantized)
- Generated test coverage baseline (all 792 tests pass)

**Coverage Baseline:**

| Module                | Statements | Branches   | Functions  | Lines      |
| --------------------- | ---------- | ---------- | ---------- | ---------- |
| **All files**         | **33.12%** | **27.44%** | **39.62%** | **32.33%** |
| src/store             | 75.12%     | 46.72%     | 86.50%     | 70.12%     |
| src/utils             | 51.34%     | 44.39%     | 58.33%     | 50.48%     |
| src/hooks             | 50.72%     | 62.50%     | 44.44%     | 51.56%     |
| src/components (root) | 44.16%     | 38.04%     | 43.92%     | 42.73%     |
| src/components/Canvas | 7.65%      | 5.95%      | 7.60%      | 8.12%      |
| src/services          | 0.34%      | 0%         | 0%         | 0.34%      |
| src/workers           | 0%         | 0%         | 0%         | 0%         |

**Key zero-coverage modules:** CanvasManager, FogOfWarLayer, all Canvas layers,
SyncManager, PreferencesDialog, services layer, workers.

**Build output:** Main chunk 908KB (gzip 260KB) — Session 11 code splitting will address.
**No regressions:** All 39 test files, 792 tests passing.

### Session 2 — Repo Organization & Type Extraction (2026-02-09)

**Completed:**

- Consolidated root documentation: deleted root ARCHITECTURE.md (duplicate), moved 8 docs
  to docs/ subdirectories (guides/, features/, architecture/, planning/)
- Moved diagnose-dungeon.ts to tests/helpers/, removed from tsconfig.json
- Updated all internal cross-references (README.md, CONTRIBUTING.md, TOUCH_SUPPORT_MIGRATION.md,
  IPC_SYNC_VERIFICATION.md, LINTING_MIGRATION_GUIDE.md)
- Root now has only 5 markdown files: README, CHANGELOG, CONTRIBUTING, CLAUDE, TESTING_STRATEGY

- Created 4 new component directories: ErrorBoundaries/, Dialogs/, Managers/, Mobile/
- Moved 17 error boundary files (incl. TokenErrorBoundary from Canvas/)
- Moved 6 dialog files (AboutModal, ConfirmDialog, PreferencesDialog, DungeonGeneratorDialog,
  ImageCropper + DungeonGeneratorDialog.test)
- Moved 6 manager files (SyncManager, ThemeManager, AutoSaveManager, PauseManager,
  UpdateManager + UpdateManager.test)
- Moved 3 mobile files (MobileToolbar, MobileBottomSheet, MobileSidebarDrawer)
- Updated ~35 import paths across consumer files and moved files
- Fixed vi.mock() paths in test files

- Extracted 14 domain types + 2 constants from gameStore.ts to src/types/domain.ts
- gameStore.ts re-exports everything for backward compatibility
- Updated IStorageService.ts to import from types/domain (per architecture contract)

**Verification:** TypeScript 0 errors, build succeeds, lint 0 errors, all 792 tests pass.
**No regressions.** Components directory is now well-organized with clear boundaries.

---

## Quick Reference

### Key Files

| File                                      | Lines | Role             | Status                     |
| ----------------------------------------- | ----- | ---------------- | -------------------------- |
| `src/components/Canvas/CanvasManager.tsx` | 1,867 | Canvas monolith  | Needs decomposition (S10)  |
| `src/components/HomeScreen.tsx`           | 1,776 | Landing page     | Needs CSS extraction (S5)  |
| `src/store/gameStore.ts`                  | 836   | Central state    | Needs UI split (S7)        |
| `src/App.tsx`                             | 763   | Root coordinator | Needs hook extraction (S9) |
| `src/styles/theme.css`                    | 309   | Theme tokens     | Needs hardening (S3)       |
| `electron/main.ts`                        | 1,283 | Electron main    | No changes planned         |

### Commands

```bash
npm run dev          # Start dev server
npm run build:web    # Build web version (verify after changes)
npm run lint         # Lint check
npm run type-check   # TypeScript check
npm run test:run     # Run unit tests
npm run test:a11y    # Run accessibility tests
npm run test:coverage # Generate coverage report
```
