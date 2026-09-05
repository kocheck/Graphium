# UI redesign ideas

## From plan 004

### ConfirmDialog

- Title is the generic "Confirm Action"; a verb from `confirmText` or the message would read as a real question.
- Destructive confirm is a filled red button; a quieter danger treatment (outline + confirmation phrase) would match the rest of the chrome.
- World View still hosts this dialog; players see DM confirm copy. A World-safe subset or blocking it there is an IA choice.
- Primitive popover surface and title weight are new; the old shell used undefined `--app-bg` / `--app-border` / `--app-text` and looked unstyled. Keep or refine once a direction is picked.
- `AlertDialog` (role="alertdialog") would be a better primitive for a destructive confirm than `Dialog`.
- `variant="destructive"` is white on `--app-error-solid` (`#e5484d`, 3.91:1). The old `bg-red-600` button passed AA; the token does not. 006b should darken the solid error colour or pick a passing pair.

### MapSettingsSheet

- Danger Zone "Reset Map Position & Scale" is now `ghost` (old `btn-destructive` was an undefined class and rendered as a bare `.btn`). A real danger treatment belongs here.
- Native `<select>` for grid type and the color `<input>` are still unstyled vs the rest of the sheet.
- Calibration draws on the canvas behind a non-modal sheet; the sheet stays open and can cover the map on small widths.

### AddToLibraryDialog

- Category is still a native `<select>` next to `Input` fields; a shared Select primitive would match.
- Mobile full-height (`h-full max-w-none rounded-none`) is a layout hack; a dedicated mobile sheet would read more clearly.
