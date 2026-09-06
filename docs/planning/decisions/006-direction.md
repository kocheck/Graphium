# Decision 006-direction: Which of the brief's three directions (or which hybrid) does Graphium adopt?

Status: PENDING

## Question

The brief (`docs/planning/ui-redesign-brief.md` §10) names three directions. All three are
rendered at `/design-system` (switcher `playground-direction-a|b|c`), pass
`npm run contrast -- --direction <x>` and the six direction `test:a11y` scans, and are
screenshotted under `docs/planning/screenshots/006a-step2/` (six files, listed below). Which one
is applied by plan 006b, or which hybrid (named as "<base direction> + <one named element of
another>")?

## Options

1. A · Instrument panel — amber-9 accent, slate-6 rules, ≤ 4 px radius, inset active ring, Plex
   Mono readouts. Screenshots: `design-system-a-dark.png`, `design-system-a-light.png`.
2. B · Etched plate — tomato accent, continuous dark stock, 2 px radius, engraved active state,
   Plex Sans numerals. Screenshots: `design-system-b-dark.png`, `design-system-b-light.png`.
3. C · Cartographer's desk — orange-9 accent, sand greys / paper light theme, flat with pressed
   state, Plex Serif titles. Screenshots: `design-system-c-dark.png`, `design-system-c-light.png`.

## Rubric (brief §9; rows 1–6 scored from measurements, row 7 is Kyle's)

| Row | Heuristic                 | Source                                                                           | A    | B    | C    |
| --- | ------------------------- | -------------------------------------------------------------------------------- | ---- | ---- | ---- |
| 1   | Chrome must not glow      | `npm run contrast -- --direction <x>`: luminance line, dark ≤ 12 %               | pass | pass | pass |
| 2   | Glance-readable at 2 m    | `directions.test.ts` readout size/weight + 7:1 pair                              | pass | pass | pass |
| 3   | One-handed / pen          | n/a here: directions set no size token; `tests/touch-targets.spec.ts` gates 006b | n/a  | n/a  | n/a  |
| 4   | Four-hour fatigue         | `directions.test.ts` grey-scale chrome test                                      | pass | pass | pass |
| 5   | State without colour      | `grep -c "elevation-active: inset" src/styles/directions.css` per direction ≥ 1  | pass | pass | pass |
| 6   | Projector-safe World View | pass by construction: `[data-direction]` never applies to `?type=world`          | pass | pass | pass |
| 7   | Hell-yes test             | Kyle, per screenshot                                                             |      |      |      |

Row 1 dark `app-bg-surface` luminance: A 1.6 %, B 1.0 %, C 1.6 % (all ≤ 12 %).
Row 2 readout tokens: A 13 px / 500, B 15 px / 600, C 13 px / 500; light `app-text-primary` /
`app-bg-surface` is 14.41:1 / 15.58:1 / 14.32:1.
Row 5: one `elevation-active: inset` line in each of `[data-direction='a'|'b'|'c']` (file count 3).

## Contrast

Seed changes (Step 2b Do 7, one step toward 12; applied once):

- A `--app-accent-text`: `var(--amber-11)` → `var(--amber-12)` (light pair failed on amber-11;
  after: `#4f3422` on `#fcfcfd`, 11.09:1).
- C `--app-accent-text`: `var(--orange-11)` → `var(--orange-12)` (light pair `#cc4e00` on base
  was 4.43:1 FAIL; after: `#582d1d` on `#fdfdfc`, 11.41:1).
- B: none.
- `--app-accent-text-contrast` was already step 12 in the Step 2a seed and was not moved.
- No second Do 7 pass. No Radix scale hex was edited.

### Base theme (`npm run contrast`)

| Theme | Foreground              | Background               | fg      | bg      | Ratio   | Min       | Result         |
| ----- | ----------------------- | ------------------------ | ------- | ------- | ------- | --------- | -------------- |
| light | `app-text-primary`      | `app-bg-base`            | #1c2024 | #fcfcfd | 15.98:1 | 4.5:1     | PASS           |
| light | `app-text-primary`      | `app-bg-surface`         | #1c2024 | #f0f0f3 | 14.41:1 | 7:1       | PASS           |
| light | `app-text-secondary`    | `app-bg-base`            | #60646c | #fcfcfd | 5.79:1  | 4.5:1     | PASS           |
| light | `app-text-secondary`    | `app-bg-surface`         | #60646c | #f0f0f3 | 5.22:1  | 4.5:1     | PASS           |
| light | `app-text-muted`        | `app-bg-surface`         | #60646c | #f0f0f3 | 5.22:1  | 4.5:1     | PASS           |
| light | `app-accent-text`       | `app-bg-base`            | #113264 | #fcfcfd | 12.31:1 | 4.5:1     | PASS           |
| light | `app-accent-solid-text` | `app-accent-solid`       | #ffffff | #0070c1 | 5.14:1  | 4.5:1     | PASS           |
| light | `app-accent-solid-text` | `app-accent-solid-hover` | #ffffff | #005a9c | 7.14:1  | 4.5:1     | PASS           |
| light | `app-error-text`        | `app-error-bg`           | #ce2c31 | #feebec | 4.54:1  | 4.5:1     | PASS           |
| light | `white`                 | `app-error-solid`        | #ffffff | #e5484d | 3.91:1  | 4.5:1     | DEFER (006b)   |
| light | `white`                 | `app-success-solid`      | #ffffff | #30a46c | 3.16:1  | 4.5:1     | DEFER (006b)   |
| light | `white`                 | `app-warning-solid`      | #ffffff | #ffc53d | 1.58:1  | 4.5:1     | DEFER (006b)   |
| light | `app-border-default`    | `app-bg-base`            | #cdced6 | #fcfcfd | 1.53:1  | 3:1       | DEFER (006b)   |
| dark  | `app-text-primary`      | `app-bg-base`            | #edeef0 | #111113 | 16.25:1 | 4.5:1     | PASS           |
| dark  | `app-text-primary`      | `app-bg-surface`         | #edeef0 | #212225 | 13.70:1 | 7:1       | PASS           |
| dark  | `app-text-secondary`    | `app-bg-base`            | #b0b4ba | #111113 | 9.06:1  | 4.5:1     | PASS           |
| dark  | `app-text-secondary`    | `app-bg-surface`         | #b0b4ba | #212225 | 7.64:1  | 4.5:1     | PASS           |
| dark  | `app-text-muted`        | `app-bg-surface`         | #b0b4ba | #212225 | 7.64:1  | 4.5:1     | PASS           |
| dark  | `app-accent-text`       | `app-bg-base`            | #70b8ff | #111113 | 8.97:1  | 4.5:1     | PASS           |
| dark  | `app-accent-solid-text` | `app-accent-solid`       | #ffffff | #0070c1 | 5.14:1  | 4.5:1     | PASS           |
| dark  | `app-accent-solid-text` | `app-accent-solid-hover` | #ffffff | #005a9c | 7.14:1  | 4.5:1     | PASS           |
| dark  | `app-error-text`        | `app-error-bg`           | #ff9592 | #3b1219 | 7.75:1  | 4.5:1     | PASS           |
| dark  | `white`                 | `app-error-solid`        | #ffffff | #e5484d | 3.91:1  | 4.5:1     | DEFER (006b)   |
| dark  | `white`                 | `app-success-solid`      | #ffffff | #30a46c | 3.16:1  | 4.5:1     | DEFER (006b)   |
| dark  | `white`                 | `app-warning-solid`      | #ffffff | #ffc53d | 1.58:1  | 4.5:1     | DEFER (006b)   |
| dark  | `app-border-default`    | `app-bg-base`            | #43484e | #111113 | 2.04:1  | 3:1       | DEFER (006b)   |
| light | luminance               | `app-bg-surface`         | #f0f0f3 |         | 87.3%   | ≤12% dark | brief §9 row 1 |
| dark  | luminance               | `app-bg-surface`         | #212225 |         | 1.6%    | ≤12% dark | brief §9 row 1 |

### Direction A (`npm run contrast -- --direction a`)

| Theme | Foreground              | Background               | fg      | bg      | Ratio   | Min       | Result         |
| ----- | ----------------------- | ------------------------ | ------- | ------- | ------- | --------- | -------------- |
| light | `app-text-primary`      | `app-bg-base`            | #1c2024 | #fcfcfd | 15.98:1 | 4.5:1     | PASS           |
| light | `app-text-primary`      | `app-bg-surface`         | #1c2024 | #f0f0f3 | 14.41:1 | 7:1       | PASS           |
| light | `app-text-secondary`    | `app-bg-base`            | #60646c | #fcfcfd | 5.79:1  | 4.5:1     | PASS           |
| light | `app-text-secondary`    | `app-bg-surface`         | #60646c | #f0f0f3 | 5.22:1  | 4.5:1     | PASS           |
| light | `app-text-muted`        | `app-bg-surface`         | #60646c | #f0f0f3 | 5.22:1  | 4.5:1     | PASS           |
| light | `app-accent-text`       | `app-bg-base`            | #4f3422 | #fcfcfd | 11.09:1 | 4.5:1     | PASS           |
| light | `app-accent-solid-text` | `app-accent-solid`       | #1c2024 | #ffc53d | 10.38:1 | 4.5:1     | PASS           |
| light | `app-accent-solid-text` | `app-accent-solid-hover` | #1c2024 | #ffba18 | 9.59:1  | 4.5:1     | PASS           |
| light | `app-error-text`        | `app-error-bg`           | #ce2c31 | #feebec | 4.54:1  | 4.5:1     | PASS           |
| light | `white`                 | `app-error-solid`        | #ffffff | #e5484d | 3.91:1  | 4.5:1     | DEFER (006b)   |
| light | `white`                 | `app-success-solid`      | #ffffff | #30a46c | 3.16:1  | 4.5:1     | DEFER (006b)   |
| light | `white`                 | `app-warning-solid`      | #ffffff | #ffc53d | 1.58:1  | 4.5:1     | DEFER (006b)   |
| light | `app-border-default`    | `app-bg-base`            | #d9d9e0 | #fcfcfd | 1.37:1  | 3:1       | DEFER (006b)   |
| dark  | `app-text-primary`      | `app-bg-base`            | #edeef0 | #111113 | 16.25:1 | 4.5:1     | PASS           |
| dark  | `app-text-primary`      | `app-bg-surface`         | #edeef0 | #212225 | 13.70:1 | 7:1       | PASS           |
| dark  | `app-text-secondary`    | `app-bg-base`            | #b0b4ba | #111113 | 9.06:1  | 4.5:1     | PASS           |
| dark  | `app-text-secondary`    | `app-bg-surface`         | #b0b4ba | #212225 | 7.64:1  | 4.5:1     | PASS           |
| dark  | `app-text-muted`        | `app-bg-surface`         | #b0b4ba | #212225 | 7.64:1  | 4.5:1     | PASS           |
| dark  | `app-accent-text`       | `app-bg-base`            | #ffe7b3 | #111113 | 15.57:1 | 4.5:1     | PASS           |
| dark  | `app-accent-solid-text` | `app-accent-solid`       | #111113 | #ffc53d | 11.95:1 | 4.5:1     | PASS           |
| dark  | `app-accent-solid-text` | `app-accent-solid-hover` | #111113 | #ffd60a | 13.36:1 | 4.5:1     | PASS           |
| dark  | `app-error-text`        | `app-error-bg`           | #ff9592 | #3b1219 | 7.75:1  | 4.5:1     | PASS           |
| dark  | `white`                 | `app-error-solid`        | #ffffff | #e5484d | 3.91:1  | 4.5:1     | DEFER (006b)   |
| dark  | `white`                 | `app-success-solid`      | #ffffff | #30a46c | 3.16:1  | 4.5:1     | DEFER (006b)   |
| dark  | `white`                 | `app-warning-solid`      | #ffffff | #ffc53d | 1.58:1  | 4.5:1     | DEFER (006b)   |
| dark  | `app-border-default`    | `app-bg-base`            | #363a3f | #111113 | 1.65:1  | 3:1       | DEFER (006b)   |
| light | luminance               | `app-bg-surface`         | #f0f0f3 |         | 87.3%   | ≤12% dark | brief §9 row 1 |
| dark  | luminance               | `app-bg-surface`         | #212225 |         | 1.6%    | ≤12% dark | brief §9 row 1 |

### Direction B (`npm run contrast -- --direction b`)

| Theme | Foreground              | Background               | fg      | bg      | Ratio   | Min       | Result         |
| ----- | ----------------------- | ------------------------ | ------- | ------- | ------- | --------- | -------------- |
| light | `app-text-primary`      | `app-bg-base`            | #1c2024 | #fcfcfd | 15.98:1 | 4.5:1     | PASS           |
| light | `app-text-primary`      | `app-bg-surface`         | #1c2024 | #f9f9fb | 15.58:1 | 7:1       | PASS           |
| light | `app-text-secondary`    | `app-bg-base`            | #60646c | #fcfcfd | 5.79:1  | 4.5:1     | PASS           |
| light | `app-text-secondary`    | `app-bg-surface`         | #60646c | #f9f9fb | 5.65:1  | 4.5:1     | PASS           |
| light | `app-text-muted`        | `app-bg-surface`         | #60646c | #f9f9fb | 5.65:1  | 4.5:1     | PASS           |
| light | `app-accent-text`       | `app-bg-base`            | #d13415 | #fcfcfd | 4.86:1  | 4.5:1     | PASS           |
| light | `app-accent-solid-text` | `app-accent-solid`       | #ffffff | #d13415 | 4.98:1  | 4.5:1     | PASS           |
| light | `app-accent-solid-text` | `app-accent-solid-hover` | #ffffff | #5c271f | 11.90:1 | 4.5:1     | PASS           |
| light | `app-error-text`        | `app-error-bg`           | #ce2c31 | #feebec | 4.54:1  | 4.5:1     | PASS           |
| light | `white`                 | `app-error-solid`        | #ffffff | #e5484d | 3.91:1  | 4.5:1     | DEFER (006b)   |
| light | `white`                 | `app-success-solid`      | #ffffff | #30a46c | 3.16:1  | 4.5:1     | DEFER (006b)   |
| light | `white`                 | `app-warning-solid`      | #ffffff | #ffc53d | 1.58:1  | 4.5:1     | DEFER (006b)   |
| light | `app-border-default`    | `app-bg-base`            | #e0e1e6 | #fcfcfd | 1.27:1  | 3:1       | DEFER (006b)   |
| dark  | `app-text-primary`      | `app-bg-base`            | #edeef0 | #111113 | 16.25:1 | 4.5:1     | PASS           |
| dark  | `app-text-primary`      | `app-bg-surface`         | #edeef0 | #18191b | 15.15:1 | 7:1       | PASS           |
| dark  | `app-text-secondary`    | `app-bg-base`            | #b0b4ba | #111113 | 9.06:1  | 4.5:1     | PASS           |
| dark  | `app-text-secondary`    | `app-bg-surface`         | #b0b4ba | #18191b | 8.45:1  | 4.5:1     | PASS           |
| dark  | `app-text-muted`        | `app-bg-surface`         | #b0b4ba | #18191b | 8.45:1  | 4.5:1     | PASS           |
| dark  | `app-accent-text`       | `app-bg-base`            | #ff977d | #111113 | 8.96:1  | 4.5:1     | PASS           |
| dark  | `app-accent-solid-text` | `app-accent-solid`       | #111113 | #e54d2e | 4.88:1  | 4.5:1     | PASS           |
| dark  | `app-accent-solid-text` | `app-accent-solid-hover` | #111113 | #ec6142 | 5.71:1  | 4.5:1     | PASS           |
| dark  | `app-error-text`        | `app-error-bg`           | #ff9592 | #3b1219 | 7.75:1  | 4.5:1     | PASS           |
| dark  | `white`                 | `app-error-solid`        | #ffffff | #e5484d | 3.91:1  | 4.5:1     | DEFER (006b)   |
| dark  | `white`                 | `app-success-solid`      | #ffffff | #30a46c | 3.16:1  | 4.5:1     | DEFER (006b)   |
| dark  | `white`                 | `app-warning-solid`      | #ffffff | #ffc53d | 1.58:1  | 4.5:1     | DEFER (006b)   |
| dark  | `app-border-default`    | `app-bg-base`            | #2e3135 | #111113 | 1.44:1  | 3:1       | DEFER (006b)   |
| light | luminance               | `app-bg-surface`         | #f9f9fb |         | 94.9%   | ≤12% dark | brief §9 row 1 |
| dark  | luminance               | `app-bg-surface`         | #18191b |         | 1.0%    | ≤12% dark | brief §9 row 1 |

### Direction C (`npm run contrast -- --direction c`)

| Theme | Foreground              | Background               | fg      | bg      | Ratio   | Min       | Result         |
| ----- | ----------------------- | ------------------------ | ------- | ------- | ------- | --------- | -------------- |
| light | `app-text-primary`      | `app-bg-base`            | #21201c | #fdfdfc | 16.02:1 | 4.5:1     | PASS           |
| light | `app-text-primary`      | `app-bg-surface`         | #21201c | #f1f0ef | 14.32:1 | 7:1       | PASS           |
| light | `app-text-secondary`    | `app-bg-base`            | #63635e | #fdfdfc | 5.93:1  | 4.5:1     | PASS           |
| light | `app-text-secondary`    | `app-bg-surface`         | #63635e | #f1f0ef | 5.31:1  | 4.5:1     | PASS           |
| light | `app-text-muted`        | `app-bg-surface`         | #63635e | #f1f0ef | 5.31:1  | 4.5:1     | PASS           |
| light | `app-accent-text`       | `app-bg-base`            | #582d1d | #fdfdfc | 11.41:1 | 4.5:1     | PASS           |
| light | `app-accent-solid-text` | `app-accent-solid`       | #21201c | #f76b15 | 5.49:1  | 4.5:1     | PASS           |
| light | `app-accent-solid-text` | `app-accent-solid-hover` | #21201c | #ef5f00 | 4.90:1  | 4.5:1     | PASS           |
| light | `app-error-text`        | `app-error-bg`           | #ce2c31 | #feebec | 4.54:1  | 4.5:1     | PASS           |
| light | `white`                 | `app-error-solid`        | #ffffff | #e5484d | 3.91:1  | 4.5:1     | DEFER (006b)   |
| light | `white`                 | `app-success-solid`      | #ffffff | #30a46c | 3.16:1  | 4.5:1     | DEFER (006b)   |
| light | `white`                 | `app-warning-solid`      | #ffffff | #ffc53d | 1.58:1  | 4.5:1     | DEFER (006b)   |
| light | `app-border-default`    | `app-bg-base`            | #dad9d6 | #fdfdfc | 1.39:1  | 3:1       | DEFER (006b)   |
| dark  | `app-text-primary`      | `app-bg-base`            | #eeeeec | #111110 | 16.26:1 | 4.5:1     | PASS           |
| dark  | `app-text-primary`      | `app-bg-surface`         | #eeeeec | #222221 | 13.71:1 | 7:1       | PASS           |
| dark  | `app-text-secondary`    | `app-bg-base`            | #b5b3ad | #111110 | 9.01:1  | 4.5:1     | PASS           |
| dark  | `app-text-secondary`    | `app-bg-surface`         | #b5b3ad | #222221 | 7.60:1  | 4.5:1     | PASS           |
| dark  | `app-text-muted`        | `app-bg-surface`         | #b5b3ad | #222221 | 7.60:1  | 4.5:1     | PASS           |
| dark  | `app-accent-text`       | `app-bg-base`            | #ffe0c2 | #111110 | 15.02:1 | 4.5:1     | PASS           |
| dark  | `app-accent-solid-text` | `app-accent-solid`       | #111110 | #f76b15 | 6.36:1  | 4.5:1     | PASS           |
| dark  | `app-accent-solid-text` | `app-accent-solid-hover` | #111110 | #ff801f | 7.52:1  | 4.5:1     | PASS           |
| dark  | `app-error-text`        | `app-error-bg`           | #ff9592 | #3b1219 | 7.75:1  | 4.5:1     | PASS           |
| dark  | `white`                 | `app-error-solid`        | #ffffff | #e5484d | 3.91:1  | 4.5:1     | DEFER (006b)   |
| dark  | `white`                 | `app-success-solid`      | #ffffff | #30a46c | 3.16:1  | 4.5:1     | DEFER (006b)   |
| dark  | `white`                 | `app-warning-solid`      | #ffffff | #ffc53d | 1.58:1  | 4.5:1     | DEFER (006b)   |
| dark  | `app-border-default`    | `app-bg-base`            | #3b3a37 | #111110 | 1.66:1  | 3:1       | DEFER (006b)   |
| light | luminance               | `app-bg-surface`         | #f1f0ef |         | 87.3%   | ≤12% dark | brief §9 row 1 |
| dark  | luminance               | `app-bg-surface`         | #222221 |         | 1.6%    | ≤12% dark | brief §9 row 1 |

## Recommendation

A — rows 1–6 tie at five `pass` each; A's dark `app-accent-solid-text` / `app-accent-solid` is
11.95:1 against C 6.36:1 and B 4.88:1.

## Kyle's answer
