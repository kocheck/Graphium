import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// Plate editor (PARITY §5.4): name, cue, alt text.
struct PlateEditor: View {
    @State var plate: StageImage
    let onSave: (StageImage) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Edit Plate").font(.title2.bold())
            Form {
                TextField("Name", text: $plate.name)
                TextField("Cue", text: $plate.cue, prompt: Text("When to show it (DM only)"))
                TextField("Alt text", text: $plate.alt, prompt: Text("Describe the image"))
            }
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                Button("Save") {
                    onSave(plate)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 420)
    }
}

/// Track editor (PARITY §5.4): title, cue, tag, loop, volume offset ±30, recommended plate.
struct TrackEditor: View {
    @State var track: Track
    let plates: [StageImage]
    let onSave: (Track) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Edit Track").font(.title2.bold())
            Form {
                TextField("Title", text: $track.title)
                TextField("Cue", text: $track.cue, prompt: Text("When to play it (DM only)"))
                Picker("Tag", selection: $track.tag) {
                    ForEach(TrackAccent.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0.rawValue) }
                    if TrackAccent(rawValue: track.tag) == nil { Text(track.tag).tag(track.tag) }
                }
                Toggle("Loop", isOn: $track.loop)
                LabeledContent("Volume offset") {
                    HStack {
                        Slider(value: $track.volumeOffset, in: -30...30, step: 1)
                        Text("\(track.volumeOffset >= 0 ? "+" : "")\(Int(track.volumeOffset))").monospacedDigit()
                    }
                }
                Picker("Recommended plate", selection: $track.recommendedImageId) {
                    Text("None").tag(String?.none)
                    ForEach(plates) { Text($0.name).tag(String?.some($0.id)) }
                }
            }
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                Button("Save") {
                    onSave(track)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 460)
    }
}

/// Session Console settings (PARITY §5.4): stage chrome, playback defaults, table setup.
struct SessionConsoleSettings: View {
    @ObservedObject var document: CampaignDocument
    var detached = false
    @Environment(\.undoManager) private var undoManager
    private var undo: UndoManager? { detached ? nil : undoManager }
    @Environment(\.dismiss) private var dismiss
    @State private var packSummary: String?
    @State private var importMode: BoardPackIO.Mode?
    @State private var choosingExportFolder = false
    /// A pack that downloads files: its hosts are named and the DM decides first.
    @State private var remoteImport: RemoteImport?

    private struct RemoteImport {
        var url: URL
        var mode: BoardPackIO.Mode
        var hosts: [String]
    }

    var body: some View {
        let catalog = document.campaign.sessionConsole
        VStack(alignment: .leading, spacing: 16) {
            Text("Session Console Settings").font(.title2.bold())
            Form {
                Section("Stage") {
                    TextField("Title", text: binding(\.stage.title, "Edit Stage Title"))
                    TextField("Subtitle", text: binding(\.stage.subtitle, "Edit Stage Subtitle"))
                    Toggle("Show frame", isOn: binding(\.stage.showFrame, "Toggle Frame"))
                }
                Section("Playback defaults") {
                    LabeledContent("Default volume") {
                        Slider(
                            value: Binding(
                                get: { catalog.defaults.volume },
                                set: { v in document.editConsole("Default Volume", undoManager: undo) { $0.updateDefaults(volume: v.rounded()) } }),
                            in: 0...100)
                    }
                    LabeledContent("Duck to") {
                        HStack {
                            Slider(
                                value: Binding(
                                    get: { catalog.defaults.duckPercent },
                                    set: { v in document.editConsole("Duck Percent", undoManager: undo) { $0.updateDefaults(duckPercent: v.rounded()) } }),
                                in: 1...100)
                            Text("\(Int(catalog.defaults.duckPercent))%").monospacedDigit()
                        }
                    }
                }
                Section("Advanced: board pack") {
                    HStack {
                        Button("Import (Replace)…") { importMode = .replace }
                        Button("Import (Merge)…") { importMode = .merge }
                        Button("Export Pack…") { choosingExportFolder = true }
                    }
                    if let packSummary {
                        Text(packSummary).font(.caption).textSelection(.enabled)
                    }
                }
                Section("Table setup (Discord)") {
                    Text(
                        """
                        • Turn off Krisp noise suppression.
                        • Set attenuation to 0%.
                        • Share the World View window with “Include audio”. macOS shares app audio, so mute other Graphium sounds you don't want players to hear.
                        • Play the Test Tone and ask the table if they hear it.
                        Keys while this panel is focused: 1–9 play tracks, D ducks, Esc stops.
                        """
                    )
                    .font(.callout)
                }
            }
            .formStyle(.grouped)
            // A second importer must sit on a different view to work.
            .fileImporter(isPresented: $choosingExportFolder, allowedContentTypes: [.folder]) { result in
                switch result {
                case .success(let folder): packSummary = BoardPackIO.exportPack(from: document, to: folder)
                case .failure(let error): packSummary = error.localizedDescription
                }
            }
            HStack {
                Spacer()
                Button("Done") { dismiss() }.keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 480, height: 560)
        .fileImporter(
            isPresented: Binding(get: { importMode != nil }, set: { if !$0 { importMode = nil } }),
            allowedContentTypes: [.json]
        ) { result in
            let mode = importMode ?? .replace
            importMode = nil
            switch result {
            case .success(let url):
                let hosts = BoardPackIO.remoteHosts(in: url)
                if hosts.isEmpty {
                    runImport(url, mode: mode, download: false)
                } else {
                    remoteImport = RemoteImport(url: url, mode: mode, hosts: hosts)
                }
            case .failure(let error):
                packSummary = error.localizedDescription
            }
        }
        .alert(
            "Download files from the internet?",
            isPresented: Binding(get: { remoteImport != nil }, set: { if !$0 { remoteImport = nil } }),
            presenting: remoteImport
        ) { pending in
            Button("Download") { runImport(pending.url, mode: pending.mode, download: true) }
            Button("Skip Remote Files") { runImport(pending.url, mode: pending.mode, download: false) }
            Button("Cancel", role: .cancel) {}
        } message: { pending in
            Text(
                "This board pack lists files on \(pending.hosts.joined(separator: ", ")). Graphium contacts these sites only if you choose Download."
            )
        }
    }

    private func runImport(_ url: URL, mode: BoardPackIO.Mode, download: Bool) {
        Task { @MainActor in
            packSummary = await BoardPackIO.importPack(
                from: url, into: document, mode: mode, downloadRemoteFiles: download, undoManager: undo)
        }
    }

    private func binding<T>(_ keyPath: WritableKeyPath<SessionConsoleCatalog, T>, _ action: String) -> Binding<T> {
        Binding(
            get: { document.campaign.sessionConsole[keyPath: keyPath] },
            set: { value in document.editConsole(action, undoManager: undo) { $0[keyPath: keyPath] = value } })
    }
}
