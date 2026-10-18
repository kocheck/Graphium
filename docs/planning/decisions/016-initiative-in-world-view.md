# Decision 016: Initiative order on the World View

Status: DEFAULT BUILT (2026-10-18), waiting on Kyle's playtest

## Question

SESSION_TIMING's `encounter-setup` friction ends when "initiative is going", and Graphium had no turn order (issue #356). What is the smallest useful turn order, and what do players see of it?

## Default built

Each map keeps its own order: token ids with the initiative the DM typed, whose turn it is, and the round. Saved in the map as `initiative` (CORE_SPEC §1.3), only while there is one.

- **The DM builds it from the canvas.** Right-click a token (or a selection) and choose Add to Initiative, use the token inspector's button, or Session > Add Selection to Initiative. The order appears in the sidebar under Initiative: each combatant's real name and an editable initiative, Previous, Next, Sort (highest first, ties keep their order) and Clear. Right-click a row to make it the current turn, select its token or remove it.
- **Turns step from the keyboard.** Session > Next Turn (⌘]) and Previous Turn (⌘[) wrap around the order; Next past the last combatant starts the next round. The first Next Turn starts with the top of the order. Every change is undoable.
- **Clear Initiative ends the encounter.** Deleting a token takes it out of the order; if it was its turn, the turn passes to the next combatant.
- **Players see the order, top left of the World View**, on the etched plate the minimap uses with `world-scrim` behind the names: "Initiative" at 18 pt, then each combatant at 22 pt, the current one bold with a play glyph on a `world-action` band. No initiative numbers, so the DM's rolls stay the DM's. It is hidden while paused and under a Session Console plate.
- **Names are the ones players see** (decision 014): a token's players' name, else its name. A token whose name is hidden from players shows as "Unknown" rather than being skipped, so players still know something takes a turn there; the DM can rename it to anything else.
- **NPCs the players can't see are never listed.** While it is a hidden NPC's turn, no line is highlighted.
- **MCP.** Not exposed: initiative is table-time, not map building.

## What would change it

Playtesting: if "Unknown" lines give away too much, skip them like hidden NPCs. If the DM wants the numbers on the projector, add a switch. If long fights outgrow the plate, show only the next few turns.
