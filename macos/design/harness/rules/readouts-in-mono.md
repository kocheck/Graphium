---
id: readouts-in-mono
applies_to: [mac, readout, overlay, inspector, canvas]
sources: ["brief §2.1 An instrument, not a dashboard", "brief §2.4 Typography does the work", "DESIGN.md#typography"]
confidence: decided
reviewed: 2026-10-17
---

# Numbers are readouts: monospaced, medium weight

**Rule.** Every number the DM reads at a glance (distance, grid size, cells, counts, position, timers, frame rate, volume) uses `.readoutStyle()` in SwiftUI or `monospacedDigitSystemFont` in AppKit, at least 13 pt and medium weight on app-owned surfaces. Labels next to them stay proportional and secondary.

**Test.** In a screenshot, digits in HUDs, measurement labels and inspector values line up and don't jitter when they change.

**Good.** `Draw time  4.2 ms` with the value in SF Mono; the ruler label "30 ft" in monospaced digits on a halo backing.
**Bad.** A proportional bold system font for a measurement that jitters as it updates; a 10 pt caption for the frame rate.

**Also check.**
- Native `Form` rows keep system type; apply `.monospacedDigit()` to the value only.
- Units stay attached with a space ("30 ft", "4.2 ms").

**Why.** The brief's instrument reading treats numeric state as a display element; monospaced digits stop values from shifting while a DM drags a ruler.

Links: [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
