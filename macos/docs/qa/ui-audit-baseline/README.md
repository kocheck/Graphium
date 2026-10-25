# UI audit baseline

Reference output of the debug UI audit, used to prove a redesign PR lost no control or menu item.

Generate on a Mac with Xcode (synthetic campaign only). The audit is compiled into Debug builds only, so launch the Debug app, for example from its DerivedData folder:

```bash
open <path to Graphium.app in Debug products> --args -GraphiumUIAudit ~/graphium-ui-audit
```

Copy `controls.txt` and `menus.txt` from that folder here. A PR that restyles a screen re-runs the audit and pastes the diff in its description; a deleted line needs a reason. Not yet generated: the first baseline comes from a Mac run before Phase 2 lands.
