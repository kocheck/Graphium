# Graphium: agent guide

Graphium is a native macOS virtual tabletop for Dungeon Masters: an Architect window to build and run the map, and a player-safe World View for the projector. The product is the Swift app in [`macos/`](macos/). Every change follows [macos/docs/PRINCIPLES.md](macos/docs/PRINCIPLES.md): privacy first and file over app. Campaigns are open files the DM owns, and nothing leaves the Mac unless the DM asks.

`CLAUDE.md` imports this file. Edit this one; there is one source of truth.

## Routing a task

- **Any app work**: [macos/AGENTS.md](macos/AGENTS.md) says what to read first for the model, file format, saving, MCP server, session timing and parity.
- **Visual, UI, copy or interaction work**: [macos/design/harness/INDEX.md](macos/design/harness/INDEX.md), then only the cards and [DESIGN.md](macos/docs/design/DESIGN.md) sections it points to. Calls that need Kyle go in `docs/decisions/` (copy the newest one's format).
- **Kyle shares something he likes or dislikes, or a rule card is wrong**: the `design-feedback` skill. `design-advisor` is the read-only critic.
- **Building maps with AI**: the `graphium-mcp` server, [macos/docs/MCP.md](macos/docs/MCP.md).
- **A bug in the browser version at /app/, or how the old app behaved**: see the archive section below.

## Global Coding Standards

These apply to every change, regardless of size. When two rules conflict, the earlier one wins.

1. **Stay in scope**: change only what the task requires. No drive-by refactors, formatting sweeps, or "while I'm here" fixes. Note them; don't do them.
2. **YAGNI**: don't build it until you need it. No speculative abstractions, flags, or config.
3. **Simple first**: write the obvious solution. Optimize only when profiling proves it's needed.
4. **Fail fast**: explicit errors beat silent failures. Never swallow exceptions, default to empty values, or catch and continue without a documented reason.
5. **DRY on the second duplicate**: two copies is fine. Three means extract. Don't abstract before the pattern is real.
6. **Delete aggressively**: less code, fewer bugs. In the code you are already touching, remove dead code, unused params, stale comments, and commented-out blocks as you go (elsewhere, rule 1: note it).
7. **Semantic naming**: optimize names for comprehension by humans and LLMs, not brevity. Names should read as a sentence fragment that describes intent. `waitUntilObservationIsSaved` > `waitObsSaved` > `wait`; `isUserAuthorizedForWorkspace` > `authOk` > `flag`; endpoints: `/workspaces/{id}/members/invite` > `/ws/inv`.
8. **Match the codebase**: follow existing conventions, patterns, and file layout over personal preference. Consistency beats local optimality.
9. **Prove it**: a change isn't done until it's verified: tests pass, the build is green, and the behavior was actually exercised. "Should work" is not done. With no toolchain in a cloud thread, a green `macos-native` CI run or a Remote Control build on Kyle's Mac is the proof; say which one you used.
10. **Say what you didn't do**: call out skipped edge cases, assumptions, and anything you were unsure about. Silence reads as confidence.

## How development works

- **Builds need Xcode, and cloud containers have no Swift toolchain.** Write the change in the cloud thread, then prove it one of two ways: push and let `macos-native` CI (macos-15) run `swift test`, the Thread Sanitizer pass, the MCP stdio check, save fault checks and the Release app build; or start a Remote Control session on Kyle's Mac in its Graphium checkout to build, run and screenshot with `xcodebuild` ([review-loop.md](macos/design/harness/review-loop.md)).
- **Checks that run anywhere** (run the ones your change touches before pushing):
  - `bash macos/scripts/check-design-docs.sh` after any change under `macos/design/` or `macos/docs/design/`.
  - `python3 macos/scripts/design-tokens.py` after editing tokens in DESIGN.md's front matter. Never hand-edit `macos/App/Graphium/Design/ColorTokens.swift`.
  - `python3 -I .github/scripts/check-md-links.py` after moving files or editing Markdown. It fails on a dead relative link, a missing heading anchor, or a path in an agent entry file that doesn't exist. It doesn't read code, so also `git grep -n <old path>` after a move.
- **Screenshots and fixtures use synthetic campaigns only** (Welcome templates, Generate Dungeon). Never a real campaign's maps or names.
- **Git**: branch per change, PR to `main`. Commit subjects start with the area (`macOS: ...`, `Docs: ...`). Kyle merges once CI is green. File judgment calls and parity or bug findings as GitHub issues rather than burying them in a PR.

## The archive

`archive/web/` is the retired React/Electron app, frozen: not edited, not fixed, not tested in CI. Web bugs at /app/ are answered by the Mac app. `deploy-web` rebuilds it for `/app/` on GitHub Pages only when `site/` changes or the workflow is run by hand. For how the old app behaved, [macos/docs/PARITY.md](macos/docs/PARITY.md) and [macos/docs/CORE_SPEC.md](macos/docs/CORE_SPEC.md) cite its sources as `archive/web/...` paths; read them there. If Kyle asks for a change anyway: `cd archive/web && npm ci && npm run lint:strict && npm run type-check && npm run test:run && npm run build:web`, then run `deploy-web` by hand. Its own docs' paths are relative to `archive/web/`, and its rules files apply to that code only.
