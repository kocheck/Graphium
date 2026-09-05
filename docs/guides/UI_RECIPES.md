# UI recipes

## Add a dialog

Store-driven `open` / `onOpenChange`. Put the root test id on `DialogContent`.

1. Import `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`,
   `DialogFooter` from `@/components/ui/dialog` and `Button` from `@/components/ui/button`.
2. `<Dialog open={open} onOpenChange={onOpenChange}>`.
3. `<DialogContent data-testid="dialog-<name>-root" showCloseButton={false}>`.
4. Title and description go in `DialogHeader`; actions go in `DialogFooter` as `Button`s
   (`secondary` cancel, `destructive` or `default` confirm).
5. Non-default initial focus (Cancel on a destructive dialog): `onOpenAutoFocus` plus
   `querySelector`. Never pass `ref` to a primitive wrapper.
6. `data-esc-owns` is on by default. Pass `ownsEscape={false}` for non-modal navigation
   that must not claim the host key.
7. Keep every existing `data-testid` and `aria-label`. Do not re-type `role`,
   `aria-modal`, or a host-key listener.

See `src/components/ConfirmDialog.tsx`.

## Add a sheet

Same contract as a dialog, on `Sheet` / `SheetContent`.

1. Import `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetFooter` from
   `@/components/ui/sheet` and `Button` from `@/components/ui/button`.
2. `<Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} modal={…}>`.
3. `<SheetContent side="right" data-testid="sheet-<name>-root">`
   (`side` is `right` | `left` | `bottom`).
4. Sticky chrome: `SheetHeader` with `sticky top-0`, `SheetFooter` with `sticky bottom-0`,
   both on `--app-bg-surface` with a border.
5. `modal={false}` when the canvas behind must stay clickable (calibration). Default
   `ownsEscape` is true; pass `ownsEscape={false}` for non-modal navigation (mobile drawers).
6. Footer actions are `Button` (`ghost` cancel, `default` save).

See `src/components/MapSettingsSheet.tsx`.

## Add a toolbar tool

_Filled by plan 004._

## Add a surface to the test harness

_Filled by plan 004._

## Add a primitive

See `src/components/ui/README.md` § "Add a primitive".
