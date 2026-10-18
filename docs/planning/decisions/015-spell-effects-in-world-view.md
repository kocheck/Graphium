# Decision 015: Spell effects in the World View

Status: DEFAULT BUILT (2026-10-18), waiting on Kyle's playtest

## Question

Kyle asked for a spell effects tool: areas of effect like cones and circles, sized, pinned to a spot or a token, with art he can change (fire, green, water…). What do players see of them, and how?

## Default built

The Spell Effect tool (S) places the four 5e templates (circle, cone, line, cube) in feet, in one of nine looks: fire, acid, water, ice, lightning, poison, necrotic, radiant and arcane. They are saved in the map (`effects`, CORE_SPEC §1.3).

- **Players see effects by default.** A spell's area is table information everyone needs, so a new effect shows on the World View; Show to Players (inspector or right-click) hides it, and in the Architect a hidden one has a dashed edge.
- **Drawn over the fog, under the tokens.** The DM chose to show it, as with shared note pins (decision 011), so it is not clipped to what the party has seen. It reveals nothing: no vision, no light, no explored ground. Tokens stay on top so the players can see who is caught in it.
- **An effect a hidden NPC carries is hidden with it**, or it would give the NPC away.
- **Each look has its own colour and its own pattern** (flames, bubbles, waves, shards, bolts, clouds, wisps, rays, sparks) under a 3 pt edge in its tint, so looks never differ by colour alone (world-view-player-safe). A custom colour keeps the look's pattern. Labels are 18 pt white on a dark outline; an unlabelled effect shows its size ("20 ft radius").
- **Still, not animated.** Patterns are seeded by the effect's id and hold still, so the projector doesn't shimmer and Reduce Motion needs nothing.

## Not built yet

Highlighting the cells or tokens inside an area (5e's "any part of the square" rule needs a hex and iso answer too), cone origins on a token's edge, animated looks, and image art.

## What would change it

Playtesting on the TV: if effects over unexplored fog spoil rooms, draw them under the fog. If the patterns are too busy over map art, drop them to a lighter texture or the tint alone (keeping the label).
