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
    @State private var highlighted = 0
    @FocusState private var focused: Bool

    private var actions: [PaletteCommand] {
        PaletteCommand.search(PaletteCommand.registry(isPaused: isPaused), query: query)
    }

    /// TS `fuzzySearch`: an empty query lists the whole library, newest first, so
    /// the sidebar's "Place…" opens onto something to place (PARITY §1.5, §2.1).
    private var assets: [TokenLibraryItem] {
        TokenLibrarySearch.search(document.browsableLibrary.items, query: query)
    }

    /// The highlighted row over `actions + assets` (section headers aren't rows); nil when empty.
    private func current(count: Int) -> Int? {
        count == 0 ? nil : min(max(highlighted, 0), count - 1)
    }

    private static func rowID(action id: String) -> String { "action:\(id)" }
    private static func rowID(asset id: String) -> String { "asset:\(id)" }
    private static func rowBackground(_ highlighted: Bool) -> Color? { highlighted ? Color.accentColor.opacity(0.25) : nil }

    var body: some View {
        let actions = self.actions
        let assets = self.assets
        let count = actions.count + assets.count
        let selected = current(count: count)
        VStack(spacing: 0) {
            TextField("Search actions and assets…", text: $query)
                .textFieldStyle(.plain)
                .font(.title3)
                .padding(14)
                .focused($focused)
                .onSubmit { runHighlighted(actions: actions, assets: assets) }
                .onKeyPress(.upArrow) { move(by: -1, count: count) }
                .onKeyPress(.downArrow) { move(by: 1, count: count) }
            Divider()
            ScrollViewReader { proxy in
                List {
                    if !actions.isEmpty {
                        Section("Actions") {
                            ForEach(Array(actions.enumerated()), id: \.element.id) { index, command in
                                Button { choose(command) } label: {
                                    HStack {
                                        Text(command.label)
                                        Spacer()
                                        if let shortcut = command.shortcut {
                                            Text(shortcut).font(.caption.monospaced()).foregroundStyle(.secondary)
                                        }
                                    }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .id(Self.rowID(action: command.id))
                                .listRowBackground(Self.rowBackground(selected == index))
                            }
                        }
                    }
                    if !assets.isEmpty {
                        Section("Assets") {
                            ForEach(Array(assets.enumerated()), id: \.element.id) { index, item in
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
                                .id(Self.rowID(asset: item.id))
                                .listRowBackground(Self.rowBackground(selected == actions.count + index))
                            }
                        }
                    }
                }
                .listStyle(.inset)
                .onChange(of: highlighted) { _, _ in
                    guard let row = current(count: count) else { return }
                    let id = row < actions.count
                        ? Self.rowID(action: actions[row].id) : Self.rowID(asset: assets[row - actions.count].id)
                    proxy.scrollTo(id)
                }
            }
        }
        .frame(width: 520, height: 420)
        .onAppear { focused = true }
        .onChange(of: query) { _, _ in highlighted = 0 }
        .onExitCommand { dismiss() }
    }

    /// Up/Down move the highlight, clamped at the ends (TS `CommandPalette`).
    private func move(by delta: Int, count: Int) -> KeyPress.Result {
        if let next = PaletteHighlight.step(current(count: count), by: delta, count: count) {
            highlighted = next
        }
        return .handled
    }

    private func choose(_ command: PaletteCommand) {
        dismiss()
        run(command)
    }

    /// Return runs the highlighted row.
    private func runHighlighted(actions: [PaletteCommand], assets: [TokenLibraryItem]) {
        guard let row = current(count: actions.count + assets.count) else { return }
        if row < actions.count {
            choose(actions[row])
        } else {
            placeAsset(assets[row - actions.count])
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
                .fixedSize(horizontal: false, vertical: true)  // wraps instead of truncating
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
