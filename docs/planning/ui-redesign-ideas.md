# UI redesign ideas

## From plan 004

### ConfirmDialog

- Title is the generic "Confirm Action"; a verb from `confirmText` or the message would read as a real question.
- Destructive confirm is a filled red button; a quieter danger treatment (outline + confirmation phrase) would match the rest of the chrome.
- World View still hosts this dialog; players see DM confirm copy. A World-safe subset or blocking it there is an IA choice.
- Primitive popover surface and title weight are new; the old shell used undefined `--app-bg` / `--app-border` / `--app-text` and looked unstyled. Keep or refine once a direction is picked.
- `AlertDialog` (role="alertdialog") would be a better primitive for a destructive confirm than `Dialog`.
