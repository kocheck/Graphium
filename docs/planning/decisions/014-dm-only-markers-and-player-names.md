# Decision 014: DM-only markers and token names for players

Status: DEFAULT BUILT (2026-10-18), waiting on Kyle's playtest

## Question

An MCP field report from a real prep session found nothing on the map could be DM-only except notes: markers (trap areas, patrol routes) and token names ("Vecna") showed on the World View. Kyle chose to build both a DM-only switch for markers and a players' name for tokens (issue #350).

## Default built

- **DM-only markers.** Right-click a marker, Hide from Players (Show to Players undoes it); it acts on every selected marker when the clicked one is among them. The World View never draws a DM-only marker, explored or not. The Architect draws it faded and dashed, so the state reads by shape as well as tone. Saved as `isDMOnly` on the drawing, written only when true.
- **Names for players.** The token inspector has Show Name to Players and a Players See field. Players See empty shows the token's name, as before; text shows that instead ("Hooded figure"); the switch off shows no name. The World View label and VoiceOver there use it; the Architect always shows the real name. Saved as `playerName` on the token: absent is the name, empty is none. It is per token, not a library default, since a disguise belongs to one creature.
- **MCP.** `draw_markers` and `update_objects` take `dm_only`; `add_tokens` and `update_objects` take `player_name` (null for the name, "" for none); `get_map` reports both, and `render_map`'s players' view applies them.

## What would change it

Playtesting: if the dashed, faded marker is hard to read on busy art, try a dashed outline at full strength instead. If libraries need a default players' name (every "Mimic" shows as "Chest"), add `defaultPlayerName` to the library item.
