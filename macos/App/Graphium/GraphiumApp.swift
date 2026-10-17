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
        }
        .commands {
            WorldViewCommands()
            ArchitectCommands()
            ExportCommands()
            ShellCommands()
        }

        WindowGroup("World View", id: WorldWindow.id, for: UUID.self) { $sessionID in
            WorldWindow(sessionID: sessionID)
        }
        .defaultSize(width: 1280, height: 720)

        Window("About Graphium", id: AboutView.windowID) {
            AboutView()
        }
        .windowResizability(.contentSize)

        Settings {
            SettingsView()
        }
    }
}
