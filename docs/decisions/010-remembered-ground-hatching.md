# Decision 010: Hatching over remembered ground

Status: DECIDED (Kyle chose fine hatching, 2026-10-18)

## Question

The brief asks the World View for a cue other than darkness that says "you can't see this now". Decision 009 left it to the Metal step. How should ground the party remembers, but can't see now, be marked?

## Decided

Remembered ground gets fine diagonal hatching over its fog: a 2 pt white line at 28% every 12 pt, at 45°. The lines are anchored to the map, so they move with it when the camera pans. Ground seen now has none, and neither does ground never explored, so the hatching gives nothing away. Bright, dim, remembered and unknown ground still differ in brightness as decision 009 set out, and remembered ground now also differs in texture.

The Metal fog renderer (`GraphiumRender`) draws the hatching. On a Mac without a Metal device, the Core Graphics fallback draws the fog without it.

## What would change it

Playtesting on the TV: if the lines shimmer or read as part of the map art, widen the spacing or lower the alpha (`FogShading` in `Sources/GraphiumRender/FogRenderer.swift`).
