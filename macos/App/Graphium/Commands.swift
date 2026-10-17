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
            Button("Generate Dungeon…") { actions?.showDungeon() }
                .keyboardShortcut("g", modifiers: [.command, .shift])
                .disabled(actions == nil)
        }
    }
}

/// File > Export as .graphium… for the web/Electron app (PARITY §5.2).
struct ExportCommands: Commands {
    @FocusedValue(\.campaignDocument) private var document

    var body: some Commands {
        CommandGroup(after: .saveItem) {
            Button("Export as .graphium…") { document?.exportLegacyGraphium() }
                .keyboardShortcut("e", modifiers: [.command, .shift])
                .disabled(document == nil)
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
    @AppStorage(PreferenceKey.theme) private var themeRaw = AppTheme.system.rawValue

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
        Button("Welcome to Graphium") { openWindow(id: WelcomeView.windowID) }
            .keyboardShortcut("1", modifiers: [.command, .shift])
    }
}
