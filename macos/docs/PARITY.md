# Graphium macOS: Feature Parity Checklist

This is the feature inventory for the native Swift port. It lists everything a user can see or do
in the TypeScript/React/Electron app, so the port can be tracked to full parity. Every item was
taken from the source. The `(source: path:line)` references point at the TypeScript/Electron
code as of the `claude/swift-macos` branch.

**How to use it**

- Tick `[x]` when the native app matches the described behaviour. If the port changes a
  behaviour on purpose, tick it and add a note.
- Items marked **(gap)** describe current web/Electron behaviour that is incomplete or buggy.
  Port the intended behaviour (in brackets), not the bug, and record the decision.
- Items marked **(concept-only)** are not shipped. They are listed so nobody ports them by
  mistake.
- Items marked **(dev-only)** exist only in development builds. Port them only as `#if DEBUG`
  tooling.
- "Architect" is the DM window. "World View" is the player/projector window.

---

## 1. App shell

### 1.1 Windows

- [ ] Architect window — The main DM window. It has the full UI (sidebar, toolbar, inspector, canvas) and is the single source of truth for state. (source: electron/main.ts:335, src/App.tsx:126)
- [ ] Architect window bounds persistence — Window size and position are saved (debounced 400 ms on resize/move, and on close) and restored on launch. The default size is 1200x800. (source: electron/main.ts:336-365)
- [x] World View window — A second window loads the same app with `?type=world`. It renders only the canvas plus player-safe overlays. (source: electron/main.ts:410-430, src/utils/useWindowType.ts)
- [x] World View singleton — Opening World View while it is already open focuses the existing window instead of creating a second one. (source: electron/main.ts:412-415)
- [ ] World View opens from: menu View > World View (Projector) `Cmd+Shift+W`, the command palette "Launch World View Window", and the mobile toolbar "More" menu. The desktop toolbar has no World View button. (source: electron/main.ts:269-273, src/utils/commandRegistry.ts:125, src/components/MobileToolbar.tsx:84)
- [ ] World View skips the home screen and always starts in the editor. (source: src/App.tsx:135)
- [x] macOS app lifecycle — Closing every window does not quit the app on macOS. Clicking the Dock icon re-creates the main window. (source: electron/main.ts:435-449)
- [ ] Single instance — A second launch focuses the existing window and forwards any `.graphium` path in argv. (source: electron/main.ts:477-496)
- [x] Open from Finder **(gap)** — `open-file` and argv paths are sent as `OPEN_FILE_FROM_OS`, but no renderer code listens and there is no `fileAssociations` entry in electron-builder.json5. [Intended: double-clicking a `.graphium` file opens it.] (source: electron/main.ts:452-474, 1139-1154)
- [ ] Quit cleanup — Before quitting, the app waits for in-flight saves and autosaves, then deletes `temp_assets/` and every session folder except the active one. (source: electron/main.ts:1219-1253, electron/campaignWriteGate.ts)

**Native mapping:** Use a `DocumentGroup` (or `NSDocument`) for the Architect window, which gives
frame autosave for free via `NSWindow.setFrameAutosaveName`. Make World View a singleton
`Window` scene (or an `NSWindowController`) opened with `openWindow(id:)`, and drive it from the
same in-process model instead of a second process. Use `NSApplicationDelegate.application(_:open:)`
together with `CFBundleDocumentTypes`/`UTExportedTypeDeclarations` for Finder opens.
`applicationShouldTerminateAfterLastWindowClosed` returns `false`. For quit cleanup, use
`applicationShouldTerminate` returning `.terminateLater` until writes finish.

### 1.2 Home screen (Architect only)

- [ ] Hero — The logo lockup, the title "Virtual Tabletop for {random subtitle}" (23 options, fixed per session) and the tagline. (source: src/components/HomeScreen.tsx:130-156, 445-457)
- [ ] New Campaign card — Enters the editor with the current (default) campaign. (source: src/components/HomeScreen.tsx:165-167, 494-508)
- [ ] Load Campaign card — Opens the file picker. On success it loads the campaign, adds it to recents, enters the editor and shows a success toast. Errors show an error toast. (source: src/components/HomeScreen.tsx:169-185)
- [ ] Generate Dungeon card — Enters the editor, then opens the Dungeon Generator dialog after a 100 ms delay. (source: src/components/HomeScreen.tsx:187-193, 524-532)
- [ ] Templates card and modal — Four templates: Classic Dungeon, Wilderness Map, Starting Tavern, Combat Arena. Choosing one resets to a new campaign and sets grid cell size to 50. The width/height values are reference only. A toast confirms. The modal traps focus, closes on Esc or backdrop click, and restores focus afterwards. (source: src/components/HomeScreen.tsx:68-97, 228-273, 389-401, 536-544, 722-760)
- [ ] Onboarding entry — The "New to Graphium? Learn the basics" button opens the About modal on its Tutorial tab. There is no other onboarding flow. (source: src/components/HomeScreen.tsx:548-560)
- [ ] Recent campaigns list — Shows name and last-opened date/time, plus a remove (x) button. Stored in localStorage `graphium-recent-campaigns`, capped at 3. (source: src/components/HomeScreen.tsx:563-622, src/utils/recentCampaigns.ts:37-38)
- [ ] Open a recent campaign **(gap)** — Clicking a recent entry only shows an info toast telling you to use Load Campaign. [Intended: it reopens the file.] (source: src/components/HomeScreen.tsx:317-322)
- [ ] Recent search **(gap)** — The search box appears only when there are 6 or more recents, so it never appears while the list is capped at 3. [Intended: a filter for a long recents list.] (source: src/components/HomeScreen.tsx:571-583)
- [ ] Footer links — GitHub, About, Report Bug (GitHub issues), Help (?) which opens About on the Shortcuts tab, and Design System (dev-only). (source: src/components/HomeScreen.tsx:628-671)
- [ ] Footer theme cycle button — Cycles Light, Dark, Auto (system). The icon and label show the current mode. (source: src/components/HomeScreen.tsx:348-387, 672-682)
- [ ] Footer Lite/Full mode toggle — Turns home-screen animations off or on. Persisted in localStorage `liteMode`. A toast confirms. (source: src/components/HomeScreen.tsx:336-346, 684-700)
- [ ] Version footer — "Version X · Desktop|Web Edition". (source: src/components/HomeScreen.tsx:705-707)
- [ ] Home keyboard shortcuts — `Cmd/Ctrl+N` new, `Cmd/Ctrl+O` load, `Cmd/Ctrl+G` generate dungeon, `Cmd/Ctrl+T` templates, `?` About on the Shortcuts tab, `Esc` closes templates or About. (source: src/components/HomeScreen.tsx:276-315)

**Native mapping:** Use a SwiftUI welcome window (like Xcode's "Welcome to Xcode") or the
`DocumentGroup` launch scene, with recents from `NSDocumentController.recentDocumentURLs`. That
fixes both recents gaps for free. Templates map to "New from template" in the File menu. Lite
mode becomes respecting `accessibilityReduceMotion`.

### 1.3 Menus (Electron application menu)

- [ ] App menu (macOS) — About, Services, Hide, Hide Others, Show All, Quit. (source: electron/main.ts:167-184)
- [ ] File > New Campaign `Cmd+N` — Asks for confirmation ("Create a new campaign? Any unsaved changes will be lost.") and then resets to a new campaign. (source: electron/main.ts:190-199, src/App.tsx:351-362)
- [ ] File > Open Campaign... `Cmd+O` — Uses the native open dialog filtered to `.graphium`. Loads the campaign, adds it to recents and shows a toast. (source: electron/main.ts:200-209, src/App.tsx:323-341)
- [ ] File > Save Campaign `Cmd+S` — Syncs the active map into the campaign, then always shows the native save dialog (there is no silent re-save to the current path). Adds to recents and shows a toast. This is the only manual-save entry point in the app. (source: electron/main.ts:210-219, 817-832, src/App.tsx:301-321)
- [ ] File > Close (macOS) or Quit. (source: electron/main.ts:221)
- [ ] Insert > Generate Dungeon... — Opens the Dungeon Generator dialog. (source: electron/main.ts:225-239, src/App.tsx:347-349)
- [ ] View > Theme > Light / Dark / System — Radio items. The choice is persisted and broadcast to all windows. (source: electron/main.ts:243-267)
- [ ] View > World View (Projector) `Cmd+Shift+W`. (source: electron/main.ts:269-273)
- [ ] View > Performance Monitor `Cmd+Shift+M` — Toggles the resource monitor overlay. (source: electron/main.ts:274-283, src/App.tsx:343-345)
- [ ] View > Reload, Force Reload, Toggle DevTools, Reset Zoom, Zoom In, Zoom Out, Toggle Full Screen (Electron roles). (source: electron/main.ts:285-293)
- [ ] Window > Minimize, Zoom, Bring All to Front, Window list. (source: electron/main.ts:297-312)
- [ ] About menu item handler — The renderer listens for `MENU_SHOW_ABOUT`, but no menu item sends it. The macOS app menu uses the stock `role: 'about'`. [Intended: About opens the in-app About modal.] (source: src/App.tsx:364-366, 380)

**Native mapping:** Use SwiftUI `.commands` with `CommandGroup(replacing: .newItem / .saveItem)`,
`CommandMenu("Insert")`, a Theme `Picker` in View, and `Cmd+Shift+W` and `Cmd+Shift+M` via
`.keyboardShortcut`. Reload and DevTools have no native meaning (see section 8). Map
Reset/Zoom In/Zoom Out to canvas zoom commands (`Cmd+0`, `Cmd+=`, `Cmd+-`). Use the system
Full Screen. Save, Save As and Revert come from `DocumentGroup`.

### 1.4 Keyboard shortcuts (complete list of keydown handlers)

All single-key shortcuts are ignored while typing in an input or textarea.

- [ ] `?` / `Shift+/` — Opens the About modal. In the editor it opens the About tab. On the home screen it opens the Shortcuts tab. Works in both windows. (source: src/App.tsx:237-241, src/components/HomeScreen.tsx:297-301)
- [ ] `V` Select, `M` Marker, `E` Eraser, `W` Wall, `D` Door — Architect only. (source: src/App.tsx:257-272)
- [ ] `R` — Measure tool. When the Door tool is active, `R` rotates door orientation instead. (source: src/App.tsx:273-281)
- [ ] Arrow keys with the Door tool active — Toggle door orientation, with page scroll suppressed. (source: src/App.tsx:249-255)
- [ ] `I` — Opens the marker colour picker. (source: src/App.tsx:282-284)
- [ ] Hold `M` — Shows the movement-range overlay for the selected token. Released on keyup or window blur. Note that pressing `M` also switches to the Marker tool (see App.tsx), so the two behaviours fire together. Reconcile this natively, for example with hold-`M`-while-Select. (source: src/components/Canvas/CanvasManager.tsx:607-610, 650-652)
- [ ] `1` to `5` — Grid type: Square Lines, Square Dots, Hexagonal, Isometric, Hidden. Each shows a toast. Architect only, no key repeat. (source: src/components/Canvas/CanvasManager.tsx:613-635)
- [ ] `Delete` / `Backspace` — Removes the selected tokens, drawings and doors. Blocked in World View. (source: src/components/Canvas/CanvasManager.tsx:566-576)
- [ ] `Esc` — Clears the active measurement. Blocked in World View. (source: src/components/Canvas/CanvasManager.tsx:579-586)
- [ ] `Esc` — Stops Session Console audio when nothing else owns Escape: no palette, confirm, dungeon dialog, calibration, active measurement, focused text field or modal. Capture phase. Architect only. (source: src/components/SessionConsole/useSessionConsoleHotkeys.ts:38-89, src/App.tsx:517-521)
- [ ] Hold `Space` — Pan mode. The stage becomes draggable and the cursor changes to grab/grabbing. (source: src/components/Canvas/CanvasManager.tsx:589-592, 415-429)
- [ ] `=` / `+` / `Numpad+` zoom in, `-` / `Numpad-` zoom out — Zooms around the viewport centre by a factor of 1.1. (source: src/components/Canvas/CanvasManager.tsx:594-604, 526-539)
- [ ] Hold `Alt` (Option) — Duplicate-on-drag mode for tokens and drawings, with ghosts shown. Disabled in World View. (source: src/components/Canvas/CanvasManager.tsx:555-557, 640-642)
- [ ] `Shift` while drawing — Locks the stroke to the horizontal or vertical axis. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:520-531)
- [ ] `Shift` + click / `Shift` + marquee — Additive selection. Shift-click toggles a token in or out of the selection. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:347-350, 683-691, src/components/Canvas/hooks/useTokenDrag.ts:411-417)
- [ ] `Cmd/Ctrl+P` and `Cmd/Ctrl+K` — Open the command palette. (source: src/hooks/useCommandPalette.ts:25)
- [ ] Command palette keys — `Esc` close, `Enter` run the highlighted item, `Up`/`Down` move while skipping section headers. (source: src/components/AssetLibrary/CommandPalette.tsx:182-228)
- [ ] Confirm dialog — `Enter` confirms. Cancel has initial focus. `Esc` cancels. (source: src/components/ConfirmDialog.tsx:27-55)
- [ ] Map rename field — `Enter` commits, `Esc` cancels. This lives in the unmounted MapNavigator (see section 5.1). (source: src/components/MapNavigator.tsx:55-57)
- [ ] Session Console panel focus — `1` to `9` play tracks in board order. `D` ducks or unducks. Only active while focus is inside the panel. (source: src/components/SessionConsole/useSessionConsoleHotkeys.ts:91-130)
- [ ] Menu accelerators — `Cmd+N`, `Cmd+O`, `Cmd+S`, `Cmd+Shift+W`, `Cmd+Shift+M`. (source: electron/main.ts:192-277)
- [ ] Home screen — `Cmd+N`, `Cmd+O`, `Cmd+G`, `Cmd+T`, `?`, `Esc` (see 1.2). (source: src/components/HomeScreen.tsx:276-315)
- [ ] Ctrl/Cmd + scroll wheel — Zoom at the pointer. Plain wheel pans. (source: src/components/Canvas/CanvasManager.tsx:978-1006)
- [ ] About modal Shortcuts tab content — Lists `V`, `M`, `E`, `W`, `I`, `Shift` (lock axis) and `?`. It omits `D`, `R`, `1` to `5`, `Space`, `Alt`, `Delete`, `+`/`-` and `Cmd+K/P`. The native help should list the full set above. (source: src/components/AboutModal.tsx:437-470)
- [ ] README shortcut list — Also documents `Cmd+S`, `Cmd+O`, `D`, `1` to `5` and hold-`M`. (source: README.md "Keyboard Sigils")

**Native mapping:** Handle tool keys in `NSView.keyDown` / `performKeyEquivalent` on the canvas, or
with SwiftUI `.onKeyPress`, gated on first responder not being a text field. Use
`flagsChanged(with:)` for Option, Space-hold and M-hold. Put every shortcut in menu items, so
the macOS Help menu search and the system shortcuts overlay show them.

### 1.5 Command palette (Architect only)

- [ ] Spotlight-style modal — A search field ("Search actions and assets...") autofocused, with results grouped into Actions and Assets section headers. (source: src/components/AssetLibrary/CommandPalette.tsx:1-25, 253)
- [ ] Action registry — Select, Marker, Eraser, Wall, Door and Measure tools; Pause/Resume World View; Launch World View; Generate Dungeon; Session Console: Stop, Duck, Return to Map, Test Tone, Settings. Each has keywords and a shortcut hint. (source: src/utils/commandRegistry.ts:61-195)
- [ ] Weighted fuzzy command search — Label x3, keywords x2, category x1. (source: src/utils/commandRegistry.ts)
- [ ] Asset search — Fuzzy subsequence match on library item name and tags. Choosing an asset places a library-linked token at the map centre, or (500, 500) when there is no map. (source: src/utils/fuzzySearch.ts, src/utils/tokenHelpers.ts:19-41, src/components/AssetLibrary/CommandPalette.tsx:159)
- [ ] Edit asset from palette — An edit button on an asset result opens TokenMetadataEditor. (source: src/components/AssetLibrary/CommandPalette.tsx:70-71, 406)
- [ ] Also opened by the Sidebar Library "Place" button. (source: src/components/Sidebar.tsx:379-387)

**Native mapping:** Use a SwiftUI sheet or an `NSPanel` floating palette with a `List` and
`.searchable`. Commands are best modelled as one `[Command]` source that also drives the menus.

### 1.6 Toasts

- [ ] A single toast at a time at the top centre. Types are error, success and info. It auto-dismisses after 5 s, has a close button with an aria-label, and slides down. A new toast replaces the current one. (source: src/components/Toast.tsx:1-100, 54-56)
- [ ] Flavour text — Most messages come from `rollForMessage(KEY)`, which picks randomly from 32 themed message pools (for example CAMPAIGN_SAVE_SUCCESS and LOADING_PAUSE_OVERLAY) with `{placeholder}` substitution. (source: src/utils/systemMessages.ts:390)

**Native mapping:** Use a custom SwiftUI overlay banner (`.overlay(alignment: .top)` with a
transition), and post `NSAccessibility.announcementRequested` for VoiceOver. Move the message
pools into a `Localizable.xcstrings` string catalog with variants.

### 1.7 Confirm dialogs

- [ ] Store-driven confirm — Takes a message, an optional confirm label, and Cancel + Confirm buttons, with Confirm styled as destructive. Cancel gets initial focus. `Enter` confirms. Used by New Campaign, Reset Map, Delete Library Asset and Delete Map. (source: src/components/ConfirmDialog.tsx, src/store/gameStore.ts:868-870)

**Native mapping:** Use `.confirmationDialog` or `NSAlert` with `hasDestructiveAction`, or
`.alert` with `role: .destructive`. Consider undo instead of confirm where possible.

### 1.8 About modal

- [ ] Three tabs: About, Tutorial, Shortcuts. The initial tab is selectable by the caller, and the tab resets when the modal reopens. (source: src/components/AboutModal.tsx:17-20, 202-209, 246-248)
- [ ] About tab — Themed description, the version, a "Consult the Archives" button that opens the Update Manager (only when a callback is given, which happens in the editor and not on home), and a "View Source on GitHub" link. (source: src/components/AboutModal.tsx:256-308)
- [ ] Tutorial tab — "Core Powers" bullet list, six feature cards (Dual Windows, Fog of War, Dungeon Generator, Local-First, Drawing Tools, Asset Library) and a screenshot showcase. (source: src/components/AboutModal.tsx:313-433)
- [ ] Shortcuts tab — A shortcut list plus feature cards. **(gap)** The Shortcuts block is rendered twice (lines 437 and 569). [Intended: render it once.] (source: src/components/AboutModal.tsx:437-603)
- [ ] Footer — "May your rolls be ever in your favor, Dungeon Master." (source: src/components/AboutModal.tsx:607-609)

**Native mapping:** Use a custom About window (an `NSApplication` About panel with credits for the
basic part), plus a Help book or a SwiftUI `Window("Getting Started")` with a `TabView` for the
tutorial and shortcuts.

### 1.9 Update manager

- [ ] Modal workflow — Check for updates, then on "update available" show the version and a Download button, then a progress bar with percent and speed (bytes/s), then "Restart & Install". There is also an "up to date" state and an error state. Messages are randomised. It is disabled in dev and on web. (source: src/components/UpdateManager.tsx:1-30, 152-280, electron/autoUpdater.ts:18-49, 185-244)
- [ ] Download is never automatic. The update installs on quit once downloaded. (source: electron/autoUpdater.ts:43-46)
- [ ] An error boundary around the Update Manager shows a retry fallback instead of crashing the app. (source: src/components/UpdateManagerErrorBoundary.tsx, src/components/UpdateErrorFallbackUI.tsx)

**Native mapping:** Use Sparkle 2 (`SPUStandardUpdaterController`) with a "Check for Updates..." menu
item in the app menu. Sparkle provides its own UI, progress and relaunch. Turn off automatic
downloads to match.

### 1.10 Error boundaries and error reporting

- [ ] Root PrivacyErrorBoundary — On any uncaught render error it shows a full-screen report UI. The error is sanitised: the username becomes `<USER>` and absolute paths become relative. Below it are an optional "what were you doing" field (max 500 chars), a privacy notice, Report on GitHub (opens a prefilled issue URL), Save to File (native save dialog, `.txt`) and Reload App. (source: src/components/PrivacyErrorBoundary.tsx:1-60, 200-430, src/utils/errorSanitizer.ts, src/utils/githubIssueUrl.ts, electron/main.ts:1056-1084)
- [ ] Global error handler — Captures `window.onerror` and unhandled promise rejections, sanitises them, dedupes them by hash with an occurrence count, and stores them in localStorage `graphium_pending_errors`. Nothing is sent without user consent. (source: src/utils/globalErrorHandler.ts:1-200)
- [ ] Pending errors indicator — A bottom-right badge opens a "Stored Errors" panel with a "Report on GitHub" action for each error and "Clear reported". (source: src/components/PendingErrorsIndicator.tsx:179-310, src/main.tsx:106-109)
- [ ] Storage-init failure screen — "Failed to Initialize Storage" with Retry and "Clear Data & Retry". (source: src/main.tsx:22-95)
- [ ] Scoped boundaries that degrade silently — TokenErrorBoundary (hides one broken token), CanvasOverlayErrorBoundary (hides paper noise, measurement or movement range), MinimapErrorBoundary, QuickTokenSidebarErrorBoundary (inline message), LibraryModalErrorBoundary (Close button), AssetProcessingErrorBoundary (around the cropper), UpdateManagerErrorBoundary. (source: src/components/Canvas/TokenErrorBoundary.tsx, src/components/Canvas/CanvasOverlayErrorBoundary.tsx, src/components/Canvas/MinimapErrorBoundary.tsx, src/components/QuickTokenSidebarErrorBoundary.tsx, src/components/AssetLibrary/LibraryModalErrorBoundary.tsx, src/components/AssetProcessingErrorBoundary.tsx)
- [ ] Not mounted — `GlobalErrorBoundary.tsx` and `DungeonGeneratorErrorBoundary.tsx` exist but are not used. Do not port them as separate features. (source: src/components/GlobalErrorBoundary.tsx, src/components/DungeonGeneratorErrorBoundary.tsx)

**Native mapping:** Swift has no render-error boundaries. Make rendering total (validate the model
on load, skip bad tokens with `os_log`). For crash and issue reporting, use MetricKit
(`MXCrashDiagnostic`) together with a "Report a Problem..." Help menu item. That item builds the
same sanitised report: replace `NSUserName()` and `NSHomeDirectory()`, then
`NSWorkspace.open` the GitHub issue URL or save the report with `NSSavePanel`.

### 1.11 Theme

- [ ] Three modes: light, dark, system (the default). Persisted in electron-store `config.json` or localStorage. In system mode the app follows OS changes live. (source: electron/themeManager.ts:1-30, 56-109)
- [ ] All windows switch together. Electron uses an IPC broadcast and web uses a BroadcastChannel `graphium-theme-sync`. (source: electron/themeManager.ts:109, src/components/ThemeManager.tsx:85-120, src/components/HomeScreen.tsx:373-380)
- [ ] No flash of the wrong theme on launch. There is no transition on first paint, and an animated transition after that. (source: src/components/ThemeManager.tsx:1-60, src/styles/theme.css:398-401)
- [ ] Theme-adaptive canvas colours — The default grid colour `#222222` is replaced by a theme token in dark mode. Token label text uses the theme text colour. (source: src/components/Canvas/CanvasManager.tsx:300-305, src/store/gameStore.ts:253)
- [ ] Visual language "direction A" — 4px radius, hairline elevation, amber Architect accent, and a separate projector-safe World View token set. (source: CHANGELOG.md "Unreleased > Changed", src/styles/theme.css)

**Native mapping:** Set `NSApp.appearance` (nil, `.aqua` or `.darkAqua`) from an `@AppStorage`
value, shown as a Picker in a `Settings` scene and in View > Theme. Use asset-catalog colours
with Any/Dark variants. World View can keep its own fixed palette.

### 1.12 Pause state ("Blank the projector")

- [x] A global pause flag lives in the main process. It persists across map switches and starts unpaused on launch. Toggling it broadcasts `PAUSE_STATE_CHANGED` to both windows. (source: electron/main.ts:144-145, 1035-1046, src/components/PauseManager.tsx:75-101)
- [x] Toolbar Play/Pause button — Red when paused, green when running. Tooltips read "Resume - Players will see the map" and "Pause - Hide map from players". (source: src/components/Toolbar.tsx:72-90)
- [ ] Also available from the command palette (`world-view-toggle-pause`) and the mobile toolbar. (source: src/utils/commandRegistry.ts:117, src/components/MobileToolbar.tsx)
- [ ] An error toast appears if the toggle fails. (source: src/App.tsx:163-175)

**Native mapping:** Make it a `@Published var isPaused` on a shared session model with no IPC. Add a
menu item (for example View > Pause World View, `Cmd+Shift+P`) and a toolbar item.

### 1.13 Resource / performance monitor

- [ ] Overlay — FPS (rAF), JS heap used and % of limit, token and drawing counts, IPC messages per second and bytes per second, active workers, canvas commit time. Updates every 500 ms. Toggled with `Cmd+Shift+M`. Architect only. (source: src/components/ResourceMonitor.tsx:35-120, src/components/Canvas/CanvasManager.tsx:1008-1017, src/utils/perfCounters.ts)

**Native mapping:** Use a debug HUD with `CADisplayLink`/`CVDisplayLink` frame timing,
`task_info` resident memory, and model counts. Prefer `os_signpost` with Instruments over a
reimplemented IPC meter.

---

## 2. Architect editor chrome

### 2.1 Sidebar (left, Architect only)

- [ ] Header — Shows the campaign name (truncated, with the full name as a tooltip) and a collapse/expand button (w-64 to w-16). (source: src/components/Sidebar.tsx:268-295)
- [ ] MAPS section (collapsible) — Maps sorted alphabetically. Clicking switches maps. The active map shows `aria-current`. A hover gear opens Map Settings in edit mode. A "New Map" button opens Map Settings in create mode. (source: src/components/Sidebar.tsx:302-368)
- [ ] Door Controls section — Only shown when doors exist. Offers "Open all unlocked doors", "Close all open doors", and "Unlock all" (only when any door is locked). (source: src/components/DoorControls.tsx:34-48, 75-120, src/components/Sidebar.tsx:373)
- [ ] LIBRARY section — "Place" (opens the command palette), "Add" (pick an image, process it as a TOKEN, then show the Add to Library dialog), "Manage library" (opens Library Manager). (source: src/components/Sidebar.tsx:376-428, 213-262)
- [ ] Quick Token Sidebar — "Recent History" (last 3 unique library tokens used on this map) and "Party Tokens" (a generic placeholder plus up to 5 PC library tokens, deduped against recents). Every item can be dragged onto the canvas. (source: src/components/QuickTokenSidebar.tsx:1-168, src/utils/tokenUtils.ts)
- [ ] Custom drag image (64x64) when dragging a library token. (source: src/components/Sidebar.tsx:174-210)
- [ ] SESSION CONSOLE section — Hosts the Session Console panel (see 5.4). (source: src/components/Sidebar.tsx:432-434)

**Native mapping:** Use a `NavigationSplitView` sidebar with `Section`s and `DisclosureGroup`s.
Library items use `.draggable` with a custom `Transferable` type (library item id). The
sidebar collapse is the system sidebar toggle.

### 2.2 Toolbar (floating, Architect desktop only)

- [ ] Play/Pause (see 1.12). (source: src/components/Toolbar.tsx:72-90)
- [ ] Tool buttons with pressed state and tooltips — Select (V), Marker (M), Eraser (E), Wall (W), Door (D, "Arrow keys or R to rotate"). (source: src/components/Toolbar.tsx:92-166)
- [ ] Door orientation toggle button — Only visible while the Door tool is active. (source: src/components/Toolbar.tsx:167-180)
- [ ] Measure (R) with mode buttons Ruler / Blast / Cone and a Broadcast toggle ("Broadcasting" / "Local Only"). The mode buttons are only visible while Measure is active. Changing mode clears the active measurement. (source: src/components/Toolbar.tsx:182-242, src/store/uiStore.ts:52-56)
- [ ] Marker colour HUD (bottom centre, Marker tool only) — A large swatch opens the colour picker. Three recent-colour swatches follow, most recent first and deduped. The default is `#df4b26`. (source: src/components/Toolbar.tsx:243-280, src/store/uiStore.ts:34-47)
- [ ] Not in the toolbar: Save/Load, World View launch and Generate Dungeon. These live in menus and the palette. Older docstrings claim otherwise. (source: src/App.tsx:77-84 vs src/components/Toolbar.tsx)

**Native mapping:** Use a window `.toolbar` with a segmented `Picker` for tools, a `ControlGroup` for
measure modes, and `ColorPicker` (backed by `NSColorPanel`) plus recent swatches. A
touch-bar-like floating HUD is optional.

### 2.3 Token inspector (Architect, shown when one or more tokens are selected)

- [ ] Title — "Token Name" for a single token, or "N Tokens Selected". There is a compact read-only summary (Type, Vision) with an Edit button and a close button. (source: src/components/TokenInspector.tsx:205-250)
- [x] Name field — The placeholder reads "Multiple tokens" when several are selected. Edits apply to every selected token. (source: src/components/TokenInspector.tsx:145-150, 263-280)
- [x] Type — PC/NPC toggle. Hint: "Only PC tokens emit vision for Fog of War". (source: src/components/TokenInspector.tsx:152-157, 289-343)
- [x] Vision radius — Presets 0, 30, 60 and 120 ft, plus a number field from 0 to 300 in steps of 5. Applies to every selected token. (source: src/components/TokenInspector.tsx:159-164, 350-398)
- [ ] "Save to library" (single, library-linked token) — Writes the name, type and vision back as library defaults. (source: src/components/TokenInspector.tsx:166-203, 400-430)
- [x] Read-only details — Scale (for example "1x") and rounded position. (source: src/components/TokenInspector.tsx:431-450)
- [x] Prototype/instance resolution — Each token property falls back to the linked library item's defaults (name, type, visionRadius, scale, movementSpeed). (source: src/store/gameStore.ts:25-62, src/hooks/useTokenData.ts)
- [ ] Not editable anywhere in the UI: per-token `movementSpeed` (always the 30 ft default unless a library default sets it), token rotation, and explicit numeric scale. (source: src/components/Canvas/OverlayLayer.tsx:131, src/hooks/useTokenData.ts)

**Native mapping:** Use a trailing `.inspector` (macOS 14) with a `Form`, a `Picker(.segmented)` for
type, and `Stepper`/`TextField(format: .number)` for vision. Multi-selection editing binds to
an aggregate proxy.

### 2.4 Mobile / narrow-window layout (viewport 767px wide or less)

- [ ] Hamburger button (48x48) opens the sidebar as a drawer. (source: src/App.tsx:533-556, src/components/MobileSidebarDrawer.tsx)
- [ ] Bottom MobileToolbar — Select, Marker, Eraser, Wall and More. The More menu has Place Door (with orientation), Change Marker Color, Generate Random Dungeon, Open World View and pause. Buttons are at least 56px tall. (source: src/components/MobileToolbar.tsx:84-230, tests/touch-targets.spec.ts)
- [ ] Bottom sheet inspector on mobile. (source: src/components/MobileBottomSheet.tsx, src/components/TokenInspector.tsx:59, 207)

These trigger in Electron too when the window is resized narrow. See section 8 for the porting
decision.

---

## 3. Canvas (shared by Architect and World View)

### 3.1 Pan and zoom

- [x] Zoom range is 0.1x to 5x with a step factor of 1.1. Zoom is anchored at the pointer for the wheel and at the pinch centre for pinch. (source: src/components/Canvas/CanvasManager.tsx:35-37, 494-523)
- [x] Mouse/trackpad — The wheel pans (deltaX/deltaY). Ctrl/Cmd+wheel zooms. A trackpad pinch arrives as ctrl+wheel. (source: src/components/Canvas/CanvasManager.tsx:978-1006)
- [ ] Space+drag pans with grab/grabbing cursors. The viewport is clamped on release. (source: src/components/Canvas/CanvasManager.tsx:1155, 1170-1196)
- [x] Keyboard `+`/`-` zoom around the centre. (source: src/components/Canvas/CanvasManager.tsx:526-539)
- [ ] Touch — Two-finger pinch zooms when the distance change is above a threshold (setting, clamped to 5-50 px, default 10). Otherwise two fingers pan. One finger goes to the active tool. Default gestures are suppressed for drawing tools. (source: src/components/Canvas/CanvasManager.tsx:307-315, 713-821)
- [ ] Viewport clamp — The viewport centre stays within the map bounds (or ±5000 with no map), expanded by PC token bounds, plus 1000 px of padding. (source: src/components/Canvas/CanvasManager.tsx:39, 439-491)
- [x] Camera is per window — Architect and World View pan and zoom independently. The camera is not synced. (source: src/components/Canvas/CanvasManager.tsx:257-298)
- [ ] Performance — Gestures write the stage transform directly and commit to React state 100 ms later. (source: src/components/Canvas/CanvasManager.tsx:268-298)
- [ ] Cursor — Crosshair for drawing, measure and door tools. Default for select. Grabbing while dragging a token. (source: src/components/Canvas/CanvasManager.tsx:406-429)

**Native mapping:** Build a custom `NSView` (Metal or Core Animation layer tree, or an
`NSScrollView` with `allowsMagnification`) and use `magnify(with:)` for trackpad pinch,
`scrollWheel` with `hasPreciseScrollingDeltas` for pan, `NSMagnificationGestureRecognizer`, and
`smartMagnify` (double-tap). Keep all canvas maths in a pure `CameraState` value type in
GraphiumCore.

### 3.2 Map background

- [ ] Import from the Map Settings sheet with "Upload". The image is resized to at most 4096 px, converted to WebP at 85% in a Web Worker, and placed at (0,0) with scale 1. (source: src/components/MapSettingsSheet.tsx:113-180, 275-296, src/utils/AssetProcessor.ts:1-110, src/utils/imageMaxDimensions.ts)
- [ ] Upload automatically enters calibration mode. In create mode the image is held until "Create Map". (source: src/components/MapSettingsSheet.tsx:155-165, 183-210)
- [ ] Calibration — "Draw a square on the map that represents exactly one grid cell." The map scales so that box equals the grid size, then offsets so the box aligns to grid lines. Boxes of 5 px or less are ignored. Square grids only (disabled for hex/iso, with a tooltip). Has a Cancel button. The sheet becomes non-modal while calibrating. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:275-286, 463-474, 576-607, src/components/MapSettingsSheet.tsx:296-335, 243)
- [ ] Danger Zone "Reset Map Position & Scale" (edit mode) — Asks for confirmation, then resets to (0,0) at scale 1. (source: src/components/MapSettingsSheet.tsx:223-232, 418-430)
- [ ] The map is not directly draggable or selectable. It is a listening-false background layer. (source: src/components/Canvas/CanvasManager.tsx:1202-1219)
- [ ] Map cropping does not exist. The cropper is only used for image files dropped onto the canvas as tokens (see 3.4).

**Native mapping:** Use `NSOpenPanel` (UTType.image) or drag-and-drop. Downscale with
ImageIO (`CGImageSourceCreateThumbnailAtIndex` with `kCGImageSourceThumbnailMaxPixelSize` 4096) off the main thread. HEIC or PNG storage is fine natively. WebP output is not required but
WebP input must decode (ImageIO handles it on macOS 11 and later).

### 3.3 Grid

- [x] Types — Square Lines, Square Dots, Hexagonal (flat-top, axial coordinates), Isometric (diamond), Hidden. Set per map. (source: src/store/gameStore.ts:101, src/types/grid.ts, src/utils/gridGeometry.ts)
- [ ] Size semantics — Square: cell px. Hex: circumradius. Iso: half the diamond width. The default is 50. There is no UI to type a grid size. Templates set 50 and calibration scales the map, not the grid. (source: CHANGELOG.md "Grid Size Semantics", src/store/gameStore.ts:267, src/components/HomeScreen.tsx:397)
- [ ] Per-map grid colour picker — Default `#222222`, theme-adaptive when left at the default. A note is shown while the grid is hidden. (source: src/components/MapSettingsSheet.tsx:369-395, src/components/Canvas/CanvasManager.tsx:303-305)
- [ ] Viewport culling — Only visible lines, cells or dots are drawn. The DOTS step coarsens above 10,000 dots. (source: src/components/Canvas/GridOverlay.tsx:1-60)
- [ ] Hover cell highlight — A translucent fill on the hovered cell, for every type except Dots and Hidden. Architect only. (source: src/components/Canvas/GridOverlay.tsx:72-80, 213-230, src/components/Canvas/hooks/useCanvasInteraction.ts:377-384)
- [x] Snapping — Square: odd-sized tokens snap to cell centres and even-sized tokens to intersections. Hex/iso: always snap to the cell centre. Applies on drop, drag end and door placement. (source: src/utils/grid.ts, CHANGELOG.md "Smart Grid-Aware Snapping")
- [x] Snap preview — A dashed blue circle shows the snap destination of each dragged token, including multi-token drags. (source: src/components/Canvas/OverlayLayer.tsx:57-90, src/components/Canvas/hooks/useTokenDrag.ts:249-294)
- [ ] Grid type quick keys `1` to `5` with toasts (see 1.4).

**Native mapping:** Port `GridGeometry` (pixelToGrid, gridToPixel, getCellVertices, neighbours) to
GraphiumCore unchanged. It is pure maths and the existing unit tests can be translated 1:1.
Render with a `CAShapeLayer` path rebuilt on viewport change, or in a Metal pass.

### 3.4 Tokens

- [ ] Add by dragging a library or quick token onto the canvas — Creates a library-linked instance at the snapped drop point. (source: src/components/Canvas/CanvasManager.tsx:858-879)
- [ ] Add by dragging the generic token — A theme-coloured SVG placeholder named "Generic Token", type NPC. (source: src/components/Canvas/CanvasManager.tsx:880-902)
- [ ] Add by dropping an image file — Opens the 1:1 ImageCropper (zoom 1x-3x by slider, wheel or pinch, "Crop & Import" / Cancel). Then creates a "New Token" (NPC) with an embedded data URL. This token is not added to the library. (source: src/components/Canvas/CanvasManager.tsx:909-961, src/components/ImageCropper.tsx:24-58)
- [ ] Add from the command palette at the map centre (see 1.5).
- [ ] Rendering — Square image of size gridSize x scale. The name label (12pt bold, theme text colour) sits below. Iso grids offset the token up by half its height. Hover shows a soft shadow. A selected token gets a dashed blue ring. A dragged token is semi-transparent with a strong shadow. (source: src/components/Canvas/TokenNode.tsx:36-100, 145-215)
- [ ] Move — Pointer drag with a 5 px threshold. Multi-select drags move together. Every token snaps on release. Live positions stream to World View during the drag (rAF-batched). (source: src/components/Canvas/hooks/useTokenDrag.ts:94, 106-116, 330-392)
- [x] Duplicate — Option/Alt-drag leaves the originals and drops copies at the snapped destinations. Ghosts are shown while dragging. (source: src/components/Canvas/hooks/useTokenDrag.ts:394-401, src/components/Canvas/TokenLayer.tsx:76-82)
- [ ] Resize — Transformer handles scale the token uniformly (the average of scaleX and scaleY multiplies the stored scale). Architect only. (source: src/components/Canvas/CanvasManager.tsx:1357-1396)
- [ ] Rotate **(gap)** — The Konva Transformer shows its default rotate handle, but rotation is discarded on transform end and the Token model has no rotation field. [Decision needed: either hide rotation or add `rotation` to the model.] (source: src/components/Canvas/CanvasManager.tsx:1359-1394, src/store/gameStore.ts:51-62)
- [x] Select — Click selects. Shift-click toggles. Marquee selection starts on empty stage or map and selects tokens and drawings whose bounds intersect. Shift-marquee is additive. Clicking empty space clears the selection. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:334-351, 476-502, 650-695)
- [x] Delete with `Delete`/`Backspace`. (see 1.4)
- [x] There is no undo or redo anywhere in the app. The native port should add it. (source: src/store/gameStore.ts:296-447 has no history)
- [x] Viewport culling — Off-screen tokens (with a 2-cell margin) skip their visuals. (source: src/components/Canvas/TokenNode.tsx:150-153, src/utils/viewportCulling.ts)
- [x] Token library linkage — Instances store only id, x, y, src and libraryItemId. Other properties inherit from the library item unless overridden. (source: src/utils/tokenHelpers.ts:19-41, src/store/gameStore.ts:25-62)

**Native mapping:** Make tokens model structs in GraphiumCore. Render them as `CALayer`s (contents =
`CGImage`) or Metal instanced quads. Handle drag in `mouseDown`/`mouseDragged`. Use
`NSEvent.modifierFlags.contains(.option)` for duplicate. Register undo with `UndoManager` on
every commit, which `DocumentGroup` already wires up.

### 3.5 Drawing tools (marker, eraser, wall)

- [ ] Marker — Freehand line in the chosen colour, 5 px base width, round caps, 0.5 tension. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:301-331, src/components/Canvas/DrawingLayer.tsx:50-100)
- [ ] Eraser — Draws a 20 px `destination-out` stroke on the drawings layer. It erases ink from markers and walls visually but never erases the map, tokens or wall geometry used for vision. Clicking a door with the eraser deletes the door. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:315-317, src/components/Canvas/DrawingLayer.tsx:58-59, src/components/Canvas/DoorShape.tsx:101-110)
- [ ] Wall — Red 8 px dashed `[10,5]` line. It blocks fog-of-war vision. Walls are not selectable or draggable. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:318-321, src/components/Canvas/DrawingLayer.tsx:54-61, 96)
- [ ] Wall smoothing and endpoint snapping — Ramer-Douglas-Peucker simplification (epsilon 3, kept if at least 2 points remain). Endpoints snap to existing walls within 10 px. Settings live in the `graphium-preferences` store and have no UI. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:84-101, 620-641, src/store/preferencesStore.ts:38-67, src/utils/pathOptimization.ts:21, 207)
- [ ] Pressure-sensitive lines — Per-point pressure is captured when pressure sensitivity is on. Width = base x mapped pressure, using a pressure curve: light 0.2-2.0, normal 0.3-1.5 (the default), heavy 0.4-1.2. A custom scene function draws the variable width. Mouse input uses 0.5. (source: src/components/Canvas/CanvasManager.tsx:41-45, src/components/Canvas/CanvasUtils.ts:18-27, src/components/Canvas/PressureSensitiveLine.tsx, src/store/touchSettingsStore.ts:116)
- [ ] Shift axis-lock while drawing (see 1.4).
- [ ] Marker strokes and eraser strokes can be selected, dragged (Option-drag duplicates) and scaled with the transformer. Walls cannot. (source: src/components/Canvas/DrawingLayer.tsx:60-61, 120-130, src/components/Canvas/CanvasManager.tsx:1258-1286, 1380-1393)
- [ ] Live stroke preview is rAF-throttled. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:544-555)

**Native mapping:** Read `NSEvent.pressure` (and `tangentialPressure`/`tilt` for Wacom), then render
variable-width strokes as filled `CGPath` outlines or with a Metal stroke shader. For the
eraser, use `CGBlendMode.clear` on a dedicated ink layer. PencilKit is iPad-only on macOS for
drawing input and is not suitable here.

### 3.6 Doors and stairs

- [ ] Place a door with the Door tool. A white ghost preview follows the snapped pointer. Clicking adds a closed, unlocked door the size of one grid cell in the current orientation (horizontal or vertical, toggled with `R`, arrow keys or the toolbar). (source: src/components/Canvas/hooks/useCanvasInteraction.ts:248-269, 386-396, src/components/Canvas/OverlayLayer.tsx:32-50)
- [ ] Open and close a door by clicking it (Architect). Locked doors do not toggle. The swing arc animates over 300 ms with ease-in-out. (source: src/components/Canvas/DoorShape.tsx:52-117)
- [ ] Door right-click context menu — Open/Close Door (disabled when locked), Lock/Unlock Door, and Delete Door in red. Clicking outside closes it. (source: src/components/Canvas/CanvasManager.tsx:235-255, 1437-1484, src/components/Canvas/DoorShape.tsx:118-126)
- [ ] Lock state — A lock icon overlay shows on locked doors. (source: src/components/Canvas/DoorShape.tsx:146, 421)
- [ ] Bulk door controls in the sidebar (see 2.1).
- [ ] Blocking — Closed doors become wall segments for vision. Open doors let vision through. (source: src/components/Canvas/FogOfWarLayer.tsx:242-320)
- [ ] World View door rendering — Thicker strokes and a white glow for legibility. It does not respond to clicks. (source: src/components/Canvas/DoorShape.tsx:137, 182-217)
- [ ] Doors can be selected for deletion with marquee or Delete. They show a selection highlight. (source: src/components/Canvas/DoorShape.tsx:149, src/components/Canvas/CanvasManager.tsx:573)
- [ ] Stairs — Render-only (non-interactive). A stepped pattern with a direction arrow (N/S/E/W) and up/down shading, visible in both windows. **(gap)** No UI or generator creates stairs. They exist only in the model, sync and persistence. [Port rendering and persistence. Creating stairs is a new feature.] (source: src/components/Canvas/StairsShape.tsx:1-41, src/store/gameStore.ts:236-250, 826-830)

**Native mapping:** Keep a `Door` model in core and render it as a layer with a
`CABasicAnimation` for the swing. Use `menu(for event:)` on the canvas view for the native
right-click `NSMenu` (and Control-click).

### 3.7 Fog of war and explored regions

- [ ] Fog renders only in World View, and only when Daylight Mode is off. The Architect always sees the whole map. (source: src/components/Canvas/CanvasManager.tsx:1289-1303)
- [ ] Vision sources — PC tokens with a vision radius above 0. Radius in px = feet / 5 x gridSize. (source: src/components/Canvas/FogOfWarLayer.tsx:340-372)
- [ ] Raycast visibility polygon for each PC against wall segments (wall drawings, with their x/y/scale transforms applied) and closed doors. The ray count depends on radius and zoom. Polygons are cached per token and recomputed only when that token or the walls change. (source: src/components/Canvas/FogOfWarLayer.tsx:100-120, 252-372)
- [ ] Three-state fog — Unexplored areas are 94% black. Explored areas are dimmed through a cached offscreen mask (union of explored polygons). Current vision is cleared with a radial-gradient soft edge. (source: src/components/Canvas/FogOfWarLayer.tsx:452-540, docs/features/explored-fog-of-war.md)
- [ ] Explored regions are recorded at most once per second per PC polygon, capped at 2000 per map (oldest dropped), and persisted in the map. (source: src/components/Canvas/FogOfWarLayer.tsx:395-427, src/store/gameStore.ts:248, 852-859)
- [ ] NPC hiding — NPC tokens outside every PC's vision are hidden and not interactive in World View. (source: src/utils/fogVisibility.ts, src/components/Canvas/FogOfWarLayer.tsx:384-387, src/components/Canvas/TokenNode.tsx:134, 162)
- [ ] Wall lines show in World View as black 6 px lines, drawn under the fog. (source: src/components/Canvas/DrawingLayer.tsx:54-55, src/components/Canvas/CanvasManager.tsx:1290)
- [ ] Reset explored fog **(gap)** — `clearExploredRegions` exists, but nothing in the UI calls it. [Intended: a "Reset explored areas" action per map.] (source: src/store/gameStore.ts:860)
- [ ] Explored-region sync caveat — Explored regions are computed in World View, but World-to-Architect sync only carries token x/y. So regions recorded in World View never reach the Architect's saved campaign. **(gap)** [Intended: compute exploration in the shared model so it persists.] (source: src/utils/worldViewTokenSync.ts, src/components/SyncManager.tsx:267-268)

**Native mapping:** Port the visibility-polygon raycaster to GraphiumCore as pure Swift (SIMD) and
unit-test it. Render fog as a Metal fragment pass or a `CALayer` mask: a `CGImage` explored
mask plus `CAGradientLayer`-style soft vision holes. Because both windows share one process,
exploration is computed once.

### 3.8 Daylight mode

- [ ] A per-map toggle in Map Settings ("Daylight Mode", with the description switching between "Fog of War disabled" and "Fog of War enabled"). When on, World View shows no fog. In create mode the value is pending until "Create Map". (source: src/components/MapSettingsSheet.tsx:396-415, src/store/gameStore.ts:861)

### 3.9 Measurement overlay

- [ ] Ruler — A line from the drag origin with a label like "30ft (6 cells)". (source: src/components/Canvas/hooks/useCanvasInteraction.ts:409-423, src/utils/measurement.ts, src/components/Canvas/MeasurementOverlay.tsx:80-100)
- [ ] Blast — A circle with a label like "20ft radius (4 cells)". (source: src/components/Canvas/hooks/useCanvasInteraction.ts:424-435, src/components/Canvas/MeasurementOverlay.tsx:120-140)
- [ ] Cone — A 53° cone triangle with a label like "30ft 53° cone (6 cells)". (source: src/components/Canvas/hooks/useCanvasInteraction.ts:436-453, src/utils/measurement.ts:130-160)
- [ ] Distance is Euclidean, with 1 cell = 5 ft. A D&D 5e 5-10-5 diagonal mode exists in utils but is not exposed in the UI. Labels are 16pt with a dark backing and handle singular and plural. (source: src/utils/measurement.ts:13-100)
- [ ] The measurement stays on screen after release until `Esc`, a mode change, or a click with another tool. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:271-273, 569-574)
- [ ] Broadcast — When "Broadcasting" is on, the DM's measurement is mirrored into World View (`dmMeasurement`). (source: src/components/Toolbar.tsx:230-240, src/components/SyncManager.tsx:145, 271-273, src/components/Canvas/CanvasManager.tsx:1354)

### 3.10 Movement range

- [ ] Hold `M` with a token selected (Architect only) to show a BFS flood-fill of reachable cells within movementSpeed / 5 cells (default 30 ft). It uses grid-aware neighbours (square, hex, iso), is drawn as a translucent blue overlay, and follows the token during a drag. (source: src/components/Canvas/MovementRangeOverlay.tsx:1-176, src/components/Canvas/OverlayLayer.tsx:98-135)
- [ ] `docs/movement-range-concept.tsx` is the earlier concept. The shipped implementation is MovementRangeOverlay. Port only the shipped one. (source: docs/movement-range-concept.tsx)

### 3.11 AoE templates

- [ ] **(concept-only, not shipped)** Cell-highlighting AoE templates (circle, cone, line, cube) that highlight the grid cells inside a spell area. They are not imported anywhere in `src/`. The shipped equivalent is the geometric Blast/Cone measurement (3.9). (source: docs/aoe-templates-concept.tsx:1-70)

### 3.12 Minimap (World View only)

- [ ] A 200x200 canvas showing the map bounds (or PC bounds when there is no map), PC tokens as green dots, and the current viewport rectangle. Clicking recentres the World View camera there. It is wrapped in an error boundary. (source: src/components/Canvas/Minimap.tsx:1-233, src/components/Canvas/ConnectedMinimap.tsx:5-59, src/components/Canvas/CanvasManager.tsx:1427-1433)

### 3.13 Paper-noise overlay

- [ ] An SVG `feTurbulence` paper texture at 25% opacity over the map bounds (or the visible bounds when there is no map). It moves with the map and is non-interactive. (source: src/components/Canvas/PaperNoiseOverlay.tsx:1-94, src/components/Canvas/CanvasManager.tsx:1221-1232)

**Native mapping:** Use a pre-rendered tiling noise `CGImage` (or a `CIFilter.randomGenerator` blended
at 25%) as a pattern layer.

### 3.14 Touch visual feedback

- [ ] **(gap, not mounted)** `TouchVisualFeedback` (touch-point indicators, pressure indicator, gesture-mode overlay) exists but no component imports it. Its settings (`showTouchPointIndicators`, `showPressureIndicator`, `showGestureFeedback`, `showGestureTutorial`) are unused. Do not port it as a user-visible feature. (source: src/components/Canvas/TouchVisualFeedback.tsx, src/store/touchSettingsStore.ts:136-141)

### 3.15 Performance features worth keeping

- [ ] Viewport culling for grid, tokens and fog bounds. (source: src/utils/viewportCulling.ts, src/components/Canvas/GridOverlay.tsx)
- [ ] Direct node updates during drag, without full re-render. A token node registry is used for live positions. (source: src/utils/tokenNodeRegistry.ts, src/store/pointerOverlayStore.ts)
- [ ] Image processing off the main thread with cancellation. (source: src/utils/AssetProcessor.ts:40-110, src/workers/image-processor.worker.ts)
- [ ] Stress fixture autoload for perf testing **(dev-only)**. (source: src/utils/stressFixture.ts, src/App.tsx:220-224)
- [ ] React profiler boundaries **(dev-only)**. (source: src/perf/profiler.tsx)

---

## 4. World View (player window)

### 4.1 What players see

- [ ] The map background, paper noise, the grid in the map's grid colour, markers, wall lines (black, 6 px), doors with high-legibility styling, stairs, tokens with name labels, fog of war (unless Daylight mode is on), and the DM's measurement when broadcasting is on. (source: src/components/Canvas/CanvasManager.tsx:1201-1356, src/components/Canvas/DrawingLayer.tsx:54-55, src/components/Canvas/DoorShape.tsx:182-217)
- [ ] Not shown: the sidebar, toolbar, inspector, palette, resource monitor, transformer handles, hover-cell highlight, door preview and movement range. (source: src/App.tsx:516-618, src/components/Canvas/OverlayLayer.tsx:33, 119)
- [ ] NPCs outside party vision are hidden (see 3.7).
- [x] "Center on Party" button (bottom right) — Fits the camera to all PC tokens with 2 cells of padding. (source: src/components/Canvas/CanvasManager.tsx:1054-1108, 1403-1425)
- [ ] Minimap (see 3.12).
- [ ] Projector legibility contract — Overlay text is at least 18 px with 7:1 contrast, strokes are at least 2 px, and there is no DM chrome. This is enforced by a Playwright test. (source: tests/world-legibility.spec.ts:2)
- [ ] Session Console stage — A full-window "plate" artwork with an optional frame, title and subtitle that crossfades between plates (no fade under reduced motion). It covers the map while `stageVisible` is true. (source: src/components/SessionConsole/WorldStage.tsx:41-140)
- [ ] "Arm World View audio" card — Shown until the window is armed. It explains that this window owns campaign audio and should be shared in Discord. The "Arm audio" button needs a user gesture to start the AudioContext and the YouTube player, and reads "Loading audio..." while getting ready. (source: src/components/SessionConsole/WorldAudioEngine.tsx:163-195)

### 4.2 What players can do

- [x] Pan and zoom independently: wheel, Ctrl+wheel, Space-drag, pinch, two-finger pan, `+`/`-`. (source: src/components/Canvas/CanvasManager.tsx:92-101)
- [x] Select and drag visible tokens. Only x/y positions are sent back. The main process sanitises every World-to-Architect message down to `TOKEN_UPDATE {x,y}` or a single-level `BATCH`. Players cannot change any other property. Hidden NPCs cannot be grabbed. (source: src/utils/worldViewTokenSync.ts, electron/main.ts:1167-1173, src/components/SyncManager.tsx:307-330, 370-410)
- [ ] Blocked: drawing tools, file drops, calibration, transform (scale/rotate), Alt-duplicate, delete, door toggling and door context menu, measurement, grid hotkeys, and tool hotkeys. `?` still opens About. (source: src/components/Canvas/CanvasManager.tsx:92-101, 823-836, src/components/Canvas/hooks/useCanvasInteraction.ts:248-305, src/components/Canvas/DoorShape.tsx:102-122, src/App.tsx:243-246)

### 4.3 Sync model

- [ ] The Architect is the producer. It subscribes to store changes, diffs them into delta actions (TOKEN*ADD/UPDATE/REMOVE, TOKEN_DRAG*\_, DRAWING\_\_, DOOR*\*, STAIRS*\*, MAP_UPDATE, GRID_UPDATE, EXPLORED_UPDATE, MEASUREMENT_UPDATE, STAGE_UPDATE, AUDIO_UPDATE, SFX_FIRE, LIBRARY_UPDATE), throttles them to 32 ms, and switches to FULL_SYNC above 20 actions. (source: src/components/SyncManager.tsx:127-290, 472, src/utils/syncUtils.ts:136-240)
- [ ] On open, World View sends `REQUEST_INITIAL_STATE`. The Architect replies with FULL_SYNC (tokens, library, drawings, doors, stairs, grid, map, explored regions, daylight, measurement, session runtime). (source: src/components/SyncManager.tsx:298-304, 344-366, electron/main.ts:1160-1164, docs/features/world-view-sync-fix.md)
- [x] Switching maps on the Architect updates World View, which is covered by the pause overlay while paused. (source: src/components/LoadingOverlay.tsx:1-60)

**Native mapping:** Delete the whole sync layer. Both windows observe the same
`@Observable CampaignSession` in-process. World View is a different SwiftUI view on the same
model, with a `ViewerRole.player` that filters content and gates input. Keep the rule that
player-originated edits may only change token positions as an explicit API boundary, for example
`session.playerMoveToken(id:to:)`.

### 4.4 Loading / pause overlay

- [x] While paused, World View shows a full-screen black overlay at 90% with an 8 px backdrop blur, a spinner, "Please Wait", and a random flavour line (`LOADING_PAUSE_OVERLAY`). It sits above everything, including the minimap. It is never shown in the Architect. (source: src/components/LoadingOverlay.tsx:1-113, 87, src/App.tsx:508-509)

**Native mapping:** Use a `.overlay` with `.ultraThinMaterial` or a solid black view. For projector
output, also stop rendering the canvas while paused so nothing leaks during transitions.

**World View native mapping (window and display):** Add a "Show on Display" submenu that lists
`NSScreen.screens` (using `localizedName`). Move the World View window to the chosen screen and
toggle `toggleFullScreen(_:)` there. Exclude it from Mission Control cycling if wanted
(`collectionBehavior`). Keep it out of screenshots of the Architect. For Discord sharing, the
system window picker (ScreenCaptureKit) handles "share this window with audio" natively.

---

## 5. Campaign

### 5.1 Campaign and multiple maps

- [x] A campaign has an id, a name, maps (a dictionary), an activeMapId, a tokenLibrary and a sessionConsole catalog. A new campaign is named "New Campaign" with one map, "Map 1" or "Default Map". (source: src/store/gameStore.ts:153-161, 256-283)
- [x] Each map holds its own tokens, drawings, doors, stairs, background, grid size, type and colour, explored regions and daylight flag. (source: src/store/gameStore.ts:105-118)
- [x] Switch map from the sidebar list. The active map is synced into the campaign before switching. (source: src/store/gameStore.ts:692-728, src/components/Sidebar.tsx:303-330)
- [ ] Create a map with Map Settings in create mode: name (default "Untitled Map"), optional background image, grid type, grid colour and daylight. The new map becomes active. (source: src/components/MapSettingsSheet.tsx:183-210, src/store/gameStore.ts:603-630)
- [x] Rename a map in edit mode. An empty name is rejected with a toast. (source: src/components/MapSettingsSheet.tsx:211-220, src/store/gameStore.ts:730-750)
- [x] Delete map **(gap)** — `deleteMap` exists (it refuses to delete the last map and switches to the next or previous map first), but its only UI is `MapNavigator.tsx`, which nothing mounts. [Intended: a delete action for maps with confirmation.] (source: src/store/gameStore.ts:632-690, src/components/MapNavigator.tsx:20, 66)
- [ ] MapNavigator (not mounted) — A dropdown map switcher with inline rename (Enter/Esc), delete and add. Use it as a spec for map management UI, not as a current feature. (source: src/components/MapNavigator.tsx)
- [ ] There is no UI to rename the campaign itself. The name comes from the file or the template. (source: src/store/gameStore.ts, src/components/Sidebar.tsx:280)

**Native mapping:** Make maps an ordered list in the document's sidebar (`List` with `.onMove`,
`.contextMenu` with Rename, Duplicate and Delete, and a `.onDeleteCommand`). The campaign name
is the document name.

### 5.2 New / open / save / autosave

- [ ] File format `.graphium` — A ZIP with `manifest.json` (the campaign JSON) and `assets/` (every `file://` asset copied in with collision-safe basenames, including library thumbnails). (source: electron/main.ts:637-717)
- [x] Load — Unzips into a fresh `sessions/<timestamp>/` folder and rewrites asset paths to absolute URLs. Legacy single-map files (no `maps` key) are migrated into "Imported Campaign" / "Imported Map". A missing session console catalog is filled in. (source: electron/main.ts:719-799, 853-901, src/store/gameStore.ts:285-295, 490-518)
- [ ] Save — Always shows the native save dialog (Save-As semantics). It writes non-atomically and remembers the path for autosave. (source: electron/main.ts:817-832)
- [ ] Autosave — Every 60 s, only after a path is known (that is, after a save or load). Atomic `.tmp` + rename. Failures are silent. Web autosaves to IndexedDB. (source: src/components/AutoSaveManager.tsx:16-60, electron/main.ts:834-851)
- [ ] Asset security — Saving refuses assets outside the temp, sessions or library roots. A missing asset gives "Campaign asset file not found". (source: electron/main.ts:645-667, electron/pathSecurity.ts)
- [ ] New campaign from the menu asks for confirmation. Home "New Campaign" just enters the editor. (see 1.2 and 1.3)
- [x] Dirty-state tracking and "unsaved changes" prompts on close **(gap)** do not exist. Closing a window or quitting never warns. [Intended natively: standard document dirty tracking.]
- [ ] Compatibility — The native app must open existing `.graphium` ZIPs, legacy single-map manifests included. Native files may use `.graphiumcampaign` (see macos/README.md), but `.graphium` import and export are required for parity. (source: electron/main.ts:853-901)

**Native mapping:** `DocumentGroup` with a `ReferenceFileDocument` whose `FileWrapper` is a
directory package, or a ZIP via Apple Archive or ZIPFoundation, for `.graphium`. Autosave in
place, Versions, Revert, dirty dot, close prompts and Open Recent all come free. Register
`.graphium` as an imported UTType.

### 5.3 Asset library (persistent, cross-campaign)

- [ ] Storage — `userData/library/assets/{id}.webp`, `thumb-{id}.webp`, and `library/index.json`. On startup, library items are merged into the campaign's tokenLibrary with de-duplication by id. (source: electron/main.ts:905-960, src/App.tsx:177-218)
- [ ] Add to Library dialog — Preview, Name (required, placeholder "e.g., Red Dragon"), Category (PC, Monsters [default], NPCs, Props, Items, Custom), and Tags (comma-separated, trimmed, placeholder "e.g., dragon, red, large"). Generates a 128x128 WebP thumbnail. A toast reports the result. (source: src/components/AssetLibrary/AddToLibraryDialog.tsx:1-30, 42, 75-150, 216-270)
- [ ] Library Manager modal — Search (fuzzy), a category filter (All plus the categories in use), and a thumbnail grid. Each card has hover actions Edit and Delete, a click or "Add to map" action, and is draggable onto the canvas. The footer shows the asset count and an Upload button. (source: src/components/AssetLibrary/LibraryManager.tsx:1-25, 86, 108-160, 226-400)
- [ ] Delete asset — Asks for confirmation, then removes the files and index entry and shows a toast. (source: src/components/AssetLibrary/LibraryManager.tsx:151-170, electron/main.ts:962-983)
- [ ] Token Metadata Editor — Name (required), category (default Custom), tags, default scale (must be positive), default type PC/NPC, and default vision radius (must be at least 0, only shown for PC). Saves to the index and the store and shows a toast. Opened from Library Manager and the command palette. (source: src/components/AssetLibrary/TokenMetadataEditor.tsx:1-31, 84-125, electron/main.ts:985-1024)
- [ ] Token Inspector "Save to library" writes instance overrides back as defaults (see 2.3).
- [ ] Token images are resized to at most 512 px WebP. (source: src/utils/AssetProcessor.ts:7-9, 60-71)

**Native mapping:** Store the library in `Application Support/Graphium/Library/` as one folder per
asset with a JSON/Codable index, or use SwiftData. Present it as a sheet with `LazyVGrid`,
`.searchable` and a category `Picker`. Edit metadata in a form sheet. Drag out with
`Transferable`. Generate thumbnails with `QLThumbnailGenerator` or ImageIO.

### 5.4 Session Console (ambience and artwork board)

**What it is.** A DM-side "board" stored in the campaign. It holds image sets ("plates") and
groups of music tracks (YouTube or local audio), plus a few sound effects. The DM triggers them
from the sidebar. World View is the only output: it shows the plate full-window and plays the
audio, so the DM can share World View in Discord with "Include Audio". (source: src/types/sessionConsole.ts:1-80, src/components/SessionConsole/DiscordSetupHelp.tsx)

- [ ] Catalog model — Stage chrome (title, which defaults to the campaign name; subtitle; showFrame), defaults (volume 45, duck 27%), imageSets[{title, note, images[{name, cue, src, thumbnailSrc, alt}]}], trackGroups[{title, note, accent bed|road|dread|combat|arrive, tracks[{title, cue, tag, source youtube|local, youtubeId|src, volumeOffset ±30, loop, recommendedImageId}]}], and sfx (synth chime, drone, snap, ping, test-tone, plus local files). (source: src/types/sessionConsole.ts:7-110, 210-232)
- [ ] Master bar — World link status: "World closed", "World connected" or "World armed", with a colour. Also a volume slider from 0 to 100, Duck toggle, Pause, Resume, Restart, Stop, Return to Map, and Test Tone. (source: src/components/SessionConsole/SessionConsoleMasterBar.tsx:14-120, src/components/SessionConsole/useWorldLinkStatus.ts)
- [ ] "Copy current link" and "Copy all links" — Copy fallback track links (numbered, with YouTube URLs) to the clipboard, with a toast. (source: src/components/SessionConsole/SessionConsolePanel.tsx:44-62, src/utils/sessionConsoleBoard.ts:30-42)
- [ ] Board dropzone — Drop images and/or audio files. Image files go to an image set named after the folder. Audio goes to a track group. Audio over 8 MB warns and over 25 MB is rejected. (source: src/components/SessionConsole/SessionConsoleBoard.tsx:44-52, src/utils/sessionConsoleBoard.ts:255-298, src/utils/localAudioLimits.ts:3-9)
- [ ] Paste YouTube URL field — Accepts a paste or Enter. Parses raw 11-character ids and youtu.be, watch?v=, shorts, embed and v/ URLs. Playlist-only URLs are rejected. (source: src/components/SessionConsole/SessionConsoleBoard.tsx:54-90, src/types/sessionConsole.ts:150-190, src/utils/sessionConsoleBoard.ts:206)
- [ ] "Add from folder" (directory image picker), "New image set" and "New track group" buttons. (source: src/components/SessionConsole/SessionConsoleBoard.tsx:92-140)
- [ ] Image set board — Clicking a thumbnail shows that plate in World View (SHOW_PLATE). Thumbnails can be reordered by drag. Each has an edit button. Files can be dropped onto a set. (source: src/components/SessionConsole/ImageSetBoard.tsx:51-130)
- [ ] Track group list — Click Play on a track. Tracks can be reordered by drag. Each has an edit button. Files can be dropped onto a group. (source: src/components/SessionConsole/TrackGroupList.tsx:57-125)
- [ ] SFX buttons — One per catalog sfx (FIRE_SFX). (source: src/components/SessionConsole/SessionConsolePanel.tsx:110-120)
- [ ] Editor sheet — For a plate: Name, Cue and Alt text. For a track: Title, Cue, Tag (accent), Loop toggle, a volume-offset slider (±30) and a recommended plate (None or a plate). (source: src/components/SessionConsole/SessionConsoleEditorSheet.tsx:20-80, 126-215)
- [ ] Remove plate, track, set or group **(gap)** — Reducers exist (REMOVE_IMAGE, REMOVE_TRACK, REMOVE_IMAGE_SET, REMOVE_TRACK_GROUP), but no UI calls them. The same goes for renaming sets and groups (UPDATE_IMAGE_SET/UPDATE_TRACK_GROUP) and for `recommendedImageId`, which is stored but never acted on. [Intended: full board editing.] (source: src/store/sessionConsoleReducers.ts:21-44)
- [ ] Settings sheet — "Stage" (title, subtitle, Show frame), "Playback defaults" (default volume on load, duck percent), "Advanced: board pack" (Import replace, Import merge, Export pack, with a skipped/warnings summary), and "Table setup" (the Discord checklist: Krisp off, attenuation 0%, share World View with audio, play the test tone; plus the keyboard list). Also opened from the command palette. (source: src/components/SessionConsole/SessionConsoleSettingsSheet.tsx:1-49, src/components/SessionConsole/sessionConsoleSettingsSections.tsx:29-272, src/components/SessionConsole/DiscordSetupHelp.tsx:1-33)
- [ ] Board pack import — Pick `board.json`. Relative files are sandboxed to the pack folder and copied into temp assets. http(s) assets are fetched with a byte cap. YouTube is kept. Per-row errors are reported as skipped. Replace or merge into the catalog. Plate thumbnails are generated. (source: electron/sessionConsolePackIngest.ts:22-60, electron/sessionConsolePackFiles.ts:130-220, src/utils/sessionConsolePack.ts:569-1075, src/utils/sessionConsoleBoard.ts:149)
- [ ] Board pack export — Pick a folder. Writes `board.json` plus `images/` and `audio/` copies, and YouTube watch URLs. Reports "Board pack exported" or "finished with errors". (source: electron/sessionConsolePackFiles.ts:224-290, src/utils/sessionConsolePack.ts:1076-1125, docs/planning/session-console-pack.example.json)
- [ ] Runtime transport — PLAY_TRACK, PAUSE, RESUME, RESTART (bumps restartSeq), STOP, SET_VOLUME (0-100), SET_DUCKED, FIRE_SFX (bumps sfxSeq), SHOW_PLATE and RETURN_TO_MAP. (source: src/store/sessionConsoleReducers.ts:47-56, 665-779)
- [ ] World audio engine — The YouTube IFrame player or an `<audio>` element. Effective volume = clamp(volume + offset), multiplied by duck% when ducked. Fades: stop 500 ms, switch track 300 ms out then in, mixer change 250 ms. Looping follows the track. Audio is silent until armed. Load or play errors are reported back to the Architect as SESSION_CONSOLE_WORLD_EVENT (armed, unarmed, ready, error). (source: src/components/SessionConsole/WorldAudioEngine.tsx, src/components/SessionConsole/useWorldTransport.ts:41-198, src/components/SessionConsole/worldAudioYoutube.ts, src/types/sessionConsole.ts:117-131, electron/main.ts:1176-1182)
- [ ] Synth SFX — Web Audio oscillator recipes for chime, drone, snap, ping and test tone. Local SFX use decoded buffers that are cached. (source: src/components/SessionConsole/worldStageSfx.ts:6-161)
- [ ] Hotkeys `1` to `9`, `D` and `Esc` (see 1.4).
- [ ] The YouTube embed needs a non-`file://` origin and a Referer header, which is why the `graphium://` protocol and `YOUTUBE_EMBED_URL_FILTER` exist. (source: electron/main.ts:374-379, 1118-1123, electron/graphiumProtocol.ts)

**Native mapping:** Local audio maps to `AVAudioEngine` (`AVAudioPlayerNode` per bed, mixer volume
ramps for fades and ducking) and synth SFX to `AVAudioSourceNode` oscillators. YouTube is the
hard part: use a hidden `WKWebView` hosting the IFrame API with
`mediaTypesRequiringUserActionForPlayback = []` and a custom `WKURLSchemeHandler` origin plus
Referer. "Arming" is not needed natively, because AVAudioEngine has no autoplay gate. Keep a
"World audio ready" status instead. Audio is owned by the app process, so Discord window-share
audio capture works as long as World View is the shared window. On macOS 13 and later,
ScreenCaptureKit app-audio capture is per application, not per window. Document this for DMs.

### 5.5 Dungeon generator

- [ ] Dialog — Number of rooms (3-15, default 5), Min room size (2-6, default 3), Max room size (4-12, default 8), and a "Clear existing walls and doors" toggle. Note: "drawn using the Wall tool... fully interactive". Cancel and Generate buttons, with Generate focused on open. Opened from the menu, the palette, the home card, `Cmd+G` on home, and the mobile More menu. (source: src/components/DungeonGeneratorDialog.tsx:16-198, src/components/DungeonGeneratorDialogGate.tsx)
- [ ] Algorithm — Organic growth: a central room, then repeated "random existing room + corridor (4 cells long, 1 wide) + new room" with collision retry. Everything is grid-aligned to the current gridSize. The canvas size is the window size. (source: src/utils/DungeonGenerator.ts:151-200, docs/DUNGEON_GENERATOR.md)
- [ ] Output — Wall drawings (red, 8 px) and doors added to the active map, so fog works immediately. No stairs and no map image. (source: src/components/DungeonGeneratorDialog.tsx:44-80)

**Native mapping:** Port DungeonGenerator to GraphiumCore with a seedable RNG
(`RandomNumberGenerator`), which makes it testable. Show a SwiftUI sheet with `Stepper`s. Add
the generated content as one undoable edit.

---

## 6. Platform and device behaviours to reproduce

- [ ] Unified pointer pipeline — Mouse, pen and touch go through the same handlers. Multi-touch (2 or more fingers) is handled separately for pinch and pan. (source: src/components/Canvas/CanvasManager.tsx:701-712, src/components/Canvas/hooks/useCanvasInteraction.ts:226-352)
- [ ] Pen pressure maps to stroke width through a selectable curve (light, normal, heavy). Pressure sensitivity can be toggled (default on). (source: src/store/touchSettingsStore.ts:1-20, 116-118, src/components/Canvas/CanvasManager.tsx:139-141)
- [ ] Palm rejection modes: off, touchSize (reject contact over 40 px, the default), stylusOnly (ignore touch once a pen has been seen), smartDelay (ignore touch for 300 ms after the pen lifts). There is also a desktop-only mode that ignores all touch. (source: src/store/touchSettingsStore.ts:21-30, 120-130, 177-215, src/components/Canvas/hooks/useCanvasInteraction.ts:186-223)
- [ ] Touch settings persist in localStorage `graphium-touch-settings`, but there is no settings UI (PreferencesDialog was removed). **(gap)** [Intended: a Settings pane.] (source: src/store/touchSettingsStore.ts:219, CHANGELOG.md "Removed")
- [ ] Documented but not implemented in source — Tilt shading, hover preview, barrel-button tool switching and eraser-end. Flags exist (`tiltSensitivityEnabled`, `hoverPreviewEnabled`, `barrelButtonEnabled`), but no code reads tilt, hover or `button`. DEVICE_COMPATIBILITY.md lists them as supported. Treat them as new work if wanted. (source: src/store/touchSettingsStore.ts:62-66, 131-135, DEVICE_COMPATIBILITY.md:125-174)
- [ ] Touch targets — Mobile menu button at least 48x48, mobile toolbar buttons at least 56 tall, inspector buttons at least 44 tall, home quick actions at least 44. Enforced by tests. (source: tests/touch-targets.spec.ts, src/components/TokenInspector.tsx:246, src/components/HomeScreen.tsx:1739)
- [ ] Suppressed browser behaviours on the canvas — `touch-action: none`, no text selection, no iOS callout. (source: src/components/Canvas/CanvasManager.tsx:1126-1137)

**Native mapping:** On macOS, the relevant inputs are the mouse, Magic Trackpad (gesture events,
not raw touches), Wacom/Huion tablets (`NSEvent.pressure`, `.tilt`, `.subtype == .tabletPoint`,
`pointingDeviceType == .eraser` for eraser-end, `buttonMask` for barrel buttons), and Sidecar with
Apple Pencil, which arrives as tablet events with pressure. Palm rejection is not needed on macOS
because there are no direct touch screens. Collapse the four modes into a "Tablet" settings group
(pressure curve, pressure on/off). Use `NSTouch` only if raw trackpad touches are wanted.

---

## 7. Accessibility

- [ ] WCAG 2.1 AA contrast for all UI text and controls, using Radix Colors steps 11-12 on steps 1-3 and borders at 3:1 or better. Disabled text is intentionally below AA. The canvas is exempt. Checked with axe-core in Playwright. (source: docs/features/wcag-audit.md, tests/accessibility.spec.ts)
- [ ] World View projector legibility test (see 4.1). (source: tests/world-legibility.spec.ts)
- [ ] Dialogs and sheets trap focus, close on Esc and expose `role="dialog"`. Templates restores focus. (source: CHANGELOG.md "Every dialog and sheet now traps focus", src/components/HomeScreen.tsx:228-273)
- [ ] ARIA — Labelled icon buttons throughout (for example "Select tool", "Pause game", "Close notification", "Remove {name} from recent campaigns", "Session volume", "Show plate {name}"). Tool buttons use `aria-pressed`. The active map uses `aria-current`. Disclosures use `aria-expanded`. (source: src/components/Toolbar.tsx:92-196, src/components/Sidebar.tsx:320-322, src/components/Toast.tsx:91, src/components/SessionConsole/sessionConsoleSettingsSections.tsx:212)
- [ ] Reduced motion — Durations drop to 0 under `prefers-reduced-motion`. WorldStage plate crossfade and YouTube fades are skipped. The home "Lite mode" is a manual equivalent. (source: src/styles/theme.css:404-410, src/components/SessionConsole/WorldStage.tsx:41, 71, src/components/SessionConsole/worldAudioYoutube.ts:189)
- [ ] Image alt text for plates (an editable "Alt text" field). (source: src/components/SessionConsole/SessionConsoleEditorSheet.tsx:213, src/components/SessionConsole/WorldStage.tsx:24-30)
- [ ] Canvas accessibility is absent today. Tokens and doors are not exposed to assistive technology. Consider adding this natively (see the mapping).

**Native mapping:** Use system colours and semantic fonts so Increase Contrast and Dynamic Type work.
Honour `NSWorkspace.accessibilityDisplayShouldReduceMotion` and `accessibilityReduceMotion`.
Expose tokens and doors as `NSAccessibilityElement` children of the canvas view, with label =
name and type, and role button for doors, plus an action to toggle. VoiceOver can then read the
board. Use `.accessibilityLabel` on every SwiftUI icon button.

---

## 8. Explicitly web/Electron-only (do not port)

Each item lists the decision and the reason.

- **IPC sync layer** (`SyncManager`, `syncUtils` deltas/FULL*SYNC/throttle, `REQUEST_INITIAL_STATE`, `SYNC_WORLD_STATE`, `SYNC_FROM_WORLD_VIEW`, `rafSync`, `syncStamp`). \_Drop.* Both windows share one in-process model. Keep only the rule that player input may change token positions and nothing else, as an API boundary. (source: src/components/SyncManager.tsx, src/utils/syncUtils.ts, electron/main.ts:1156-1200)
- **BroadcastChannel sync and the web `?type=world` new tab.** _Drop._ This is the web equivalent of IPC. (source: src/components/SyncManager.tsx:81-82, src/App.tsx:600-601)
- **Main-process pause relay** (`TOGGLE_PAUSE`, `GET_PAUSE_STATE`, `PAUSE_STATE_CHANGED`) and **theme IPC** (`get-theme-state`, `set-theme-mode`, `themeAPI`). _Drop._ Use shared observable state and `NSApp.appearance`. (source: electron/main.ts:1029-1046, electron/preload.ts:212)
- **electron-updater / `autoUpdater` preload API.** _Replace with Sparkle 2._ (source: electron/autoUpdater.ts, electron/preload.ts:277)
- **electron-store** (window bounds, theme). _Replace_ with `NSWindow` frame autosave and `@AppStorage`/`UserDefaults`. (source: electron/main.ts:81-90, electron/themeManager.ts)
- **`media://` and `graphium://` custom protocols, the path sandbox for them, and `contentTypeFor*`.** _Drop_ for assets, which load from file URLs or the document package directly. _Keep the idea_ only for the YouTube `WKWebView` (custom scheme plus Referer). (source: electron/main.ts:95-118, 568-631, electron/graphiumProtocol.ts, electron/pathSecurity.ts)
- **`temp_assets/` and `sessions/<timestamp>/` unpacking, and quit cleanup.** _Drop._ A package document (or a ZIP read in memory) owns its assets. Use `FileManager.temporaryDirectory` for scratch files. Keep the asset-path security idea when importing board packs. (source: electron/main.ts:753-799, 1219-1253)
- **WebStorageService** (IndexedDB, OPFS, File System Access API, browser-download save, YouTube-only web pack export) and the **storage-init failure screen**. _Drop._ There is only one native storage backend. (source: src/services/WebStorageService.ts, src/services/IStorageService.ts, src/main.tsx:22-95)
- **Download-the-desktop-app banner and the "Web Edition" label.** _Drop._ (source: src/components/HomeScreen.tsx:455-482, 705-707)
- **Mobile layouts** (hamburger, MobileSidebarDrawer, MobileToolbar, MobileBottomSheet, `useIsMobile`/`useIsTablet`). _Drop._ A Mac window should keep its desktop layout. Set a minimum window size (for example 900x600) and let the sidebar and inspector collapse instead. An iPad port would revisit this. (source: src/App.tsx:533-556, 610-618, src/components/MobileToolbar.tsx, src/hooks/useMediaQuery.ts:53-75)
- **Palm-rejection modes and the touch pinch-threshold setting.** _Drop or reduce._ macOS has no touchscreen, and trackpad gestures arrive pre-classified. Keep the pressure curve. (source: src/store/touchSettingsStore.ts)
- **Electron View roles: Reload, Force Reload, Toggle DevTools, page Zoom.** _Drop._ Remap zoom to canvas zoom. (source: electron/main.ts:285-291)
- **Single-instance lock and argv `.graphium` parsing.** _Drop._ Launch Services guarantees one instance and delivers opens through `application(_:open:)`. (source: electron/main.ts:476-496)
- **React error boundaries** (Privacy, Token, Overlay, Minimap, Library modal, Asset processing, Update). _Drop as a mechanism._ Keep the user-facing parts: the privacy-sanitised report, Report on GitHub, Save Report and the stored-errors list (see 1.10). (source: src/components/\*ErrorBoundary.tsx)
- **Web Worker image processor and the cancellable ProcessingHandle.** _Replace_ with Swift concurrency (`Task` cancellation) and ImageIO. (source: src/utils/AssetProcessor.ts, src/workers/image-processor.worker.ts)
- **Design System Playground route `/design-system`, the Agentation dev toolbar, the React profiler, the stress fixture, `LOG_TO_TERMINAL` and `main-process-message`.** _Drop,_ or port as `#if DEBUG` previews (SwiftUI `#Preview` replaces the playground). (source: src/App.tsx:36-57, 397-411, src/perf/profiler.tsx, src/utils/stressFixture.ts, electron/main.ts:367-372, 1202-1207)
- **The IPC part of the Resource Monitor (IPC msgs/s, bytes/s, active workers).** _Drop._ It has no meaning without IPC. Keep FPS, memory and counts in a debug HUD. (source: src/components/ResourceMonitor.tsx:40-47)
- **The YouTube "Arm audio" user-gesture gate.** _Drop as a gate._ Native audio has no autoplay policy. Keep a status indicator, and keep a one-time WKWebView warm-up if YouTube needs it. (source: src/components/SessionConsole/WorldAudioEngine.tsx:163-195, src/components/SessionConsole/useWorldYouTubeArm.ts)
- **Unmounted or dead components** (`MapNavigator`, `GlobalErrorBoundary`, `DungeonGeneratorErrorBoundary`, `TouchVisualFeedback`, and the unused shadcn `dropdown-menu`/`popover`/`select`/`slider` primitives). _Do not port as-is._ Use them only as design references where noted above.
