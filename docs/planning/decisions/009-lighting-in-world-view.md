# Decision 009: Lighting in the World View

Status: PROPOSED (Claude's default, built in the lights PR, waiting on Kyle)

## Question

With lighting on, the World View has to show three kinds of seen ground: bright, dim, and darkness within darkvision (which 5e treats as dim). Until now, ground was either in sight (clear) or not (fog). How should dim ground look to players?

## Default built

Dim ground reads as a lighter fog. Bright ground is fully clear. Dim light, and darkness within darkvision, clear 65% of the fog. Dim light within darkvision clears nearly all of it, as bright light would. Ground a PC remembers but can't see now stays at the explored-fog level. From lightest to darkest, players see:

- bright
- dim
- remembered
- unknown

Light markers and their radius rings are DM-only, so players never see where a light sits, only what it lights.

## Open for the Metal step

The brief asks for something other than darkness to say "you can't see this" (`state-without-colour`). The Metal renderer is where that cue goes, for example a fine texture over remembered ground. This default changes only brightness.

## What would change it

Playtesting on the TV: if dim and remembered ground can't be told apart across the room, widen the gap or add the texture early.
