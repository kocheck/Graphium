# Walls and lighting (native app)

Asked for by Kyle on 2026-10-17: deepen how walls are drawn and seen, and let the DM place and control light, using Metal where it pays. The brief with the reasoning is in the claude.ai project folder `planning/walls-and-lighting-brief.md`.

Model and geometry first, rendering last. Each step is one PR.

1. **Exact visibility** (this PR). An angular sweep over wall ends, wall crossings and circle crossings replaces the fixed ray fan, and near-miss seams (a door stopping short of its wall) are welded shut. Checked against a brute-force oracle on random maps. No file-format change.
2. **Walls as a model.** Wall segments say what they block (sight, light, movement), with one-way walls, windows, and doors at any angle. Old wall strokes and doors still load unchanged.
3. **Light the DM controls.** Light sources with bright and dim radii (torch, lantern, candle, *Light* presets), and token senses (darkvision with a range), following the 5e 2024 Vision and Light rules. A player sees what is in line of sight and lit, or within darkvision. Daylight stays "everything lit". Tests use the rules' numbers.
4. **Metal rendering.** A light texture composited with fog and the map, readable on a TV in a lit room, with a cue other than darkness for "unseen". Golden-image tests and a frame-rate test on a 500-wall, 20-light map.
5. **Universal VTT import.** `.dd2vtt` walls, doors and lights, offline.
