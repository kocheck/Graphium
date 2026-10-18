import AppKit
import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// The DM's Session Console (PARITY §5.4): plates and music the World View plays.
struct SessionConsolePanel: View {
    @ObservedObject var document: CampaignDocument
    /// In its own window the panel's undo manager isn't the document's; edits then
    /// go to the Architect window's stack (nil lets the document pick it).
    var detached = false
    @Environment(\.undoManager) private var undoManager
    private var undo: UndoManager? { detached ? nil : undoManager }

    @State private var youtubeText = ""
    @State private var notice: String?
    @State private var importing: ImportKind?
    @State private var editingPlate: StageImage?
    @State private var editingTrack: Track?
    @State private var showingSettings = false
    @State private var renaming: RenameTarget?
    // Collapsible sections, remembered across launches.
    @AppStorage("graphium.console.platesExpanded") private var platesExpanded = true
    @AppStorage("graphium.console.tracksExpanded") private var tracksExpanded = true
    @AppStorage("graphium.console.sfxExpanded") private var sfxExpanded = true
    @AppStorage("graphium.console.soundscapesExpanded") private var soundscapesExpanded = true
    @State private var renameText = ""

    private enum RenameTarget {
        case set(String), group(String)
    }

    private enum ImportKind: Identifiable {
        case files, folder
        var id: Self { self }
    }

    private var catalog: SessionConsoleCatalog { document.campaign.sessionConsole }
    private var runtime: SessionConsoleRuntime { document.sessionRuntime }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                masterBar
                if let error = document.audioError {
                    Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(Palette.statusWarning.color).font(.caption)
                }
                if let notice {
                    Text(notice).font(.caption).foregroundStyle(.secondary)
                }
                addControls
                section("Plates", isExpanded: $platesExpanded) { platesSection }
                section("Music", isExpanded: $tracksExpanded) { tracksSection }
                section("Soundscapes", isExpanded: $soundscapesExpanded) { soundscapesSection }
                section("Sound Effects", isExpanded: $sfxExpanded) { sfxSection }
            }
            .padding(12)
        }
        .focusable()
        .onKeyPress(phases: .down) { press in handleKey(press) }
        // Board dropzone (PARITY §5.4): files or one folder dropped anywhere on the panel.
        .dropDestination(for: URL.self) { urls, _ in
            ingestDropped(urls)
            return true
        }
        .fileImporter(
            isPresented: Binding(get: { importing != nil }, set: { if !$0 { importing = nil } }),
            allowedContentTypes: importing == .folder ? [.folder] : [.image, .audio],
            allowsMultipleSelection: importing != .folder
        ) { result in
            let kind = importing
            importing = nil
            if case .success(let urls) = result { ingest(urls, fromFolder: kind == .folder) }
        }
        .sheet(item: $editingPlate) { plate in
            PlateEditor(plate: plate) { updated in
                document.editConsole("Edit Plate", undoManager: undo) { c in
                    c.updateImage(id: updated.id) { $0 = updated }
                }
            }
        }
        .sheet(item: $editingTrack) { track in
            TrackEditor(track: track, plates: catalog.imageSets.flatMap(\.images)) { updated in
                document.editConsole("Edit Track", undoManager: undo) { c in
                    c.updateTrack(id: updated.id) { $0 = updated }
                }
            }
        }
        .sheet(isPresented: $showingSettings) {
            SessionConsoleSettings(document: document, detached: detached)
        }
        .alert(
            renameTitle,
            isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })
        ) {
            TextField("Name", text: $renameText)
            Button("Rename") { commitRename() }
            Button("Cancel", role: .cancel) {}
        }
    }

    // MARK: Master bar

    /// Inside the inspector: a native group box, never glass on glass.
    private var masterBar: some View {
        GroupBox { masterBarContent }
    }

    /// Whether players see anything: paused wins over open, since a plate chosen now stays
    /// behind "Please Wait" until the DM resumes.
    private var worldStatus: some View {
        let open = document.worldViewsOpen > 0
        let paused = open && document.isPaused
        return Label(
            paused ? "World View paused" : open ? "World View open" : "World View closed",
            systemImage: paused ? "pause.circle.fill" : open ? "tv.fill" : "tv.slash"
        )
        .font(.caption)
        .foregroundStyle(paused ? Palette.accentText.color : open ? Palette.statusOk.color : Palette.inkSecondary.color)
    }

    private var masterBarContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                worldStatus
                Spacer()
                Button { showingSettings = true } label: {
                    Label("Session Console Settings", systemImage: "gearshape").labelStyle(.iconOnly)
                }
                .buttonStyle(.borderless)
                .help("Session Console settings")
            }
            if let trackID = runtime.audio.trackId {
                Text("\(runtime.audio.status == .playing ? "▶︎" : runtime.audio.status == .paused ? "❚❚" : "■") \(runtime.audio.title)")
                    .font(.callout.weight(.medium))
                    .lineLimit(1)
                    .id(trackID)
            }
            HStack {
                Image(systemName: "speaker.wave.2")
                Slider(
                    value: Binding(get: { runtime.volume }, set: { document.dispatch(.setVolume($0.rounded())) }),
                    in: 0...100)
                Text("\(Int(runtime.volume))").readoutStyle(.callout).frame(width: 28, alignment: .trailing)
            }
            HStack(spacing: 6) {
                Toggle("Duck", isOn: Binding(get: { runtime.ducked }, set: { document.dispatch(.setDucked($0)) }))
                    .toggleStyle(.button)
                    .help("Lower the music to \(Int(runtime.duckPercent))% (D)")
                Button { document.dispatch(runtime.audio.status == .paused ? .resume : .pause) } label: {
                    Image(systemName: runtime.audio.status == .paused ? "play.fill" : "pause.fill")
                }
                .help(runtime.audio.status == .paused ? "Resume" : "Pause")
                Button { document.dispatch(.restart) } label: { Image(systemName: "backward.end.fill") }.help("Restart")
                Button { document.dispatch(.stop) } label: { Image(systemName: "stop.fill") }.help("Stop (Esc)")
                Spacer()
            }
            HStack(spacing: 6) {
                Button("Return to Map") { document.dispatch(.returnToMap) }
                    .disabled(!runtime.stageVisible)
                Button("Test Tone") { document.dispatch(.fireSfx(sfxId: "test-tone")) }
            }
            HStack(spacing: 6) {
                Button("Copy Current Link") { copyCurrentLink() }.disabled(runtime.audio.trackId == nil)
                Button("Copy All Links") { copy(catalog.fallbackLinks, "Copied \(catalog.allTracks.count) links") }
                    .disabled(catalog.allTracks.isEmpty)
            }
            .controlSize(.small)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Adding

    private var addControls: some View {
        VStack(alignment: .leading, spacing: 6) {
            TextField("Paste YouTube link", text: $youtubeText)
                .textFieldStyle(.roundedBorder)
                .onSubmit { addYouTube() }
                .onChange(of: youtubeText) { old, new in
                    if new.count - old.count > 5 { addYouTube() }  // pasted
                }
            HStack(spacing: 6) {
                Button("Add Files…") { importing = .files }
                Button("Add Folder…") { importing = .folder }
            }
            HStack(spacing: 6) {
                Button("New Image Set") {
                    document.editConsole("New Image Set", undoManager: undo) { $0.addNewImageSet() }
                }
                Button("New Track Group") {
                    document.editConsole("New Track Group", undoManager: undo) { $0.addNewTrackGroup() }
                }
            }
        }
        .controlSize(.small)
    }

    private func addYouTube() {
        let text = youtubeText
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        var added: String?
        document.editConsole("Add YouTube Track", undoManager: undo) { added = $0.addYouTube(text) }
        notice = added == nil ? "Invalid YouTube link" : "Added YouTube track"
        if added != nil { youtubeText = "" }
    }

    /// TS `ingestDroppedFiles`: images become plates (in a set named after the folder),
    /// audio becomes tracks, with the TS size limits.
    private func ingestDropped(_ urls: [URL], intoSet: String? = nil, intoGroup: String? = nil) {
        let folder = urls.count == 1 && urls[0].hasDirectoryPath
        ingest(urls, fromFolder: folder, intoSet: intoSet, intoGroup: intoGroup)
    }

    private func ingest(_ urls: [URL], fromFolder: Bool, intoSet: String? = nil, intoGroup: String? = nil) {
        // Images decode off the main thread; the board edit lands when all are ready.
        Task { @MainActor in
            var files = urls
            var folderTitle: String?
            // A folder's access covers its children, so hold it for the whole import.
            let folder = fromFolder ? urls.first : nil
            let folderScoped = folder?.startAccessingSecurityScopedResource() ?? false
            defer { if folderScoped { folder?.stopAccessingSecurityScopedResource() } }
            if let folder {
                folderTitle = folder.lastPathComponent
                files =
                    (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil))?
                    .filter {
                        let type = UTType(filenameExtension: $0.pathExtension)
                        return type?.conforms(to: .image) == true || type?.conforms(to: .audio) == true
                    }
                    .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending } ?? []
            }
            var plates: [StageImage] = []
            var tracks: [Track] = []
            var messages: [String] = []
            for url in files {
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                let stem = url.deletingPathExtension().lastPathComponent.isEmpty ? "Untitled" : url.deletingPathExtension().lastPathComponent
                let type = UTType(filenameExtension: url.pathExtension)
                if type?.conforms(to: .audio) == true {
                    guard let data = try? Data(contentsOf: url) else { continue }
                    switch SessionConsoleAudio.check(audioFileName: url.lastPathComponent, byteCount: data.count) {
                    case .rejected(let message):
                        messages.append("\(url.lastPathComponent): \(message)")
                        continue
                    case .warning(let message):
                        messages.append(message)
                    case .ok:
                        break
                    }
                    let name = document.addAsset(data, preferredName: url.lastPathComponent)
                    tracks.append(Track(title: stem, source: .local, src: name))
                } else if type?.conforms(to: .image) == true {
                    do {
                        let full = try await ImportedImage.loadInBackground(from: url, kind: .map)
                        let thumb = (try? await ImportedImage.loadInBackground(from: url, kind: .thumbnail)) ?? full
                        let src = document.addAsset(full.data, preferredName: full.preferredName)
                        let thumbSrc = document.addAsset(thumb.data, preferredName: "thumb-" + thumb.preferredName)
                        plates.append(StageImage(name: stem, src: src, thumbnailSrc: thumbSrc, alt: stem))
                    } catch {
                        messages.append(error.localizedDescription)
                    }
                }
            }
            guard !plates.isEmpty || !tracks.isEmpty else {
                notice = messages.first ?? "Nothing to add"
                return
            }
            document.editConsole("Add to Board", undoManager: undo) { c in
                if !plates.isEmpty {
                    let set = intoSet.flatMap { id in c.imageSets.contains { $0.id == id } ? id : nil }
                        ?? c.ensureImageSet(title: folderTitle)
                    for plate in plates { c.addImage(plate, toSet: set) }
                }
                if !tracks.isEmpty {
                    let group = intoGroup.flatMap { id in c.trackGroups.contains { $0.id == id } ? id : nil }
                        ?? c.ensureTrackGroup()
                    for track in tracks { c.addTrack(track, toGroup: group) }
                }
            }
            notice = (["Added \(plates.count) plate(s), \(tracks.count) track(s)"] + messages).joined(separator: "\n")
        }
    }

    // MARK: Board

    private func section<Content: View>(
        _ title: String, isExpanded: Binding<Bool>, @ViewBuilder content: () -> Content
    ) -> some View {
        let content = content()
        return DisclosureGroup(isExpanded: isExpanded) {
            VStack(alignment: .leading, spacing: 12) { content }
                .padding(.top, 6)
        } label: {
            Text(title).font(.headline)
        }
    }

    private var platesSection: some View {
        ForEach(catalog.imageSets) { set in
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(set.title).font(.headline)
                    Spacer()
                    Menu {
                        Button("Rename…") { rename(set: set) }
                        Button("Remove Set", role: .destructive) {
                            document.editConsole("Remove Image Set", undoManager: undo) { $0.removeImageSet(id: set.id) }
                        }
                    } label: { Image(systemName: "ellipsis.circle") }
                        .menuStyle(.borderlessButton)
                        .fixedSize()
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 70), spacing: 6)], spacing: 6) {
                    ForEach(Array(set.images.enumerated()), id: \.element.id) { index, plate in
                        Button {
                            document.dispatch(.showPlate(imageId: plate.id))
                        } label: {
                            plateThumbnail(plate)
                        }
                        .buttonStyle(.plain)
                        .help(plate.cue.isEmpty ? plate.name : "\(plate.name) — \(plate.cue)")
                        .accessibilityLabel("Show plate \(plate.name)")
                        .draggable(BoardDrag.platePrefix + plate.id)
                        .dropDestination(for: String.self) { items, _ in
                            guard let id = items.first.flatMap(BoardDrag.plateID) else { return false }
                            movePlate(id, before: plate, in: set)
                            return true
                        }
                        .contextMenu {
                            Button("Edit…") { editingPlate = plate }
                            Button("Move Earlier") { move(plate: plate, in: set, by: -1) }.disabled(index == 0)
                            Button("Move Later") { move(plate: plate, in: set, by: 1) }.disabled(index == set.images.count - 1)
                            Button("Remove", role: .destructive) {
                                document.editConsole("Remove Plate", undoManager: undo) { $0.removeImage(id: plate.id) }
                            }
                        }
                    }
                }
            }
            .dropDestination(for: URL.self) { urls, _ in
                ingestDropped(urls, intoSet: set.id)
                return true
            }
        }
    }

    private func plateThumbnail(_ plate: StageImage) -> some View {
        let active = runtime.stageVisible && runtime.activeImage?.id == plate.id
        return Group {
            if let image = document.imageCache.image(named: plate.thumbnailSrc, in: document.assets)
                ?? document.imageCache.image(named: plate.src, in: document.assets)
            {
                Image(decorative: image, scale: 1).resizable().scaledToFill()
            } else {
                Image(systemName: "photo")
            }
        }
        .frame(width: 70, height: 50)
        .clipped()
        .overlay(RoundedRectangle(cornerRadius: Radius.control).strokeBorder(active ? Palette.accent.color : .clear, lineWidth: 3))
        .clipShape(RoundedRectangle(cornerRadius: Radius.control))
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private var tracksSection: some View {
        ForEach(catalog.trackGroups) { group in
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Circle().fill(group.accent.color).frame(width: 8, height: 8)
                    Text(group.title).font(.headline)
                    Spacer()
                    Menu {
                        Button("Rename…") { rename(group: group) }
                        Picker("Accent", selection: Binding(get: { group.accent }, set: { accent in
                            document.editConsole("Change Accent", undoManager: undo) {
                                $0.updateTrackGroup(id: group.id, accent: accent)
                            }
                        })) {
                            ForEach(TrackAccent.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                        }
                        Button("Remove Group", role: .destructive) {
                            document.editConsole("Remove Track Group", undoManager: undo) { $0.removeTrackGroup(id: group.id) }
                        }
                    } label: { Image(systemName: "ellipsis.circle") }
                        .menuStyle(.borderlessButton)
                        .fixedSize()
                }
                ForEach(Array(group.tracks.enumerated()), id: \.element.id) { index, track in
                    HStack {
                        Button {
                            document.dispatch(.playTrack(trackId: track.id))
                        } label: {
                            Image(systemName: runtime.audio.trackId == track.id && runtime.audio.status == .playing
                                ? "speaker.wave.2.fill" : "play.circle")
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Play \(track.title)")
                        Text(track.title).lineLimit(1)
                        Spacer()
                        Image(systemName: track.source == .youtube ? "play.rectangle" : "music.note")
                            .foregroundStyle(.secondary)
                    }
                    .contentShape(Rectangle())
                    .draggable(BoardDrag.trackPrefix + track.id)
                    .dropDestination(for: String.self) { items, _ in
                        guard let id = items.first.flatMap(BoardDrag.trackID) else { return false }
                        moveTrack(id, before: track, in: group)
                        return true
                    }
                    .contextMenu {
                        Button("Edit…") { editingTrack = track }
                        Button("Move Up") { move(track: track, in: group, by: -1) }.disabled(index == 0)
                        Button("Move Down") { move(track: track, in: group, by: 1) }.disabled(index == group.tracks.count - 1)
                        Button("Remove", role: .destructive) {
                            document.editConsole("Remove Track", undoManager: undo) { $0.removeTrack(id: track.id) }
                        }
                    }
                }
            }
            .dropDestination(for: URL.self) { urls, _ in
                ingestDropped(urls, intoGroup: group.id)
                return true
            }
        }
    }

    private var sfxSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 80), spacing: 6)], spacing: 6) {
                ForEach(catalog.sfx) { sfx in
                    Button(sfx.label) { document.dispatch(.fireSfx(sfxId: sfx.id)) }
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }

    /// Built-in scenes (docs/planning/soundscapes/plan.md): one plays at a time under the
    /// music, and each layer has its own level for this session.
    private var soundscapesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 6)], spacing: 6) {
                ForEach(Soundscape.builtIn) { scene in
                    let playing = runtime.ambience.soundscapeId == scene.id
                    Button {
                        document.dispatch(playing ? .stopSoundscape : .playSoundscape(id: scene.id))
                    } label: {
                        Label(scene.title, systemImage: playing ? "speaker.wave.2.fill" : "play.circle")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .help(playing ? "Stop \(scene.title)" : "Play \(scene.title)")
                    .accessibilityAddTraits(playing ? .isSelected : [])
                }
            }
            if let scene = runtime.soundscape {
                ForEach(scene.layers) { layer in
                    let muted = runtime.ambience.muted.contains(layer.id)
                    HStack {
                        Button {
                            document.dispatch(.setLayerMuted(layerId: layer.id, !muted))
                        } label: {
                            Image(systemName: muted ? "speaker.slash" : "speaker.wave.1")
                        }
                        .buttonStyle(.borderless)
                        .help(muted ? "Unmute \(layer.title)" : "Mute \(layer.title)")
                        Text(layer.title).lineLimit(1).frame(width: 96, alignment: .leading)
                        Slider(
                            value: Binding(
                                get: { runtime.ambience.levels[layer.id] ?? layer.level },
                                set: { document.dispatch(.setLayerLevel(layerId: layer.id, $0.rounded())) }),
                            in: 0...100)
                            .disabled(muted)
                            .accessibilityLabel("\(layer.title) level")
                    }
                }
            }
            Text("CC0 recordings from Freesound, stored in the app.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .controlSize(.small)
    }

    // MARK: Helpers

    private func move(plate: StageImage, in set: ImageSet, by delta: Int) {
        var ids = set.images.map(\.id)
        guard let i = ids.firstIndex(of: plate.id), ids.indices.contains(i + delta) else { return }
        ids.swapAt(i, i + delta)
        document.editConsole("Reorder Plates", undoManager: undo) { $0.reorderImages(inSet: set.id, ids) }
    }

    private func move(track: Track, in group: TrackGroup, by delta: Int) {
        var ids = group.tracks.map(\.id)
        guard let i = ids.firstIndex(of: track.id), ids.indices.contains(i + delta) else { return }
        ids.swapAt(i, i + delta)
        document.editConsole("Reorder Tracks", undoManager: undo) { $0.reorderTracks(inGroup: group.id, ids) }
    }

    /// Drag-reorder within one set or group; drops from elsewhere are ignored.
    private func movePlate(_ id: String, before target: StageImage, in set: ImageSet) {
        var ids = set.images.map(\.id)
        guard id != target.id, let from = ids.firstIndex(of: id) else { return }
        ids.remove(at: from)
        ids.insert(id, at: ids.firstIndex(of: target.id) ?? ids.count)
        document.editConsole("Reorder Plates", undoManager: undo) { $0.reorderImages(inSet: set.id, ids) }
    }

    private func moveTrack(_ id: String, before target: Track, in group: TrackGroup) {
        var ids = group.tracks.map(\.id)
        guard id != target.id, let from = ids.firstIndex(of: id) else { return }
        ids.remove(at: from)
        ids.insert(id, at: ids.firstIndex(of: target.id) ?? ids.count)
        document.editConsole("Reorder Tracks", undoManager: undo) { $0.reorderTracks(inGroup: group.id, ids) }
    }

    private func rename(set: ImageSet) {
        renameText = set.title
        renaming = .set(set.id)
    }

    private func rename(group: TrackGroup) {
        renameText = group.title
        renaming = .group(group.id)
    }

    private var renameTitle: String {
        if case .group = renaming { return "Rename Track Group" }
        return "Rename Image Set"
    }

    private func commitRename() {
        let name = renameText.trimmingCharacters(in: .whitespaces)
        guard let target = renaming, !name.isEmpty else { return }
        switch target {
        case .set(let id):
            document.editConsole("Rename Image Set", undoManager: undo) { $0.updateImageSet(id: id, title: name) }
        case .group(let id):
            document.editConsole("Rename Track Group", undoManager: undo) { $0.updateTrackGroup(id: id, title: name) }
        }
    }

    private func copyCurrentLink() {
        guard let id = runtime.audio.trackId, let track = catalog.allTracks.first(where: { $0.id == id }),
            let index = catalog.allTracks.firstIndex(where: { $0.id == id })
        else { return }
        copy(SessionConsoleCatalog.fallbackLine(index: index + 1, track: track), "Copied current link")
    }

    private func copy(_ text: String, _ message: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        notice = message
    }

    /// Panel hotkeys (PARITY §1.4): 1–9 play tracks in board order, D ducks, Esc stops.
    private func handleKey(_ press: KeyPress) -> KeyPress.Result {
        guard press.modifiers.isEmpty else { return .ignored }
        if press.key == .escape {
            document.dispatch(.stop)
            return .handled
        }
        let char = press.characters.lowercased()
        if char == "d" {
            document.dispatch(.setDucked(!runtime.ducked))
            return .handled
        }
        if let digit = Int(char), (1...9).contains(digit), digit <= catalog.allTracks.count {
            document.dispatch(.playTrack(trackId: catalog.allTracks[digit - 1].id))
            return .handled
        }
        return .ignored
    }
}

extension TrackAccent {
    var color: Color {
        switch self {
        case .bed: return .teal
        case .road: return .orange
        case .dread: return .purple
        case .combat: return .red
        case .arrive: return .green
        }
    }
}

/// Drag payloads for reordering board items.
enum BoardDrag {
    static let platePrefix = "graphium-plate:"
    static let trackPrefix = "graphium-track:"

    static func plateID(_ s: String) -> String? { s.hasPrefix(platePrefix) ? String(s.dropFirst(platePrefix.count)) : nil }
    static func trackID(_ s: String) -> String? { s.hasPrefix(trackPrefix) ? String(s.dropFirst(trackPrefix.count)) : nil }
}

/// The Session Console in its own window (Window > Session Console), for a second
/// display or a narrow Architect window. Same document, so it stays in step.
struct SessionConsoleWindow: View {
    static let id = "session-console"
    let sessionID: UUID?

    var body: some View {
        if let sessionID, let document = DocumentRegistry.shared.document(for: sessionID) {
            DetachedSessionConsole(document: document)
        } else {
            OrphanedWindow(
                title: "No Campaign", systemImage: "music.note.list",
                description: "Open a campaign, then choose Session Console.")
        }
    }
}

/// Observes the document so the window title follows campaign renames.
private struct DetachedSessionConsole: View {
    @ObservedObject var document: CampaignDocument

    var body: some View {
        SessionConsolePanel(document: document, detached: true)
            .frame(minWidth: 300, idealWidth: 340, minHeight: 420)
            .navigationTitle("Session Console — \(document.campaign.name)")
            .focusedSceneValue(\.campaignDocument, document)
    }
}
