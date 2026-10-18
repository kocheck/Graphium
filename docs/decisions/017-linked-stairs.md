# Decision 017: Linked stairs

Status: DEFAULT BUILT (2026-10-18), waiting on Kyle's playtest

## Question

Kyle asked for a Stairs tool: drop a token on one end and it appears at the other, so a dungeon's floors can sit side by side on one map. What do players see, and how does travel behave around groups, the DM and the fog?

## Default built

Graphium already stored stairs (from the web app) but nothing made them or used them. Two ends now link (`Stairs.linkedStairsId`, CORE_SPEC §1.8).

- **Both ends show the same letter** (A and A, B and B) on the Architect and the World View, so everyone can tell which stairs connect. Stairs stay under the fog as before, so players only see the letters on ground they have explored; that is all they learn about where a staircase leads.
- **Travel happens when a drop steps onto linked stairs.** The token the DM or a player grabbed decides: if its centre lands on linked stairs it wasn't already on, every token in that drag moves by the distance between the two ends, keeping its place in the formation, then snaps. Standing on stairs, nudging along them and arriving never trigger travel, so nothing bounces back.
- **The drop preview shows the landing spot** at the far end while the token hovers over the stairs.
- **⌘ on release stops on the stairs** (a guard on the landing). Only the DM can; players on the World View always take them, and never carry a hidden NPC.
- **Fog and undo need nothing new.** Arrival explores what the PCs now see, in the same undo step, and one Undo ("Take Stairs") returns everyone.
- **Placing:** the Stairs tool (T) places the first end with one click and its sister with the next; clicking existing stairs links them to the waiting end. A lone end stays plain, drawn-only stairs. R turns stairs; right-click unlinks or deletes; deleting one end unlinks the other.

## Not built yet

Landings that are already occupied (Graphium has no occupancy rule anywhere), one-way, locked or secret stairs (each needs its own answer for the World View, as hidden doors did in 012), and moving the TV's view to follow the party.

## What would change it

The next real session: if players can't tell which ends connect from the letters, add the line between ends on the World View; if the TV loses the party after a floor change, add camera follow.
