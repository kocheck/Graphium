# Graphium: agent guide

Graphium is a native macOS virtual tabletop for Dungeon Masters: an Architect window to build and run the map, and a player-safe World View for the projector. The product is the Swift app in [`macos/`](macos/). Every change follows [macos/docs/PRINCIPLES.md](macos/docs/PRINCIPLES.md): privacy first and file over app. Campaigns are open files the DM owns, and nothing leaves the Mac unless the DM asks.

`CLAUDE.md` imports this file. Edit this one; there is one source of truth.

## Where things are

| Path                                     | What it is                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`macos/`](macos/)                       | The app. Its own guide is [macos/AGENTS.md](macos/AGENTS.md): read it before touching anything in there |
| [`macos/design/harness/`](macos/design/harness/INDEX.md) | Design harness: rule cards, taste, the build-and-screenshot loop                         |
| [`macos/docs/design/DESIGN.md`](macos/docs/design/DESIGN.md) | Design system and tokens (front matter generates `Palette`)                           |
| [`docs/decisions/`](docs/decisions/)     | Numbered product and design decisions, shared by both apps. Next number follows the highest           |
| [`site/`](site/)                         | The "pardon our dust" page at the GitHub Pages root                                                     |
| [`archive/web/`](archive/web/README.md)  | The retired web and Electron app. Read-only by default (see below)                                      |
| `.claude/agents/`, `.claude/skills/`     | `design-advisor` (read-only critic) and `design-feedback` (turns Kyle's likes and misses into rules)    |
| `.github/workflows/`                     | `macos-native` (build and tests), `docs-links`, `deploy-web`, `web-archive`                             |

## Routing a task

- **Any app work**: [macos/AGENTS.md](macos/AGENTS.md) has the table of what to read first for the model, file format, saving, MCP server, session timing and parity.
- **Visual, UI, copy or interaction work**: [macos/design/harness/INDEX.md](macos/design/harness/INDEX.md), then only the cards and DESIGN.md sections it points to. Changes that need a call from Kyle are recorded in `docs/decisions/`.
- **Kyle shares something he likes or dislikes, or a rule card is wrong**: the `design-feedback` skill.
- **Building maps with AI**: the `graphium-mcp` server ([macos/docs/MCP.md](macos/docs/MCP.md)). It ships inside the app, and the app's Agent window runs the DM's own Claude Code or Codex with only that server.
- **How the old app behaved**: [macos/docs/PARITY.md](macos/docs/PARITY.md) and [macos/docs/CORE_SPEC.md](macos/docs/CORE_SPEC.md) cite its sources as `archive/web/...` paths. Read them there; don't change them.

## How development works

- **Builds need Xcode, and cloud containers have no Swift toolchain.** Write the change in the cloud thread, then prove it one of two ways: push and let `macos-native` CI (macos-15) run `swift test`, the Thread Sanitizer pass, the MCP stdio check, save fault checks and the Release app build; or start a Remote Control session on Kyle's Mac in its Graphium checkout to build, run and screenshot with `xcodebuild` ([review-loop.md](macos/design/harness/review-loop.md)).
- **Checks that run anywhere** (run the ones your change touches before pushing):
  - `bash macos/scripts/check-design-docs.sh` after any change under `macos/design/` or `macos/docs/design/`.
  - `python3 macos/scripts/design-tokens.py` after editing tokens in DESIGN.md's front matter. Never hand-edit `macos/App/Graphium/Design/ColorTokens.swift`.
  - `python3 -I .github/scripts/check-md-links.py` after moving files or editing Markdown. It fails on a dead relative link, a missing heading anchor, or a path in an agent entry file that doesn't exist.
- **Screenshots and fixtures use synthetic campaigns only** (Welcome templates, Generate Dungeon). Never a real campaign's maps or names.
- **Git**: branch per change, PR to `main`. Commit subjects start with the area (`macOS: ...`, `Docs: ...`). Kyle merges once CI is green. File judgment calls and parity or bug findings as GitHub issues rather than burying them in a PR.

## The archive

`archive/web/` holds the React/Electron app with its history (moved with `git mv`; use `git log --follow`). It is still built and served at `/app/` on GitHub Pages by `deploy-web`.

- Don't edit it unless the task is about the web app. The importer test fixture is regenerated from it with `macos/Tests/make-ts-fixture.mts`.
- A change there runs `web-archive` CI (lint, type-check, unit tests, web build). Its old E2E, accessibility and release workflows are kept, inactive, in `archive/web/.github/workflows/`.
- Paths inside the archive's docs are relative to `archive/web/`. Its rules files (`.cursorrules`, `.ai-rules.md`) apply to that code only.
