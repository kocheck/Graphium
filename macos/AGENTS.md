# Graphium for macOS: agent guide

Start with [README.md](README.md) and [docs/PRINCIPLES.md](docs/PRINCIPLES.md) (privacy first, file over app).

| Task                                 | Read first                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Data model, file format, game logic  | [docs/CORE_SPEC.md](docs/CORE_SPEC.md), then `Sources/GraphiumCore`                                                                  |
| Parity with the web app              | [docs/PARITY.md](docs/PARITY.md)                                                                                                     |
| Visual, UI, copy or interaction work | [design/harness/INDEX.md](design/harness/INDEX.md), then only the cards and [DESIGN.md](docs/design/DESIGN.md) sections it points to |
| In-session friction                  | [docs/SESSION_TIMING.md](docs/SESSION_TIMING.md)                                                                                     |
| Saving, file safety, diagnostics     | [docs/SAVE_CHECKS.md](docs/SAVE_CHECKS.md), `Sources/GraphiumCore/Document`, `Sources/GraphiumCore/Diagnostics`                      |
| MCP server for AI map building       | [docs/MCP.md](docs/MCP.md), then `Sources/GraphiumMCP`                                                                               |

- Colours on app-owned surfaces come from `Palette` (generated). Edit tokens in DESIGN.md's front matter, then run `python3 scripts/design-tokens.py`; never hand-edit `App/Graphium/Design/ColorTokens.swift`.
- After changing anything under `design/` or `docs/design/`, run `bash scripts/check-design-docs.sh`.
- Changing the map model (`Sources/GraphiumCore/Model`)? Update the MCP server too: `ModelCoverageTests` fails until you do. Steps in [docs/MCP.md](docs/MCP.md#keeping-it-up-to-date).
- Builds need Xcode on Kyle's Mac; see [design/harness/review-loop.md](design/harness/review-loop.md) for the build-and-screenshot loop.
