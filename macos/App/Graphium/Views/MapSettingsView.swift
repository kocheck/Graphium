import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// Create or edit a map (PARITY §3.2): name, grid, daylight, background image,
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
                    Toggle("Daylight (no fog of war)", isOn: $map.isDaylightMode)
                }
                Section("Map image") {
                    HStack {
                        if let bg = map.background {
                            Text("\(Int(bg.width)) × \(Int(bg.height)) px, scale \(bg.scale.formatted(.number.precision(.fractionLength(0...3))))")
                                .foregroundStyle(.secondary)
                        } else {
                            Text("None").foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button(map.background == nil ? "Choose…" : "Replace…") { choosingImage = true }
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
                Button(isNew ? "Create" : "Save") {
                    map.name = trimmedName
                    onSave(map)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(trimmedName.isEmpty)
            }
        }
        .padding(20)
        .frame(width: 460)
        .fileImporter(isPresented: $choosingImage, allowedContentTypes: [.image]) { result in
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
            "Couldn't use that image",
            isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func loadImage(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let image = try ImportedImage.load(from: url, kind: .map)
            let name = document.addAsset(image.data, preferredName: image.preferredName)
            map.background = MapBackground(src: name, width: Double(image.width), height: Double(image.height))
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
