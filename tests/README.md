# Tests

Two runners:

- **Vitest** (`npm run test:run`): `src/**/*.test.tsx` next to the code, plus `tests/unit/**`
  and `tests/integration/**`.
- **Playwright** (`playwright.config.ts`): every other `*.spec.ts` under `tests/`, in the
  `Web-Chromium` project (browser) and the `Electron-App` project (`*.electron.spec.ts`).

## Layout

```text
tests/
├── accessibility.spec.ts        # axe WCAG 2.1 AA on every surface × theme (14 scans)
├── shots.spec.ts                # screenshots every surface × theme into $SHOTS_OUT
├── visual.spec.ts               # toHaveScreenshot baselines in visual.spec.ts-snapshots/
├── touch-targets.spec.ts        # today's touch-target minimums
├── functional/
│   ├── overlays.spec.ts         # overlay contract: role, aria-modal, data-esc-owns, Escape, focus
│   ├── editor-smoke.spec.ts     # toolbar tools by click and shortcut
│   ├── mobile-smoke.spec.ts     # mobile toolbar and more-menu
│   ├── tokens.spec.ts           # non-colour --app-* tokens are live
│   ├── door-sync.spec.ts        # DM and World tabs both load (URL-only assertions)
│   └── dm-world-sync.spec.ts    # store-driven drag and draw checks on one page
├── electron/                    # Electron-App project
├── helpers/
│   ├── surfaces.ts              # gotoSurface(page, surface, theme) — start here
│   ├── bypassLandingPage.ts     # Electron-mocked entry used by the two legacy specs
│   └── …
└── unit/, integration/          # Vitest
```

## Running

Use the gates, not raw Playwright commands: `npm run verify:static`, `npm run verify:web`,
`npm run verify:electron`, `npm run verify`. `verify:web` builds `dist-web` and runs the
`Web-Chromium` project and the a11y suite against the built output with `CI=1` (preview
server on port 4173, no dev-only components). One spec the same way:

```bash
npm run build:web && CI=1 npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
```

Without `CI=1` the dev server on 5173 is used and `import.meta.env.DEV` extras (the
Agentation toolbar) render.

- Screenshots: `SHOTS_OUT=docs/planning/screenshots/<plan>-<step> npm run shots`
- Visual baselines (only when a change is intended; commit the PNGs):
  `npm run build:web && CI=1 npx playwright test tests/visual.spec.ts --project=Web-Chromium --update-snapshots`
- Electron: `npm run verify:electron` builds first and uses `xvfb-run -a` (Linux).
- The bare `test:e2e` script is `verify:web` followed by `verify:electron`; it is slow by design.

## Surfaces

| Surface          | What it is                                                           |
| ---------------- | -------------------------------------------------------------------- |
| `home`           | HomeScreen at 1280×720                                               |
| `editor`         | New campaign → editor with the desktop toolbar and sidebar           |
| `editor-mobile`  | The editor at 390×844 (mobile toolbar, hamburger)                    |
| `confirm-dialog` | `editor` with `ConfirmDialog` open via the store                     |
| `world`          | `?type=world` in a second tab, after `FULL_SYNC` from the editor tab |
| `world-dialog`   | `world` with `ConfirmDialog` open in the World tab                   |
| `design-system`  | `/design-system`                                                     |

## Rules

- No `test.skip`, `test.fixme`, `describe.skip` or `testInfo.skip`
  (`tests/unit/playwrightConfig.test.ts` fails otherwise); the one exception is plan 005's
  `test.skip(!process.env.PERF, 'set PERF=1 to profile')`.
- `testIgnore` in `playwright.config.ts` holds exactly the three structural patterns.
- Helper URLs carry `?e2e=1`, which exposes `window.__GAME_STORE__` in every build.
- Run the app in plain web mode unless a spec needs Electron IPC mocks: mocking
  `window.ipcRenderer` switches the app to Electron mode and disables `BroadcastChannel`.
