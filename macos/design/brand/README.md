# Brand mark

`mark.svg` is the Graphium mark (a map pin whose stem becomes a pen nib), single colour on a 512 viewBox. Graphium is a sister app to Project Icarus (kocheck/Project-Icarus), so it follows Icarus's brand system (`designs/brand/README.md` there):

- **App icon "Paper"**: ink mark (`#1A1A18`) on a warm paper base (`#ECEAE4`); paper mark on graphite (`#343536`) in Dark. The mark fills 0.66 of the icon, a little more than Icarus's 0.6, because the pin is taller and narrower than the quill.
- **Dev twin**: Debug builds use Graphium's amber accent (`#FFC53D`) as the base, where Icarus uses yellow-green, so a test build never passes for a release on the Dock.
- **Lockup**: the mark before the wordmark "Graphium" in New York (`ui-serif` on the web, `.serif` design in SwiftUI), mark about 1.15× the cap height.
- **Clear space** a third of the mark's width on every side; **smallest** 20 pt on screen. Below that, use the name alone.
- **One colour**: ink, paper or the current text colour. Amber is the app's accent, not the mark's colour, except on the dev icon.

`make_brand_assets.py` generates every product use from `mark.svg`. Edit the SVG, never the outputs:

| Output                                               | Use                                                                                                                                                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App/Graphium/Assets.xcassets/AppIcon.appiconset`    | Release app icon (asset catalog PNGs: shadowed 824 px plate on the 1024 macOS grid).                                                                                                                                             |
| `App/Graphium/Assets.xcassets/AppIconDev.appiconset` | Debug app icon. Picked per configuration by `ASSETCATALOG_COMPILER_APPICON_NAME` in `App/project.yml`.                                                                                                                           |
| `design/brand/Graphium.icon`, `GraphiumDev.icon`     | Icon Composer bundles with Dark and Tinted appearances, the same art as Icarus's. Not wired yet: CI builds on `macos-15`, whose Xcode can't compile `.icon`. Swap them in for the appiconsets when the app builds with Xcode 26. |
| `App/Graphium/Design/BrandMark.swift`                | SwiftUI `Shape` for the Welcome window.                                                                                                                                                                                          |
| `site/icon.svg`, `site/apple-touch-icon.png`         | Favicon (follows light/dark) and Home Screen icon for the public site.                                                                                                                                                           |

```sh
python3 -I macos/design/brand/make_brand_assets.py          # regenerate (needs Pillow)
python3 -I macos/design/brand/make_brand_assets.py --check  # fail if a text output is stale
```

The web app in `src/` and `public/` still uses the previous fountain-pen logo.
