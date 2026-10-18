# Decision 013: Sounds on note pins

Status: DEFAULT BUILT (2026-10-18), waiting on Kyle's playtest; soundscapes to follow

## Question

Kyle asked to attach sounds or music to note pins, so the DM can trigger them when the moment comes. How do pins hold sounds, and when do they play?

## Default built

- **Pins refer to Session Console entries; they never hold audio.** A note's `sounds` lists tracks and effects by id (CORE_SPEC §1.3). The audio stays in the campaign's Session Console, so there is one copy, one place to replace it, and the file stays small. A sound whose entry was deleted shows as missing and can't play.
- **The DM plays them by hand.** The note inspector's Sounds section has a Play button per sound. It sends the same command as the Session Console (`SessionCommand.playTrack` / `.fireSfx`), so volume, ducking and the World View's audio output behave identically.
- **Play when shown** is off by default. When on, the sound plays by itself when the note goes up on the World View (Show on World View, or clicking a shared pin there), but only while a World View is open and unpaused, so a track never starts later, unasked.
- **MCP.** `add_notes` and `update_objects` take `sounds` by Session Console name, `get_map` lists them by name, and `check_map` reports `note_sound_missing`.
- **Forward compatible.** A sound kind the app doesn't know is skipped on read, so a file saved by a newer build (with soundscapes) still opens.

## Next

Once soundscapes land in main, add a `soundscape` kind that starts a soundscape from the pin.

## What would change it

If DMs want sound without the Session Console (dragging a file straight onto a pin), pins could import into the Session Console behind the scenes rather than holding audio themselves.
