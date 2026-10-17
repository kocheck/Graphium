# Walls and lighting (native app)

Asked for by Kyle on 2026-10-17: deepen how walls are drawn and seen, and let the DM place and control light, using Metal where it pays. The brief with the reasoning is in the claude.ai project folder `planning/walls-and-lighting-brief.md`.

Model and geometry first, rendering last. Each step is one PR.

1. **Exact visibility** (PR #332). An angular sweep over wall ends, wall crossings and circle crossings replaces the fixed ray fan, and near-miss seams (a door stopping short of its wall) are welded shut. Checked against a brute-force oracle on random maps. No file-format change.
2. **Walls as a model.** Walls can be selected, moved and deleted. A wall can be a window (stops movement, not sight) or one-way, set from the Wall tool's options or a wall's right-click menu. Old wall strokes load unchanged.
   Doors at any angle follow as their own PR, so a door placed on a diagonal wall lines up with it.
3. **Light the DM controls.** Light sources with bright and dim radii (torch, lantern, candle, _Light_ presets), and token senses (darkvision with a range), following the 5e 2024 Vision and Light rules. A player sees what is in line of sight and lit, or within darkvision. Daylight stays "everything lit". Tests use the rules' numbers.
4. **Metal rendering.** A light texture composited with fog and the map, readable on a TV in a lit room, with a cue other than darkness for "unseen". Golden-image tests and a frame-rate test on a 500-wall, 20-light map.
5. **Universal VTT import.** `.dd2vtt` walls, doors and lights, offline.
