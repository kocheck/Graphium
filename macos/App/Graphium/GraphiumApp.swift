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

        // Document-based: New/Open/Open Recent/Save/Revert/autosave/versions and the
        // title-bar proxy icon all come from the system.
        DocumentGroup(newDocument: { CampaignDocument() }) { file in
            ArchitectView(document: file.document)
                // Opening or saving a campaign brings back a recent hidden on Welcome (PARITY §1.2).
                .task(id: file.fileURL) { HiddenRecents.unhide(file.fileURL) }
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

        WindowGroup("Session Console", id: SessionConsoleWindow.id, for: UUID.self) { $sessionID in
            SessionConsoleWindow(sessionID: sessionID)
        }
        .defaultSize(width: 360, height: 720)

        Window("About Graphium", id: AboutView.windowID) {
            AboutView()
        }
        .windowResizability(.contentSize)

        Settings {
            SettingsView()
        }
    }
}
