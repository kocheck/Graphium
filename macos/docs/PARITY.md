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

- [x] Architect window — The main DM window. It has the full UI (sidebar, toolbar, inspector, canvas) and is the single source of truth for state. (source: electron/main.ts:335, src/App.tsx:126) **Native:** DocumentGroup window per campaign; the campaign document is the single source of truth.
- [x] Architect window bounds persistence — Window size and position are saved (debounced 400 ms on resize/move, and on close) and restored on launch. The default size is 1200x800. (source: electron/main.ts:336-365) **Native:** AppKit restores document window frames and reopens windows on relaunch (state restoration); default size is the system's.
- [x] World View window — A second window loads the same app with `?type=world`. It renders only the canvas plus player-safe overlays. (source: electron/main.ts:410-430, src/utils/useWindowType.ts)
- [x] World View singleton — Opening World View while it is already open focuses the existing window instead of creating a second one. (source: electron/main.ts:412-415)
- [x] World View opens from: menu View > World View (Projector) `Cmd+Shift+W`, the command palette "Launch World View Window", and the mobile toolbar "More" menu. The desktop toolbar has no World View button. (source: electron/main.ts:269-273, src/utils/commandRegistry.ts:125, src/components/MobileToolbar.tsx:84) **Native:** Also a toolbar button and the Session Console link light. No mobile toolbar on macOS.
- [x] World View skips the home screen and always starts in the editor. (source: src/App.tsx:135)
- [x] macOS app lifecycle — Closing every window does not quit the app on macOS. Clicking the Dock icon re-creates the main window. (source: electron/main.ts:435-449) **Native:** With no windows open (none minimised), a Dock click opens the Welcome window.
- [x] Single instance — A second launch focuses the existing window and forwards any `.graphium` path in argv. (source: electron/main.ts:477-496) **Native:** LaunchServices keeps one instance; Finder opens and `open` forward to it.
- [x] Open from Finder **(gap)** — `open-file` and argv paths are sent as `OPEN_FILE_FROM_OS`, but no renderer code listens and there is no `fileAssociations` entry in electron-builder.json5. [Intended: double-clicking a `.graphium` file opens it.] (source: electron/main.ts:452-474, 1139-1154)
- [x] Quit cleanup — Before quitting, the app waits for in-flight saves and autosaves, then deletes `temp_assets/` and every session folder except the active one. (source: electron/main.ts:1219-1253, electron/campaignWriteGate.ts) **Native:** NSDocument finishes saves and autosaves before quit. The native format keeps assets in the package, so there are no temp or session folders to clean.

**Native mapping:** Use a `DocumentGroup` (or `NSDocument`) for the Architect window, which gives
frame autosave for free via `NSWindow.setFrameAutosaveName`. Make World View a singleton
`Window` scene (or an `NSWindowController`) opened with `openWindow(id:)`, and drive it from the
same in-process model instead of a second process. Use `NSApplicationDelegate.application(_:open:)`
together with `CFBundleDocumentTypes`/`UTExportedTypeDeclarations` for Finder opens.
`applicationShouldTerminateAfterLastWindowClosed` returns `false`. For quit cleanup, use
`applicationShouldTerminate` returning `.terminateLater` until writes finish.

### 1.2 Home screen (Architect only)

- [x] Hero — The logo lockup, the title "Virtual Tabletop for {random subtitle}" (23 options, fixed per session) and the tagline. (source: src/components/HomeScreen.tsx:130-156, 445-457) **Native:** Welcome window (`Shell/WelcomeView.swift`), same 23 subtitles. The tagline reads "Two windows, fog of war, your files. No accounts, no subscriptions." and each quick-action card shows its shortcut.
- [x] New Campaign card — Enters the editor with the current (default) campaign. (source: src/components/HomeScreen.tsx:165-167, 494-508) **Native:** Opens a new campaign window.
- [x] Load Campaign card — Opens the file picker. On success it loads the campaign, adds it to recents, enters the editor and shows a success toast. Errors show an error toast. (source: src/components/HomeScreen.tsx:169-185) **Native:** System open panel; success needs no toast (the window opening is the feedback). Errors use the system alert.
- [x] Generate Dungeon card — Enters the editor, then opens the Dungeon Generator dialog after a 100 ms delay. (source: src/components/HomeScreen.tsx:187-193, 524-532) **Native:** New campaign, then the dialog after 100 ms (`LaunchIntent`).
- [x] Templates card and modal — Four templates: Classic Dungeon, Wilderness Map, Starting Tavern, Combat Arena. Choosing one resets to a new campaign and sets grid cell size to 50. The width/height values are reference only. A toast confirms. The modal traps focus, closes on Esc or backdrop click, and restores focus afterwards. (source: src/components/HomeScreen.tsx:68-97, 228-273, 389-401, 536-544, 722-760) **Native:** Native also names the first map after the template.
- [x] Onboarding entry — The "New to Graphium? Learn the basics" button opens the About modal on its Tutorial tab. There is no other onboarding flow. (source: src/components/HomeScreen.tsx:548-560) **Native:** Opens About on the Tutorial tab.
- [x] Recent campaigns list — Shows name and last-opened date/time, plus a remove (x) button. Stored in localStorage `graphium-recent-campaigns`, capped at 3. (source: src/components/HomeScreen.tsx:563-622, src/utils/recentCampaigns.ts:37-38) **Native:** Uses the system recents (NSDocumentController), shown with last-opened date and an x that hides an entry until the campaign is opened or saved again (like TS remove then re-add). Shows up to the system limit (10), not 3.
- [x] Open a recent campaign **(gap)** — Clicking a recent entry only shows an info toast telling you to use Load Campaign. [Intended: it reopens the file.] (source: src/components/HomeScreen.tsx:317-322) **Native:** Fixed: a recent entry reopens the file.
- [x] Recent search **(gap)** — The search box appears only when there are 6 or more recents, so it never appears while the list is capped at 3. [Intended: a filter for a long recents list.] (source: src/components/HomeScreen.tsx:571-583) **Native:** Fixed: the search field appears at 6 or more recents, which the system list can reach.
- [x] Footer links — GitHub, About, Report Bug (GitHub issues), Help (?) which opens About on the Shortcuts tab, and Design System (dev-only). (source: src/components/HomeScreen.tsx:628-671) **Native:** GitHub, About, Report Bug, Help. Design System is dev-only and not ported.
- [x] Footer theme cycle button — Cycles Light, Dark, Auto (system). The icon and label show the current mode. (source: src/components/HomeScreen.tsx:348-387, 672-682)
- [x] Footer Lite/Full mode toggle — Turns home-screen animations off or on. Persisted in localStorage `liteMode`. A toast confirms. (source: src/components/HomeScreen.tsx:336-346, 684-700) **Native:** Not ported: the Welcome window has no animations to turn off. Reduce Motion is honoured instead.
- [x] Version footer — "Version X · Desktop|Web Edition". (source: src/components/HomeScreen.tsx:705-707) **Native:** "Version X · macOS Edition".
- [x] Home keyboard shortcuts — `Cmd/Ctrl+N` new, `Cmd/Ctrl+O` load, `Cmd/Ctrl+G` generate dungeon, `Cmd/Ctrl+T` templates, `?` About on the Shortcuts tab, `Esc` closes templates or About. (source: src/components/HomeScreen.tsx:276-315) **Native:** ⌘N/⌘O are the File menu; Generate Dungeon is ⇧⌘D and Templates ⇧⌘T (⌘G is Find Next on macOS); ? opens Shortcuts; Esc closes the Templates sheet.

**Native mapping:** Use a SwiftUI welcome window (like Xcode's "Welcome to Xcode") or the
`DocumentGroup` launch scene, with recents from `NSDocumentController.recentDocumentURLs`. That
fixes both recents gaps for free. Templates map to "New from template" in the File menu. Lite
mode becomes respecting `accessibilityReduceMotion`.

### 1.3 Menus (Electron application menu)

- [x] App menu (macOS) — About, Services, Hide, Hide Others, Show All, Quit. (source: electron/main.ts:167-184) **Native:** Standard app menu; About opens the in-app About window.
- [x] File > New Campaign `Cmd+N` — Asks for confirmation ("Create a new campaign? Any unsaved changes will be lost.") and then resets to a new campaign. (source: electron/main.ts:190-199, src/App.tsx:351-362) **Native:** Native: ⌘N opens a new campaign window, so there is nothing to lose and no confirmation.
- [x] File > Open Campaign... `Cmd+O` — Uses the native open dialog filtered to `.graphium`. Loads the campaign, adds it to recents and shows a toast. (source: electron/main.ts:200-209, src/App.tsx:323-341) **Native:** Opens .graphiumcampaign and legacy .graphium; recents come from the system.
- [x] File > Save Campaign `Cmd+S` — Syncs the active map into the campaign, then always shows the native save dialog (there is no silent re-save to the current path). Adds to recents and shows a toast. This is the only manual-save entry point in the app. (source: electron/main.ts:210-219, 817-832, src/App.tsx:301-321) **Native:** Native: standard document saving. ⌘S saves in place after the first save, autosave runs continuously, and Save As/Duplicate are available. Export as .graphium (⇧⌘E) writes the legacy format.
- [x] File > Close (macOS) or Quit. (source: electron/main.ts:221)
- [x] Insert > Generate Dungeon... — Opens the Dungeon Generator dialog. (source: electron/main.ts:225-239, src/App.tsx:347-349) **Native:** ⇧⌘D, the same key as the Welcome card (⇧⌘G is Find Previous on macOS).
- [x] View > Theme > Light / Dark / System — Radio items. The choice is persisted and broadcast to all windows. (source: electron/main.ts:243-267) **Native:** View > Theme picker; applies app-wide.
- [x] View > World View (Projector) `Cmd+Shift+W`. (source: electron/main.ts:269-273)
- [x] View > Performance Monitor `Cmd+Shift+M` — Toggles the resource monitor overlay. (source: electron/main.ts:274-283, src/App.tsx:343-345)
- [x] View > Reload, Force Reload, Toggle DevTools, Reset Zoom, Zoom In, Zoom Out, Toggle Full Screen (Electron roles). (source: electron/main.ts:285-293) **Native:** Electron roles (reload, DevTools, page zoom) do not apply. Enter Full Screen is the standard View item.
- [x] Window > Minimize, Zoom, Bring All to Front, Window list. (source: electron/main.ts:297-312) **Native:** Standard Window menu, plus Window > Welcome to Graphium (⇧⌘1).
- [x] About menu item handler — The renderer listens for `MENU_SHOW_ABOUT`, but no menu item sends it. The macOS app menu uses the stock `role: 'about'`. [Intended: About opens the in-app About modal.] (source: src/App.tsx:364-366, 380) **Native:** Fixed: About Graphium opens the in-app About window.

**Native mapping:** Use SwiftUI `.commands` with `CommandGroup(replacing: .newItem / .saveItem)`,
`CommandMenu("Insert")`, a Theme `Picker` in View, and `Cmd+Shift+W` and `Cmd+Shift+M` via
`.keyboardShortcut`. Reload and DevTools have no native meaning (see section 8). Map
Reset/Zoom In/Zoom Out to canvas zoom commands (`Cmd+0`, `Cmd+=`, `Cmd+-`). Use the system
Full Screen. Save, Save As and Revert come from `DocumentGroup`.

### 1.4 Keyboard shortcuts (complete list of keydown handlers)

All single-key shortcuts are ignored while typing in an input or textarea. **Native:** The canvas takes focus when its window opens, and a window-level key monitor sends canvas keys to it while another non-text control (sidebar list, toolbar, inspector picker) has focus. Text fields and focusable panels with their own keys (the Session Console) keep them. Window blur or the canvas losing focus releases hold-Space and hold-M.

- [x] `?` / `Shift+/` — Opens the About modal. In the editor it opens the About tab. On the home screen it opens the Shortcuts tab. Works in both windows. (source: src/App.tsx:237-241, src/components/HomeScreen.tsx:297-301) **Native:** Opens About from either window (canvas key); on Welcome it opens Shortcuts.
- [x] `V` Select, `M` Marker, `E` Eraser, `W` Wall, `D` Door — Architect only. (source: src/App.tsx:257-272)
- [x] `R` — Measure tool. When the Door tool is active, `R` rotates door orientation instead. (source: src/App.tsx:273-281)
- [x] Arrow keys with the Door tool active — Toggle door orientation, with page scroll suppressed. (source: src/App.tsx:249-255)
- [x] `I` — Opens the marker colour picker. (source: src/App.tsx:282-284) **Native:** Opens the system colour panel and switches to Marker.
- [x] Hold `M` — Shows the movement-range overlay for the selected token. Released on keyup or window blur. Note that pressing `M` also switches to the Marker tool (see App.tsx), so the two behaviours fire together. Reconcile this natively, for example with hold-`M`-while-Select. (source: src/components/Canvas/CanvasManager.tsx:607-610, 650-652) **Native:** Reconciled: with the Select tool and a selection, holding M shows the range and does not switch tools; otherwise M selects Marker.
- [x] `1` to `5` — Grid type: Square Lines, Square Dots, Hexagonal, Isometric, Hidden. Each shows a toast. Architect only, no key repeat. (source: src/components/Canvas/CanvasManager.tsx:613-635) **Native:** Toast shows the grid type.
- [x] `Delete` / `Backspace` — Removes the selected tokens, drawings and doors. Blocked in World View. (source: src/components/Canvas/CanvasManager.tsx:566-576) **Native:** Mixed selections of tokens, strokes and doors delete together. World View has no delete.
- [x] `Esc` — Clears the active measurement. Blocked in World View. (source: src/components/Canvas/CanvasManager.tsx:579-586)
- [x] `Esc` — Stops Session Console audio when nothing else owns Escape: no palette, confirm, dungeon dialog, calibration, active measurement, focused text field or modal. Capture phase. Architect only. (source: src/components/SessionConsole/useSessionConsoleHotkeys.ts:38-89, src/App.tsx:517-521) **Native:** Esc on the canvas with nothing to cancel stops the music; Esc in the Session Console always stops.
- [x] Hold `Space` — Pan mode. The stage becomes draggable and the cursor changes to grab/grabbing. (source: src/components/Canvas/CanvasManager.tsx:589-592, 415-429)
- [x] `=` / `+` / `Numpad+` zoom in, `-` / `Numpad-` zoom out — Zooms around the viewport centre by a factor of 1.1. (source: src/components/Canvas/CanvasManager.tsx:594-604, 526-539)
- [x] Hold `Alt` (Option) — Duplicate-on-drag mode for tokens and drawings, with ghosts shown. Disabled in World View. (source: src/components/Canvas/CanvasManager.tsx:555-557, 640-642) **Native:** The original stays and the copy follows the pointer; snap preview shown.
- [x] `Shift` while drawing — Locks the stroke to the horizontal or vertical axis. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:520-531)
- [x] `Shift` + click / `Shift` + marquee — Additive selection. Shift-click toggles a token in or out of the selection. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:347-350, 683-691, src/components/Canvas/hooks/useTokenDrag.ts:411-417)
- [x] `Cmd/Ctrl+P` and `Cmd/Ctrl+K` — Open the command palette. (source: src/hooks/useCommandPalette.ts:25) **Native:** ⌘K and ⌘P (Print is removed from the File menu).
- [x] Command palette keys — `Esc` close, `Enter` run the highlighted item, `Up`/`Down` move while skipping section headers. (source: src/components/AssetLibrary/CommandPalette.tsx:182-228)
- [x] Confirm dialog — `Enter` confirms. Cancel has initial focus. `Esc` cancels. (source: src/components/ConfirmDialog.tsx:27-55) **Native:** Native confirmation dialogs: Return confirms the default, Esc cancels.
- [x] Map rename field — `Enter` commits, `Esc` cancels. This lives in the unmounted MapNavigator (see section 5.1). (source: src/components/MapNavigator.tsx:55-57) **Native:** Rename uses an alert text field: Return commits, Esc cancels.
- [x] Session Console panel focus — `1` to `9` play tracks in board order. `D` ducks or unducks. Only active while focus is inside the panel. (source: src/components/SessionConsole/useSessionConsoleHotkeys.ts:91-130)
- [x] Menu accelerators — `Cmd+N`, `Cmd+O`, `Cmd+S`, `Cmd+Shift+W`, `Cmd+Shift+M`. (source: electron/main.ts:192-277) **Native:** Plus ⇧⌘E export, ⇧⌘D dungeon, ⇧⌘P pause, ⌘K/⌘P palette.
- [x] Home screen — `Cmd+N`, `Cmd+O`, `Cmd+G`, `Cmd+T`, `?`, `Esc` (see 1.2). (source: src/components/HomeScreen.tsx:276-315)
- [x] Ctrl/Cmd + scroll wheel — Zoom at the pointer. Plain wheel pans. (source: src/components/Canvas/CanvasManager.tsx:978-1006)
- [x] About modal Shortcuts tab content — Lists `V`, `M`, `E`, `W`, `I`, `Shift` (lock axis) and `?`. It omits `D`, `R`, `1` to `5`, `Space`, `Alt`, `Delete`, `+`/`-` and `Cmd+K/P`. The native help should list the full set above. (source: src/components/AboutModal.tsx:437-470) **Native:** Fixed: Help > Keyboard Shortcuts lists every key.
- [x] README shortcut list — Also documents `Cmd+S`, `Cmd+O`, `D`, `1` to `5` and hold-`M`. (source: README.md "Keyboard Sigils")

**Native mapping:** Handle tool keys in `NSView.keyDown` / `performKeyEquivalent` on the canvas, or
with SwiftUI `.onKeyPress`, gated on first responder not being a text field. Use
`flagsChanged(with:)` for Option, Space-hold and M-hold. Put every shortcut in menu items, so
the macOS Help menu search and the system shortcuts overlay show them.

### 1.5 Command palette (Architect only)

- [x] Spotlight-style modal — A search field ("Search actions and assets...") autofocused, with results grouped into Actions and Assets section headers. (source: src/components/AssetLibrary/CommandPalette.tsx:1-25, 253)
- [x] Action registry — Select, Marker, Eraser, Wall, Door and Measure tools; Pause/Resume World View; Launch World View; Generate Dungeon; Session Console: Stop, Duck, Return to Map, Test Tone, Settings. Each has keywords and a shortcut hint. (source: src/utils/commandRegistry.ts:61-195)
- [x] Weighted fuzzy command search — Label x3, keywords x2, category x1. (source: src/utils/commandRegistry.ts)
- [x] Asset search — Fuzzy subsequence match on library item name and tags. Choosing an asset places a library-linked token at the map centre, or (500, 500) when there is no map. (source: src/utils/fuzzySearch.ts, src/utils/tokenHelpers.ts:19-41, src/components/AssetLibrary/CommandPalette.tsx:159)
- [x] Edit asset from palette — An edit button on an asset result opens TokenMetadataEditor. (source: src/components/AssetLibrary/CommandPalette.tsx:70-71, 406)
- [x] Also opened by the Sidebar Library "Place" button. (source: src/components/Sidebar.tsx:379-387)

**Native mapping:** Use a SwiftUI sheet or an `NSPanel` floating palette with a `List` and
`.searchable`. Commands are best modelled as one `[Command]` source that also drives the menus.

### 1.6 Toasts

- [x] A single toast at a time at the top centre. Types are error, success and info. It auto-dismisses after 5 s, has a close button with an aria-label, and slides down. A new toast replaces the current one. (source: src/components/Toast.tsx:1-100, 54-56) **Native:** Architect window: one toast at a time, top centre, info/success/error, close button, 5 s.
- [x] Flavour text — Most messages come from `rollForMessage(KEY)`, which picks randomly from 32 themed message pools (for example CAMPAIGN_SAVE_SUCCESS and LOADING_PAUSE_OVERLAY) with `{placeholder}` substitution. (source: src/utils/systemMessages.ts:390) **Native:** All 32 pools ported verbatim (`SystemMessages.swift`).

**Native mapping:** Use a custom SwiftUI overlay banner (`.overlay(alignment: .top)` with a
transition), and post `NSAccessibility.announcementRequested` for VoiceOver. Move the message
pools into a `Localizable.xcstrings` string catalog with variants.

### 1.7 Confirm dialogs

- [x] Store-driven confirm — Takes a message, an optional confirm label, and Cancel + Confirm buttons, with Confirm styled as destructive. Cancel gets initial focus. `Enter` confirms. Used by New Campaign, Reset Map, Delete Library Asset and Delete Map. (source: src/components/ConfirmDialog.tsx, src/store/gameStore.ts:868-870) **Native:** Native confirmationDialog with a destructive confirm button.

**Native mapping:** Use `.confirmationDialog` or `NSAlert` with `hasDestructiveAction`, or
`.alert` with `role: .destructive`. Consider undo instead of confirm where possible.

### 1.8 About modal

- [x] Three tabs: About, Tutorial, Shortcuts. The initial tab is selectable by the caller, and the tab resets when the modal reopens. (source: src/components/AboutModal.tsx:17-20, 202-209, 246-248)
- [x] About tab — Themed description, the version, a "Consult the Archives" button that opens the Update Manager (only when a callback is given, which happens in the editor and not on home), and a "View Source on GitHub" link. (source: src/components/AboutModal.tsx:256-308) **Native:** Version and GitHub link. No "Consult the Archives" button until updates ship (see 1.9).
- [x] Tutorial tab — "Core Powers" bullet list, six feature cards (Dual Windows, Fog of War, Dungeon Generator, Local-First, Drawing Tools, Asset Library) and a screenshot showcase. (source: src/components/AboutModal.tsx:313-433) **Native:** Core Powers, six feature cards and two screenshots.
- [x] Shortcuts tab — A shortcut list plus feature cards. **(gap)** The Shortcuts block is rendered twice (lines 437 and 569). [Intended: render it once.] (source: src/components/AboutModal.tsx:437-603) **Native:** Fixed: rendered once, and it lists the full shortcut set.
- [x] Footer — "May your rolls be ever in your favor, Dungeon Master." (source: src/components/AboutModal.tsx:607-609)

**Native mapping:** Use a custom About window (an `NSApplication` About panel with credits for the
basic part), plus a Help book or a SwiftUI `Window("Getting Started")` with a `TabView` for the
tutorial and shortcuts.

### 1.9 Update manager

- [ ] Modal workflow — Check for updates, then on "update available" show the version and a Download button, then a progress bar with percent and speed (bytes/s), then "Restart & Install". There is also an "up to date" state and an error state. Messages are randomised. It is disabled in dev and on web. (source: src/components/UpdateManager.tsx:1-30, 152-280, electron/autoUpdater.ts:18-49, 185-244) **Native:** Deferred: Sparkle updates need a signed, notarised build and a feed (Apple Developer credentials).
- [ ] Download is never automatic. The update installs on quit once downloaded. (source: electron/autoUpdater.ts:43-46) **Native:** Deferred with Sparkle.
- [ ] An error boundary around the Update Manager shows a retry fallback instead of crashing the app. (source: src/components/UpdateManagerErrorBoundary.tsx, src/components/UpdateErrorFallbackUI.tsx) **Native:** Deferred with Sparkle.

**Native mapping:** Use Sparkle 2 (`SPUStandardUpdaterController`) with a "Check for Updates..." menu
item in the app menu. Sparkle provides its own UI, progress and relaunch. Turn off automatic
downloads to match.

### 1.10 Error boundaries and error reporting

- [x] Root PrivacyErrorBoundary — On any uncaught render error it shows a full-screen report UI. The error is sanitised: the username becomes `<USER>` and absolute paths become relative. Below it are an optional "what were you doing" field (max 500 chars), a privacy notice, Report on GitHub (opens a prefilled issue URL), Save to File (native save dialog, `.txt`) and Reload App. (source: src/components/PrivacyErrorBoundary.tsx:1-60, 200-430, src/utils/errorSanitizer.ts, src/utils/githubIssueUrl.ts, electron/main.ts:1056-1084) **Native:** Not ported: Swift has no render error boundaries. Crashes go to the macOS crash reporter, and Help > Report a Bug opens GitHub issues.
- [x] Global error handler — Captures `window.onerror` and unhandled promise rejections, sanitises them, dedupes them by hash with an occurrence count, and stores them in localStorage `graphium_pending_errors`. Nothing is sent without user consent. (source: src/utils/globalErrorHandler.ts:1-200) **Native:** Not ported: see above. Nothing was ever sent automatically in TS either.
- [x] Pending errors indicator — A bottom-right badge opens a "Stored Errors" panel with a "Report on GitHub" action for each error and "Clear reported". (source: src/components/PendingErrorsIndicator.tsx:179-310, src/main.tsx:106-109) **Native:** Not ported: see above.
- [x] Storage-init failure screen — "Failed to Initialize Storage" with Retry and "Clear Data & Retry". (source: src/main.tsx:22-95) **Native:** Not applicable: there is no browser storage to initialise.
- [x] Scoped boundaries that degrade silently — TokenErrorBoundary (hides one broken token), CanvasOverlayErrorBoundary (hides paper noise, measurement or movement range), MinimapErrorBoundary, QuickTokenSidebarErrorBoundary (inline message), LibraryModalErrorBoundary (Close button), AssetProcessingErrorBoundary (around the cropper), UpdateManagerErrorBoundary. (source: src/components/Canvas/TokenErrorBoundary.tsx, src/components/Canvas/CanvasOverlayErrorBoundary.tsx, src/components/Canvas/MinimapErrorBoundary.tsx, src/components/QuickTokenSidebarErrorBoundary.tsx, src/components/AssetLibrary/LibraryModalErrorBoundary.tsx, src/components/AssetProcessingErrorBoundary.tsx) **Native:** Native: a missing or unreadable image draws a placeholder, and failed overlays draw nothing, so there is nothing to catch.
- [x] Not mounted — `GlobalErrorBoundary.tsx` and `DungeonGeneratorErrorBoundary.tsx` exist but are not used. Do not port them as separate features. (source: src/components/GlobalErrorBoundary.tsx, src/components/DungeonGeneratorErrorBoundary.tsx)

**Native mapping:** Swift has no render-error boundaries. Make rendering total (validate the model
on load, skip bad tokens with `os_log`). For crash and issue reporting, use MetricKit
(`MXCrashDiagnostic`) together with a "Report a Problem..." Help menu item. That item builds the
same sanitised report: replace `NSUserName()` and `NSHomeDirectory()`, then
`NSWorkspace.open` the GitHub issue URL or save the report with `NSSavePanel`.

### 1.11 Theme

- [x] Three modes: light, dark, system (the default). Persisted in electron-store `config.json` or localStorage. In system mode the app follows OS changes live. (source: electron/themeManager.ts:1-30, 56-109) **Native:** Stored in UserDefaults; System follows macOS live.
- [x] All windows switch together. Electron uses an IPC broadcast and web uses a BroadcastChannel `graphium-theme-sync`. (source: electron/themeManager.ts:109, src/components/ThemeManager.tsx:85-120, src/components/HomeScreen.tsx:373-380) **Native:** Set app-wide (NSApp.appearance), so every window switches together.
- [x] No flash of the wrong theme on launch. There is no transition on first paint, and an animated transition after that. (source: src/components/ThemeManager.tsx:1-60, src/styles/theme.css:398-401) **Native:** Applied in applicationWillFinishLaunching, before any window draws.
- [x] Theme-adaptive canvas colours — The default grid colour `#222222` is replaced by a theme token in dark mode. Token label text uses the theme text colour. (source: src/components/Canvas/CanvasManager.tsx:300-305, src/store/gameStore.ts:253)
- [x] Visual language "direction A" — 4px radius, hairline elevation, amber Architect accent, and a separate projector-safe World View token set. (source: CHANGELOG.md "Unreleased > Changed", src/styles/theme.css) **Native:** Native controls with an amber accent colour; the World View uses the TS navy (#003362) on its button.

**Native mapping:** Set `NSApp.appearance` (nil, `.aqua` or `.darkAqua`) from an `@AppStorage`
value, shown as a Picker in a `Settings` scene and in View > Theme. Use asset-catalog colours
with Any/Dark variants. World View can keep its own fixed palette.

### 1.12 Pause state ("Blank the projector")

- [x] A global pause flag lives in the main process. It persists across map switches and starts unpaused on launch. Toggling it broadcasts `PAUSE_STATE_CHANGED` to both windows. (source: electron/main.ts:144-145, 1035-1046, src/components/PauseManager.tsx:75-101)
- [x] Toolbar Play/Pause button — Red when paused, green when running. Tooltips read "Resume - Players will see the map" and "Pause - Hide map from players". (source: src/components/Toolbar.tsx:72-90) **Native (design pass, 2026-10-17):** only the paused state is tinted, in the amber accent, and the symbol and label change (`play.fill` "Resume" / `pause.fill` "Pause"); tooltips read "Resume: players will see the map" and "Pause: hide the map from players". See `design/harness/rules/state-without-colour.md`.
- [x] Also available from the command palette (`world-view-toggle-pause`) and the mobile toolbar. (source: src/utils/commandRegistry.ts:117, src/components/MobileToolbar.tsx)
- [x] An error toast appears if the toggle fails. (source: src/App.tsx:163-175) **Native:** Not applicable: the native toggle can't fail (same process, no IPC).

**Native mapping:** Make it a `@Published var isPaused` on a shared session model with no IPC. Add a
menu item (for example View > Pause World View, `Cmd+Shift+P`) and a toolbar item.

### 1.13 Resource / performance monitor

- [x] Overlay — FPS (rAF), JS heap used and % of limit, token and drawing counts, IPC messages per second and bytes per second, active workers, canvas commit time. Updates every 500 ms. Toggled with `Cmd+Shift+M`. Architect only. (source: src/components/ResourceMonitor.tsx:35-120, src/components/Canvas/CanvasManager.tsx:1008-1017, src/utils/perfCounters.ts) **Native:** Native metrics: canvas FPS and draw time, memory footprint, display refresh rate, object counts and open World Views. JS heap, IPC and workers don't exist natively.

**Native mapping:** Use a debug HUD with `CADisplayLink`/`CVDisplayLink` frame timing,
`task_info` resident memory, and model counts. Prefer `os_signpost` with Instruments over a
reimplemented IPC meter.

---

## 2. Architect editor chrome

### 2.1 Sidebar (left, Architect only)

- [x] Header — Shows the campaign name (truncated, with the full name as a tooltip) and a collapse/expand button (w-64 to w-16). (source: src/components/Sidebar.tsx:268-295) **Native:** The NavigationSplitView sidebar collapses; the campaign name is the window subtitle.
- [x] MAPS section (collapsible) — Maps sorted alphabetically. Clicking switches maps. The active map shows `aria-current`. A hover gear opens Map Settings in edit mode. A "New Map" button opens Map Settings in create mode. (source: src/components/Sidebar.tsx:302-368) **Native:** Sorted alphabetically; right-click opens Map Settings; the + button opens Map Settings in create mode.
- [x] Door Controls section — Only shown when doors exist. Offers "Open all unlocked doors", "Close all open doors", and "Unlock all" (only when any door is locked). (source: src/components/DoorControls.tsx:34-48, 75-120, src/components/Sidebar.tsx:373)
- [x] LIBRARY section — "Place" (opens the command palette), "Add" (pick an image, process it as a TOKEN, then show the Add to Library dialog), "Manage library" (opens Library Manager). (source: src/components/Sidebar.tsx:376-428, 213-262)
- [x] Quick Token Sidebar — "Recent History" (last 3 unique library tokens used on this map) and "Party Tokens" (a generic placeholder plus up to 5 PC library tokens, deduped against recents). Every item can be dragged onto the canvas. (source: src/components/QuickTokenSidebar.tsx:1-168, src/utils/tokenUtils.ts)
- [x] Custom drag image (64x64) when dragging a library token. (source: src/components/Sidebar.tsx:174-210)
- [x] SESSION CONSOLE section — Hosts the Session Console panel (see 5.4). (source: src/components/Sidebar.tsx:432-434)

**Native mapping:** Use a `NavigationSplitView` sidebar with `Section`s and `DisclosureGroup`s.
Library items use `.draggable` with a custom `Transferable` type (library item id). The
sidebar collapse is the system sidebar toggle.

### 2.2 Toolbar (floating, Architect desktop only)

- [x] Play/Pause (see 1.12). (source: src/components/Toolbar.tsx:72-90)
- [x] Tool buttons with pressed state and tooltips — Select (V), Marker (M), Eraser (E), Wall (W), Door (D, "Arrow keys or R to rotate"). (source: src/components/Toolbar.tsx:92-166)
- [x] Door orientation toggle button — Only visible while the Door tool is active. (source: src/components/Toolbar.tsx:167-180)
- [x] Measure (R) with mode buttons Ruler / Blast / Cone and a Broadcast toggle ("Broadcasting" / "Local Only"). The mode buttons are only visible while Measure is active. Changing mode clears the active measurement. (source: src/components/Toolbar.tsx:182-242, src/store/uiStore.ts:52-56)
- [x] Marker colour HUD (bottom centre, Marker tool only) — A large swatch opens the colour picker. Three recent-colour swatches follow, most recent first and deduped. The default is `#df4b26`. (source: src/components/Toolbar.tsx:243-280, src/store/uiStore.ts:34-47)
- [x] Not in the toolbar: Save/Load, World View launch and Generate Dungeon. These live in menus and the palette. Older docstrings claim otherwise. (source: src/App.tsx:77-84 vs src/components/Toolbar.tsx) **Native:** Native: the toolbar also has World View, Add Tokens and Map Image, which is usual on macOS.

**Native mapping:** Use a window `.toolbar` with a segmented `Picker` for tools, a `ControlGroup` for
measure modes, and `ColorPicker` (backed by `NSColorPanel`) plus recent swatches. A
touch-bar-like floating HUD is optional.

### 2.3 Token inspector (Architect, shown when one or more tokens are selected)

- [x] Title — "Token Name" for a single token, or "N Tokens Selected". There is a compact read-only summary (Type, Vision) with an Edit button and a close button. (source: src/components/TokenInspector.tsx:205-250) **Native:** Native: the inspector shows the editable fields directly, with no compact summary.
- [x] Name field — The placeholder reads "Multiple tokens" when several are selected. Edits apply to every selected token. (source: src/components/TokenInspector.tsx:145-150, 263-280) **Native:** Commits on Return, focus loss or selection change rather than per keystroke, as one undo step; an untouched field writes nothing.
- [x] Type — PC/NPC toggle. Hint: "Only PC tokens emit vision for Fog of War". (source: src/components/TokenInspector.tsx:152-157, 289-343)
- [x] Vision radius — Presets 0, 30, 60 and 120 ft, plus a number field from 0 to 300 in steps of 5. Applies to every selected token. (source: src/components/TokenInspector.tsx:159-164, 350-398) **Native:** A number field (clamped to 0-300) with a stepper in steps of 5; the active preset is drawn prominent; a mixed selection shows an empty field.
- [x] "Save to library" (single, library-linked token) — Writes the name, type and vision back as library defaults. (source: src/components/TokenInspector.tsx:166-203, 400-430) **Native:** Also clears those three overrides on the token so it inherits the new defaults; scale stays a per-token override. Shows the TS success and error toasts, and one undo reverts both the campaign copy and the app-wide library item.
- [x] Read-only details — Scale (for example "1x") and rounded position. (source: src/components/TokenInspector.tsx:431-450)
- [x] Prototype/instance resolution — Each token property falls back to the linked library item's defaults (name, type, visionRadius, scale, movementSpeed). (source: src/store/gameStore.ts:25-62, src/hooks/useTokenData.ts)
- [x] Not editable anywhere in the UI: per-token `movementSpeed` (always the 30 ft default unless a library default sets it), token rotation, and explicit numeric scale. (source: src/components/Canvas/OverlayLayer.tsx:131, src/hooks/useTokenData.ts)

**Native mapping:** Use a trailing `.inspector` (macOS 14) with a `Form`, a `Picker(.segmented)` for
type, and `Stepper`/`TextField(format: .number)` for vision. Multi-selection editing binds to
an aggregate proxy.

### 2.4 Mobile / narrow-window layout (viewport 767px wide or less)

- [x] Hamburger button (48x48) opens the sidebar as a drawer. (source: src/App.tsx:533-556, src/components/MobileSidebarDrawer.tsx) **Native:** Not ported: macOS windows use the standard sidebar at every width.
- [x] Bottom MobileToolbar — Select, Marker, Eraser, Wall and More. The More menu has Place Door (with orientation), Change Marker Color, Generate Random Dungeon, Open World View and pause. Buttons are at least 56px tall. (source: src/components/MobileToolbar.tsx:84-230, tests/touch-targets.spec.ts) **Native:** Not ported: no mobile toolbar on macOS.
- [x] Bottom sheet inspector on mobile. (source: src/components/MobileBottomSheet.tsx, src/components/TokenInspector.tsx:59, 207) **Native:** Not ported: the inspector is a column at every width.

These trigger in Electron too when the window is resized narrow. See section 8 for the porting
decision.

---

## 3. Canvas (shared by Architect and World View)

### 3.1 Pan and zoom

- [x] Zoom range is 0.1x to 5x with a step factor of 1.1. Zoom is anchored at the pointer for the wheel and at the pinch centre for pinch. (source: src/components/Canvas/CanvasManager.tsx:35-37, 494-523)
- [x] Mouse/trackpad — The wheel pans (deltaX/deltaY). Ctrl/Cmd+wheel zooms. A trackpad pinch arrives as ctrl+wheel. (source: src/components/Canvas/CanvasManager.tsx:978-1006)
- [x] Space+drag pans with grab/grabbing cursors. The viewport is clamped on release. (source: src/components/Canvas/CanvasManager.tsx:1155, 1170-1196)
- [x] Keyboard `+`/`-` zoom around the centre. (source: src/components/Canvas/CanvasManager.tsx:526-539)
- [x] Touch — Two-finger pinch zooms when the distance change is above a threshold (setting, clamped to 5-50 px, default 10). Otherwise two fingers pan. One finger goes to the active tool. Default gestures are suppressed for drawing tools. (source: src/components/Canvas/CanvasManager.tsx:307-315, 713-821) **Native:** Native: trackpad pinch zooms and two-finger scroll pans (system gestures). There is no touchscreen on a Mac.
- [x] Viewport clamp — The viewport centre stays within the map bounds (or ±5000 with no map), expanded by PC token bounds, plus 1000 px of padding. (source: src/components/Canvas/CanvasManager.tsx:39, 439-491) **Native:** Clamped on every zoom step (pinch, ⌘/⌃-wheel, `+`/`-`) and every scroll-pan event, as in TS, and when a space-drag ends (`Viewport.zoomed(by:around:clampingTo:…)`).
- [x] Camera is per window — Architect and World View pan and zoom independently. The camera is not synced. (source: src/components/Canvas/CanvasManager.tsx:257-298)
- [x] Performance — Gestures write the stage transform directly and commit to React state 100 ms later. (source: src/components/Canvas/CanvasManager.tsx:268-298) **Native:** Native: AppKit redraws directly; there is no React state to commit.
- [x] Cursor — Crosshair for drawing, measure and door tools. Default for select. Grabbing while dragging a token. (source: src/components/Canvas/CanvasManager.tsx:406-429)

**Native mapping:** Build a custom `NSView` (Metal or Core Animation layer tree, or an
`NSScrollView` with `allowsMagnification`) and use `magnify(with:)` for trackpad pinch,
`scrollWheel` with `hasPreciseScrollingDeltas` for pan, `NSMagnificationGestureRecognizer`, and
`smartMagnify` (double-tap). Keep all canvas maths in a pure `CameraState` value type in
GraphiumCore.

### 3.2 Map background

- [x] Import from the Map Settings sheet with "Upload". The image is resized to at most 4096 px, converted to WebP at 85% in a Web Worker, and placed at (0,0) with scale 1. (source: src/components/MapSettingsSheet.tsx:113-180, 275-296, src/utils/AssetProcessor.ts:1-110, src/utils/imageMaxDimensions.ts) **Native:** Native: up to 4096 px, stored as PNG (with alpha) or JPEG at 85%; macOS can't encode WebP.
- [x] Upload automatically enters calibration mode. In create mode the image is held until "Create Map". (source: src/components/MapSettingsSheet.tsx:155-165, 183-210) **Native:** After an upload, "Calibrate to the grid after saving" is on (square grids). Create mode holds the image until Create Map.
- [x] Calibration — "Draw a square on the map that represents exactly one grid cell." The map scales so that box equals the grid size, then offsets so the box aligns to grid lines. Boxes of 5 px or less are ignored. Square grids only (disabled for hex/iso, with a tooltip). Has a Cancel button. The sheet becomes non-modal while calibrating. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:275-286, 463-474, 576-607, src/components/MapSettingsSheet.tsx:296-335, 243)
- [x] Danger Zone "Reset Map Position & Scale" (edit mode) — Asks for confirmation, then resets to (0,0) at scale 1. (source: src/components/MapSettingsSheet.tsx:223-232, 418-430)
- [x] The map is not directly draggable or selectable. It is a listening-false background layer. (source: src/components/Canvas/CanvasManager.tsx:1202-1219)
- [x] Map cropping does not exist. The cropper is only used for image files dropped onto the canvas as tokens (see 3.4).

**Native mapping:** Use `NSOpenPanel` (UTType.image) or drag-and-drop. Downscale with
ImageIO (`CGImageSourceCreateThumbnailAtIndex` with `kCGImageSourceThumbnailMaxPixelSize` 4096) off the main thread. HEIC or PNG storage is fine natively. WebP output is not required but
WebP input must decode (ImageIO handles it on macOS 11 and later).

### 3.3 Grid

- [x] Types — Square Lines, Square Dots, Hexagonal (flat-top, axial coordinates), Isometric (diamond), Hidden. Set per map. (source: src/store/gameStore.ts:101, src/types/grid.ts, src/utils/gridGeometry.ts)
- [x] Size semantics — Square: cell px. Hex: circumradius. Iso: half the diamond width. The default is 50. There is no UI to type a grid size. Templates set 50 and calibration scales the map, not the grid. (source: CHANGELOG.md "Grid Size Semantics", src/store/gameStore.ts:267, src/components/HomeScreen.tsx:397)
- [x] Per-map grid colour picker — Default `#222222`, theme-adaptive when left at the default. A note is shown while the grid is hidden. (source: src/components/MapSettingsSheet.tsx:369-395, src/components/Canvas/CanvasManager.tsx:303-305) **Native:** Default colour adapts to the theme; a note shows while the grid is hidden. A custom colour draws at 50% opacity like every TS grid (80% with Increase Contrast).
- [x] Viewport culling — Only visible lines, cells or dots are drawn. The DOTS step coarsens above 10,000 dots. (source: src/components/Canvas/GridOverlay.tsx:1-60)
- [x] Hover cell highlight — A translucent fill on the hovered cell, for every type except Dots and Hidden. Architect only. (source: src/components/Canvas/GridOverlay.tsx:72-80, 213-230, src/components/Canvas/hooks/useCanvasInteraction.ts:377-384)
- [x] Snapping — Square: odd-sized tokens snap to cell centres and even-sized tokens to intersections. Hex/iso: always snap to the cell centre. Applies on drop, drag end and door placement. (source: src/utils/grid.ts, CHANGELOG.md "Smart Grid-Aware Snapping") **Native:** Isometric `pixelToGrid` rounds to the nearest diamond centre instead of flooring (CORE_SPEC §3.1 "Known quirk"), so points in the upper half of a diamond snap to that diamond, not its neighbour. Campaigns imported from TS keep their saved positions, but an iso token that TS had snapped onto a diamond's top vertex sits half a cell off the native snap grid until it is next moved.
- [x] Snap preview — A dashed blue circle shows the snap destination of each dragged token, including multi-token drags. (source: src/components/Canvas/OverlayLayer.tsx:57-90, src/components/Canvas/hooks/useTokenDrag.ts:249-294) **Native:** amber over a dark halo rather than blue (design harness `canvas-marks-read-on-any-map`).
- [x] Grid type quick keys `1` to `5` with toasts (see 1.4).

**Native mapping:** Port `GridGeometry` (pixelToGrid, gridToPixel, getCellVertices, neighbours) to
GraphiumCore unchanged. It is pure maths and the existing unit tests can be translated 1:1.
Render with a `CAShapeLayer` path rebuilt on viewport change, or in a Metal pass.

### 3.4 Tokens

- [x] Add by dragging a library or quick token onto the canvas — Creates a library-linked instance at the snapped drop point. (source: src/components/Canvas/CanvasManager.tsx:858-879)
- [x] Add by dragging the generic token — A theme-coloured SVG placeholder named "Generic Token", type NPC. (source: src/components/Canvas/CanvasManager.tsx:880-902) **Native:** Sidebar Library > Generic Token: click to place or drag onto the map. A neutral PNG instead of a theme-coloured SVG.
- [x] Add by dropping an image file — Opens the 1:1 ImageCropper (zoom 1x-3x by slider, wheel or pinch, "Crop & Import" / Cancel). Then creates a "New Token" (NPC) with an embedded data URL. This token is not added to the library. (source: src/components/Canvas/CanvasManager.tsx:909-961, src/components/ImageCropper.tsx:24-58)
- [x] Add from the command palette at the map centre (see 1.5).
- [x] Rendering — Square image of size gridSize x scale. The name label (12pt bold, theme text colour) sits below. Iso grids offset the token up by half its height. Hover shows a soft shadow. A selected token gets a dashed blue ring. A dragged token is semi-transparent with a strong shadow. (source: src/components/Canvas/TokenNode.tsx:36-100, 145-215) **Native:** The iso half-height lift applies everywhere the token is drawn or picked: hit-testing, marquee, accessibility frames, the snap preview circle and the resize handle. The label stays 8 pt under the unlifted footprint, as in TS. Vision, party framing and the minimap use the stored footprint. Hover (Select tool), drag and selection looks follow TS: a 1.02× scale and soft shadow on hover; 50% opacity, a 1.05× scale and a strong shadow while dragging; a dashed `[8,4]` blue circle with a glow when selected, hidden while dragging. Native scales about the token centre (Konva scales from the top-left corner), and the ring's line width and dashes stay constant on screen rather than scaling with zoom (thicker with Increase Contrast). Since the design pass (2026-10-17) the ring is amber over a dark halo with no glow, other selection marks (strokes, doors, handles, marquee) match it, and the name label is white with a dark outline so it reads on any map art.
- [x] Move — Pointer drag with a 5 px threshold. Multi-select drags move together. Every token snaps on release. Live positions stream to World View during the drag (rAF-batched). (source: src/components/Canvas/hooks/useTokenDrag.ts:94, 106-116, 330-392)
- [x] Duplicate — Option/Alt-drag leaves the originals and drops copies at the snapped destinations. Ghosts are shown while dragging. (source: src/components/Canvas/hooks/useTokenDrag.ts:394-401, src/components/Canvas/TokenLayer.tsx:76-82)
- [x] Resize — Transformer handles scale the token uniformly (the average of scaleX and scaleY multiplies the stored scale). Architect only. (source: src/components/Canvas/CanvasManager.tsx:1357-1396) **Native:** Native: a corner resize handle, in quarter-scale steps.
- [x] Rotate **(gap)** — The Konva Transformer shows its default rotate handle, but rotation is discarded on transform end and the Token model has no rotation field. [Decision needed: either hide rotation or add `rotation` to the model.] (source: src/components/Canvas/CanvasManager.tsx:1359-1394, src/store/gameStore.ts:51-62) **Native:** Decision: rotation is hidden (no rotate handle), since the model has no rotation field.
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

- [x] Marker — Freehand line in the chosen colour, 5 px base width, round caps, 0.5 tension. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:301-331, src/components/Canvas/DrawingLayer.tsx:50-100)
- [x] Eraser — Draws a 20 px `destination-out` stroke on the drawings layer. It erases ink from markers and walls visually but never erases the map, tokens or wall geometry used for vision. Clicking a door with the eraser deletes the door. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:315-317, src/components/Canvas/DrawingLayer.tsx:58-59, src/components/Canvas/DoorShape.tsx:101-110)
- [x] Wall — Red 8 px dashed `[10,5]` line. It blocks fog-of-war vision. Walls are not selectable or draggable. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:318-321, src/components/Canvas/DrawingLayer.tsx:54-61, 96) **Native:** Walls always draw as straight, dashed polylines that match their vision segments, and never record pressure. In TS, with pressure sensitivity on (the default), walls record pressure and render through `PressureSensitiveLine`, which has no dash, so the dashed wall appears only with pressure off. Walls have a kind and a direction (native additions, ignored by TS): a **window** stops movement but not sight and draws dotted (in the World View too, decision 008); a **one-way** wall lets sight through from the left of the direction it was drawn in and shows ticks on its blocked side (Architect only). The Wall tool's toolbar options set both for new walls; right-click a wall to change its kind, one-way and direction, or delete it.
- [x] Wall smoothing and endpoint snapping — Ramer-Douglas-Peucker simplification (epsilon 3, kept if at least 2 points remain). Endpoints snap to existing walls within 10 px. Settings live in the `graphium-preferences` store and have no UI. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:84-101, 620-641, src/store/preferencesStore.ts:38-67, src/utils/pathOptimization.ts:21, 207)
- [x] Pressure-sensitive lines — Per-point pressure is captured when pressure sensitivity is on. Width = base x mapped pressure, using a pressure curve: light 0.2-2.0, normal 0.3-1.5 (the default), heavy 0.4-1.2. A custom scene function draws the variable width. Mouse input uses 0.5. (source: src/components/Canvas/CanvasManager.tsx:41-45, src/components/Canvas/CanvasUtils.ts:18-27, src/components/Canvas/PressureSensitiveLine.tsx, src/store/touchSettingsStore.ts:116) **Native:** Marker and eraser strokes record pressure (the eraser gets a variable width); without pressure they draw as a 0.5-tension cardinal spline, as Konva does (`CardinalSpline`).
- [x] Shift axis-lock while drawing (see 1.4).
- [x] Marker strokes and eraser strokes can be selected, dragged (Option-drag duplicates) and scaled with the transformer. Walls cannot. (source: src/components/Canvas/DrawingLayer.tsx:60-61, 120-130, src/components/Canvas/CanvasManager.tsx:1258-1286, 1380-1393) **Native:** Strokes, walls included, can be selected, dragged, Option-duplicated and deleted, but not scaled. New wall ends snap to where existing walls are drawn, moved or not.
- [x] Live stroke preview is rAF-throttled. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:544-555) **Native:** The live stroke is appended in place, repeated points are skipped, and each drag event redraws only the area around the newest segment (AppKit coalesces redraws per display frame).

**Native mapping:** Read `NSEvent.pressure` (and `tangentialPressure`/`tilt` for Wacom), then render
variable-width strokes as filled `CGPath` outlines or with a Metal stroke shader. For the
eraser, use `CGBlendMode.clear` on a dedicated ink layer. PencilKit is iPad-only on macOS for
drawing input and is not suitable here.

### 3.6 Doors and stairs

- [x] Place a door with the Door tool. A white ghost preview follows the snapped pointer. Clicking adds a closed, unlocked door the size of one grid cell in the current orientation (horizontal or vertical, toggled with `R`, arrow keys or the toolbar). (source: src/components/Canvas/hooks/useCanvasInteraction.ts:248-269, 386-396, src/components/Canvas/OverlayLayer.tsx:32-50) **Native:** A click on a wall stroke (within a fifth of a cell) lines the door up with that wall at any angle, and the ghost shows it. On an axis wall the door keeps the grid snap and takes the wall's orientation; elsewhere it sits on the nearest point of the wall. Away from walls it behaves as in TS.
- [x] Open and close a door by clicking it (Architect). Locked doors do not toggle. The swing arc animates over 300 ms with ease-in-out. (source: src/components/Canvas/DoorShape.tsx:52-117) **Native:** The leaf turns about its hinge over 300 ms (ease-in-out quad) for every open or close, whether from a click, the context menu or the sidebar, in both windows. A re-toggle mid-swing reverses from the current angle. With Reduce Motion on, doors switch instantly.
- [x] Door right-click context menu — Open/Close Door (disabled when locked), Lock/Unlock Door, and Delete Door in red. Clicking outside closes it. (source: src/components/Canvas/CanvasManager.tsx:235-255, 1437-1484, src/components/Canvas/DoorShape.tsx:118-126)
- [x] Lock state — A lock icon overlay shows on locked doors. (source: src/components/Canvas/DoorShape.tsx:146, 421)
- [x] Bulk door controls in the sidebar (see 2.1).
- [x] Blocking — Closed doors become wall segments for vision. Open doors let vision through. (source: src/components/Canvas/FogOfWarLayer.tsx:242-320) **Native:** An open door also cuts the wall under it, in vision and on the canvas, so a room drawn in one stroke with a door dropped on it opens when the door does. In TS that wall went on blocking. A door sitting in a gap (as the dungeon generator makes) changes nothing.
- [x] World View door rendering — Thicker strokes and a white glow for legibility. It does not respond to clicks. (source: src/components/Canvas/DoorShape.tsx:137, 182-217)
- [x] Doors can be selected for deletion with marquee or Delete. They show a selection highlight. (source: src/components/Canvas/DoorShape.tsx:149, src/components/Canvas/CanvasManager.tsx:573)
- [x] Stairs — Render-only (non-interactive). A stepped pattern with a direction arrow (N/S/E/W) and up/down shading, visible in both windows. **(gap)** No UI or generator creates stairs. They exist only in the model, sync and persistence. [Port rendering and persistence. Creating stairs is a new feature.] (source: src/components/Canvas/StairsShape.tsx:1-41, src/store/gameStore.ts:236-250, 826-830)

**Native mapping:** Keep a `Door` model in core and render it as a layer with a
`CABasicAnimation` for the swing. Use `menu(for event:)` on the canvas view for the native
right-click `NSMenu` (and Control-click).

### 3.7 Fog of war and explored regions

- [x] Fog renders only in World View, and only when Daylight Mode is off. The Architect always sees the whole map. (source: src/components/Canvas/CanvasManager.tsx:1289-1303)
- [x] Vision sources — PC tokens with a vision radius above 0. Radius in px = feet / 5 x gridSize. (source: src/components/Canvas/FogOfWarLayer.tsx:340-372) **Native:** With lighting on (Map Settings > Lighting, or placing the first light with the Light tool, `L`), light comes from the map's ambient level and from lights the DM places (Candle, Lamp, Torch, Lantern, _Light_, _Daylight_, at the SRD 5.2.1 radii). Walls stop light as they stop sight. Every PC is a vision source, sees whatever is lit in its line of sight, and sees darkness within its darkvision (token inspector) as dim. The vision radius is unused then. In the World View, dim ground is a lighter fog (decision 009). NPCs in darkness stay hidden. Lights are DM-only marks in the Architect: a bulb, a solid ring at the bright radius and a dashed ring at the dim radius. They can be selected, dragged, Option-duplicated, erased, and turned off or changed from their right-click menu.
- [x] Raycast visibility polygon for each PC against wall segments (wall drawings, with their x/y/scale transforms applied) and closed doors. The ray count depends on radius and zoom. Polygons are cached per token and recomputed only when that token or the walls change. (source: src/components/Canvas/FogOfWarLayer.tsx:100-120, 252-372) **Native:** Exact, not sampled: besides the evenly spaced rays, which still draw the arc, a ray goes at every wall end in range and a hair either side of it, and at every point where a wall crosses the vision circle or another wall (`VisibilitySweep`). Corners land exactly and a thin wall can't hide between two rays; with no walls in range the polygon is the TS one. Wall ends within a tenth of a cell of another wall, such as a door stopping short of its wall, are welded shut first (`WallWeld`). A brute-force oracle checks it on random maps (`VisibilitySweepTests`).
- [x] Three-state fog — Unexplored areas are 94% black. Explored areas are dimmed through a cached offscreen mask (union of explored polygons). Current vision is cleared with a radial-gradient soft edge. (source: src/components/Canvas/FogOfWarLayer.tsx:452-540, docs/features/explored-fog-of-war.md) **Native:** The explored union is a cached greyscale mask (up to 2 px per map unit, longest side capped at 4096 px) applied as a clip mask. New regions are stamped onto it; it is rebuilt only when the map or fog bounds change or the history is rewritten (undo, reset, the 2000-region cap). Overlaps form one union instead of compounding.
- [x] Explored regions are recorded at most once per second per PC polygon, capped at 2000 per map (oldest dropped), and persisted in the map. (source: src/components/Canvas/FogOfWarLayer.tsx:395-427, src/store/gameStore.ts:248, 852-859) **Native:** Recorded in the shared campaign on each edit, so it persists and undoes with that edit. A changed wall or door stamps every PC at once (a glimpse through a door opened beside a standing PC is kept); otherwise only PCs whose position or vision changed are raycast, and edits that touch nothing vision depends on cast no rays. Fog and NPC hiding follow live drags in both windows, but a drag is stamped only where it is dropped, not at 1 Hz along the way.
- [x] NPC hiding — NPC tokens outside every PC's vision are hidden and not interactive in World View. (source: src/utils/fogVisibility.ts, src/components/Canvas/FogOfWarLayer.tsx:384-387, src/components/Canvas/TokenNode.tsx:134, 162)
- [x] Layer order — Fog is drawn above the map, grid, drawings and stairs, and below doors and tokens. Visible tokens always render on top of the fog; only hidden NPCs are left out. (source: src/components/Canvas/CanvasManager.tsx:1243-1340, 1288) **Native:** Tokens are drawn above the fog as in TS, but doors stay under it, so unexplored fog doesn't reveal where doors are; doors in current or explored vision still show through.
- [x] Wall lines show in World View as black 6 px lines, drawn under the fog. (source: src/components/Canvas/DrawingLayer.tsx:54-55, src/components/Canvas/CanvasManager.tsx:1290)
- [x] Reset explored fog **(gap)** — `clearExploredRegions` exists, but nothing in the UI calls it. [Intended: a "Reset explored areas" action per map.] (source: src/store/gameStore.ts:860)
- [x] Explored-region sync caveat — Explored regions are computed in World View, but World-to-Architect sync only carries token x/y. So regions recorded in World View never reach the Architect's saved campaign. **(gap)** [Intended: compute exploration in the shared model so it persists.] (source: src/utils/worldViewTokenSync.ts, src/components/SyncManager.tsx:267-268)

**Native mapping:** Port the visibility-polygon raycaster to GraphiumCore as pure Swift (SIMD) and
unit-test it. Render fog as a Metal fragment pass or a `CALayer` mask: a `CGImage` explored
mask plus `CAGradientLayer`-style soft vision holes. Because both windows share one process,
exploration is computed once.

### 3.8 Daylight mode

- [x] A per-map toggle in Map Settings ("Daylight Mode", with the description switching between "Fog of War disabled" and "Fog of War enabled"). When on, World View shows no fog. In create mode the value is pending until "Create Map". (source: src/components/MapSettingsSheet.tsx:396-415, src/store/gameStore.ts:861)

### 3.9 Measurement overlay

- [x] Ruler — A line from the drag origin with a label like "30ft (6 cells)". (source: src/components/Canvas/hooks/useCanvasInteraction.ts:409-423, src/utils/measurement.ts, src/components/Canvas/MeasurementOverlay.tsx:80-100)
- [x] Blast — A circle with a label like "20ft radius (4 cells)". (source: src/components/Canvas/hooks/useCanvasInteraction.ts:424-435, src/components/Canvas/MeasurementOverlay.tsx:120-140)
- [x] Cone — A 53° cone triangle with a label like "30ft 53° cone (6 cells)". (source: src/components/Canvas/hooks/useCanvasInteraction.ts:436-453, src/utils/measurement.ts:130-160)
- [x] Distance is Euclidean, with 1 cell = 5 ft. A D&D 5e 5-10-5 diagonal mode exists in utils but is not exposed in the UI. Labels are 16pt with a dark backing and handle singular and plural. (source: src/utils/measurement.ts:13-100)
- [x] The measurement stays on screen after release until `Esc`, a mode change, or a click with another tool. (source: src/components/Canvas/hooks/useCanvasInteraction.ts:271-273, 569-574)
- [x] Broadcast — When "Broadcasting" is on, the DM's measurement is mirrored into World View (`dmMeasurement`). (source: src/components/Toolbar.tsx:230-240, src/components/SyncManager.tsx:145, 271-273, src/components/Canvas/CanvasManager.tsx:1354) Off by default (src/store/gameStore.ts:480).

### 3.10 Movement range

- [x] Hold `M` with a token selected (Architect only) to show a BFS flood-fill of reachable cells within movementSpeed / 5 cells (default 30 ft). It uses grid-aware neighbours (square, hex, iso), is drawn as a translucent blue overlay, and follows the token during a drag. (source: src/components/Canvas/MovementRangeOverlay.tsx:1-176, src/components/Canvas/OverlayLayer.tsx:98-135) **Native:** On hex and iso grids the fill starts from the cell under the token centre, so it is centred on the token. TS starts from the top-left, which on iso is half a cell above the token. Square grids keep the TS top-left start. The overlay is translucent amber (`canvas-range`) since the design pass.
- [x] `docs/movement-range-concept.tsx` is the earlier concept. The shipped implementation is MovementRangeOverlay. Port only the shipped one. (source: docs/movement-range-concept.tsx)

### 3.11 AoE templates

- [x] **(concept-only, not shipped)** Cell-highlighting AoE templates (circle, cone, line, cube) that highlight the grid cells inside a spell area. They are not imported anywhere in `src/`. The shipped equivalent is the geometric Blast/Cone measurement (3.9). (source: docs/aoe-templates-concept.tsx:1-70) **Native:** Not ported (concept-only).

### 3.12 Minimap (World View only)

- [x] A 200x200 canvas showing the map bounds (or PC bounds when there is no map), PC tokens as green dots, and the current viewport rectangle. Clicking recentres the World View camera there. It is wrapped in an error boundary. (source: src/components/Canvas/Minimap.tsx:1-233, src/components/Canvas/ConnectedMinimap.tsx:5-59, src/components/Canvas/CanvasManager.tsx:1427-1433) **Native:** Without a map image it frames the PCs padded by 500 px, else a fixed 0–2000 world, as in TS; PC bounds use each token's real footprint rather than TS's 100 px × scale.

### 3.13 Paper-noise overlay

- [x] An SVG `feTurbulence` paper texture at 25% opacity over the map bounds (or the visible bounds when there is no map). It moves with the map and is non-interactive. (source: src/components/Canvas/PaperNoiseOverlay.tsx:1-94, src/components/Canvas/CanvasManager.tsx:1221-1232)

**Native mapping:** Use a pre-rendered tiling noise `CGImage` (or a `CIFilter.randomGenerator` blended
at 25%) as a pattern layer.

### 3.14 Touch visual feedback

- [x] **(gap, not mounted)** `TouchVisualFeedback` (touch-point indicators, pressure indicator, gesture-mode overlay) exists but no component imports it. Its settings (`showTouchPointIndicators`, `showPressureIndicator`, `showGestureFeedback`, `showGestureTutorial`) are unused. Do not port it as a user-visible feature. (source: src/components/Canvas/TouchVisualFeedback.tsx, src/store/touchSettingsStore.ts:136-141) **Native:** Not ported (not mounted).

### 3.15 Performance features worth keeping

- [x] Viewport culling for grid, tokens and fog bounds. (source: src/utils/viewportCulling.ts, src/components/Canvas/GridOverlay.tsx)
- [x] Direct node updates during drag, without full re-render. A token node registry is used for live positions. (source: src/utils/tokenNodeRegistry.ts, src/store/pointerOverlayStore.ts)
- [x] Image processing off the main thread with cancellation. (source: src/utils/AssetProcessor.ts:40-110, src/workers/image-processor.worker.ts) **Native:** `ImportedImage.loadInBackground` decodes and resizes in a detached task, with a spinner. It isn't cancellable, but imports are short. The paper texture is also baked off the main thread.
- [x] Stress fixture autoload for perf testing **(dev-only)**. (source: src/utils/stressFixture.ts, src/App.tsx:220-224) **Native:** Not ported (dev-only).
- [x] React profiler boundaries **(dev-only)**. (source: src/perf/profiler.tsx) **Native:** Not ported (dev-only).

---

## 4. World View (player window)

### 4.1 What players see

- [x] The map background, paper noise, the grid in the map's grid colour, markers, wall lines (black, 6 px), doors with high-legibility styling, stairs, tokens with name labels, fog of war (unless Daylight mode is on), and the DM's measurement when broadcasting is on. (source: src/components/Canvas/CanvasManager.tsx:1201-1356, src/components/Canvas/DrawingLayer.tsx:54-55, src/components/Canvas/DoorShape.tsx:182-217) **Native:** Doors are drawn under the fog rather than above it (see 3.7 Layer order); tokens are above it as in TS.
- [x] Not shown: the sidebar, toolbar, inspector, palette, resource monitor, transformer handles, hover-cell highlight, door preview and movement range. (source: src/App.tsx:516-618, src/components/Canvas/OverlayLayer.tsx:33, 119)
- [x] NPCs outside party vision are hidden (see 3.7).
- [x] "Center on Party" button (bottom right) — Fits the camera to all PC tokens with 2 cells of padding. (source: src/components/Canvas/CanvasManager.tsx:1054-1108, 1403-1425)
- [x] Minimap (see 3.12).
- [ ] Projector legibility contract — Overlay text is at least 18 px with 7:1 contrast, strokes are at least 2 px, and there is no DM chrome. This is enforced by a Playwright test. (source: tests/world-legibility.spec.ts:2) **Native:** Open: Center on Party uses 18 pt and the pause text is large, but no automated legibility test exists.
- [x] Session Console stage — A full-window "plate" artwork with an optional frame, title and subtitle that crossfades between plates (no fade under reduced motion). It covers the map while `stageVisible` is true. (source: src/components/SessionConsole/WorldStage.tsx:41-140)
- [x] "Arm World View audio" card — Shown until the window is armed. It explains that this window owns campaign audio and should be shared in Discord. The "Arm audio" button needs a user gesture to start the AudioContext and the YouTube player, and reads "Loading audio..." while getting ready. (source: src/components/SessionConsole/WorldAudioEngine.tsx:163-195) **Native:** Native: AVAudioEngine and the hidden WKWebView need no user gesture, so the card isn't needed.

### 4.2 What players can do

- [x] Pan and zoom independently: wheel, Ctrl+wheel, Space-drag, pinch, two-finger pan, `+`/`-`. (source: src/components/Canvas/CanvasManager.tsx:92-101)
- [x] Select and drag visible tokens. Only x/y positions are sent back. The main process sanitises every World-to-Architect message down to `TOKEN_UPDATE {x,y}` or a single-level `BATCH`. Players cannot change any other property. Hidden NPCs cannot be grabbed. (source: src/utils/worldViewTokenSync.ts, electron/main.ts:1167-1173, src/components/SyncManager.tsx:307-330, 370-410)
- [x] Blocked: drawing tools, file drops, calibration, transform (scale/rotate), Alt-duplicate, delete, door toggling and door context menu, measurement, grid hotkeys, and tool hotkeys. `?` still opens About. (source: src/components/Canvas/CanvasManager.tsx:92-101, 823-836, src/components/Canvas/hooks/useCanvasInteraction.ts:248-305, src/components/Canvas/DoorShape.tsx:102-122, src/App.tsx:243-246)

### 4.3 Sync model

- [x] The Architect is the producer. It subscribes to store changes, diffs them into delta actions (TOKEN*ADD/UPDATE/REMOVE, TOKEN_DRAG*\_, DRAWING\_\_, DOOR*\*, STAIRS*\*, MAP_UPDATE, GRID_UPDATE, EXPLORED_UPDATE, MEASUREMENT_UPDATE, STAGE_UPDATE, AUDIO_UPDATE, SFX_FIRE, LIBRARY_UPDATE), throttles them to 32 ms, and switches to FULL_SYNC above 20 actions. (source: src/components/SyncManager.tsx:127-290, 472, src/utils/syncUtils.ts:136-240) **Native:** Native: both windows observe one CampaignDocument, so there is no sync protocol.
- [x] On open, World View sends `REQUEST_INITIAL_STATE`. The Architect replies with FULL_SYNC (tokens, library, drawings, doors, stairs, grid, map, explored regions, daylight, measurement, session runtime). (source: src/components/SyncManager.tsx:298-304, 344-366, electron/main.ts:1160-1164, docs/features/world-view-sync-fix.md) **Native:** Native: see above.
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
- [x] Create a map with Map Settings in create mode: name (default "Untitled Map"), optional background image, grid type, grid colour and daylight. The new map becomes active. (source: src/components/MapSettingsSheet.tsx:183-210, src/store/gameStore.ts:603-630) **Native:** Default name "Untitled Map".
- [x] Rename a map in edit mode. An empty name is rejected with a toast. (source: src/components/MapSettingsSheet.tsx:211-220, src/store/gameStore.ts:730-750)
- [x] Delete map **(gap)** — `deleteMap` exists (it refuses to delete the last map and switches to the next or previous map first), but its only UI is `MapNavigator.tsx`, which nothing mounts. [Intended: a delete action for maps with confirmation.] (source: src/store/gameStore.ts:632-690, src/components/MapNavigator.tsx:20, 66)
- [x] MapNavigator (not mounted) — A dropdown map switcher with inline rename (Enter/Esc), delete and add. Use it as a spec for map management UI, not as a current feature. (source: src/components/MapNavigator.tsx)
- [x] There is no UI to rename the campaign itself. The name comes from the file or the template. (source: src/store/gameStore.ts, src/components/Sidebar.tsx:280)

**Native mapping:** Make maps an ordered list in the document's sidebar (`List` with `.onMove`,
`.contextMenu` with Rename, Duplicate and Delete, and a `.onDeleteCommand`). The campaign name
is the document name.

### 5.2 New / open / save / autosave

- [x] File format `.graphium` — A ZIP with `manifest.json` (the campaign JSON) and `assets/` (every `file://` asset copied in with collision-safe basenames, including library thumbnails). (source: electron/main.ts:637-717) **Native:** Native: `.graphiumcampaign` package. `.graphium` ZIPs are imported, and File > Export as .graphium writes them.
- [x] Load — Unzips into a fresh `sessions/<timestamp>/` folder and rewrites asset paths to absolute URLs. Legacy single-map files (no `maps` key) are migrated into "Imported Campaign" / "Imported Map". A missing session console catalog is filled in. (source: electron/main.ts:719-799, 853-901, src/store/gameStore.ts:285-295, 490-518)
- [x] Save — Always shows the native save dialog (Save-As semantics). It writes non-atomically and remembers the path for autosave. (source: electron/main.ts:817-832) **Native:** Native: standard document saving (see 1.3).
- [x] Autosave — Every 60 s, only after a path is known (that is, after a save or load). Atomic `.tmp` + rename. Failures are silent. Web autosaves to IndexedDB. (source: src/components/AutoSaveManager.tsx:16-60, electron/main.ts:834-851) **Native:** Native: macOS autosave in place and Versions.
- [x] Asset security — Saving refuses assets outside the temp, sessions or library roots. A missing asset gives "Campaign asset file not found". (source: electron/main.ts:645-667, electron/pathSecurity.ts) **Native:** Native: assets live inside the package, and asset names are validated. Like TS, which writes only referenced assets, a package drops unreferenced assets (replaced backgrounds, deleted tokens, plates and tracks): they are pruned when the campaign is opened, not at save time, so undo can still restore a removed reference during the session (`CampaignPackage.pruneUnreferencedAssets`).
- [x] New campaign from the menu asks for confirmation. Home "New Campaign" just enters the editor. (see 1.2 and 1.3) **Native:** Native: ⌘N opens a new window, so no confirmation is needed.
- [x] Dirty-state tracking and "unsaved changes" prompts on close **(gap)** do not exist. Closing a window or quitting never warns. [Intended natively: standard document dirty tracking.]
- [x] Compatibility — The native app must open existing `.graphium` ZIPs, legacy single-map manifests included. Native files may use `.graphiumcampaign` (see macos/README.md), but `.graphium` import and export are required for parity. (source: electron/main.ts:853-901) **Native:** Imports both, including legacy single-map manifests, and exports `.graphium`.

**Native mapping:** `DocumentGroup` with a `ReferenceFileDocument` whose `FileWrapper` is a
directory package, or a ZIP via Apple Archive or ZIPFoundation, for `.graphium`. Autosave in
place, Versions, Revert, dirty dot, close prompts and Open Recent all come free. Register
`.graphium` as an imported UTType.

### 5.3 Asset library (persistent, cross-campaign)

- [x] Storage — `userData/library/assets/{id}.webp`, `thumb-{id}.webp`, and `library/index.json`. On startup, library items are merged into the campaign's tokenLibrary with de-duplication by id. (source: electron/main.ts:905-960, src/App.tsx:177-218) **Native:** The app library and `campaign.tokenLibrary` stay separate (their images live in different places), but the Library Manager, the palette and the sidebar Party list show their union, de-duplicated by id with the app library's copy first. Items only the campaign carries are marked and offer "Add to My Library", which copies the image out of the package.
- [x] Add to Library dialog — Preview, Name (required, placeholder "e.g., Red Dragon"), Category (PC, Monsters [default], NPCs, Props, Items, Custom), and Tags (comma-separated, trimmed, placeholder "e.g., dragon, red, large"). Generates a 128x128 WebP thumbnail. A toast reports the result. (source: src/components/AssetLibrary/AddToLibraryDialog.tsx:1-30, 42, 75-150, 216-270)
- [x] Library Manager modal — Search (fuzzy), a category filter (All plus the categories in use), and a thumbnail grid. Each card has hover actions Edit and Delete, a click or "Add to map" action, and is draggable onto the canvas. The footer shows the asset count and an Upload button. (source: src/components/AssetLibrary/LibraryManager.tsx:1-25, 86, 108-160, 226-400)
- [x] Delete asset — Asks for confirmation, then removes the files and index entry and shows a toast. (source: src/components/AssetLibrary/LibraryManager.tsx:151-170, electron/main.ts:962-983)
- [x] Token Metadata Editor — Name (required), category (default Custom), tags, default scale (must be positive), default type PC/NPC, and default vision radius (must be at least 0, only shown for PC). Saves to the index and the store and shows a toast. Opened from Library Manager and the command palette. (source: src/components/AssetLibrary/TokenMetadataEditor.tsx:1-31, 84-125, electron/main.ts:985-1024)
- [x] Token Inspector "Save to library" writes instance overrides back as defaults (see 2.3).
- [x] Token images are resized to at most 512 px WebP. (source: src/utils/AssetProcessor.ts:7-9, 60-71)

**Native mapping:** Store the library in `Application Support/Graphium/Library/` as one folder per
asset with a JSON/Codable index, or use SwiftData. Present it as a sheet with `LazyVGrid`,
`.searchable` and a category `Picker`. Edit metadata in a form sheet. Drag out with
`Transferable`. Generate thumbnails with `QLThumbnailGenerator` or ImageIO.

### 5.4 Session Console (ambience and artwork board)

**What it is.** A DM-side "board" stored in the campaign. It holds image sets ("plates") and
groups of music tracks (YouTube or local audio), plus a few sound effects. The DM triggers them
from the sidebar. World View is the only output: it shows the plate full-window and plays the
audio, so the DM can share World View in Discord with "Include Audio". (source: src/types/sessionConsole.ts:1-80, src/components/SessionConsole/DiscordSetupHelp.tsx)

- [x] Catalog model — Stage chrome (title, which defaults to the campaign name; subtitle; showFrame), defaults (volume 45, duck 27%), imageSets[{title, note, images[{name, cue, src, thumbnailSrc, alt}]}], trackGroups[{title, note, accent bed|road|dread|combat|arrive, tracks[{title, cue, tag, source youtube|local, youtubeId|src, volumeOffset ±30, loop, recommendedImageId}]}], and sfx (synth chime, drone, snap, ping, test-tone, plus local files). (source: src/types/sessionConsole.ts:7-110, 210-232)
- [x] Master bar — World link status: "World closed", "World connected" or "World armed", with a colour. Also a volume slider from 0 to 100, Duck toggle, Pause, Resume, Restart, Stop, Return to Map, and Test Tone. (source: src/components/SessionConsole/SessionConsoleMasterBar.tsx:14-120, src/components/SessionConsole/useWorldLinkStatus.ts)
- [x] "Copy current link" and "Copy all links" — Copy fallback track links (numbered, with YouTube URLs) to the clipboard, with a toast. (source: src/components/SessionConsole/SessionConsolePanel.tsx:44-62, src/utils/sessionConsoleBoard.ts:30-42)
- [x] Board dropzone — Drop images and/or audio files. Image files go to an image set named after the folder. Audio goes to a track group. Audio over 8 MB warns and over 25 MB is rejected. (source: src/components/SessionConsole/SessionConsoleBoard.tsx:44-52, src/utils/sessionConsoleBoard.ts:255-298, src/utils/localAudioLimits.ts:3-9) **Native:** Drop on the panel, or onto one set or group. A folder becomes a set named after it.
- [x] Paste YouTube URL field — Accepts a paste or Enter. Parses raw 11-character ids and youtu.be, watch?v=, shorts, embed and v/ URLs. Playlist-only URLs are rejected. (source: src/components/SessionConsole/SessionConsoleBoard.tsx:54-90, src/types/sessionConsole.ts:150-190, src/utils/sessionConsoleBoard.ts:206)
- [x] "Add from folder" (directory image picker), "New image set" and "New track group" buttons. (source: src/components/SessionConsole/SessionConsoleBoard.tsx:92-140)
- [x] Image set board — Clicking a thumbnail shows that plate in World View (SHOW_PLATE). Thumbnails can be reordered by drag. Each has an edit button. Files can be dropped onto a set. (source: src/components/SessionConsole/ImageSetBoard.tsx:51-130) **Native:** Drag a thumbnail onto another to reorder; drop files onto a set to add them.
- [x] Track group list — Click Play on a track. Tracks can be reordered by drag. Each has an edit button. Files can be dropped onto a group. (source: src/components/SessionConsole/TrackGroupList.tsx:57-125)
- [x] SFX buttons — One per catalog sfx (FIRE_SFX). (source: src/components/SessionConsole/SessionConsolePanel.tsx:110-120)
- [x] Editor sheet — For a plate: Name, Cue and Alt text. For a track: Title, Cue, Tag (accent), Loop toggle, a volume-offset slider (±30) and a recommended plate (None or a plate). (source: src/components/SessionConsole/SessionConsoleEditorSheet.tsx:20-80, 126-215)
- [x] Remove plate, track, set or group **(gap)** — Reducers exist (REMOVE_IMAGE, REMOVE_TRACK, REMOVE_IMAGE_SET, REMOVE_TRACK_GROUP), but no UI calls them. The same goes for renaming sets and groups (UPDATE_IMAGE_SET/UPDATE_TRACK_GROUP) and for `recommendedImageId`, which is stored but never acted on. [Intended: full board editing.] (source: src/store/sessionConsoleReducers.ts:21-44) **Native:** Fixed: remove and rename sets, groups, plates and tracks; recommended plate is in the track editor.
- [x] Settings sheet — "Stage" (title, subtitle, Show frame), "Playback defaults" (default volume on load, duck percent), "Advanced: board pack" (Import replace, Import merge, Export pack, with a skipped/warnings summary), and "Table setup" (the Discord checklist: Krisp off, attenuation 0%, share World View with audio, play the test tone; plus the keyboard list). Also opened from the command palette. (source: src/components/SessionConsole/SessionConsoleSettingsSheet.tsx:1-49, src/components/SessionConsole/sessionConsoleSettingsSections.tsx:29-272, src/components/SessionConsole/DiscordSetupHelp.tsx:1-33)
- [x] Board pack import — Pick `board.json`. Relative files are sandboxed to the pack folder and copied into temp assets. http(s) assets are fetched with a byte cap. YouTube is kept. Per-row errors are reported as skipped. Replace or merge into the catalog. Plate thumbnails are generated. (source: electron/sessionConsolePackIngest.ts:22-60, electron/sessionConsolePackFiles.ts:130-220, src/utils/sessionConsolePack.ts:569-1075, src/utils/sessionConsoleBoard.ts:149)
- [x] Board pack export — Pick a folder. Writes `board.json` plus `images/` and `audio/` copies, and YouTube watch URLs. Reports "Board pack exported" or "finished with errors". (source: electron/sessionConsolePackFiles.ts:224-290, src/utils/sessionConsolePack.ts:1076-1125, docs/planning/session-console-pack.example.json)
- [x] Runtime transport — PLAY_TRACK, PAUSE, RESUME, RESTART (bumps restartSeq), STOP, SET_VOLUME (0-100), SET_DUCKED, FIRE_SFX (bumps sfxSeq), SHOW_PLATE and RETURN_TO_MAP. (source: src/store/sessionConsoleReducers.ts:47-56, 665-779)
- [x] World audio engine — The YouTube IFrame player or an `<audio>` element. Effective volume = clamp(volume + offset), multiplied by duck% when ducked. Fades: stop 500 ms, switch track 300 ms out then in, mixer change 250 ms. Looping follows the track. Audio is silent until armed. Load or play errors are reported back to the Architect as SESSION_CONSOLE_WORLD_EVENT (armed, unarmed, ready, error). (source: src/components/SessionConsole/WorldAudioEngine.tsx, src/components/SessionConsole/useWorldTransport.ts:41-198, src/components/SessionConsole/worldAudioYoutube.ts, src/types/sessionConsole.ts:117-131, electron/main.ts:1176-1182)
- [x] Synth SFX — Web Audio oscillator recipes for chime, drone, snap, ping and test tone. Local SFX use decoded buffers that are cached. (source: src/components/SessionConsole/worldStageSfx.ts:6-161)
- [x] Hotkeys `1` to `9`, `D` and `Esc` (see 1.4).
- [x] The YouTube embed needs a non-`file://` origin and a Referer header, which is why the `graphium://` protocol and `YOUTUBE_EMBED_URL_FILTER` exist. (source: electron/main.ts:374-379, 1118-1123, electron/graphiumProtocol.ts) **Native:** Native: the hidden WKWebView loads the IFrame API with base URL https://graphium.app.

**Native mapping:** Local audio maps to `AVAudioEngine` (`AVAudioPlayerNode` per bed, mixer volume
ramps for fades and ducking) and synth SFX to `AVAudioSourceNode` oscillators. YouTube is the
hard part: use a hidden `WKWebView` hosting the IFrame API with
`mediaTypesRequiringUserActionForPlayback = []` and a custom `WKURLSchemeHandler` origin plus
Referer. "Arming" is not needed natively, because AVAudioEngine has no autoplay gate. Keep a
"World audio ready" status instead. Audio is owned by the app process, so Discord window-share
audio capture works as long as World View is the shared window. On macOS 13 and later,
ScreenCaptureKit app-audio capture is per application, not per window. Document this for DMs.

### 5.5 Dungeon generator

- [x] Dialog — Number of rooms (3-15, default 5), Min room size (2-6, default 3), Max room size (4-12, default 8), and a "Clear existing walls and doors" toggle. Note: "drawn using the Wall tool... fully interactive". Cancel and Generate buttons, with Generate focused on open. Opened from the menu, the palette, the home card, `Cmd+G` on home, and the mobile More menu. (source: src/components/DungeonGeneratorDialog.tsx:16-198, src/components/DungeonGeneratorDialogGate.tsx)
- [x] Algorithm — Organic growth: a central room, then repeated "random existing room + corridor (4 cells long, 1 wide) + new room" with collision retry. Everything is grid-aligned to the current gridSize. The canvas size is the window size. (source: src/utils/DungeonGenerator.ts:151-200, docs/DUNGEON_GENERATOR.md)
- [x] Output — Wall drawings (red, 8 px) and doors added to the active map, so fog works immediately. No stairs and no map image. (source: src/components/DungeonGeneratorDialog.tsx:44-80)

**Native mapping:** Port DungeonGenerator to GraphiumCore with a seedable RNG
(`RandomNumberGenerator`), which makes it testable. Show a SwiftUI sheet with `Stepper`s. Add
the generated content as one undoable edit.

---

## 6. Platform and device behaviours to reproduce

- [x] Unified pointer pipeline — Mouse, pen and touch go through the same handlers. Multi-touch (2 or more fingers) is handled separately for pinch and pan. (source: src/components/Canvas/CanvasManager.tsx:701-712, src/components/Canvas/hooks/useCanvasInteraction.ts:226-352) **Native:** Mouse, pen (tablet events) and trackpad. No touchscreen on a Mac.
- [x] Pen pressure maps to stroke width through a selectable curve (light, normal, heavy). Pressure sensitivity can be toggled (default on). (source: src/store/touchSettingsStore.ts:1-20, 116-118, src/components/Canvas/CanvasManager.tsx:139-141) **Native:** Settings > Pen tablet.
- [x] Palm rejection modes: off, touchSize (reject contact over 40 px, the default), stylusOnly (ignore touch once a pen has been seen), smartDelay (ignore touch for 300 ms after the pen lifts). There is also a desktop-only mode that ignores all touch. (source: src/store/touchSettingsStore.ts:21-30, 120-130, 177-215, src/components/Canvas/hooks/useCanvasInteraction.ts:186-223) **Native:** Not applicable: Macs have no touchscreen, so there is nothing to reject.
- [x] Touch settings persist in localStorage `graphium-touch-settings`, but there is no settings UI (PreferencesDialog was removed). **(gap)** [Intended: a Settings pane.] (source: src/store/touchSettingsStore.ts:219, CHANGELOG.md "Removed") **Native:** Fixed: Settings (⌘,) has appearance and pen pressure.
- [x] Documented but not implemented in source — Tilt shading, hover preview, barrel-button tool switching and eraser-end. Flags exist (`tiltSensitivityEnabled`, `hoverPreviewEnabled`, `barrelButtonEnabled`), but no code reads tilt, hover or `button`. DEVICE_COMPATIBILITY.md lists them as supported. Treat them as new work if wanted. (source: src/store/touchSettingsStore.ts:62-66, 131-135, DEVICE_COMPATIBILITY.md:125-174) **Native:** Not ported (not implemented in TS either).
- [x] Touch targets — Mobile menu button at least 48x48, mobile toolbar buttons at least 56 tall, inspector buttons at least 44 tall, home quick actions at least 44. Enforced by tests. (source: tests/touch-targets.spec.ts, src/components/TokenInspector.tsx:246, src/components/HomeScreen.tsx:1739) **Native:** Not applicable: desktop pointer input; controls use standard macOS sizes.
- [x] Suppressed browser behaviours on the canvas — `touch-action: none`, no text selection, no iOS callout. (source: src/components/Canvas/CanvasManager.tsx:1126-1137) **Native:** Not applicable.

**Native mapping:** On macOS, the relevant inputs are the mouse, Magic Trackpad (gesture events,
not raw touches), Wacom/Huion tablets (`NSEvent.pressure`, `.tilt`, `.subtype == .tabletPoint`,
`pointingDeviceType == .eraser` for eraser-end, `buttonMask` for barrel buttons), and Sidecar with
Apple Pencil, which arrives as tablet events with pressure. Palm rejection is not needed on macOS
because there are no direct touch screens. Collapse the four modes into a "Tablet" settings group
(pressure curve, pressure on/off). Use `NSTouch` only if raw trackpad touches are wanted.

---

## 7. Accessibility

- [x] WCAG 2.1 AA contrast for all UI text and controls, using Radix Colors steps 11-12 on steps 1-3 and borders at 3:1 or better. Disabled text is intentionally below AA. The canvas is exempt. Checked with axe-core in Playwright. (source: docs/features/wcag-audit.md, tests/accessibility.spec.ts) **Native:** Native: system colours and controls, which meet macOS contrast and support Increase Contrast.
- [ ] World View projector legibility test (see 4.1). (source: tests/world-legibility.spec.ts) **Native:** Open: no automated legibility test yet.
- [x] Dialogs and sheets trap focus, close on Esc and expose `role="dialog"`. Templates restores focus. (source: CHANGELOG.md "Every dialog and sheet now traps focus", src/components/HomeScreen.tsx:228-273) **Native:** Native sheets and windows handle focus and Esc.
- [x] ARIA — Labelled icon buttons throughout (for example "Select tool", "Pause game", "Close notification", "Remove {name} from recent campaigns", "Session volume", "Show plate {name}"). Tool buttons use `aria-pressed`. The active map uses `aria-current`. Disclosures use `aria-expanded`. (source: src/components/Toolbar.tsx:92-196, src/components/Sidebar.tsx:320-322, src/components/Toast.tsx:91, src/components/SessionConsole/sessionConsoleSettingsSections.tsx:212) **Native:** Icon buttons have labels; board thumbnails say "Show plate {name}"; tracks say "Play {title}"; toast close is labelled.
- [x] Reduced motion — Durations drop to 0 under `prefers-reduced-motion`. WorldStage plate crossfade and YouTube fades are skipped. The home "Lite mode" is a manual equivalent. (source: src/styles/theme.css:404-410, src/components/SessionConsole/WorldStage.tsx:41, 71, src/components/SessionConsole/worldAudioYoutube.ts:189) **Native:** Reduce Motion skips the plate crossfade and audio fades.
- [x] Image alt text for plates (an editable "Alt text" field). (source: src/components/SessionConsole/SessionConsoleEditorSheet.tsx:213, src/components/SessionConsole/WorldStage.tsx:24-30)
- [x] Canvas accessibility is absent today. Tokens and doors are not exposed to assistive technology. Consider adding this natively (see the mapping). **Native:** Added: tokens and doors are VoiceOver elements; press selects a token or toggles a door.

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
