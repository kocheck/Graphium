import GraphiumCore
import SwiftUI

/// Spotlight-style palette (PARITY §1.5): Actions and Assets, searched with the TS scoring.
struct CommandPalette: View {
    let isPaused: Bool
    let run: (PaletteCommand) -> Void
    let placeAsset: (TokenLibraryItem) -> Void
    let editAsset: (TokenLibraryItem) -> Void
    @ObservedObject var library = LibraryStore.shared
    /// Items the open campaign carries are searchable too (PARITY §5.3).
    @ObservedObject var document: CampaignDocument
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @FocusState private var focused: Bool

    private var actions: [PaletteCommand] {
        PaletteCommand.search(PaletteCommand.registry(isPaused: isPaused), query: query)
    }

    private var assets: [TokenLibraryItem] {
        query.trimmingCharacters(in: .whitespaces).isEmpty ? [] : TokenLibrarySearch.search(document.browsableLibrary.items, query: query)
    }

    var body: some View {
        VStack(spacing: 0) {
            TextField("Search actions and assets…", text: $query)
                .textFieldStyle(.plain)
                .font(.title3)
                .padding(14)
                .focused($focused)
                .onSubmit { runFirst() }
            Divider()
            List {
                if !actions.isEmpty {
                    Section("Actions") {
                        ForEach(actions) { command in
                            Button { choose(command) } label: {
                                HStack {
                                    Text(command.label)
                                    Spacer()
                                    if let shortcut = command.shortcut {
                                        Text(shortcut).font(.caption.monospaced()).foregroundStyle(.secondary)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                if !assets.isEmpty {
                    Section("Assets") {
                        ForEach(assets) { item in
                            HStack {
                                Button {
                                    placeAsset(item)
                                    dismiss()
                                } label: {
                                    HStack {
                                        if let image = document.libraryThumbnail(item) {
                                            Image(decorative: image, scale: 1).resizable().scaledToFit().frame(width: 24, height: 24)
                                        }
                                        Text(item.name)
                                        Text(item.category).foregroundStyle(.secondary)
                                    }
                                }
                                .buttonStyle(.plain)
                                Spacer()
                                Button("Edit") {
                                    editAsset(item)
                                    dismiss()
                                }
                                .controlSize(.small)
                            }
                        }
                    }
                }
            }
            .listStyle(.inset)
        }
        .frame(width: 520, height: 420)
        .onAppear { focused = true }
        .onExitCommand { dismiss() }
    }

    private func choose(_ command: PaletteCommand) {
        dismiss()
        run(command)
    }

    private func runFirst() {
        if let first = actions.first {
            choose(first)
        } else if let asset = assets.first {
            placeAsset(asset)
            dismiss()
        }
    }
}

/// Dungeon generator dialog (PARITY §5.5).
struct DungeonDialog: View {
    let generate: (DungeonOptions, _ clearFirst: Bool) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var rooms = 5
    @State private var minSize = 3
    @State private var maxSize = 8
    @State private var clearFirst = true

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Generate Dungeon").font(.title2.bold())
            Form {
                Stepper("Rooms: \(rooms)", value: $rooms, in: DungeonOptions.roomCountRange)
                Stepper("Min room size: \(minSize) cells", value: $minSize, in: DungeonOptions.minRoomSizeRange)
                    .onChange(of: minSize) { _, v in if maxSize < v { maxSize = max(v, DungeonOptions.maxRoomSizeRange.lowerBound) } }
                Stepper("Max room size: \(maxSize) cells", value: $maxSize, in: DungeonOptions.maxRoomSizeRange)
                    .onChange(of: maxSize) { _, v in if minSize > v { minSize = v } }
                Toggle("Clear existing walls and doors", isOn: $clearFirst)
            }
            Text("Rooms are drawn with the Wall tool and Door tool, so fog of war works straight away and everything stays editable.")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                Button("Generate") {
                    generate(DungeonOptions(numRooms: rooms, minRoomSize: minSize, maxRoomSize: maxSize), clearFirst)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 420)
    }
}
