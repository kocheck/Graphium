import SwiftUI

/// The campaign whose window is frontmost, for menu commands.
struct FocusedCampaignKey: FocusedValueKey {
    typealias Value = CampaignDocument
}

/// Architect-window actions the menus can trigger.
struct ArchitectActions {
    var showPalette: () -> Void
    var showDungeon: () -> Void
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
        }
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
