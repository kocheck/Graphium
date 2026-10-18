# UI recipes

## Add a dialog

Store-driven `open` / `onOpenChange`. Put the root test id on `DialogContent`.

1. Import `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`,
   `DialogFooter` from `@/components/ui/dialog` and `Button` from `@/components/ui/button`.
2. `<Dialog open={open} onOpenChange={onOpenChange}>`.
3. `<DialogContent data-testid="dialog-{name}-root" showCloseButton={false}>`.
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
3. `<SheetContent side="right" data-testid="sheet-{name}-root">`
   (`side` is `right` | `left` | `bottom`).
4. Sticky chrome: `SheetHeader` with `sticky top-0`, `SheetFooter` with `sticky bottom-0`,
   both on `--app-bg-surface` with a border.
5. `modal={false}` when the canvas behind must stay clickable (calibration). Default
   `ownsEscape` is true; pass `ownsEscape={false}` for non-modal navigation (mobile drawers).
6. Footer actions are `Button` (`ghost` cancel, `default` save).

See `src/components/MapSettingsSheet.tsx`.

## Add a toolbar tool

1. Add the literal to the `Tool` union in `src/store/uiStore.ts`; `CanvasManager`'s prop type
   (`grep -n "tool?: 'select'" src/components/Canvas/CanvasManager.tsx`) and
   `src/components/Canvas/hooks/useCanvasInteraction.ts` carry the same union — extend both.
2. Shortcut: add a `case` to the `switch` in `handleKeyDown` in `src/App.tsx`
   (`grep -n "case 'v':" src/App.tsx`) calling `ui.setTool('{name}')`.
3. Button: in `src/components/Toolbar.tsx` add a `<Button variant="tool" active={tool === '{name}'} aria-pressed={tool === '{name}'} aria-label="{Name} tool" data-testid="toolbar-tool-{name}" onClick={() => setTool('{name}')}>` inside a `Tooltip`; mirror it in `MobileToolbar.tsx` and add a `setTool{Name}` command to `createCommandRegistry` in `CommandPalette.tsx`.
4. Test: add the shortcut and `aria-pressed` assertion to the tool-switch test in
   `tests/functional/editor-smoke.spec.ts`, and a `useUiStore.setState({ tool: '{name}' })` case
   to `src/components/Toolbar.render-count.test.tsx` if the button reads new store fields.

## Add a surface to the test harness

1. Add the name to the surface union and its navigation in `tests/helpers/surfaces.ts`
   (`grep -n 'export' tests/helpers/surfaces.ts` shows the helper's exports).
2. Give the surface's root element a `data-testid` per `plans/CONVENTIONS.md` §8 and wait for it
   in the navigation.
3. `SHOTS_OUT=<dir> npm run shots` and `npm run test:a11y` iterate every surface in both themes:
   check the new surface appears in both outputs (`ls <dir>` and the a11y scan count).

## Add a primitive

See `src/components/ui/README.md` § "Add a primitive".
