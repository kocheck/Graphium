# Graphium — Hyle

Electron + React + TypeScript tabletop RPG battlemap app.
Branch: `claude/refactor-modular-architecture-GUfVC` (modular refactor — complete)

---

## Commands

```bash
npm run dev              # Start dev server
npm run build:web        # Build web version (verify after changes)
npm run lint             # ESLint check
npm run type-check       # TypeScript check
npm run test:run         # Run unit tests
npm run test:a11y        # Run accessibility tests
npm run test:coverage    # Generate coverage report
```

---

## Architecture

```
src/
├── types/domain.ts              # Core domain types (Token, Drawing, Door, Campaign…)
├── styles/
│   ├── theme.css                # CSS custom properties (all app colors)
│   ├── brand.css                # Brand overrides — edit to rebrand
│   ├── primitives.css           # UI primitive component styles
│   ├── home-screen.css          # Landing page styles
│   └── app.css                  # Global utility classes + focus indicators
├── components/
│   ├── primitives/              # Button, Dialog, Input, Card, ToggleSwitch
│   ├── Canvas/                  # CanvasManager + rendering layers + hooks/
│   ├── Dialogs/                 # ConfirmDialog, PreferencesDialog, AboutModal…
│   ├── ErrorBoundaries/         # All error boundary components
│   ├── Managers/                # SyncManager, ThemeManager, AutoSaveManager…
│   └── Mobile/                  # MobileToolbar, MobileBottomSheet…
├── store/
│   ├── gameStore.ts             # Domain state: tokens, drawings, campaign, maps
│   └── uiStore.ts               # UI state: toast, dialogs, sidebar, pause
├── services/
│   └── campaignService.ts       # All campaign save/load/new I/O
├── hooks/
│   ├── useToolState.ts          # Tool selection, color, keyboard shortcuts
│   ├── useMenuCommands.ts       # Electron IPC menu handlers
│   └── useRecentCampaigns.ts    # Recent file list (localStorage)
└── utils/
    └── vision.ts                # Raycasting / fog of war (pure functions)
```

---

## Design System Contract

Enforced by ESLint `import/no-restricted-paths`.

| Layer      | Can import from                      | Cannot import from     |
| ---------- | ------------------------------------ | ---------------------- |
| primitives | styles/, types/                      | store/, services/      |
| store      | types/                               | components/, services/ |
| services   | types/, store/ (imperative getState) | components/            |
| utils      | types/                               | components/, store/    |
| hooks      | store/, services/, types/            | components/            |
| components | anything above                       | (integration layer)    |

---

## Key Files

| File                                      | Lines | Role                                  |
| ----------------------------------------- | ----- | ------------------------------------- |
| `src/components/Canvas/CanvasManager.tsx` | 1,450 | Canvas layer compositor               |
| `src/components/HomeScreen.tsx`           | 723   | Landing page                          |
| `src/store/gameStore.ts`                  | 607   | Domain state (tokens, drawings, maps) |
| `src/store/uiStore.ts`                    | 79    | UI ephemeral state                    |
| `src/utils/vision.ts`                     | 205   | Raycasting (100% test coverage)       |
| `src/App.tsx`                             | 325   | Root compositor + landmarks           |
| `src/hooks/useToolState.ts`               | 152   | Tool state + keyboard shortcuts       |
| `src/services/campaignService.ts`         | 91    | Campaign save/load/new                |
| `src/components/Toolbar.tsx`              | 228   | Desktop toolbar (extracted from App)  |
| `src/styles/theme.css`                    | 530   | All CSS custom properties             |
| `electron/main.ts`                        | 1,283 | Electron main process                 |

---

## Gotchas & Patterns

**Konva + CSS variables:** Konva renders to `<canvas>` — `var(--app-*)` doesn't work in
Konva props. Use `*_COLORS` const objects at file top with JSDoc referencing the token name:

```ts
// mirrors var(--app-canvas-fog)
const FOG_COLORS = { fog: 'rgba(0,0,0,0.94)' };
```

**Store split:** `useGameStore` = domain state. `useUiStore` = UI state. SyncManager only
watches gameStore — UI changes (toast, dialogs) do NOT trigger IPC sync to World View.

**Campaign I/O:** Always use `campaignService.ts`. Never call the storage service directly
from a component.

**Async event handlers:** Wrap with `void` to satisfy `no-misused-promises`:

```ts
onClick={() => { void asyncFn(); }}
```

**React.lazy named exports:**

```ts
const C = lazy(() => import('./C').then((m) => ({ default: m.C })));
```

**noUncheckedIndexedAccess:** `array[i]` is `T | undefined`. Use `!` where bounds are
guaranteed, or add a guard.

**Error boundaries:** All extend `Component` — need `override` on `componentDidCatch`,
`render`, AND the `state` property declaration.

**Cross-store calls:** Only one: `gameStore.deleteMap()` calls `useUiStore.getState().showToast()`
for the "cannot delete last map" error.

---

## Documentation

| Doc                                    | Location                              |
| -------------------------------------- | ------------------------------------- |
| Modular refactor history (14 sessions) | `docs/planning/REFACTOR_SESSIONS.md`  |
| Architecture decisions (ADRs)          | `docs/architecture/DECISIONS.md`      |
| Testing strategy                       | `TESTING_STRATEGY.md`                 |
| Linting guide                          | `docs/guides/LINTING.md`              |
| Device compatibility                   | `docs/guides/DEVICE_COMPATIBILITY.md` |
| Changelog                              | `CHANGELOG.md`                        |
