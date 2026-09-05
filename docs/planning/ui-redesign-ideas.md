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

### ImageCropper

- Title is `sr-only` ("Crop image"); a visible header would make the modal feel like the other dialogs.
- Zoom is a native range input; a Slider primitive would match the rest of the chrome.
- Cropping itself has no automated coverage (jsdom cannot drive `react-easy-crop`).

### SessionConsoleEditorSheet

- Tag and Recommended plate stay native `<select>`s (not `Input`); a shared Select primitive would match the rest of the sheet.
- Volume offset is still a native range; a Slider primitive would match.
- The sheet still early-returns when closed, so Radix never mounts a closed instance.

### LibraryManager

- Category filter is still a native `<select>` next to the search `Input`.
- Nested AddToLibraryDialog and TokenMetadataEditor stay inside this dialog; a stacked-dialog IA or a route would be clearer.
- Mobile uses `h-full max-w-none rounded-none`; a dedicated sheet would match the other mobile drawers.
- Card drag affordance is a scale/opacity class, not a preview ghost.

### TokenMetadataEditor

- Category and Default Type stay native `<select>`s next to `Input` fields.
- Vision radius is a raw number field; a Slider with feet marks would match the rest of the chrome.
- The editor is also mounted from CommandPalette; a shared sheet on mobile would match LibraryManager.

### UpdateManager

- Restart & Install was a success-green fill; it is now `variant="default"` like the other actions.
- Download percent still sets width in a ref (runtime value; no static class).
- Opened from About via "Consult the Archives"; a dedicated menu item would avoid stacking two dialogs.

### AboutModal

- Close is still the hand-rolled × (`about-modal-close-btn`); the primitive X would match other dialogs.
- Title is `sr-only` ("About Graphium"); a visible header would match ConfirmDialog.
- Tab strip uses `Tabs` with the old underline look gone; a custom Tabs trigger style would restore the previous active underline.
- The shortcuts tab still repeats the tutorial feature/showcase blocks; one shared section would drop the duplicate.
- Consult the Archives is still a raw `<button>` (only `text-white` was swapped).
- Large `modalStyles` block still styles feature cards and showcase; tokens-in-Tailwind would retire the `<style>` tag.

### DungeonGeneratorDialog

- Room-count and size controls stay native range inputs; a Slider primitive would match ImageCropper and the rest of the chrome.
- Clear-canvas is a native checkbox next to labelled ranges; a shared Switch would match ToggleSwitch.
- Generate is `variant="default"` (accent) rather than a distinct create treatment.
- The dialog still early-returns when closed, so Radix never mounts a closed instance.
