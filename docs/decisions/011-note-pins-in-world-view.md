# Decision 011: Note pins in the World View

Status: DEFAULT BUILT (2026-10-18), waiting on Kyle's playtest

## Question

Kyle asked for note pins that open in the side panel, with DM notes and player-facing notes. What may players see of them, and how?

## Default built

Each pin holds a title, DM notes and player notes, saved in the map in `campaign.json` (`notes`, CORE_SPEC §1.3). DM notes never reach the World View, in any state.

- **New pins are the DM's alone.** In the Architect they show as a white card with a note glyph and a dashed edge.
- **Show Pin to Players** (inspector or right-click) puts the pin on the World View: a 40 pt `world-action` card with a white speech-bubble glyph and its title at 18 pt, and in the Architect the pin gets a solid edge and the bubble glyph. Shared pins draw over the fog, as tokens do, because the DM chose to show them; a pin in unexplored ground gives away only what the DM shared.
- **Clicking a shared pin on the World View** opens a card at the top right with the title (28 pt) and player notes (22 pt), `world-ink` on `world-scrim`, and a Close button (Esc). It never shows DM notes.
- **Show on World View** (inspector or right-click) opens the same card from the Architect without sharing the pin, for read-aloud text and handouts on a projector nobody clicks. The card is session-only state, like a broadcast measurement, and closes when the DM switches maps or deletes the note.

## What would change it

Playtesting on the TV: if shared pins in unexplored ground spoil rooms, draw them under the fog instead (only where explored or seen). If players never click the projector, the pin glyph could go and only Show on World View stay.
