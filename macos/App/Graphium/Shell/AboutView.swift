import SwiftUI

/// About / Tutorial / Shortcuts (PARITY §1.8). One window; callers pick the tab.
@MainActor
final class AboutModel: ObservableObject {
    static let shared = AboutModel()

    enum Tab: Hashable {
        case about, tutorial, shortcuts
    }

    @Published var tab: Tab = .about
}

enum AppLinks {
    static let source = URL(string: "https://github.com/kocheck/Graphium")!
    static let issues = URL(string: "https://github.com/kocheck/Graphium/issues")!
    static let releases = URL(string: "https://github.com/kocheck/Graphium/releases")!

    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }
}

/// Opens the About window on a tab. Used by menus, `?`, Welcome and Help.
struct ShowAbout {
    let openWindow: OpenWindowAction

    @MainActor
    func callAsFunction(_ tab: AboutModel.Tab) {
        AboutModel.shared.tab = tab
        openWindow(id: AboutView.windowID)
    }
}

struct AboutView: View {
    static let windowID = "about"
    @ObservedObject private var model = AboutModel.shared

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 16) {
                Image("Logo").resizable().frame(width: 64, height: 64)
                VStack(alignment: .leading) {
                    Text("Graphium").font(.largeTitle.bold())
                    Text("Version \(AppLinks.version) · macOS Edition").foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(20)
            Picker("Section", selection: $model.tab) {
                Text("About").tag(AboutModel.Tab.about)
                Text("Tutorial").tag(AboutModel.Tab.tutorial)
                Text("Shortcuts").tag(AboutModel.Tab.shortcuts)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .padding(.horizontal, 20)
            Divider().padding(.top, 12)
            ScrollView {
                Group {
                    switch model.tab {
                    case .about: aboutTab
                    case .tutorial: tutorialTab
                    case .shortcuts: ShortcutsList()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
            }
            Divider()
            Text("May your rolls be ever in your favor, Dungeon Master. ⚔️🎲")
                .font(.callout)
                .foregroundStyle(.secondary)
                .padding(12)
        }
        .frame(minWidth: 560, idealWidth: 640, minHeight: 520, idealHeight: 640)
    }

    private var aboutTab: some View {
        VStack(alignment: .leading, spacing: 20) {
            section("🎲 World Given Form") {
                Text(
                    "Greetings, Master of Dungeons! **Graphium** (Latin: *graphium*, “a writing stylus”) is your arcane battlemat—a local-first virtual tabletop designed to replace your physical grid with digital sorcery."
                )
                Text(
                    "Project your campaign map onto a second monitor or share your screen, maintaining **total control** over what your players see while you orchestrate the chaos from your Architect’s throne."
                )
            }
            section("🌟 The Sacred Philosophy") {
                Text(
                    "Graphium is a **digital stylus** for the discerning World Builder. It handles maps, tokens, and fog of war without demanding tribute to corporate overlords. Your campaigns are stored locally in sacred `.graphiumcampaign` tomes that no cloud wizard can touch. Simple, powerful, and *yours*."
                )
            }
            HStack {
                Spacer()
                VStack(spacing: 8) {
                    Text("Version \(AppLinks.version)").foregroundStyle(.secondary)
                    Link("View Source on GitHub", destination: AppLinks.source).bold()
                    Link("Releases", destination: AppLinks.releases)
                }
                Spacer()
            }
        }
    }

    private var tutorialTab: some View {
        VStack(alignment: .leading, spacing: 20) {
            section("⚔️ Core Powers") {
                bullet("Dual-Window Enchantment", "Architect View for you, pristine World View for your players")
                bullet("Fog of War", "Dynamic vision with raycasting, wall occlusion, and blurred aesthetics")
                bullet("Drawing Tools", "Markers, erasers, and vision-blocking walls (Shift to lock axes!)")
                bullet("Local-First", "Your data stays yours—saved as .graphiumcampaign files, no cloud required")
            }
            section("Designed for Dungeon Masters") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 12)], spacing: 12) {
                    FeatureCard(symbol: "rectangle.on.rectangle", title: "Dual Windows", text: "Architect view for you, clean world view for players")
                    FeatureCard(symbol: "eye.slash", title: "Fog of War", text: "Hardware-accelerated raycasting with dynamic vision")
                    FeatureCard(symbol: "square.grid.3x3.topleft.filled", title: "Dungeon Generator", text: "Procedural dungeons with rooms, corridors, and doors")
                    FeatureCard(symbol: "internaldrive", title: "Local-First", text: "Your campaigns live on your drive, no cloud required")
                    FeatureCard(symbol: "pencil.tip", title: "Drawing Tools", text: "Markers, walls, doors, and tactical annotations")
                    FeatureCard(symbol: "books.vertical", title: "Asset Library", text: "Drag-and-drop tokens with automatic optimization")
                }
            }
            section("See Graphium in Action") {
                screenshot("ScreenshotFog", caption: "Dual-window architecture with fog of war")
                screenshot("ScreenshotOverview", caption: "Dynamic lighting and shadows")
            }
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.title2.bold()).foregroundStyle(Color.accentColor)
            content().foregroundStyle(.secondary)
        }
    }

    private func bullet(_ title: String, _ text: String) -> some View {
        Text("•  **\(title):** \(text)")
    }

    private func screenshot(_ name: String, caption: String) -> some View {
        VStack(spacing: 6) {
            Image(name).resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 4))
                .accessibilityLabel(caption)
            Text(caption).font(.caption)
        }
    }
}

private struct FeatureCard: View {
    let symbol: String
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: symbol).font(.title2).foregroundStyle(Color.accentColor)
            Text(title).font(.headline).foregroundStyle(.primary)
            Text(text).font(.callout)
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .padding(12)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 4))
    }
}

/// The full shortcut set (PARITY §1.4: the native help lists every key, not the TS subset).
struct ShortcutsList: View {
    private struct Row: Hashable {
        let keys: String
        let action: String
    }

    private struct ShortcutGroup: Hashable {
        let title: String
        let rows: [Row]
    }

    private let groups: [ShortcutGroup] = [
        ShortcutGroup(title: "Tools", rows: [
            Row(keys: "V", action: "Select"), Row(keys: "M", action: "Marker"), Row(keys: "E", action: "Eraser"), Row(keys: "W", action: "Wall (blocks vision)"),
            Row(keys: "D", action: "Door"), Row(keys: "R", action: "Measure (rotates the door with the Door tool)"), Row(keys: "I", action: "Marker colour"),
            Row(keys: "↑ ↓ ← →", action: "Rotate the door (Door tool)"),
        ]),
        ShortcutGroup(title: "Canvas", rows: [
            Row(keys: "Space-drag", action: "Pan"), Row(keys: "Scroll", action: "Pan"), Row(keys: "⌘-scroll / pinch", action: "Zoom at the pointer"),
            Row(keys: "+ / −", action: "Zoom around the centre"), Row(keys: "1 – 5", action: "Grid: Lines, Dots, Hex, Iso, Hidden"),
            Row(keys: "Shift (drawing)", action: "Lock to an axis"), Row(keys: "Shift-click / marquee", action: "Add to the selection"),
            Row(keys: "⌥-drag", action: "Duplicate tokens or strokes"), Row(keys: "Hold M", action: "Movement range of the selection"),
            Row(keys: "Delete", action: "Remove the selection"), Row(keys: "Esc", action: "Clear measurement and selection; stop music"),
        ]),
        ShortcutGroup(title: "Campaign", rows: [
            Row(keys: "⌘N", action: "New campaign"), Row(keys: "⌘O", action: "Open"), Row(keys: "⌘S", action: "Save"), Row(keys: "⇧⌘E", action: "Export as .graphium"),
            Row(keys: "⌘K / ⌘P", action: "Command palette"), Row(keys: "⇧⌘D", action: "Generate dungeon"), Row(keys: "⌘Z / ⇧⌘Z", action: "Undo / Redo"),
        ]),
        ShortcutGroup(title: "World View", rows: [
            Row(keys: "⇧⌘W", action: "Open World View"), Row(keys: "⇧⌘P", action: "Pause / resume players"), Row(keys: "⇧⌘M", action: "Performance monitor"),
            Row(keys: "?", action: "About Graphium"),
        ]),
        ShortcutGroup(title: "Session Console", rows: [Row(keys: "1 – 9", action: "Play a track"), Row(keys: "D", action: "Duck music"), Row(keys: "Esc", action: "Stop")]),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("📜 Quick Start Incantations").font(.title2.bold()).foregroundStyle(Color.accentColor)
            ForEach(groups, id: \.self) { group in
                VStack(alignment: .leading, spacing: 6) {
                    Text(group.title).font(.headline)
                    Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 4) {
                        ForEach(group.rows, id: \.self) { row in
                            GridRow {
                                Text(row.keys).font(.body.monospaced()).padding(.horizontal, 6)
                                    .background(.quaternary, in: RoundedRectangle(cornerRadius: 4))
                                Text(row.action).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
    }
}
