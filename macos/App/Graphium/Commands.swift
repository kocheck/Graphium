import SwiftUI

/// The campaign whose window is frontmost, for menu commands.
struct FocusedCampaignKey: FocusedValueKey {
    typealias Value = CampaignDocument
}

extension FocusedValues {
    var campaignDocument: CampaignDocument? {
        get { self[FocusedCampaignKey.self] }
        set { self[FocusedCampaignKey.self] = newValue }
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
