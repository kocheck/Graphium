import AppKit
import XCTest

/// One persona run (docs/qa/LAUNCH_QA.md): drives the real app, timestamps every step and keeps
/// what was seen (screenshot, the literal action, error toasts) apart from what it means, which is
/// written up afterwards in LAUNCH_QA_RESULTS.md. The trace is attached to the test as JSON and,
/// when `QA_OUT` is set, written there with the screenshots.
final class QASession {
    struct Step: Codable {
        /// Critical path step (LAUNCH_QA.md), 0 for steps off the path.
        var pathStep: Int
        var action: String
        var seconds: Double
        var ok: Bool
        var observation: String
        var screenshot: String?
        var errorToast: String?
    }

    struct Trace: Codable {
        var persona: String
        var arguments: [String]
        var steps: [Step] = []
        var timeToFirstAction: Double?
        var timeToValue: Double?
        var aborted: String?
        var notes: [String: [String]] = [:]
    }

    let app = XCUIApplication()
    let test: XCTestCase
    private(set) var trace: Trace
    private var start = Date()
    private var shots = 0

    /// Synthetic map images made by `scripts/qa/make-fixtures.swift` (never a real campaign).
    static var fixtures: String {
        ProcessInfo.processInfo.environment["QA_FIXTURES"] ?? "/tmp/graphium-qa-fixtures"
    }

    static var mapImage: String { fixtures + "/grid-map.png" }
    static var hugeMapImage: String { fixtures + "/huge-map.png" }
    /// Pixels per cell in the fixture maps.
    static let fixtureCell = 70.0

    init(_ persona: String, test: XCTestCase, arguments: [String] = []) {
        self.test = test
        trace = Trace(persona: persona, arguments: arguments)
        app.launchArguments = [
            "-ApplePersistenceIgnoreState", "YES",
            "-NSQuitAlwaysKeepsWindows", "NO",
        ] + arguments
    }

    var seconds: Double { Date().timeIntervalSince(start) }

    func launch() {
        start = Date()
        app.launch()
        let first = app.buttons.matching(Self.labelContains("New Campaign")).firstMatch
        if first.waitForExistence(timeout: 30) {
            trace.timeToFirstAction = seconds
        }
    }

    // MARK: Recording

    @discardableResult
    func record(_ pathStep: Int, _ action: String, ok: Bool, _ observation: String = "", shot: Bool = true) -> Bool {
        let name = shot ? screenshot("\(pathStep)-\(action)") : nil
        let toast = errorToast()
        trace.steps.append(Step(
            pathStep: pathStep, action: action, seconds: (seconds * 10).rounded() / 10, ok: ok,
            observation: observation, screenshot: name, errorToast: toast))
        return ok
    }

    func note(_ key: String, _ value: String) {
        trace.notes[key, default: []].append(value)
    }

    func abort(_ reason: String) {
        trace.aborted = reason
    }

    func reachedValue() {
        if trace.timeToValue == nil { trace.timeToValue = (seconds * 10).rounded() / 10 }
    }

    @discardableResult
    func screenshot(_ label: String, of element: XCUIElement? = nil) -> String {
        shots += 1
        let safe = label.map { $0.isLetter || $0.isNumber ? $0 : "-" }
        let name = "\(trace.persona)-" + String(format: "%02d", shots) + "-" + String(String(safe).prefix(40))
        let shot = (element ?? XCUIScreen.main).screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        test.add(attachment)
        if let out = Self.outFolder {
            try? shot.pngRepresentation.write(to: out.appendingPathComponent(name + ".png"))
        }
        return name
    }

    func finish() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(trace) else { return }
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = "trace-\(trace.persona).json"
        attachment.lifetime = .keepAlways
        test.add(attachment)
        if let out = Self.outFolder {
            try? data.write(to: out.appendingPathComponent("trace-\(trace.persona).json"))
        }
    }

    private static var outFolder: URL? {
        guard let path = ProcessInfo.processInfo.environment["QA_OUT"] else { return nil }
        let url = URL(fileURLWithPath: path, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    // MARK: Queries

    static func labelContains(_ text: String) -> NSPredicate {
        NSPredicate(format: "label CONTAINS[c] %@ OR title CONTAINS[c] %@", text, text)
    }

    func button(_ text: String) -> XCUIElement {
        app.buttons.matching(Self.labelContains(text)).firstMatch
    }

    func text(_ text: String) -> XCUIElement {
        app.staticTexts.matching(Self.labelContains(text)).firstMatch
    }

    /// The message of a visible error toast, if any.
    func errorToast() -> String? {
        let toast = app.descendants(matching: .any).matching(identifier: "toast-error").firstMatch
        guard toast.exists else { return nil }
        let texts = toast.staticTexts.allElementsBoundByIndex.map(\.label).filter { !$0.isEmpty }
        return texts.isEmpty ? toast.label : texts.joined(separator: " ")
    }

    func anyToast() -> String? {
        for kind in ["error", "success", "info"] {
            let toast = app.descendants(matching: .any).matching(identifier: "toast-\(kind)").firstMatch
            if toast.exists {
                let texts = toast.staticTexts.allElementsBoundByIndex.map(\.label).filter { !$0.isEmpty }
                return "\(kind): " + texts.joined(separator: " ")
            }
        }
        return nil
    }

    var architectWindows: [XCUIElement] {
        app.windows.allElementsBoundByIndex.filter { window in
            let title = window.title
            return !title.hasPrefix("World View") && !title.contains("Welcome") && !title.contains("About")
                && !title.contains("Session Console") && !title.isEmpty
        }
    }

    var architect: XCUIElement {
        architectWindows.first ?? app.windows.firstMatch
    }

    var worldWindow: XCUIElement {
        app.windows.matching(NSPredicate(format: "title BEGINSWITH %@", "World View")).firstMatch
    }

    var canvas: XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Map canvas")).firstMatch
    }

    /// Every visible static text, for the copy and jargon passes.
    func visibleTexts(in element: XCUIElement? = nil) -> [String] {
        let root = element ?? app
        return root.staticTexts.allElementsBoundByIndex.compactMap { el in
            let label = el.label.isEmpty ? (el.value as? String ?? "") : el.label
            return label.isEmpty ? nil : label
        }
    }

    // MARK: Critical path

    /// Step 2.
    @discardableResult
    func newCampaign() -> Bool {
        button("New Campaign").click()
        let ok = text("Drop a map image here").waitForExistence(timeout: 15)
        return record(2, "new-campaign", ok: ok, ok ? "Architect window with the empty-map banner" : "No empty-map banner")
    }

    /// Fills an open panel by typing a path (Go to Folder), as a DM could.
    func choose(file path: String) {
        sleep(2)
        app.typeKey("g", modifierFlags: [.command, .shift])
        sleep(1)
        app.typeText(path)
        sleep(1)
        app.typeKey(.return, modifierFlags: [])
        sleep(2)
        app.typeKey(.return, modifierFlags: [])
    }

    /// Step 3 through the banner's Choose… button.
    @discardableResult
    func chooseMapImage(_ path: String = QASession.mapImage) -> Bool {
        let choose = button("Choose")
        guard choose.waitForExistence(timeout: 5) else {
            return record(3, "map-image", ok: false, "No Choose… button")
        }
        choose.click()
        choose(file: path)
        let calibrating = text("drag a box around one grid cell").waitForExistence(timeout: 30)
        let gone = !text("Drop a map image here").exists
        return record(
            3, "map-image", ok: gone,
            "Image set: \(gone). Calibration banner shown on its own: \(calibrating).")
    }

    /// The canvas zoom the readout reports, as a fraction.
    func zoom() -> Double? {
        let readout = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Zoom ")).firstMatch
        guard readout.exists else { return nil }
        let digits = readout.label.split(separator: " ").dropFirst().first.flatMap { Double($0) }
        return digits.map { $0 / 100 }
    }

    /// Step 4 done as the banner says: zoom in, then drag around one cell of the fixture's grid.
    @discardableResult
    func calibrateCarefully() -> Bool {
        for _ in 0..<3 { app.typeKey("=", modifierFlags: .command) }
        sleep(1)
        let z = zoom() ?? 1
        let cell = Self.fixtureCell * z
        let centre = architect.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        centre.press(forDuration: 0.2, thenDragTo: centre.withOffset(CGVector(dx: cell, dy: cell)))
        sleep(1)
        let toast = anyToast() ?? "no toast"
        let ok = toast.contains("calibrated")
        return record(4, "calibrate-careful", ok: ok, "Zoom \(Int(z * 100))%, dragged \(Int(cell)) pt. Toast: \(toast)")
    }

    /// Step 5: the sidebar's Generic Token.
    @discardableResult
    func placeGenericToken() -> Bool {
        let generic = app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Generic Token")).firstMatch
        let target = generic.exists ? generic : text("Generic Token")
        guard target.waitForExistence(timeout: 5) else {
            return record(5, "place-token", ok: false, "No Generic Token in the sidebar")
        }
        target.click()
        sleep(1)
        let onCanvas = app.descendants(matching: .any).matching(Self.labelContains("Generic Token,")).firstMatch.exists
        return record(5, "place-token", ok: onCanvas, "Token on the canvas: \(onCanvas)")
    }

    /// Step 6: Token inspector > Type > PC.
    @discardableResult
    func makePC() -> Bool {
        var pc = app.radioButtons.matching(Self.labelContains("PC")).firstMatch
        if !pc.exists { pc = app.buttons.matching(NSPredicate(format: "label ==[c] %@", "PC")).firstMatch }
        guard pc.waitForExistence(timeout: 5) else { return record(6, "make-pc", ok: false, "No PC control found") }
        pc.click()
        sleep(1)
        let isPC = app.descendants(matching: .any).matching(Self.labelContains(", PC")).firstMatch.exists
        return record(6, "make-pc", ok: isPC, "Canvas says the token is a PC: \(isPC)")
    }

    /// Step 7: View > World View (⇧⌘W), then what the players' window shows.
    @discardableResult
    func openWorldView(viaToolbar: Bool = false) -> Bool {
        if viaToolbar {
            app.toolbars.buttons.matching(Self.labelContains("World View")).firstMatch.click()
        } else {
            app.typeKey("w", modifierFlags: [.command, .shift])
        }
        let ok = worldWindow.waitForExistence(timeout: 10)
        sleep(2)
        return record(7, "world-view", ok: ok, ok ? "World View window open" : "No World View window")
    }

    /// Step 8, as the players see it: a PC is exposed on the World View and the window isn't black.
    @discardableResult
    func checkPlayersSeeMap() -> Bool {
        guard worldWindow.exists else { return record(8, "players-see-map", ok: false, "No World View") }
        let pc = worldWindow.descendants(matching: .any)
            .matching(NSPredicate(format: "label MATCHES %@", "(.*, )?PC(, selected)?")).firstMatch.exists
        let dark = Self.darkFraction(worldWindow.screenshot().image)
        let ok = pc && dark < 0.85
        if ok { reachedValue() }
        let shot = screenshot("8-world-view", of: worldWindow)
        record(
            8, "players-see-map", ok: ok,
            "PC on the World View: \(pc). Near-black share of the window: \(Int(dark * 100))%. Screenshot \(shot).",
            shot: false)
        return ok
    }

    /// Share of near-black pixels, sampled on a 64×64 grid.
    static func darkFraction(_ image: NSImage) -> Double {
        guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return 1 }
        let side = 64
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        guard let context = CGContext(
            data: &pixels, width: side, height: side, bitsPerComponent: 8, bytesPerRow: side * 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return 1 }
        context.draw(cg, in: CGRect(x: 0, y: 0, width: side, height: side))
        var dark = 0
        for i in stride(from: 0, to: pixels.count, by: 4) {
            let luma = 0.2126 * Double(pixels[i]) + 0.7152 * Double(pixels[i + 1]) + 0.0722 * Double(pixels[i + 2])
            if luma < 40 { dark += 1 }
        }
        return Double(dark) / Double(side * side)
    }

    /// Closes every campaign without saving, so the next test starts clean.
    func quitDiscarding() {
        app.typeKey("q", modifierFlags: .command)
        for _ in 0..<6 {
            let discard = app.buttons.matching(NSPredicate(format: "label IN %@", ["Delete", "Don’t Save", "Don't Save"])).firstMatch
            if discard.waitForExistence(timeout: 2) { discard.click() } else { break }
        }
        if app.state != .notRunning { app.terminate() }
    }
}
