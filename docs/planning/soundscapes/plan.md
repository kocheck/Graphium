# Soundscapes (native app)

Asked for by Kyle on 2026-10-18: build options into the Session Console so a DM can play soundscapes made from the free sounds Thaumaturgy lists at <https://thaumaturgy.app/docs/sounds>, starting from the original recordings and each one's real license rather than the site's digest. Reviewed by a Fable advisor pass the same day; its changes are folded in below.

Rights first, then the model and the engine, then the sounds and the UI. Each step is one PR.

## What a soundscape is

A soundscape is a few **layers** that play together under the current track:

- **Bed**: one looping recording (rain, cave air, tavern walla) at a level.
- **Scatter**: a pool of short clips fired at random intervals between a min and max (a drip every 4–11 s, a distant growl every 40–90 s). Clips come from a shuffle bag so the same one never plays twice in a row, each at ±3 dB.

The DM picks a scene, then nudges each layer with a slider or mutes it. That is the whole UI at the table.

v1 is six scenes (Cave, Tavern, Forest night, Storm, Dungeon, Battle), each one bed and two scatter pools: about 6 beds and 40 one-shots, under 15 MB, bundled in the app. No downloads, no scene editor, no pitch or pan jitter. Those wait until the six scenes have been used at a real table.

This reverses one v1 decision in [session-console-design.md](../session-console-design.md): "stacked beds" was out of scope. The rest holds: images and audio stay independent, World View owns playback, duck and stop apply to everything, and the World never receives the catalog.

## Sources and rights

Checked 2026-10-18 against each source's own terms, not Thaumaturgy's summary.

| Source | What it gives us | License (as checked) | Use? |
| --- | --- | --- | --- |
| Freesound, the 603 recordings Thaumaturgy lists ([freesound-candidates.tsv](./freesound-candidates.tsv)) | Beds and scatter clips: caves, water, weather, fire, crowds, creatures, smithing | The page states "603 recordings, CC0" once, with no per-sound license. A spot-check of 45 IDs on Freesound (every 16th, plus every ID below 50000) found all 45 live and CC0 ([spot-check](./license-spotcheck-2026-10-18.tsv)). | Yes, per sound, after step 1 records each one |
| Kenney.nl (RPG Audio, Impact Sounds, Interface Sounds) | One-shots: doors, footsteps, weapons, impacts | CC0, "attribution is not required" ([kenney.nl/support](https://kenney.nl/support)) | Yes |
| "Water drips in the cave HQ" by tosha73 ([546359](https://freesound.org/people/tosha73/sounds/546359/)) | Cave drips | CC-BY 4.0 | Not in v1. A CC0 drip keeps v1 free of attribution duties. If added later, the credit (author, title, link, license name and URL, "edited") travels with the file and appears in the app. |
| Mixkit | Battle, castle, tavern, weather, animal effects | "You can't redistribute the Item on its own, as stock, in a tool or template" ([terms](https://mixkit.co/license/modal/sfxFree/)) | **No.** A soundboard that hands sounds to the DM is a tool. Fill those roles from Freesound or Kenney. |
| Thaumaturgy's processed Ogg files | Their trimmed, normalized, looped cuts | Their own work on top of the sources | **No.** We start from the originals. |

Six candidates are by `deleted_user_*` accounts (164472, 346682, 164670, 132929, 254977, 177242). CC0 needs no credit, but skip them where an equal recording exists so every sound has a live source page.

## Steps

0. **Ogg bug (small PR, now).** `SessionConsoleAudio.allowedAudioExtensions` accepts `ogg` (`SessionConsoleRuntime.swift:157`), but Core Audio has no Vorbis decoder as far as we know, so a dropped `.ogg` likely fails at play time. Confirm on Kyle's Mac; if it fails, reject `.ogg` at drop with a clear message (or transcode on import).

1. **Rights ledger.** `tools/sounds/ledger.py` takes the chosen Freesound and Kenney sounds and writes `macos/Resources/Sounds/ledger.json`: per file, the source URL, author, license and license URL, the raw `/apiv2/sounds/<id>/` response, the download date, the original's sha256, what we did to it, and the shipped filename. CC licenses can't be revoked, so the license at download time is what counts; the build never calls the network. A unit test fails when a shipped file has no row, its hash or license doesn't match the row, or the license isn't CC0. Needs a Freesound API key from Kyle, kept in the environment and never committed.

2. **Curate and process.** Pick the six scenes' sounds from the candidates and Kenney. Download originals (Freesound originals need a login; previews aren't good enough for beds). A checked-in ffmpeg script trims, loops beds with a 2–4 s equal-power crossfade at the seam, and normalizes. Encode beds with `afconvert` to AAC with gapless metadata (or ALAC if the seam still clicks), since the two-copy loop in `WorldAudioEngine.swift:118-121` clicks on AAC padding otherwise. Name files with UCS categories (`AMBCave_DripsDistant_….m4a`). Loudness targets are set in the validation below, not guessed here; one-shots in a pool are matched by momentary max and true peak, then trimmed by ear.

3. **Model.** Add to `SessionConsoleCatalog` (version 2, old files decode with no soundscapes):
   ```swift
   struct Soundscape { id, title, layers: [SoundLayer] }
   struct SoundLayer {
       id, title
       kind: .bed(src) | .scatter(srcs: [String], minInterval, maxInterval)
       level: Double   // 0…100, the same linear scale as track volume
       muted: Bool
   }
   ```
   Runtime gains the playing soundscape and its layer levels next to `audio`, with commands `playSoundscape`, `setLayerLevel`, `muteLayer`, `stopSoundscape`. `stop` and `Esc` stop both; duck applies to both. Pure-model tests beside `SessionConsoleTests`.

4. **Engine.** In `WorldAudioEngine`, a soundscape `AVAudioMixerNode` beside the music and effects nodes. One player node per bed, looped the way music is. Each scatter layer schedules its next clip with `AVAudioTime` a few seconds ahead on a small pool of player nodes, using a seeded random source so a test can check the interval and gain bounds. Scene changes crossfade over 2 s. A 3-layer scene should stay under 3% CPU on Kyle's Mac.

5. **Sounds on disk (file over app).** The six scenes' files ship in the app bundle and are read from `Bundle.main`, with `ledger.json` beside them. When a soundscape is used in a campaign, its files are copied into the campaign's `assets/`, as local tracks are today, so a `.graphium` plays the same on another Mac. Later, a DM-chosen sounds folder (default `~/Documents/Graphium/Sounds`, next to campaigns) can hold more; not `~/Music`, which would need a whole-library sandbox entitlement once the App Sandbox is on (`macos/docs/PRINCIPLES.md:82`).

6. **UI.** In the Console, a Soundscapes group with one button per scene and, under the playing scene, a slider and mute per layer. Follows `macos/docs/design/DESIGN.md`.

## How we know it's right

- **Rights:** the offline ledger test passes for every shipped file.
- **Through the real chain:** a player records the Discord stream on their end while the DM plays each scene. Measure that recording's loudness per scene (ffmpeg `ebur128`) and run a click detector over it. Set the bed and one-shot levels from those numbers, so ambience survives Discord's compression and noise suppression and no scene change makes the DM reach for the slider. This tests levels, codec and loop seams where players actually hear them.
- **Loops:** no audible or detected seam across 30 minutes of each bed in that recording.
- **Engine:** model and scheduling tests pass; CPU stays under budget in Activity Monitor during a scene.
