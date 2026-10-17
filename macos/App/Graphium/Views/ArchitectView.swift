import GraphiumCore
import SwiftUI

/// The DM's window: map navigator sidebar plus the editable canvas.
struct ArchitectView: View {
    @ObservedObject var document: CampaignDocument
    @Environment(\.undoManager) private var undoManager
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        NavigationSplitView {
            List(selection: activeMapBinding) {
                Section("Maps") {
                    ForEach(document.campaign.maps) { map in
                        Text(map.name).tag(map.id)
                    }
                }
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 220)
            .toolbar {
                ToolbarItem {
                    Button {
                        document.edit("Add Map", undoManager: undoManager) { $0.addMap() }
                    } label: {
                        Label("Add Map", systemImage: "plus")
                    }
                    .help("Add a map to this campaign")
                }
            }
        } detail: {
            MapCanvas(map: document.campaign.activeMap)
                .navigationTitle(document.campaign.activeMap.name)
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            openWindow(id: WorldWindow.id, value: document.sessionID)
                        } label: {
                            Label("World View", systemImage: "tv")
                        }
                        .help("Open the player-facing World View (drag it to the projector)")
                        .keyboardShortcut("w", modifiers: [.command, .shift])
                    }
                }
        }
    }

    private var activeMapBinding: Binding<GameMap.ID?> {
        Binding(
            get: { document.campaign.activeMapID },
            set: { newValue in
                guard let newValue, newValue != document.campaign.activeMapID else { return }
                document.edit("Switch Map", undoManager: undoManager) { $0.activeMapID = newValue }
            })
    }
}
