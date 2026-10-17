import GraphiumCore
import SwiftUI

@main
struct GraphiumApp: App {
    var body: some Scene {
        // Document-based: New/Open/Open Recent/Save/Revert/autosave/versions and the
        // title-bar proxy icon all come from the system.
        DocumentGroup(newDocument: { CampaignDocument() }) { file in
            ArchitectView(document: file.document)
        }
        .commands {
            WorldViewCommands()
            ArchitectCommands()
            ExportCommands()
        }

        WindowGroup("World View", id: WorldWindow.id, for: UUID.self) { $sessionID in
            WorldWindow(sessionID: sessionID)
        }
        .defaultSize(width: 1280, height: 720)
    }
}
