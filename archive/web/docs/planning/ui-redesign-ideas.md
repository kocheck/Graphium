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

### Toolbar

- `size="tool"` uses `px-3! py-1!` so leftover `p-2` on tool buttons cannot inflate the 46×30 hit target (old unlayered `.btn` won that cascade).
- State still lives in `App.tsx` as a long prop list; plan 005 should move it to a store.
- Door-orientation and measure-mode controls only appear when those tools are active; a persistent strip would make the modes discoverable.
- Broadcast is a labelled button; a Switch next to the measure modes would match ToggleSwitch.
- The floating colour palette stayed in `App.tsx`; grouping it with the toolbar would keep marker chrome in one place.

### MobileToolbar

- Active bar buttons use accent-bg + accent text, not `variant="tool"` (solid accent). Unifying with the desktop toolbar would change the mobile active treatment.
- The more-menu is a hand-rolled sheet (backdrop + list); a Sheet primitive would match the other drawers.
- Rotate is still a nested button inside the Place Door row.

### SessionConsolePanel

- Copy current / Copy all / SFX chips were `btn-secondary` and now map to `ghost` (undefined class, same as bare `.btn`). A real secondary treatment would separate them from the settings icon.
- Settings is a lone icon with no text; a labelled control or a sheet trigger would match the other Session Console sheets.

### TrackGroupList

- Play-row buttons stay raw `<button>`s (not `.btn`); only Edit moved onto the primitive. A shared track-row treatment would unify play vs edit.
- Recommended-plate copy still uses hardcoded `#c4a35a`; a warning/accent token would match the rest of the chrome.

### SessionConsoleSettingsSections

- Stage title/subtitle now use `Input`; volume and duck remain native ranges. A Slider primitive would match.
- Advanced pack accordion is a raw `<button>` + `aria-expanded`, not `Collapsible`. Switching would match CollapsibleSection.
- Import replace is a destructive confirm but the trigger is `ghost`; a danger treatment belongs here.

### SessionConsoleBoard

- YouTube field and Add/New actions are now primitives; the hidden folder file input is still a native control (by design this step).
- Empty-state copy and the dashed dropzone are unchanged; a dedicated empty illustration or Dropzone primitive would make the ingest path clearer.

### ImageSetBoard

- Plate tiles stay raw `<button>`s; only Edit moved onto the primitive. Same split as TrackGroupList.
- Thumbnails are a fixed `h-16` crop; a square token tile would match QuickTokenSidebar.

### SessionConsoleMasterBar

- Transport buttons were `btn-secondary` and now map to `ghost`. A compact `size="sm"` or a real toolbar group would distinguish Duck/Pause/Stop from text actions.
- World-link status still uses hex (`#6b7280` / `#d97706` / `#22c55e`); tokens would survive a theme pass.
- Volume is still a native range.

### Sidebar

- New Map / Place / Add were `btn-secondary` and now map to `ghost`. A real secondary (or outline dashed) treatment would keep New Map distinct from Place/Add.
- Dashed-border New Map styling was kept as leftover classes on `Button`; a dedicated dashed variant would not fight the primitive's default padding.

### MapNavigator

- Delete hover was `hover:text-red-500` and is now `--app-error-text`. Rename still uses an emoji button; an icon + token would match Sidebar's settings control.
- New Map is the same dashed `ghost` as Sidebar; one shared "create map" control would remove the duplicate.

### DoorControls

- Unlock All keeps `bg-orange-600/20 hover:bg-orange-600/30` and the locked count keeps `text-orange-400` (no token; not on the ratchet). Plan 006b decides the orange.
- Open All / Close All are `secondary` (old `btn-default`); a quieter ghost set would match the Session Console transport.

### QuickTokenSidebar

- Tiles are token-background `div`s with `data-testid="sidebar-token-tile"`, not `Button`s (they are drag sources). A shared token-tile primitive would match Library cards.
- The generic tile still overrides the token background with an inline `style` (`--app-bg-subtle` + dashed border).

## From plan 006 audit

- Accent is `#0070c1` on every surface; brief §2.2 forbids tech-blue.
- Editor toolbar is `8px` radius with a 25px blur shadow; brief §2.3 wants hairline/recessed, no blur.
- Confirm and World dialogs are `12px` radius; not etched.
- Body type is Plex Sans 16px/400 everywhere; no Plex Mono readout face (brief §2.4).
- Button padding is 4px (home), 8px (editor), 12px (editor-mobile), 8px 16px (world) — one density scale is missing.
- `transition` counts range from 0 (ConfirmDialog) to 12 (HomeScreen).
- Remix Icon is imported on home/toolbar/playground and absent on ConfirmDialog / WorldStage.
- Eleven brief §6 reference PNGs were not in `docs/planning/screenshots/006a-baseline/reference/`.
- Conclusion: identity gap (`| brief:` ≥ 21). Weights Step 3 question 7 only; do not change the §10 direction set.
