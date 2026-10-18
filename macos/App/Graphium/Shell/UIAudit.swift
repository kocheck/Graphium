#if DEBUG
    import AppKit
    import GraphiumCore
    import SwiftUI

    /// Debug-only UI audit for a design pass without screen recording or app control: launch with
    /// `-GraphiumUIAudit <folder>` and the app writes, then quits,
    /// - `menus.txt`: the main menu bar with key equivalents, and any shortcut used twice;
    /// - `views/<name>-<light|dark>.png`: panels and sheets rendered offscreen at the widths
    ///   they get in the app (inspector at its minimum and ideal widths);
    /// - `widths.txt`: views whose content wants more width than the app gives them (clipping).
    /// Uses a synthetic campaign only (review-loop.md).
    @MainActor
    enum UIAudit {
        static var folder: URL? {
            guard let path = UserDefaults.standard.string(forKey: "GraphiumUIAudit"), !path.isEmpty else { return nil }
            return URL(fileURLWithPath: (path as NSString).expandingTildeInPath, isDirectory: true)
        }

        static func runIfRequested() {
            guard let folder else { return }
            try? FileManager.default.createDirectory(
                at: folder.appendingPathComponent("views"), withIntermediateDirectories: true)
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(1.5))
                let document = CampaignDocument(campaign: sampleCampaign())
                var widths: [String] = []
                for surface in surfaces(document) {
                    for dark in [false, true] {
                        if let note = await render(surface, dark: dark, into: folder) { widths.append(note) }
                    }
                }
                write(widths.isEmpty ? "No view wants more width than it gets.\n" : widths.joined(separator: "\n") + "\n",
                    to: folder.appendingPathComponent("widths.txt"))
                await openSampleDocument(in: folder)
                try? await Task.sleep(for: .seconds(2.5))
                write(menuReport(), to: folder.appendingPathComponent("menus.txt"))
                await snapshotWindows(into: folder)
                NSApp.terminate(nil)
            }
        }

        // MARK: Surfaces

        struct Surface {
            let name: String
            /// Nil sizes the view to fit (sheets with their own frame).
            let width: CGFloat?
            let height: CGFloat?
            let view: AnyView
        }

        static func surfaces(_ document: CampaignDocument) -> [Surface] {
            let map = document.campaign.activeMap
            let token = Set([map.tokens[0].id])
            let tokens = Set(map.tokens.map(\.id))
            let note = Set([map.notes[0].id])
            let effect = Set([map.effects[0].id])
            let line = Set([map.effects[1].id])
            var list: [Surface] = []
            for width: CGFloat in [260, 300] {
                let w = Int(width)
                list += [
                    Surface(name: "token-inspector-\(w)", width: width, height: 900,
                        view: AnyView(TokenInspector(document: document, selection: token))),
                    Surface(name: "tokens-inspector-\(w)", width: width, height: 700,
                        view: AnyView(TokenInspector(document: document, selection: tokens))),
                    Surface(name: "note-inspector-\(w)", width: width, height: 800,
                        view: AnyView(NoteInspector(document: document, selection: note))),
                    Surface(name: "effect-inspector-\(w)", width: width, height: 800,
                        view: AnyView(EffectInspector(document: document, selection: effect))),
                    Surface(name: "line-effect-inspector-\(w)", width: width, height: 800,
                        view: AnyView(EffectInspector(document: document, selection: line))),
                    Surface(name: "session-console-\(w)", width: width, height: 900,
                        view: AnyView(SessionConsolePanel(document: document))),
                ]
            }
            list += [
                Surface(name: "map-settings", width: nil, height: nil,
                    view: AnyView(MapSettingsView(document: document, map: map, isNew: false, onSave: { _ in }, onCalibrate: { _ in }))),
                Surface(name: "new-map", width: nil, height: nil,
                    view: AnyView(MapSettingsView(document: document, map: GameMap(name: "Untitled Map"), isNew: true, onSave: { _ in }, onCalibrate: { _ in }))),
                Surface(name: "dungeon-dialog", width: nil, height: nil, view: AnyView(DungeonDialog { _, _ in })),
                Surface(name: "command-palette", width: nil, height: nil,
                    view: AnyView(CommandPalette(isPaused: false, run: { _ in }, placeAsset: { _ in }, editAsset: { _ in }, document: document))),
                Surface(name: "console-settings", width: nil, height: nil, view: AnyView(SessionConsoleSettings(document: document))),
                Surface(name: "plate-editor", width: nil, height: nil,
                    view: AnyView(PlateEditor(plate: StageImage(name: "The Sunken Chapel", src: "", thumbnailSrc: ""), onSave: { _ in }))),
                Surface(name: "settings", width: nil, height: nil, view: AnyView(SettingsView())),
                Surface(name: "welcome", width: 760, height: 600, view: AnyView(WelcomeView())),
                Surface(name: "about", width: 560, height: 520, view: AnyView(AboutView())),
                Surface(name: "world-view", width: 1280, height: 720, view: AnyView(WorldWindow(sessionID: document.sessionID))),
            ]
            return list
        }

        /// Names long enough to show truncation, on every kind of thing the inspectors edit.
        static func sampleCampaign() -> Campaign {
            var map = GameMap(name: "The Drowned Abbey of Saint Vellamy", gridSize: 50)
            map.tokens = [
                Token(x: 100, y: 100, src: "", type: .pc, visionRadius: 60, name: "Seraphina Thornwood-Blackmere",
                    movementSpeed: 30, darkvision: 60, playerName: "Sera"),
                Token(x: 200, y: 100, src: "", type: .npc, name: "Goblin Skirmisher", movementSpeed: 30),
            ]
            map.notes = [
                MapNote(x: 300, y: 300, title: "Collapsed reliquary beneath the north transept",
                    dmNotes: "## Trap\nA **DC 15** Perception check spots the tripwire.\n- Loot: 40 gp\n- A silvered dagger",
                    playerNotes: "The air smells of wet stone and old incense.", isShared: true)
            ]
            map.effects = [
                SpellEffect(shape: .cone, size: 60, angle: 30, x: 400, y: 400, tokenID: map.tokens[0].id, look: .fire,
                    color: "#3366FF", label: "Burning Hands from the second-level slot"),
                SpellEffect(shape: .line, size: 100, x: 500, y: 500, look: .lightning, label: "Lightning Bolt", isHidden: true),
            ]
            map.initiative = Initiative(
                entries: [Initiative.Entry(tokenID: map.tokens[0].id, value: 18), Initiative.Entry(tokenID: map.tokens[1].id, value: 12)],
                currentTokenID: map.tokens[0].id)
            return Campaign(name: "UI Audit", maps: [map], activeMapID: map.id)
        }

        // MARK: Rendering

        private static func render(_ surface: Surface, dark: Bool, into folder: URL) async -> String? {
            let hosting = NSHostingView(rootView: surface.view.environment(\.colorScheme, dark ? .dark : .light))
            hosting.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
            let natural = hosting.fittingSize
            let size = NSSize(width: surface.width ?? max(natural.width, 200), height: surface.height ?? max(natural.height, 100))
            let window = NSWindow(
                contentRect: NSRect(x: -20_000, y: -20_000, width: size.width, height: size.height),
                styleMask: [.borderless], backing: .buffered, defer: false)
            window.isReleasedWhenClosed = false
            window.appearance = hosting.appearance
            window.contentView = hosting
            window.orderFrontRegardless()
            try? await Task.sleep(for: .seconds(0.6))
            hosting.layoutSubtreeIfNeeded()
            let suffix = dark ? "dark" : "light"
            if let rep = hosting.bitmapImageRepForCachingDisplay(in: hosting.bounds) {
                hosting.cacheDisplay(in: hosting.bounds, to: rep)
                try? rep.representation(using: .png, properties: [:])?
                    .write(to: folder.appendingPathComponent("views/\(surface.name)-\(suffix).png"))
            }
            window.orderOut(nil)
            window.close()
            guard !dark, let width = surface.width, natural.width > width + 0.5 else { return nil }
            return "\(surface.name): content wants \(Int(natural.width.rounded())) pt, gets \(Int(width)) pt"
        }

        private static func openSampleDocument(in folder: URL) async {
            let url = folder.appendingPathComponent("UI Audit.graphiumcampaign")
            try? FileManager.default.removeItem(at: url)
            do {
                let package = CampaignPackage(campaign: sampleCampaign(), assets: [:])
                try package.fileWrapper(reusing: nil).write(to: url, options: .atomic, originalContentsURL: nil)
            } catch {
                write("Couldn't write the sample campaign: \(error)\n", to: folder.appendingPathComponent("errors.txt"))
                return
            }
            guard let (opened, _) = try? await NSDocumentController.shared.openDocument(withContentsOf: url, display: true)
            else { return }
            // Menus follow the key window, so make the campaign window key before dumping them.
            NSApp.activate(ignoringOtherApps: true)
            opened.windowControllers.first?.window?.makeKeyAndOrderFront(nil)
        }

        private static func snapshotWindows(into folder: URL) async {
            for (index, window) in NSApp.windows.enumerated() where window.isVisible {
                await snapshot(window, index: index, suffix: "", into: folder)
                // Campaign windows again at a laptop-sized width, where the toolbar and sidebar crowd.
                if window.windowController?.document != nil {
                    window.setFrame(NSRect(origin: window.frame.origin, size: NSSize(width: 1000, height: 680)), display: true)
                    await snapshot(window, index: index, suffix: "-narrow", into: folder)
                }
            }
        }

        private static func snapshot(_ window: NSWindow, index: Int, suffix: String, into folder: URL) async {
            guard let frame = window.contentView?.superview ?? window.contentView else { return }
            let name = (window.title.isEmpty ? "window-\(index)" : window.title).replacingOccurrences(of: "/", with: "-")
            for dark in [false, true] {
                window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
                try? await Task.sleep(for: .seconds(0.6))
                frame.layoutSubtreeIfNeeded()
                guard let rep = frame.bitmapImageRepForCachingDisplay(in: frame.bounds) else { continue }
                frame.cacheDisplay(in: frame.bounds, to: rep)
                try? rep.representation(using: .png, properties: [:])?
                    .write(to: folder.appendingPathComponent("views/window-\(name)\(suffix)-\(dark ? "dark" : "light").png"))
            }
            window.appearance = nil
        }

        // MARK: Menus

        static func menuReport() -> String {
            var lines: [String] = []
            var shortcuts: [String: [String]] = [:]
            func walk(_ menu: NSMenu, path: String, depth: Int) {
                menu.update()
                for item in menu.items {
                    let indent = String(repeating: "  ", count: depth)
                    if item.isSeparatorItem {
                        lines.append("\(indent)---")
                        continue
                    }
                    let key = shortcut(item)
                    let state = item.state == .on ? " [✓]" : ""
                    let enabled = item.isEnabled ? "" : " (disabled)"
                    let alternate = item.isAlternate ? " (alternate)" : ""
                    let hidden = item.isHidden ? " (hidden)" : ""
                    lines.append("\(indent)\(item.title)\(key.isEmpty ? "" : "\t\(key)")\(state)\(enabled)\(alternate)\(hidden)")
                    if !key.isEmpty, !item.isHidden { shortcuts[key, default: []].append("\(path) > \(item.title)") }
                    if let submenu = item.submenu {
                        walk(submenu, path: path.isEmpty ? item.title : "\(path) > \(item.title)", depth: depth + 1)
                    }
                }
            }
            if let main = NSApp.mainMenu { walk(main, path: "", depth: 0) }
            let clashes = shortcuts.filter { $0.value.count > 1 }.sorted { $0.key < $1.key }
            lines.append("")
            lines.append(clashes.isEmpty ? "No shortcut is used twice." : "Shortcuts used more than once:")
            for (key, items) in clashes { lines.append("  \(key): \(items.joined(separator: " | "))") }
            return lines.joined(separator: "\n") + "\n"
        }

        private static func shortcut(_ item: NSMenuItem) -> String {
            guard !item.keyEquivalent.isEmpty else { return "" }
            var flags = item.keyEquivalentModifierMask
            var key = item.keyEquivalent
            if key != key.lowercased() {
                flags.insert(.shift)
                key = key.lowercased()
            }
            var text = ""
            if flags.contains(.control) { text += "⌃" }
            if flags.contains(.option) { text += "⌥" }
            if flags.contains(.shift) { text += "⇧" }
            if flags.contains(.command) { text += "⌘" }
            let names: [String: String] = ["\u{8}": "⌫", "\u{7f}": "⌫", "\r": "↩", "\u{1b}": "⎋", " ": "Space", "\t": "⇥"]
            return text + (names[key] ?? key.uppercased())
        }

        private static func write(_ text: String, to url: URL) {
            try? text.write(to: url, atomically: true, encoding: .utf8)
        }
    }
#endif
