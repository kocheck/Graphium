import SwiftUI

/// The campaign whose window is frontmost, for menu commands.
struct FocusedCampaignKey: FocusedValueKey {
    typealias Value = CampaignDocument
}

/// Architect-window actions the menus can trigger.
struct ArchitectActions {
    var showPalette: () -> Void
    var showDungeon: () -> Void
    var togglePerformanceMonitor: () -> Void
    var exportLegacy: () -> Void
    var tool: CanvasTool
    var selectTool: (CanvasTool) -> Void
    var showMapSettings: () -> Void
    var newMap: () -> Void
    /// Nil when calibration isn't possible (no map image, or not a square grid).
    var calibrate: (() -> Void)?
    var isDaylight: Bool
    var toggleDaylight: () -> Void
    /// Nil when nothing has been explored.
    var resetFog: (() -> Void)?
    /// Nil when nothing is selected.
    var deleteSelection: (() -> Void)?
    var showConsoleSettings: () -> Void
    var zoomIn: () -> Void
    var zoomOut: () -> Void
    var zoomToFit: () -> Void
}

struct FocusedArchitectActionsKey: FocusedValueKey {
    typealias Value = ArchitectActions
}

extension FocusedValues {
    var campaignDocument: CampaignDocument? {
        get { self[FocusedCampaignKey.self] }
        set { self[FocusedCampaignKey.self] = newValue }
    }

    var architectActions: ArchitectActions? {
        get { self[FocusedArchitectActionsKey.self] }
        set { self[FocusedArchitectActionsKey.self] = newValue }
    }
}

/// Command Palette (⌘K) and Insert > Generate Dungeon (PARITY §1.3, §1.5).
struct ArchitectCommands: Commands {
    @FocusedValue(\.architectActions) private var actions

    var body: some Commands {
        CommandGroup(after: .textEditing) {
            Button("Command Palette…") { actions?.showPalette() }
                .keyboardShortcut("k")
                .disabled(actions == nil)
            // TS also binds ⌘P (PARITY §1.4); printing a map isn't supported.
            Button("Command Palette") { actions?.showPalette() }
                .keyboardShortcut("p")
                .disabled(actions == nil)
        }
        // ⌘P is the palette and ⇧⌘P pauses the World View; maps aren't printable.
        CommandGroup(replacing: .printItem) {}
        CommandMenu("Insert") {
            // ⇧⌘D, as on the Welcome card: ⇧⌘G is Edit > Find > Find Previous on macOS.
            Button("Generate Dungeon…") { actions?.showDungeon() }
                .keyboardShortcut("d", modifiers: [.command, .shift])
                .disabled(actions == nil)
        }
    }
}

/// File > Export as .graphium… for the web/Electron app (PARITY §5.2).
struct ExportCommands: Commands {
    @FocusedValue(\.architectActions) private var actions

    var body: some Commands {
        CommandGroup(after: .saveItem) {
            Button("Export as .graphium…") { actions?.exportLegacy() }
                .keyboardShortcut("e", modifiers: [.command, .shift])
                .disabled(actions == nil)
        }
    }
}

/// View menu: World View and pause (PARITY §1.3, §1.12).
struct WorldViewCommands: Commands {
    @FocusedValue(\.campaignDocument) private var document

    var body: some Commands {
        CommandGroup(after: .toolbar) {
            WorldViewMenuItems(document: document)
        }
    }
}

private struct WorldViewMenuItems: View {
    let document: CampaignDocument?
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Divider()
        Button("World View (Projector)") {
            if let document { openWindow(id: WorldWindow.id, value: document.sessionID) }
        }
        .keyboardShortcut("w", modifiers: [.command, .shift])
        .disabled(document == nil)

        if let document {
            PauseMenuItem(document: document)
        } else {
            Button("Pause World View") {}
                .keyboardShortcut("p", modifiers: [.command, .shift])
                .disabled(true)
        }
        Divider()
    }
}

private struct PauseMenuItem: View {
    @ObservedObject var document: CampaignDocument

    var body: some View {
        Button(document.isPaused ? "Resume World View" : "Pause World View") {
            document.isPaused.toggle()
        }
        .keyboardShortcut("p", modifiers: [.command, .shift])
    }
}

/// About, Help, Theme, Performance Monitor and Welcome (PARITY §1.3, §1.8, §1.11, §1.13).
struct ShellCommands: Commands {
    @FocusedValue(\.architectActions) private var actions
    @AppStorage(Prefs.theme) private var themeRaw = AppTheme.system.rawValue

    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            AboutMenuItem(title: "About Graphium", tab: .about)
        }
        CommandGroup(replacing: .help) {
            AboutMenuItem(title: "Graphium Tutorial", tab: .tutorial)
            AboutMenuItem(title: "Keyboard Shortcuts", tab: .shortcuts)
            Divider()
            Link("Report a Bug…", destination: AppLinks.issues)
            Link("View Source on GitHub", destination: AppLinks.source)
        }
        CommandGroup(before: .toolbar) {
            Button("Zoom In") { actions?.zoomIn() }
                .keyboardShortcut("=", modifiers: .command)
                .disabled(actions == nil)
            Button("Zoom Out") { actions?.zoomOut() }
                .keyboardShortcut("-", modifiers: .command)
                .disabled(actions == nil)
            Button("Zoom to Fit") { actions?.zoomToFit() }
                .keyboardShortcut("0", modifiers: .command)
                .disabled(actions == nil)
            Divider()
            Picker("Theme", selection: Binding(
                get: { themeRaw },
                set: { raw in
                    themeRaw = raw
                    (AppTheme(rawValue: raw) ?? .system).apply()
                })
            ) {
                ForEach(AppTheme.allCases) { Text($0.title).tag($0.rawValue) }
            }
            Button("Performance Monitor") { actions?.togglePerformanceMonitor() }
                .keyboardShortcut("m", modifiers: [.command, .shift])
                .disabled(actions == nil)
            Divider()
        }
        CommandGroup(before: .windowList) {
            WelcomeMenuItem()
            Divider()
        }
    }
}

private struct AboutMenuItem: View {
    let title: String
    let tab: AboutModel.Tab
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button(title) { ShowAbout(openWindow: openWindow)(tab) }
    }
}

private struct WelcomeMenuItem: View {
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button(WelcomeView.menuTitle) { openWindow(id: WelcomeView.windowID) }
            .keyboardShortcut("1", modifiers: [.command, .shift])
    }
}

/// Tools, Map and Session Console menus (every action reachable from a menu, so Help
/// search and System Settings > Keyboard shortcuts can find it). Single-letter tool
/// keys stay on the canvas; menu key equivalents would steal typing in text fields.
struct EditorCommands: Commands {
    @FocusedValue(\.architectActions) private var actions
    @FocusedValue(\.campaignDocument) private var document

    var body: some Commands {
        CommandMenu("Tools") {
            ForEach(CanvasTool.allCases) { tool in
                Toggle(
                    "\(tool.title) (\(String(tool.key).uppercased()))",
                    isOn: Binding(get: { actions?.tool == tool }, set: { if $0 { actions?.selectTool(tool) } }))
            }
            .disabled(actions == nil)
        }
        CommandMenu("Map") {
            Button("Map Settings…") { actions?.showMapSettings() }
                .keyboardShortcut(",", modifiers: [.command, .option])
                .disabled(actions == nil)
            Button("New Map…") { actions?.newMap() }
                .keyboardShortcut("n", modifiers: [.command, .option])
                .disabled(actions == nil)
            Button("Calibrate Map Image…") { actions?.calibrate?() }
                .disabled(actions?.calibrate == nil)
            Divider()
            Toggle("Daylight", isOn: Binding(get: { actions?.isDaylight ?? false }, set: { _ in actions?.toggleDaylight() }))
                .disabled(actions == nil)
            Button("Reset Explored Fog…") { actions?.resetFog?() }
                .disabled(actions?.resetFog == nil)
            Divider()
            Button("Delete Selection") { actions?.deleteSelection?() }
                .keyboardShortcut(.delete, modifiers: [.command])
                .disabled(actions?.deleteSelection == nil)
        }
        CommandMenu("Session") {
            if let document {
                SessionMenuItems(document: document, showSettings: actions?.showConsoleSettings)
            } else {
                Button("Stop Music") {}.disabled(true)
            }
        }
    }
}

private struct SessionMenuItems: View {
    @ObservedObject var document: CampaignDocument
    let showSettings: (() -> Void)?
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        let runtime = document.sessionRuntime
        Button("Stop Music") { document.dispatch(.stop) }
            .disabled(runtime.audio.trackId == nil)
        Toggle("Duck Music", isOn: Binding(get: { runtime.ducked }, set: { document.dispatch(.setDucked($0)) }))
        Button("Return to Map") { document.dispatch(.returnToMap) }
            .disabled(!runtime.stageVisible)
        Button("Play Test Tone") { document.dispatch(.fireSfx(sfxId: "test-tone")) }
        Divider()
        Button("Session Console Window") { openWindow(id: SessionConsoleWindow.id, value: document.sessionID) }
            .keyboardShortcut("c", modifiers: [.command, .option])
        Button("Session Console Settings…") { showSettings?() }
            .disabled(showSettings == nil)
    }
}
