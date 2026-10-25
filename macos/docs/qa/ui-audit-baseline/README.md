# UI audit baseline

Reference output of the debug UI audit, used to prove a redesign PR lost no control or menu item.

Generate on a Mac with Xcode (synthetic campaign only). The audit is compiled into Debug builds only, so launch the Debug app, for example from its DerivedData folder:

```bash
open <path to Graphium.app in Debug products> --args -GraphiumUIAudit ~/graphium-ui-audit
```

Copy `controls.txt` and `menus.txt` from that folder here. A PR that restyles a screen re-runs the audit and pastes the diff in its description; a deleted line needs a reason. Files here (from the merged calm-canvas redesign, 2026-10-25, macOS 27, Debug build):

- `menus.txt`: every menu item with its shortcut; a clash is listed at the bottom.
- `controls.txt`: toolbar items, plus the AppKit controls in each window and in each rendered view (`view: <name>`). SwiftUI builds its accessibility tree only for an attached assistive client, so many SwiftUI controls are not listed and their labels are often empty. Read it as a floor: a control that vanishes from here has gone; one never listed is not covered.
- `widths.txt`: views that want more width than the app gives them. Several inspectors are listed. This was not compared against a pre-redesign build, so treat it as the current state, not proof that the redesign did not cause it.
