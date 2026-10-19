import XCTest

/// The six launch-QA personas (docs/qa/LAUNCH_QA.md), each a scripted run of the critical path on
/// the real app. They record what happened and don't fail on a stall: a stall is a finding, written
/// up in LAUNCH_QA_RESULTS.md. A test fails only when the script itself can't run.
final class PersonaTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = true
    }

    /// 1. Impatient: does the least each screen asks for, as fast as it can, and stops at the first
    /// error state. Logs time to first action and time to value.
    func testImpatient() {
        let qa = QASession("impatient", test: self)
        defer { qa.finish(); qa.quitDiscarding() }
        qa.launch()
        qa.record(1, "launch", ok: qa.trace.timeToFirstAction != nil, "Welcome window ready")

        let steps: [() -> Bool] = [
            { qa.newCampaign() },
            { qa.chooseMapImage() },
            {
                // A quick short drag, no zooming: the least the calibration banner asks for.
                let centre = qa.architect.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
                centre.press(forDuration: 0.05, thenDragTo: centre.withOffset(CGVector(dx: 20, dy: 20)))
                sleep(1)
                let toast = qa.anyToast() ?? "no toast"
                return qa.record(4, "calibrate-quick", ok: !toast.hasPrefix("error"), "20 pt drag at fit zoom. Toast: \(toast)")
            },
            { qa.placeGenericToken() },
            // Skips the inspector: nothing on the path says the token must be a PC.
            { qa.openWorldView(viaToolbar: true) },
            { qa.checkPlayersSeeMap() },
        ]
        for step in steps {
            let ok = step()
            if let error = qa.errorToast() {
                qa.abort("Error state: \(error)")
                return
            }
            if !ok {
                qa.abort("Stalled at \(qa.trace.steps.last?.action ?? "?"): \(qa.trace.steps.last?.observation ?? "")")
                return
            }
        }
    }

    /// The same path done the way the screens literally describe, including Type > PC. The
    /// reference trace for time to value.
    func testReferencePath() {
        let qa = QASession("reference", test: self)
        defer { qa.finish(); qa.quitDiscarding() }
        qa.launch()
        qa.record(1, "launch", ok: qa.trace.timeToFirstAction != nil, "Welcome window ready")
        qa.newCampaign()
        qa.chooseMapImage()
        qa.calibrateCarefully()
        qa.placeGenericToken()
        qa.makePC()
        qa.openWorldView()
        qa.checkPlayersSeeMap()
        // Step 9: ⌘S on an untitled campaign asks for a name.
        qa.architect.click()
        qa.app.typeKey("s", modifierFlags: .command)
        let panel = qa.app.sheets.firstMatch.waitForExistence(timeout: 5)
        qa.record(9, "save", ok: panel, "Save sheet shown: \(panel)")
        if panel { qa.app.typeKey(.escape, modifierFlags: []) }
    }

    /// 2. Skeptic: reads every claim literally and checks it against what the app does.
    func testSkeptic() {
        let qa = QASession("skeptic", test: self)
        defer { qa.finish(); qa.quitDiscarding() }
        qa.launch()
        qa.visibleTexts().forEach { qa.note("welcome-text", $0) }
        qa.record(1, "read-welcome", ok: true, "Welcome copy recorded in notes")

        // Templates: do they make what they describe?
        qa.button("Templates").click()
        let sheet = qa.text("Campaign Templates").waitForExistence(timeout: 5)
        qa.visibleTexts().forEach { qa.note("template-text", $0) }
        qa.record(2, "read-templates", ok: sheet, "Templates sheet")
        let classic = qa.app.buttons.matching(QASession.labelContains("Classic Dungeon")).firstMatch
        if classic.exists {
            classic.click()
            sleep(3)
            let blank = qa.text("Drop a map image here").exists
            let doors = qa.text("Doors").exists
            let toast = qa.anyToast() ?? "no toast"
            qa.record(
                2, "apply-classic-dungeon", ok: !blank,
                "Promised a 5-room dungeon with fog of war. Empty-map banner: \(blank). Doors section: \(doors). Toast: \(toast)")
        }

        // About and Tutorial, read literally.
        qa.app.typeKey("?", modifierFlags: [])
        if !qa.text("Graphium").waitForExistence(timeout: 3) {
            qa.app.menuBars.menuBarItems["Graphium"].click()
            qa.app.menuItems.matching(QASession.labelContains("About Graphium")).firstMatch.click()
        }
        sleep(1)
        qa.visibleTexts().forEach { qa.note("about-text", $0) }
        qa.record(0, "read-about", ok: true, "About copy recorded in notes")
        let tutorial = qa.app.radioButtons.matching(QASession.labelContains("Tutorial")).firstMatch
        if tutorial.exists { tutorial.click() } else { qa.button("Tutorial").click() }
        sleep(1)
        qa.visibleTexts().forEach { qa.note("tutorial-text", $0) }
        qa.record(0, "read-tutorial", ok: true, "Tutorial copy recorded in notes")
    }

    /// 3. Small window and slow Mac: the critical path in the smallest Architect window.
    func testSmallWindow() {
        let qa = QASession("small-window", test: self)
        defer { qa.finish(); qa.quitDiscarding() }
        qa.launch()
        qa.newCampaign()
        let window = qa.architect
        let corner = window.coordinate(withNormalizedOffset: CGVector(dx: 1, dy: 1)).withOffset(CGVector(dx: -3, dy: -3))
        corner.press(forDuration: 0.3, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.05)))
        sleep(1)
        let frame = qa.architect.frame
        qa.note("window-frame", "\(Int(frame.width)) × \(Int(frame.height)) pt")
        let worldButton = qa.app.toolbars.buttons.matching(QASession.labelContains("World View")).firstMatch
        let pause = qa.app.toolbars.buttons.matching(QASession.labelContains("Pause")).firstMatch
        qa.record(
            7, "toolbar-at-min-size", ok: worldButton.exists && worldButton.isHittable,
            "Window \(Int(frame.width))×\(Int(frame.height)). World View button hittable: \(worldButton.exists && worldButton.isHittable). Pause hittable: \(pause.exists && pause.isHittable).")
        qa.chooseMapImage()
        qa.calibrateCarefully()
        qa.placeGenericToken()
        qa.makePC()
        if worldButton.exists && worldButton.isHittable { qa.openWorldView(viaToolbar: true) } else { qa.openWorldView() }
        qa.checkPlayersSeeMap()
    }

    /// 4. Non-native English: every string doubled in length (`NSDoubleLocalizedStrings`, stricter
    /// than +30%), following only what the screens literally tell the DM to do.
    func testNonNative() {
        let qa = QASession("non-native", test: self, arguments: ["-NSDoubleLocalizedStrings", "YES"])
        defer { qa.finish(); qa.quitDiscarding() }
        qa.launch()
        qa.record(1, "launch", ok: qa.trace.timeToFirstAction != nil, "Welcome with doubled strings")
        let jargon = [
            "PC", "NPC", "Daylight", "World View", "Architect", "Calibrat", "Reveal", "Duck", "plate", "fog",
            "Initiative", "graphiumcampaign", "Incantation", "arcane", "tribute", "overlord",
        ]
        func scan(_ screen: String) {
            for text in qa.visibleTexts() {
                for word in jargon where text.localizedCaseInsensitiveContains(word) {
                    qa.note("jargon", "\(screen): \(word) in “\(text.prefix(80))”")
                }
            }
        }
        scan("welcome")
        qa.newCampaign()
        scan("architect")
        qa.chooseMapImage()
        scan("calibrating")
        qa.calibrateCarefully()
        qa.placeGenericToken()
        scan("token-inspector")
        // The inspector describes PCs ("Only PC tokens emit vision") but doesn't tell the DM to
        // change the type, so a literal reader leaves it.
        qa.openWorldView(viaToolbar: true)
        scan("world-view")
        qa.checkPlayersSeeMap()
    }

    /// 5. Breaker: double-triggers, naughty strings and quitting mid-work.
    func testBreaker() {
        let qa = QASession("breaker", test: self)
        defer { qa.finish(); qa.quitDiscarding() }
        qa.launch()

        // Double-click New Campaign.
        qa.button("New Campaign").doubleClick()
        sleep(3)
        let campaigns = qa.architectWindows.count
        qa.record(2, "double-click-new-campaign", ok: campaigns <= 1, "Campaign windows open: \(campaigns)")
        while qa.architectWindows.count > 1 {
            qa.architectWindows.last?.click()
            qa.app.typeKey("w", modifierFlags: .command)
            sleep(1)
        }

        // Double-click the toolbar's World View.
        qa.app.toolbars.buttons.matching(QASession.labelContains("World View")).firstMatch.doubleClick()
        sleep(2)
        let worlds = qa.app.windows.matching(NSPredicate(format: "title BEGINSWITH %@", "World View")).count
        qa.record(7, "double-click-world-view", ok: worlds == 1, "World View windows: \(worlds)")
        if qa.worldWindow.exists {
            qa.worldWindow.click()
            qa.app.typeKey("w", modifierFlags: .command)
        }

        // Naughty map names through Rename….
        qa.architect.click()
        for (i, name) in NaughtyStrings.sample.enumerated() {
            let row = qa.architect.outlines.cells.firstMatch.exists
                ? qa.architect.outlines.cells.element(boundBy: 0) : qa.architect.tables.cells.element(boundBy: 0)
            guard row.waitForExistence(timeout: 3) else {
                qa.record(0, "rename-\(i)", ok: false, "No map row in the sidebar")
                break
            }
            row.rightClick()
            let rename = qa.app.menuItems.matching(QASession.labelContains("Rename")).firstMatch
            guard rename.waitForExistence(timeout: 3) else {
                qa.record(0, "rename-\(i)", ok: false, "No Rename… in the map's menu")
                qa.app.typeKey(.escape, modifierFlags: [])
                continue
            }
            rename.click()
            sleep(1)
            qa.app.typeKey("a", modifierFlags: .command)
            qa.app.typeText(name)
            qa.app.typeKey(.return, modifierFlags: [])
            sleep(1)
            let alive = qa.app.state == .runningForeground
            let title = qa.architect.title
            qa.record(
                0, "rename-\(i)", ok: alive, "Typed \(name.count) characters (\(NaughtyStrings.describe(name))). Window title now \(title.count) characters. App running: \(alive)",
                shot: i % 4 == 0 || name.count > 200)
            if !alive { qa.abort("App stopped after naughty map name \(i)"); return }
        }

        // Quit in the middle of a huge image import.
        let choose = qa.button("Choose")
        if !choose.exists {
            // The map has no art yet, but a rename doesn't change that; the banner should be there.
            qa.record(3, "quit-mid-import", ok: false, "No Choose… button to start an import")
        } else {
            choose.click()
            qa.choose(file: QASession.hugeMapImage)
            qa.app.typeKey("q", modifierFlags: .command)
            sleep(1)
            let prompt = qa.app.sheets.firstMatch.exists || qa.app.dialogs.firstMatch.exists
            qa.record(3, "quit-mid-import", ok: qa.app.state != .notRunning, "Save prompt shown: \(prompt)")
            let cancel = qa.app.buttons.matching(NSPredicate(format: "label == %@", "Cancel")).firstMatch
            if cancel.exists { cancel.click() }
            sleep(10)
            let set = !qa.text("Drop a map image here").exists
            qa.record(3, "after-quit-cancel", ok: qa.app.state == .runningForeground && set, "Import finished after the cancelled quit: \(set)")
        }

        // Undo and redo hammered.
        for _ in 0..<40 { qa.app.typeKey("z", modifierFlags: .command) }
        for _ in 0..<40 { qa.app.typeKey("z", modifierFlags: [.command, .shift]) }
        sleep(1)
        qa.record(0, "undo-redo-x40", ok: qa.app.state == .runningForeground, "App running after 80 undo/redo")
    }

    /// 6. Keyboard and accessibility: XCTest's accessibility audit on each screen of the path, and the
    /// path by keyboard alone, recording the Tab order.
    func testKeyboardAndAudit() throws {
        let qa = QASession("keyboard", test: self, arguments: ["-AppleKeyboardUIMode", "2"])
        defer { qa.finish(); qa.quitDiscarding() }
        qa.launch()
        audit(qa, "welcome")

        qa.app.typeKey("n", modifierFlags: .command)
        let opened = qa.text("Drop a map image here").waitForExistence(timeout: 15)
        qa.record(2, "cmd-n", ok: opened, "⌘N opened a campaign: \(opened)")

        // Tab through the Architect, noting what takes focus, until the banner's Choose… does.
        let order = tabOrder(qa, until: "Choose", limit: 40)
        qa.note("tab-order-architect", order.joined(separator: " → "))
        let reachedChoose = order.last?.localizedCaseInsensitiveContains("Choose") == true
        qa.record(3, "tab-to-choose", ok: reachedChoose, "Tab presses to reach Choose…: \(reachedChoose ? "\(order.count)" : "not reached in 40")")
        if reachedChoose {
            qa.app.typeKey(" ", modifierFlags: [])
            qa.choose(file: QASession.mapImage)
        } else {
            qa.app.menuBars.menuBarItems["Map"].click()
            qa.app.menuItems.matching(QASession.labelContains("Map Image")).firstMatch.click()
            qa.choose(file: QASession.mapImage)
            qa.note("pointer-used", "Map > Map Image… (no keyboard shortcut)")
        }
        let calibrating = qa.text("drag a box around one grid cell").waitForExistence(timeout: 30)
        qa.record(4, "calibration-by-keyboard", ok: false, "Calibration banner: \(calibrating). Only Esc (Cancel) works from the keyboard; the box needs a drag.")
        qa.app.typeKey(.escape, modifierFlags: [])

        let toToken = tabOrder(qa, until: "Generic Token", limit: 60)
        let reachedToken = toToken.last?.localizedCaseInsensitiveContains("Generic Token") == true
        qa.note("tab-order-to-token", toToken.joined(separator: " → "))
        qa.record(5, "tab-to-generic-token", ok: reachedToken, "Tab presses to reach Generic Token: \(reachedToken ? "\(toToken.count)" : "not reached in 60")")
        if reachedToken {
            qa.app.typeKey(" ", modifierFlags: [])
        } else {
            qa.placeGenericToken()
            qa.note("pointer-used", "Generic Token clicked")
        }
        sleep(1)
        audit(qa, "architect-token-selected")

        let toPC = tabOrder(qa, until: "PC", limit: 60, exact: true)
        let reachedPC = toPC.last == "PC"
        qa.note("tab-order-to-pc", toPC.joined(separator: " → "))
        qa.record(6, "tab-to-pc", ok: reachedPC, "Tab presses to reach Type > PC: \(reachedPC ? "\(toPC.count)" : "not reached in 60")")
        if reachedPC { qa.app.typeKey(" ", modifierFlags: []) } else { qa.makePC(); qa.note("pointer-used", "Type > PC clicked") }

        qa.app.typeKey("w", modifierFlags: [.command, .shift])
        _ = qa.worldWindow.waitForExistence(timeout: 10)
        sleep(2)
        qa.checkPlayersSeeMap()
        audit(qa, "world-view")
    }

    // MARK: Helpers

    private func audit(_ qa: QASession, _ screen: String) {
        var issues: [String] = []
        do {
            try qa.app.performAccessibilityAudit { issue in
                let element = issue.element.map { "\($0.elementType.rawValue) “\($0.label.prefix(40))”" } ?? "no element"
                issues.append("\(issue.compactDescription) [\(element)]")
                return true  // keep going: issues are findings, not test failures
            }
        } catch {
            issues.append("audit could not run: \(error.localizedDescription)")
        }
        issues.forEach { qa.note("audit-\(screen)", $0) }
        qa.record(0, "audit-\(screen)", ok: issues.isEmpty, "\(issues.count) accessibility audit issues")
    }

    /// Presses Tab until the focused element's label matches, returning the labels seen in order.
    private func tabOrder(_ qa: QASession, until target: String, limit: Int, exact: Bool = false) -> [String] {
        var seen: [String] = []
        let focused = NSPredicate(format: "hasKeyboardFocus == true")
        for _ in 0..<limit {
            qa.app.typeKey(.tab, modifierFlags: [])
            let element = qa.app.descendants(matching: .any).matching(focused).firstMatch
            let label = element.exists ? (element.label.isEmpty ? "(\(element.elementType.rawValue))" : element.label) : "(none)"
            seen.append(label)
            if exact ? label == target : label.localizedCaseInsensitiveContains(target) { break }
        }
        return seen
    }
}

/// A sample of the Big List of Naughty Strings (github.com/minimaxir/big-list-of-naughty-strings,
/// MIT), chosen for what breaks names: direction marks, combining marks, emoji, path characters,
/// format strings, markup and length.
enum NaughtyStrings {
    static let sample: [String] = [
        "",
        "   ",
        "undefined",
        "null",
        "%@%d%s%n",
        "{0}{1}",
        "<script>alert(1)</script>",
        "../../etc/passwd",
        "Map/With:Slashes",
        "\u{202E}gnirts desrever",
        "مرحبا بالعالم",
        "Ṱ̺̺̕o͞ ̷i̲̬͇̪͙n̝̗͕v̟̜̘̦͟o̶̙̰̠kè͚̮̺̪̹̱̤ ̖t̝͕̳̣̻̪͞h̼͓̲̦̳̘̲e͇̣̰̦̬͎ ̢̼̻̱̘h͚͎͙̜̣̲ͅi̦̲̣̰̤v̻͍e̺̭̳̪̰-m̢iͅn̖̺̞̲̯̰d̵̼̟͙̩̼̘̳",
        "👩🏽‍🚀🧙‍♂️🐉",
        "田中さんにあげて下さい",
        "Ω≈ç√∫˜µ≤≥÷",
        "'; DROP TABLE maps; --",
        String(repeating: "A", count: 1000),
    ]

    static func describe(_ s: String) -> String {
        if s.isEmpty { return "empty" }
        if s.trimmingCharacters(in: .whitespaces).isEmpty { return "whitespace" }
        if s.count > 200 { return "\(s.count) characters" }
        return s.unicodeScalars.contains { $0.value > 0x2000 } ? "unicode" : "ascii"
    }
}
