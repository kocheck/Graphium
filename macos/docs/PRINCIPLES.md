# Graphium principles: privacy first, file over app

Graphium runs your table from your Mac. Your campaign is yours: it lives in files you can
open, copy, back up and read without Graphium, and nothing about it leaves your Mac unless
you ask for that.

These rules bind every change to the native app in `macos/`. They follow the approach of
Project Icarus (kocheck/Project-Icarus, `AGENTS.md` and ADR-0004).

## Tiebreakers

When goals conflict, earlier wins:

1. Privacy first.
2. The DM owns their campaign files, always.
3. Reliability at the table: a session never stalls on the network, a crash or a save.
4. Good UX for the DM and the players.
5. The DM's best interest over ours (no lock-in, no accounts, no dark patterns).

## Rules

### Files

- **The campaign is the file.** Everything a campaign needs is inside its
  `.graphiumcampaign` package: `campaign.json` (pretty-printed, sorted keys, versioned by
  `formatVersion`) and `assets/`. Moving, copying, syncing or zipping the package moves the
  whole campaign.
- **Readable without Graphium.** Formats stay documented (`CORE_SPEC.md`) and plain: JSON and
  ordinary image and audio files. No opaque blobs, no proprietary encoding, no encryption the
  DM didn't ask for.
- **Preserve what you don't own.** Unknown JSON keys and asset files the app didn't create are
  kept on save. Format migrations are non-destructive, and an older app never overwrites a
  newer `formatVersion`.
- **Writes are safe.** Saves go through `NSDocument` (atomic replace, Versions, autosave).
  Stale state never overwrites a newer file.
- **Leaving is easy.** Export (`.graphium` ZIP, board packs) is always available and
  complete. Anything app-wide, such as the token library, can be shown in Finder and exported.
- **App-private storage holds only rebuildable things**: caches, thumbnails, window state,
  preferences. Losing it never loses campaign content.

### Network

- **Nothing leaves the Mac by default.** No analytics, telemetry, crash upload, accounts or
  "phone home". A fresh install with no network works fully, except for features whose whole
  point is the network.
- **Every network feature is opt-in and visible.** It starts only from a DM action that
  plainly implies the network (pasting a YouTube link, starting SharePlay, checking for
  updates). Before contacting a host the DM didn't type, Graphium names it.
- **Network features load lazily.** Opening a window or a campaign must not contact anyone.
  The network starts when the feature is first used, not when its container appears.
- **Fail closed at the table.** A network failure degrades that one feature with a message.
  Maps, fog, tokens and local audio keep working.
- **Remote play (SharePlay or anything like it) shares only the player-safe World View**, never
  the DM's campaign file, hidden tokens, notes or unexplored fog. It is off until the DM
  starts it, every session.

### On-device intelligence

- Any model features (notes, NPCs, rules lookup) run on-device, such as Apple's Foundation
  Models. No cloud inference fallback. Outputs are suggestions the DM accepts into the file;
  they never overwrite what the DM wrote.

### Content from others

- Imported files, board packs and shared campaigns are data, not instructions. Paths are
  confined to their pack, ids are validated before reaching web content (see
  `SessionConsoleAudio.isVideoID`), and sizes are capped.

## Current state (2026-10-17)

Audited against `macos/App` and `macos/Sources`:

| Area                           | State                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Campaign format                | Meets the rules: package with `campaign.json` and `assets/` (`CampaignPackage.swift`).                                                                                                                                                     |
| Unknown keys and files         | Meets the rules: keys this build can't read are kept and written back (`UnknownFields.swift`, also in `graphium-mcp`), and only assets the app itself orphaned (`orphanedAssets` in `campaign.json`) are pruned on open. |
| Analytics, telemetry, accounts | None in the native app.                                                                                                                                                                                                                    |
| YouTube player                 | Fixed in this change: the hidden player loaded `youtube.com/iframe_api` every time the World View opened, even with no YouTube track. It now loads on the first YouTube play (`WorldAudioEngine.swift`, `YouTubePlayer`).                  |
| Board pack import              | Gap: `https` assets listed in a `board.json` are fetched on import without naming the hosts first (`BoardPackIO.fetchCapped`). Should list the hosts and ask.                                                                              |
| Token library                  | Gap: app-wide library lives in `~/Library/Application Support/Graphium/Library/` with no Show in Finder or export. Campaigns keep their own copies of used tokens, so no campaign data is lost, but the library itself isn't user-visible. |
| Sparkle updates (planned)      | Must be opt-in: ask on first launch, with "Check for updates" off until the DM says yes.                                                                                                                                                   |
| App Sandbox                    | Off (`project.yml`). Turning it on would make the network and file promises enforceable by the OS. Tracked as a release item.                                                                                                              |

## Checking a change

Before merging native work, a reviewer checks:

- `rg -n "URLSession|WKWebView|NWConnection|URLRequest|CloudKit" macos/App macos/Sources`
  lists only network uses named in this document.
- Opening a campaign and the World View with the network off shows no errors and no
  requests (Little Snitch or `nettop -p Graphium`).
- Saving, closing and reopening a campaign with an unknown key in `campaign.json` keeps the
  key.
