# Decision 018: Walls only answer the Wall tool, and note titles get a backing

Status: DEFAULT BUILT (2026-10-18), waiting on Kyle's prep session

## Question

Kyle kept grabbing walls when he reached for a token or a light, and DM note pins were hard to read on the map. When should a wall take a click, and how much contrast do note pins need?

## Default built

**Walls are a locked layer outside the Wall tool.** The web app never let walls be selected; the native app made every stroke selectable (PARITY §3.5), so a wall's hit band (half its 8 px width plus 4 px) caught presses that just missed a token, light or marker. Now:

- **Select, and every other tool:** a click, a box select and a right-click pass through walls to whatever is under them. Walls already selected still drag and still take the right-click menu, so a wall picked in the Wall tool can be moved after pressing V.
- **Wall tool:** a drag draws a wall as before. A click without a drag selects the wall under it (Shift adds or removes) or clears the selection on open ground. It used to save a one-point wall.
- **Unchanged:** Edit › Select All still takes walls, and Delete removes selected walls.

The pick order for a press in Select is now: resize handle, light, note pin, spell origin, token, door, stroke (markers, plus walls only if selected), stairs, spell area, then a box select. The right-click order is light, note, spell origin, door, token, wall (Wall tool or selected), stairs, marker, spell area.

**Note pins on the Architect read on any map art** (rule card `canvas-marks-read-on-any-map`). Measured with the WCAG luminance formula:

| Map art under the pin | Title before (white, 0.4 pt outline) | Title now (on `canvas-halo` plate) | Pin edge |
| --- | --- | --- | --- |
| White `#FFFFFF` | 1.0:1 | 7.0:1 | 21:1 |
| Parchment `#E8DCC0` | 1.4:1 | 8.4:1 | 15:1 |
| Mid grey `#808080` | 4.0:1 | 13.8:1 | 5.3:1 |
| Black `#000000` | 21:1 | 21:1 | white card 21:1 |

Titles need 4.5:1 and the pin's shape needs 3:1 (WCAG 1.4.3 and 1.4.11). The pin already passed on its black edge; it now also casts a soft `canvas-halo` shadow so the white card doesn't flatten into light parchment. Increase Contrast makes the title plate opaque. The World View is unchanged.

## Not built yet

Box-selecting walls inside the Wall tool, and the same plate for token names, spell labels and stairs letters, which share the thin outline (`NSAttributedString.mapLabel`).

## What would change it

Kyle's next prep session. If he still grabs a wall he didn't mean to, or reaches for V just to pick walls, the pick order is wrong. If titles still get lost on a real map, raise the plate to opaque everywhere.
