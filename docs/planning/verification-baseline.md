# Verification baseline

Recorded by plan 000 Step 1 on `plan/000-verification-infrastructure`, grounded at `d3d3642`.

## Before

Commands run after `npm install && npx playwright install chromium`.

| Command                                                                                                                                                                                    | Exit | Last line                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------ |
| `npm run lint:strict`                                                                                                                                                                      | 0    | `(eslint produced no output)`                                                                    |
| `npm run type-check`                                                                                                                                                                       | 0    | `> tsc --noEmit`                                                                                 |
| `npm run test:run`                                                                                                                                                                         | 0    | `Duration  15.43s (transform 2.15s, setup 3.13s, import 6.11s, tests 6.99s, environment 21.97s)` |
| `npx prettier --check "**/*.{ts,tsx,js,jsx,json,md,css}"`                                                                                                                                  | 0    | `All matched files use Prettier code style!`                                                     |
| `CI=1 npx playwright test --project=Web-Chromium --list \| tail -1`                                                                                                                        | 0    | `Total: 13 tests in 2 files`                                                                     |
| `CI=1 npx playwright test --project=Electron-App --list \| tail -1`                                                                                                                        | 0    | `Total: 7 tests in 2 files`                                                                      |
| `grep -rnoE '\b(bg\|text\|border\|ring)-(white\|black\|slate\|gray\|zinc\|neutral\|blue\|red\|green\|amber\|orange\|yellow\|purple\|indigo)(-[0-9]{2,3})?\b' src --include=*.tsx \| wc -l` | 0    | `400`                                                                                            |
| `grep -rn "style={{" --include=*.tsx src \| wc -l`                                                                                                                                         | 0    | `286`                                                                                            |
| `grep -rhoE 'data-testid="[^"]+"' src/ \| sort -u \| wc -l`                                                                                                                                | 0    | `22`                                                                                             |

`npm run test:run` also printed `Test Files  78 passed (78)` / `Tests  1129 passed (1129)`.

`ls tests/functional tests/performance tests/electron tests/*.spec.ts`:

```
tests/accessibility.spec.ts
tests/visual.spec.ts

tests/electron:
ipc.electron.spec.ts
startup.electron.spec.ts

tests/functional:
campaign-workflow.spec.ts
data-integrity.spec.ts
dm-world-sync.spec.ts
door-sync.spec.ts
error-boundary-debugging.spec.ts
error-handling.spec.ts
map-management.spec.ts
state-persistence.spec.ts
token-library.spec.ts
token-management.spec.ts
touch-interactions.spec.ts

tests/performance:
drawing-performance.spec.ts
```

## Palette-class regex

```bash
grep -rnoE '\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b' src --include=*.tsx | wc -l
```

Count at `d3d3642` / before plan 000: `400`.
