<div align="center">
  <img alt="Graphium mark" src="macos/design/brand/mark.svg" width="120">

# Graphium

A virtual tabletop for the Mac, built for the Dungeon Master.

</div>

Graphium runs your table from your Mac. You build and run the map in the Architect window, and your players see a player-safe World View on the projector or second display. Fog of war, walls and doors, lighting, tokens, initiative, spell effects and a Session Console for images and sound are all in one native app.

Your campaign is yours. It is a `.graphiumcampaign` file you can open, copy, back up and read without Graphium, and nothing about it leaves your Mac unless you ask. See [the principles](macos/docs/PRINCIPLES.md).

## Get started

Graphium needs macOS 14 or later. To build it you need Xcode 16 or later and [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```sh
git clone https://github.com/kocheck/Graphium.git
cd Graphium/macos
swift test                                  # core logic tests
brew install xcodegen
cd App && xcodegen generate && open Graphium.xcodeproj
```

[macos/GETTING_STARTED.md](macos/GETTING_STARTED.md) covers the first build and a smoke test, and [macos/README.md](macos/README.md) covers the architecture and file format.

## Repository

- [`macos/`](macos/): the app, its core library, the bundled `graphium-mcp` server for building maps with AI tools, and the design system.
- [`docs/decisions/`](docs/decisions/): product and design decisions.
- [`archive/web/`](archive/web/README.md): the earlier web and Electron version, kept for reference. Its browser build is still served at `/app/` on the GitHub Pages site.
- [`AGENTS.md`](AGENTS.md): how AI coding agents (and people) should work in this repo.

## License

[MIT](LICENSE)
