# Voice guide

Goal: in-app copy that reads like a calm game master's aside: short, exact, and never more than the code does.
Scope: user-facing strings in `macos/App/` and the copy constants in `macos/Sources/GraphiumCore/`.

## Two registers

- **Flavour lines** are the `SystemMessages` pools (save, load, pause screen, place, delete), ported verbatim from the web app (PARITY §1.6). They may be playful and use emoji. They change only together with the web app's `systemMessages.ts`.
- **Everything else** is plain: labels, help tags, alerts, errors, empty states, the Welcome window and the World View.

## Rules for plain copy

1. Labels are 1 to 6 words, title case for menu items, toolbar items and buttons (macOS convention), sentence case elsewhere. Explanations are one short sentence.
2. Say what happened and what the DM can do next; skip how Graphium works inside.
3. Keep the words that prevent loss or surprise: "You can undo this", "Nothing was changed", "Players will see the map", "Stays on your Mac".
4. Help tags (`.help`) name the action and its shortcut: "Measure (R)", "Search actions and assets (⌘K)".
5. The World View speaks to players: no DM vocabulary (no "fog regions", "NPC hidden", "token library").
6. Cut hedges and filler: "simply", "just", "at any time", "you can now".
7. Use the app's own names once and consistently: World View, Architect, Session Console, Map Settings, Library, Daylight, Explored Fog.
8. Numbers keep units with a space ("30 ft", "50 px", "4.2 ms") and use readout style where they're displays.

## Before and after

| Before                                                          | After                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Resume - Players will see the map                               | Resume: players will see the map                                    |
| Pause - Hide map from players                                   | Pause: hide the map from players                                    |
| Dual-window VTT with fog of war • Local-first, no subscriptions | Two windows, fog of war, your files. No accounts, no subscriptions. |
| Drag a box around exactly one grid cell on the map image        | Drag a box around one grid cell on the map image                    |
