import GraphiumCore
import SwiftUI

@main
struct GraphiumApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        // First, so it is what opens at launch (PARITY §1.2).
        Window("Welcome to Graphium", id: WelcomeView.windowID) {
            WelcomeView()
        }
        .windowResizability(.contentSize)
        .defaultPosition(.center)
        // Window > Welcome to Graphium (⇧⌘1) is ShellCommands' own item; without this the
        // window would be listed twice.
        .commandsRemoved()

        // Document-based: New/Open/Open Recent/Save/Revert/autosave/versions and the
        // title-bar proxy icon all come from the system.
        DocumentGroup(newDocument: { CampaignDocument() }) { file in
            ArchitectView(document: file.document)
                // Opening or saving a campaign brings back a recent hidden on Welcome (PARITY §1.2),
                // and tells the Agent window where the file is.
                .task(id: file.fileURL) {
                    HiddenRecents.unhide(file.fileURL)
                    file.document.fileURL = file.fileURL
                }
                .modifier(DocumentNoticeAlert(document: file.document))
        }
        .commands {
            WorldViewCommands()
            ArchitectCommands()
            ExportCommands()
            ShellCommands()
            EditorCommands()
        }

        WindowGroup("World View", id: WorldWindow.id, for: UUID.self) { $sessionID in
            WorldWindow(sessionID: sessionID)
        }
        .defaultSize(width: 1280, height: 720)
        // Opened for a campaign from View > World View; File > New would open one with no campaign.
        .commandsRemoved()

        WindowGroup("Session Console", id: SessionConsoleWindow.id, for: UUID.self) { $sessionID in
            SessionConsoleWindow(sessionID: sessionID)
        }
        .defaultSize(width: 360, height: 720)
        .commandsRemoved()

        // Window > Agent, only while it's turned on in Settings > AI Tools.
        WindowGroup("Agent", id: AgentWindow.id, for: UUID.self) { $sessionID in
            AgentWindow(sessionID: sessionID)
        }
        .defaultSize(width: 420, height: 640)
        .commandsRemoved()

        Window("About Graphium", id: AboutView.windowID) {
            AboutView()
        }
        .windowResizability(.contentSize)
        // Opened from Graphium > About and the Help menu, not listed in the Window menu.
        .commandsRemoved()

        Settings {
            SettingsView()
        }
    }
}
