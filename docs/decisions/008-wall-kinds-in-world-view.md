# Decision 008: Wall kinds in the World View

Status: DECIDED

## Question

Walls can now be windows (sight passes, movement doesn't) or one-way (sight passes from one side). The World View draws every wall as a solid black 6 px line, so a window would look like a wall to players who can see straight through it. What should players see?

## Kyle's answer

Dotted line, recorded 2026-10-17.

## What changes

- A **window** draws as a dotted black line, 6 px dots, so it differs from a wall by shape, not colour (`state-without-colour`, `world-view-player-safe`).
- A **one-way** wall draws as an ordinary wall. Its direction ticks are DM-only, so the trick stays a secret.

## What would change it

Playtesting on the TV: if the dots wash out across the room, make them larger or add a second, thinner line.
