# Decision 012: Doors and hidden doors in the World View

Status: DEFAULT BUILT (2026-10-18), waiting on Kyle's playtest

## Question

Kyle asked for doors on the World View to get the same lift the walls got (decision 010's rock hatching), so players can clearly see where a door is, and for hidden doors as an option.

## Default built

- **Known doors draw over the fog.** Before, doors sat under the fog, so a closed door seen from one side lost its far half to black and read as a thin brown sliver. Now a door the players know (a spot just off either face is explored or in sight now) is drawn above the fog, as the rock behind seen walls is. Doors in unexplored fog still draw nothing.
- **Ink on paper, like the walls.** A known door is an old-school map door: a paper slab (the hatching's paper grey) with a 3-unit black ink edge across the wall, plus a 5-unit ink jamb at each end of the doorway. Open, the jambs stay, the leaf swings about its hinge as a thinner paper slab and a dashed ink arc shows the swing, so an open doorway still reads as a door and not a gap. Locked doors keep their lock glyph. The old brown fill and white glow are gone from the World View; the Architect keeps the wood look.
- **Hidden doors look like wall until revealed.** Right-click a door, Hide from Players. While it is shut the World View draws the black wall line over it and hatches rock behind it once seen, VoiceOver there skips it, and render_map's players' view draws it as wall. Open, it shows as a door (the players are looking at it); closed again, it goes back to wall until the DM picks Reveal to Players. The Architect always shows it, faded with a dashed edge and an eye-slash glyph (state by shape, not colour).
- **Bulk controls keep secrets.** Open All Unlocked Doors leaves hidden doors shut. The sidebar adds Reveal All Hidden Doors while any are hidden.
- **Saved as `isHidden`** on the door, written only when true, so the web app and older files are unaffected (CORE_SPEC §1.7). The MCP tools take `hidden` on add_doors, add_rooms doors and update_objects, and show it in get_map (S in the ASCII picture).

## What would change it

Playtesting on the TV: if the paper slab is too loud against busy map art, drop the jambs or thin the ink. If DMs want hidden doors to stay revealed once opened, opening could clear the flag instead.
