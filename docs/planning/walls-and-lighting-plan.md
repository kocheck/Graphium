# Walls and lighting (native app)

Asked for by Kyle on 2026-10-17: deepen how walls are drawn and seen, and let the DM place and control light, using Metal where it pays. The brief with the reasoning is in the claude.ai project folder `planning/walls-and-lighting-brief.md`.

Model and geometry first, rendering last. Each step is one PR.

1. **Exact visibility** (PR #332). An angular sweep over wall ends, wall crossings and circle crossings replaces the fixed ray fan, and near-miss seams (a door stopping short of its wall) are welded shut. Checked against a brute-force oracle on random maps. No file-format change.
2. **Walls as a model** (PR #333). Walls can be selected, moved and deleted. A wall can be a window (stops movement, not sight) or one-way, set from the Wall tool's options or a wall's right-click menu. Old wall strokes load unchanged.
   **Doors at any angle** (own PR). A door clicked onto a wall lines up with it at any angle, and an open door cuts the wall under it, so a room can be drawn in one stroke and given doors afterwards. Doors gain an optional `angle`.
3. **Light the DM controls** (own PR). Light sources with bright and dim radii (torch, lantern, candle, _Light_ presets), and token senses (darkvision with a range), following the 5e 2024 Vision and Light rules. A player sees what is in line of sight and lit, or within darkvision. Daylight stays "everything lit". Tests use the rules' numbers. Built: lighting is a per-map setting (off keeps today's vision radius), lights stop at walls, and the World View shows dim ground as a lighter fog (decision 009).
4. **Metal rendering.** A light texture composited with fog and the map, readable on a TV in a lit room, with a cue other than darkness for "unseen". Golden-image tests and a frame-rate test on a 500-wall, 20-light map.
5. **Universal VTT import.** `.dd2vtt` walls, doors and lights, offline.
