# macOS Release Guide

How Graphium ships as a real Mac app: signed, notarized, auto-updating, and owning `.graphium`
files in Finder. This is also the record of the macOS audit (October 2026) and what is still
unverified.

## Decisions

**Stay on Electron.** Graphium's main process is about 1,300 lines of file I/O, ZIP
(de)serialization, custom protocols and two-window IPC, and the renderer is a Konva canvas
that already runs in Chromium. Tauri would mean rewriting the main process in Rust and moving
the canvas onto WebKit (Safari), whose pointer-pressure behaviour differs from Chromium (see
`DEVICE_COMPATIBILITY.md`). Native (Swift) would mean rewriting the whole product. None of the
macOS gaps below come from Electron. They come from packaging and main-process gaps.

**Developer ID, not the Mac App Store.** The App Store requires the App Sandbox. Graphium
writes campaigns anywhere the user picks, keeps a library at a user-chosen path
(`SELECT_LIBRARY_PATH`), and reads arbitrary `.graphium` files from Finder. Under the sandbox
each of these needs security-scoped bookmarks, and the auto-updater would have to be removed.
The "local sovereignty" positioning also fits direct download better. Revisit only if
App Store discovery becomes a goal.

**Separate arm64 and x64 builds, not universal.** A universal app carries two copies of
Electron (about 500 MB vs about 250 MB). `electron-updater` reads `latest-mac.yml` and installs
the zip whose name contains `arm64` on Apple Silicon, so split builds update correctly.

## Audit: gaps ranked by user harm

Evidence comes from building the mac target (`electron-builder --mac zip --arm64 --x64`) and
reading the produced `Info.plist`, binaries and `latest-mac.yml`.

| #   | Gap                                                                                                                                                          | Evidence                                                                                                           | Status                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 1   | Unsigned, not notarized: Gatekeeper blocks first launch ("damaged / can't be opened")                                                                        | electron-builder log: `skipped macOS application code signing`. No identity, entitlements or notarize config       | Config + CI done; **needs Apple credentials**                                                    |
| 2   | Auto-update can't work on macOS                                                                                                                              | Only a `dmg` target. Squirrel.Mac installs from a `zip`, and requires a signed app                                 | Fixed (zip target); signing per #1                                                               |
| 3   | Double-clicking a `.graphium` file does nothing                                                                                                              | No `CFBundleDocumentTypes` / UTI in `Info.plist`; `OPEN_FILE_FROM_OS` not in the preload allowlist and no listener | Fixed; e2e test `tests/electron/openFile.electron.spec.ts`                                       |
| 4   | No Edit menu: ⌘C / ⌘V / ⌘X / ⌘Z / ⌘A don't work in text fields                                                                                               | `buildApplicationMenu` had no Edit menu                                                                            | Fixed; asserted in `startup.electron.spec.ts`                                                    |
| 5   | Intel Macs get no build                                                                                                                                      | No `arch`; CI's `macos-latest` runner is arm64                                                                     | Fixed: arm64 + x64                                                                               |
| 6   | Window restored off-screen after unplugging the projector or TV                                                                                              | Saved bounds reused without checking connected displays; World View position not remembered at all                 | Fixed (`electron/windowBounds.ts`, unit-tested)                                                  |
| 7   | File → Open from the home screen loads the campaign but stays on the home screen                                                                             | `App.tsx` menu handler never set the view to `EDITOR`                                                              | Fixed                                                                                            |
| 8   | No Open Recent, no title-bar proxy icon, Dock click can't bring back the Architect window while the World View is open, no Help menu                         | Main-process review                                                                                                | Fixed                                                                                            |
| 9   | Wrong Finder category (`developer-tools`)                                                                                                                    | `LSApplicationCategoryType`                                                                                        | Fixed: `role-playing-games`                                                                      |
| 10  | 350 MB app; about 120 MB is renderer-only `node_modules` packed into `app.asar` (`lucide-react` 30 MB, the `shadcn` CLI and its `ts-morph`/`@babel`/MCP SDK) | `app.asar` 90 MB vs `dist` 12 MB. The main process imports only `electron` and `ajv` at runtime                    | **Open.** Move renderer-only and CLI deps to `devDependencies`, then smoke-test the packaged app |
| 11  | Apple Silicon canvas performance and power use are unmeasured                                                                                                | No Instruments data                                                                                                | **Open** (see Profiling)                                                                         |

Already fine: dark mode follows the system (`themeManager.ts`, `NSRequiresAquaSystemAppearance = false`),
the app menu has About / Services / Hide / Quit, `window-all-closed` keeps the app alive on
macOS, and full screen comes from the `togglefullscreen` role (⌃⌘F).

## One-time setup (repository owner)

1. Join the Apple Developer Program ($99/year).
2. In Xcode → Settings → Accounts → Manage Certificates (or on developer.apple.com), create a
   **Developer ID Application** certificate. In Keychain Access, export it with its private key
   as a `.p12` file with a password.
3. In App Store Connect → Users and Access → Integrations → **Team Keys**, create an API key with
   the Developer role. Download the `.p8` once, and note the Key ID and Issuer ID.
4. Add GitHub Actions secrets (Settings → Secrets and variables → Actions):

| Secret             | Value                                 |
| ------------------ | ------------------------------------- |
| `CSC_LINK`         | `base64 -i DeveloperID.p12 \| pbcopy` |
| `CSC_KEY_PASSWORD` | the `.p12` export password            |
| `APPLE_API_KEY_P8` | full text of `AuthKey_XXXXXXXXXX.p8`  |
| `APPLE_API_KEY_ID` | the Key ID                            |
| `APPLE_API_ISSUER` | the Issuer ID                         |

Without these secrets the release workflow still builds, unsigned, and skips the verify step.
With them it signs, notarizes, staples, and **fails the release** if `codesign`, `spctl` or
`stapler` reject either app.

## Definition of done

A release is good on macOS when all of these pass. None of them can run in a Linux container,
so each needs a Mac or the CI macOS runner.

1. **Notary service accepts it.** In the CI log, electron-builder's notarize step succeeds. To
   check by hand: `xcrun notarytool history --key AuthKey.p8 --key-id $ID --issuer $ISSUER`
   should show `Accepted`.
2. **Gatekeeper reports Notarized Developer ID.**
   `spctl --assess --type execute -vvv /Applications/Graphium.app` prints
   `source=Notarized Developer ID`. CI runs this on both architectures.
3. **Clean-Mac first launch.** On a Mac (or VM) that has never run Graphium, download the
   `.dmg` with a browser so it is quarantined (`xattr -p com.apple.quarantine <file>.dmg` prints a
   value). Open it, drag Graphium to Applications, and launch. Expect no Gatekeeper warning and
   no right-click → Open workaround.
4. **Auto-update N → N+1.** Install release N, publish N+1, then press `?` → Check for Updates →
   Download → Restart. The app relaunches as N+1, and `~/Library/Logs/Graphium/main.log` shows
   the download and no signature error. Do this on Apple Silicon and on Intel (or Rosetta) to
   confirm each picks its own zip.
5. **Finder owns `.graphium`.** `mdls -name kMDItemContentType some.graphium` prints
   `com.graphium.campaign`. Double-clicking it opens that campaign in the editor, both
   when Graphium is closed and when it is already running. File → Open Recent lists it after
   opening.
6. **Electron e2e on macOS.** `npm run build:electron && npx playwright test --project=Electron-App`
   passes on a Mac. CI currently runs it only under `xvfb` on Linux.

## Profiling on Apple Silicon (open)

1. Build the app locally (`npm run build`) and open a large real campaign (many tokens, fog,
   drawings). The `?stress=1` fixture (`src/utils/stressFixture.ts`) only reaches the web/dev
   build through the URL. Pan and zoom continuously for 60 seconds with the World View on a
   second display.
2. Instruments → **Time Profiler**, attached to `Graphium Helper (Renderer)`. Record the top
   self-time symbols.
3. Instruments → **Allocations**, run for 10 minutes. Memory should plateau, not climb.
4. `sudo powermetrics --samplers cpu_power,gpu_power -i 1000` while idle on a map. Idle power
   should drop to near zero when nothing is animating.

Fix the top hotspot it shows, then re-measure.
