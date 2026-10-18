import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// Create or edit a map (PARITY §3.2): name, grid, daylight, background image or video,
/// calibration and transform reset. Changes apply on Save as one undoable edit.
struct MapSettingsView: View {
    @ObservedObject var document: CampaignDocument
    @State var map: GameMap
    let isNew: Bool
    let onSave: (GameMap) -> Void
    /// Saves, closes the sheet and starts box calibration on the canvas.
    let onCalibrate: (GameMap) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var choosingImage = false
    @State private var confirmingReset = false
    @State private var errorMessage: String?
    /// TS enters calibration straight after an upload (PARITY §3.2).
    @State private var calibrateAfterSave = false
    @State private var uploadedImage = false
    @State private var loadingImage = false
    @State private var importingVTT = false
    /// What the last Universal VTT import brought in.
    @State private var importedVTT: String?

    /// Dungeondraft writes `.dd2vtt`, other tools `.uvtt` or `.df2vtt`; all are JSON.
    private static let vttTypes: [UTType] =
        ["dd2vtt", "uvtt", "df2vtt"].compactMap { UTType(filenameExtension: $0, conformingTo: .json) } + [.json]

    init(
        document: CampaignDocument, map: GameMap, isNew: Bool, onSave: @escaping (GameMap) -> Void,
        onCalibrate: @escaping (GameMap) -> Void
    ) {
        self.document = document
        _map = State(initialValue: map)
        self.isNew = isNew
        self.onSave = onSave
        self.onCalibrate = onCalibrate
    }

    private var gridColorBinding: Binding<Color> {
        Binding(
            get: { Color(nsColor: NSColor(hex: map.gridColor) ?? .darkGray) },
            set: { map.gridColor = NSColor($0).usingColorSpace(.sRGB)?.hexString ?? GameMap.defaultGridColor })
    }

    private var trimmedName: String { map.name.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(isNew ? "New Map" : "Map Settings").font(.title2.bold())
            Form {
                TextField("Name", text: $map.name)
                Section("Grid") {
                    Picker("Type", selection: $map.gridType) {
                        ForEach(GridType.allCases, id: \.self) { Text($0.title).tag($0) }
                    }
                    ColorPicker("Colour", selection: gridColorBinding, supportsOpacity: false)
                    if map.gridType == .hidden {
                        Text("The grid is hidden, but tokens still snap to it.").font(.caption).foregroundStyle(.secondary)
                    }
                    Toggle("Daylight (no fog of war)", isOn: $map.isDaylightMode)
                }
                Section("Lighting") {
                    Picker("Light", selection: $map.ambientLight) {
                        Text("Off").tag(LightLevel?.none)
                        Text("Darkness").tag(LightLevel?.some(.dark))
                        Text("Dim").tag(LightLevel?.some(.dim))
                        Text("Bright").tag(LightLevel?.some(.bright))
                    }
                    Text(
                        map.ambientLight == nil
                            ? "PCs see everything in sight out to their vision radius. Placing a light turns lighting on."
                            : "The light wherever no light source reaches. PCs see what is lit, and darkness within their darkvision."
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                Section("Map image") {
                    HStack {
                        if let bg = map.background {
                            Text("\(isVideoAsset(bg.src) ? "Video, " : "")\(Int(bg.width)) × \(Int(bg.height)) px, scale \(bg.scale.formatted(.number.precision(.fractionLength(0...3))))")
                                .foregroundStyle(.secondary)
                        } else {
                            Text("None").foregroundStyle(.secondary)
                        }
                        Spacer()
                        if loadingImage { ProgressView().controlSize(.small) }
                        Button(map.background == nil ? "Choose…" : "Replace…") { choosingImage = true }
                            .disabled(loadingImage)
                    }
                    // AVFoundation plays MP4 and MOV; macOS has no WebM decoder.
                    Text("An image, or an MP4 or MOV video (H.264 or HEVC) for an animated map. WebM can't play on a Mac: convert it to MP4 first.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let bg = map.background, isVideoAsset(bg.src) {
                        Text("Plays looped and muted. Map > Pause Animation holds it still.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if uploadedImage, map.gridType.isSquare {
                        Toggle("Calibrate to the grid after saving", isOn: $calibrateAfterSave)
                    }
                    if isNew {
                        HStack {
                            Text("Universal VTT").foregroundStyle(.secondary)
                            Spacer()
                            Button("Import…") { importingVTT = true }
                                .disabled(loadingImage)
                                .help("A .dd2vtt, .uvtt or .df2vtt map: its image, walls, doors and lights")
                                .fileImporter(isPresented: $importingVTT, allowedContentTypes: Self.vttTypes) { result in
                                    switch result {
                                    case .success(let url): loadVTT(url)
                                    case .failure(let error): errorMessage = error.localizedDescription
                                    }
                                }
                        }
                        if let importedVTT {
                            Text(importedVTT).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    HStack {
                        Button("Calibrate…") { onCalibrate(map); dismiss() }
                            .disabled(map.background == nil || !map.gridType.isSquare || trimmedName.isEmpty)
                            .help(
                                map.gridType.isSquare
                                    ? "Drag a box around one grid cell printed on the image to line it up"
                                    : "Calibration works with square grids")
                        Button("Reset Map Position & Scale…") { confirmingReset = true }
                            .disabled(map.background == nil)
                    }
                }
            }
            .formStyle(.grouped)
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                Button(isNew ? "Create Map" : "Save") {
                    map.name = trimmedName
                    if calibrateAfterSave, map.gridType.isSquare, map.background != nil {
                        onCalibrate(map)
                    } else {
                        onSave(map)
                    }
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(trimmedName.isEmpty || loadingImage)
            }
        }
        .padding(20)
        .frame(width: 460)
        .fileImporter(isPresented: $choosingImage, allowedContentTypes: ImportedBackground.contentTypes) { result in
            switch result {
            case .success(let url): loadImage(url)
            case .failure(let error): errorMessage = error.localizedDescription
            }
        }
        .confirmationDialog("Reset the map image's position and scale?", isPresented: $confirmingReset) {
            Button("Reset", role: .destructive) { map.resetBackgroundTransform() }
        } message: {
            Text("This undoes any calibration. Tokens and drawings stay where they are.")
        }
        .alert(
            "Couldn't use that file",
            isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    /// Reads a Universal VTT file on the Mac (nothing is fetched): the image becomes the map
    /// image, already lined up with the grid, and its walls, doors and lights replace the map's.
    private func loadVTT(_ url: URL) {
        loadingImage = true
        let name = url.deletingPathExtension().lastPathComponent
        Task { @MainActor in
            defer { loadingImage = false }
            do {
                let (vtt, image) = try await Task.detached(priority: .userInitiated) {
                    let scoped = url.startAccessingSecurityScopedResource()
                    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                    let vtt = try UniversalVTT.decode(Data(contentsOf: url))
                    let image = try vtt.image.map { try ImportedImage.load(data: $0, name: "\(name).png", kind: .map) }
                    return (vtt, image)
                }.value
                var background: (src: String, width: Double, height: Double)?
                if let image {
                    let src = document.addAsset(image.data, preferredName: image.preferredName)
                    background = (src, Double(image.width), Double(image.height))
                }
                if !map.gridType.isSquare { map.gridType = .lines }
                vtt.apply(to: &map, background: background)
                if trimmedName.isEmpty || map.name.hasPrefix("Map ") { map.name = name }
                calibrateAfterSave = false
                uploadedImage = false
                importedVTT = Self.summary(of: vtt, hasImage: image != nil)
            } catch is UniversalVTT.ImportError {
                errorMessage = "“\(url.lastPathComponent)” isn't a Universal VTT map."
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private static func summary(of vtt: UniversalVTT, hasImage: Bool) -> String {
        func count(_ n: Int, _ one: String, _ many: String) -> String { n == 1 ? "1 \(one)" : "\(n) \(many)" }
        let parts = [
            count(vtt.walls.count, "wall", "walls"), count(vtt.portals.count, "door", "doors"),
            count(vtt.lights.count, "light", "lights"),
        ]
        return "Imported \(parts.joined(separator: ", "))" + (hasImage ? "." : ", and no map image.")
    }

    private func loadImage(_ url: URL) {
        loadingImage = true
        Task { @MainActor in
            defer { loadingImage = false }
            do {
                let background = try await ImportedBackground.load(from: url)
                let name = document.addAsset(background.data, preferredName: background.preferredName)
                map.background = MapBackground(src: name, width: background.width, height: background.height)
                calibrateAfterSave = true
                uploadedImage = true
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
