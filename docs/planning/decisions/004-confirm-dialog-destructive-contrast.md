# Decision 004-confirm-dialog-destructive-contrast: How should ConfirmDialog pass the a11y gate?

Status: DECIDED

## Question

Plan 004 Step 3 requires the confirm button to use `variant="destructive"` and forbids any other class on that button. That variant paints white on `--app-error-solid` (`#e5484d`), which axe reports as 3.91:1 against the 4.5:1 WCAG AA floor at 14px. `npm run verify:web` therefore fails on the `confirm-dialog` and `world-dialog` surfaces. The previous hand-rolled button used `bg-red-600` and passed. Changing an `--app-*` colour is reserved for plan 006b. Adding these surfaces to `CONTRAST_DEFERRED` in `tests/accessibility.spec.ts` is an axe-rule disable, which CONVENTIONS §2 forbids an executor from doing to make a gate pass.

## Options

1. Keep `variant="destructive"` and add `confirm-dialog` and `world-dialog` to `CONTRAST_DEFERRED` (same treatment as `editor-mobile`; plan 006b empties the list).
2. Darken `--app-error-solid` now so white-on-destructive meets 4.5:1 (overrides the 006b-only colour rule).
3. Put a passing colour on this button only (`bg-red-600` or `bg-[var(--app-error-solid-hover)]`), violating Step 3's "no class other than `variant=\"destructive\"`".
4. Revert ConfirmDialog to the hand-rolled shell until 006b (abandons PR 1's worked example).

## Recommendation

Option 1 — the only violation is color-contrast, already the documented 006 bucket, and the primitive is doing what Step 3 asked.

## Kyle's answer

1 — add `confirm-dialog` and `world-dialog` to `CONTRAST_DEFERRED` until 006b.
