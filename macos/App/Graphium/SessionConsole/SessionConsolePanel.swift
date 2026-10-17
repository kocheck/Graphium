import AppKit
import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// The DM's Session Console (PARITY §5.4): plates and music the World View plays.
struct SessionConsolePanel: View {
    @ObservedObject var document: CampaignDocument
    @Environment(\.undoManager) private var undoManager

    @State private var youtubeText = ""
    @State private var notice: String?
    @State private var importing: ImportKind?
    @State private var editingPlate: StageImage?
    @State private var editingTrack: Track?
    @State private var showingSettings = false

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
                    Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.orange).font(.caption)
                }
                if let notice {
                    Text(notice).font(.caption).foregroundStyle(.secondary)
                }
                addControls
                platesSection
                tracksSection
                sfxSection
            }
            .padding(12)
        }
        .focusable()
        .onKeyPress(phases: .down) { press in handleKey(press) }
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
                document.editConsole("Edit Plate", undoManager: undoManager) { c in
                    c.updateImage(id: updated.id) { $0 = updated }
                }
            }
        }
        .sheet(item: $editingTrack) { track in
            TrackEditor(track: track, plates: catalog.imageSets.flatMap(\.images)) { updated in
                document.editConsole("Edit Track", undoManager: undoManager) { c in
                    c.updateTrack(id: updated.id) { $0 = updated }
                }
            }
        }
        .sheet(isPresented: $showingSettings) {
            SessionConsoleSettings(document: document)
        }
    }

    // MARK: Master bar

    private var masterBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle().fill(document.worldViewsOpen > 0 ? Color.green : Color.secondary).frame(width: 8, height: 8)
                Text(document.worldViewsOpen > 0 ? "World View open" : "World View closed").font(.caption)
                Spacer()
                Button { showingSettings = true } label: { Image(systemName: "gearshape") }
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
                Text("\(Int(runtime.volume))").monospacedDigit().frame(width: 28, alignment: .trailing)
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
        .padding(10)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
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
                    document.editConsole("New Image Set", undoManager: undoManager) { $0.addNewImageSet() }
                }
                Button("New Track Group") {
                    document.editConsole("New Track Group", undoManager: undoManager) { $0.addNewTrackGroup() }
                }
            }
        }
        .controlSize(.small)
    }

    private func addYouTube() {
        let text = youtubeText
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        var added: String?
        document.editConsole("Add YouTube Track", undoManager: undoManager) { added = $0.addYouTube(text) }
        notice = added == nil ? "Invalid YouTube link" : "Added YouTube track"
        if added != nil { youtubeText = "" }
    }

    /// TS `ingestDroppedFiles`: images become plates (in a set named after the folder),
    /// audio becomes tracks, with the TS size limits.
    private func ingest(_ urls: [URL], fromFolder: Bool) {
        var files = urls
        var folderTitle: String?
        if fromFolder, let folder = urls.first {
            folderTitle = folder.lastPathComponent
            let scoped = folder.startAccessingSecurityScopedResource()
            defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
            files =
                (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil))?
                .filter { UTType(filenameExtension: $0.pathExtension)?.conforms(to: .image) == true }
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
                    let full = try ImportedImage.load(from: url, kind: .map)
                    let thumb = (try? ImportedImage.load(from: url, kind: .thumbnail)) ?? full
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
        document.editConsole("Add to Board", undoManager: undoManager) { c in
            if !plates.isEmpty {
                let set = c.ensureImageSet(title: folderTitle)
                for plate in plates { c.addImage(plate, toSet: set) }
            }
            if !tracks.isEmpty {
                let group = c.ensureTrackGroup()
                for track in tracks { c.addTrack(track, toGroup: group) }
            }
        }
        notice = (["Added \(plates.count) plate(s), \(tracks.count) track(s)"] + messages).joined(separator: "\n")
    }

    // MARK: Board

    private var platesSection: some View {
        ForEach(catalog.imageSets) { set in
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(set.title).font(.headline)
                    Spacer()
                    Menu {
                        Button("Rename…") { rename(set: set) }
                        Button("Remove Set", role: .destructive) {
                            document.editConsole("Remove Image Set", undoManager: undoManager) { $0.removeImageSet(id: set.id) }
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
                        .contextMenu {
                            Button("Edit…") { editingPlate = plate }
                            Button("Move Earlier") { move(plate: plate, in: set, by: -1) }.disabled(index == 0)
                            Button("Move Later") { move(plate: plate, in: set, by: 1) }.disabled(index == set.images.count - 1)
                            Button("Remove", role: .destructive) {
                                document.editConsole("Remove Plate", undoManager: undoManager) { $0.removeImage(id: plate.id) }
                            }
                        }
                    }
                }
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
        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(active ? Color.accentColor : .clear, lineWidth: 3))
        .clipShape(RoundedRectangle(cornerRadius: 4))
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
                            document.editConsole("Change Accent", undoManager: undoManager) {
                                $0.updateTrackGroup(id: group.id, accent: accent)
                            }
                        })) {
                            ForEach(TrackAccent.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                        }
                        Button("Remove Group", role: .destructive) {
                            document.editConsole("Remove Track Group", undoManager: undoManager) { $0.removeTrackGroup(id: group.id) }
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
                        Text(track.title).lineLimit(1)
                        Spacer()
                        Image(systemName: track.source == .youtube ? "play.rectangle" : "music.note")
                            .foregroundStyle(.secondary)
                    }
                    .contextMenu {
                        Button("Edit…") { editingTrack = track }
                        Button("Move Up") { move(track: track, in: group, by: -1) }.disabled(index == 0)
                        Button("Move Down") { move(track: track, in: group, by: 1) }.disabled(index == group.tracks.count - 1)
                        Button("Remove", role: .destructive) {
                            document.editConsole("Remove Track", undoManager: undoManager) { $0.removeTrack(id: track.id) }
                        }
                    }
                }
            }
        }
    }

    private var sfxSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Sound Effects").font(.headline)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 80), spacing: 6)], spacing: 6) {
                ForEach(catalog.sfx) { sfx in
                    Button(sfx.label) { document.dispatch(.fireSfx(sfxId: sfx.id)) }
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }

    // MARK: Helpers

    private func move(plate: StageImage, in set: ImageSet, by delta: Int) {
        var ids = set.images.map(\.id)
        guard let i = ids.firstIndex(of: plate.id), ids.indices.contains(i + delta) else { return }
        ids.swapAt(i, i + delta)
        document.editConsole("Reorder Plates", undoManager: undoManager) { $0.reorderImages(inSet: set.id, ids) }
    }

    private func move(track: Track, in group: TrackGroup, by delta: Int) {
        var ids = group.tracks.map(\.id)
        guard let i = ids.firstIndex(of: track.id), ids.indices.contains(i + delta) else { return }
        ids.swapAt(i, i + delta)
        document.editConsole("Reorder Tracks", undoManager: undoManager) { $0.reorderTracks(inGroup: group.id, ids) }
    }

    private func rename(set: ImageSet) {
        guard let name = prompt("Rename Image Set", current: set.title) else { return }
        document.editConsole("Rename Image Set", undoManager: undoManager) { $0.updateImageSet(id: set.id, title: name) }
    }

    private func rename(group: TrackGroup) {
        guard let name = prompt("Rename Track Group", current: group.title) else { return }
        document.editConsole("Rename Track Group", undoManager: undoManager) { $0.updateTrackGroup(id: group.id, title: name) }
    }

    /// A small modal text prompt (sheets inside a scrolling inspector get awkward).
    private func prompt(_ title: String, current: String) -> String? {
        let alert = NSAlert()
        alert.messageText = title
        let field = NSTextField(string: current)
        field.frame = NSRect(x: 0, y: 0, width: 240, height: 24)
        alert.accessoryView = field
        alert.addButton(withTitle: "Rename")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return nil }
        let text = field.stringValue.trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? nil : text
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
