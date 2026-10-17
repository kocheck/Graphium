import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// Library Manager (PARITY §5.3): fuzzy search, category filter, thumbnail grid.
struct LibraryManagerView: View {
    @ObservedObject var store = LibraryStore.shared
    /// Places an item on the current map; nil hides "Add to Map".
    var onPlace: ((TokenLibraryItem) -> Void)?
    var onEdited: ((TokenLibraryItem) -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var category = "All"
    @State private var editing: TokenLibraryItem?
    @State private var deleting: TokenLibraryItem?
    @State private var showingImporter = false
    @State private var pendingImage: ImportedImage?
    @State private var errorMessage: String?

    private var results: [TokenLibraryItem] {
        TokenLibrarySearch.search(TokenLibrarySearch.filter(store.items, category: category), query: query)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("Search library", text: $query)
                    .textFieldStyle(.roundedBorder)
                Picker("Category", selection: $category) {
                    Text("All").tag("All")
                    ForEach(TokenLibrarySearch.categories(store.items), id: \.self) { Text($0).tag($0) }
                }
                .frame(maxWidth: 200)
            }
            .padding()

            if results.isEmpty {
                ContentUnavailableView(
                    store.items.isEmpty ? "No Tokens Yet" : "No Matches", systemImage: "person.crop.square",
                    description: Text(store.items.isEmpty ? "Upload an image to start your library." : "Try another search."))
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 12)], spacing: 12) {
                        ForEach(results) { item in
                            LibraryCard(item: item, store: store)
                                .onTapGesture(count: 2) { place(item) }
                                .draggable(LibraryDrag.payload(for: item))
                                .contextMenu {
                                    if onPlace != nil { Button("Add to Map") { place(item) } }
                                    Button("Edit…") { editing = item }
                                    Button("Delete…", role: .destructive) { deleting = item }
                                }
                        }
                    }
                    .padding()
                }
            }

            Divider()
            HStack {
                Text("\(store.items.count) asset\(store.items.count == 1 ? "" : "s")")
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Upload…") { showingImporter = true }
                Button("Done") { dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
            .padding()
        }
        .frame(minWidth: 560, minHeight: 440)
        .fileImporter(isPresented: $showingImporter, allowedContentTypes: [.image]) { result in
            if case .success(let url) = result {
                do {
                    let scoped = url.startAccessingSecurityScopedResource()
                    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                    pendingImage = try ImportedImage.load(from: url, kind: .token)
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        }
        .sheet(item: $pendingImage) { image in
            AddToLibraryView(image: image)
        }
        .sheet(item: $editing) { item in
            TokenMetadataEditor(item: item) { updated in
                do {
                    try store.update(updated)
                    onEdited?(updated)
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        }
        .confirmationDialog(
            "Delete “\(deleting?.name ?? "")” from the library?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })
        ) {
            Button("Delete", role: .destructive) {
                if let item = deleting { try? store.delete(item) }
            }
        } message: {
            Text("Tokens already on maps keep their image.")
        }
        .alert("Library Error", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func place(_ item: TokenLibraryItem) {
        guard let onPlace else { return }
        onPlace(item)
        dismiss()
    }
}

extension ImportedImage: Identifiable {
    var id: String { preferredName + "\(data.count)" }
}

struct LibraryCard: View {
    let item: TokenLibraryItem
    @ObservedObject var store: LibraryStore

    var body: some View {
        VStack(spacing: 6) {
            Group {
                if let image = store.image(item.thumbnailSrc) ?? store.image(item.src) {
                    Image(decorative: image, scale: 1).resizable().scaledToFit()
                } else {
                    Image(systemName: "questionmark.square.dashed").font(.largeTitle).foregroundStyle(.secondary)
                }
            }
            .frame(width: 96, height: 96)
            .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
            Text(item.name).font(.caption.weight(.medium)).lineLimit(1)
            Text(item.category).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
        .help(item.tags.isEmpty ? item.name : "\(item.name) — \(item.tags.joined(separator: ", "))")
        .accessibilityElement(children: .combine)
    }
}

/// Add to Library (PARITY §5.3): preview, name (required), category, tags.
struct AddToLibraryView: View {
    let image: ImportedImage
    var onAdded: ((TokenLibraryItem) -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var category = "Monsters"
    @State private var tags = ""
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Add to Library").font(.title2.bold())
            HStack(alignment: .top, spacing: 16) {
                if let preview = NSImage(data: image.data) {
                    Image(nsImage: preview).resizable().scaledToFit().frame(width: 120, height: 120)
                        .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
                }
                Form {
                    TextField("Name", text: $name, prompt: Text("e.g., Red Dragon"))
                    Picker("Category", selection: $category) {
                        ForEach(TokenLibrarySearch.standardCategories, id: \.self) { Text($0).tag($0) }
                    }
                    TextField("Tags", text: $tags, prompt: Text("e.g., dragon, red, large"))
                }
            }
            if let errorMessage { Text(errorMessage).foregroundStyle(.red) }
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                Button("Add to Library") { add() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 480)
        .onAppear { name = (image.preferredName as NSString).deletingPathExtension }
    }

    private func add() {
        do {
            let item = try LibraryStore.shared.add(
                image: image, name: name.trimmingCharacters(in: .whitespaces), category: category,
                tags: TokenLibrarySearch.parseTags(tags), defaultType: category == "PC" ? .pc : nil)
            onAdded?(item)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Token Metadata Editor (PARITY §5.3).
struct TokenMetadataEditor: View {
    @State var item: TokenLibraryItem
    let onSave: (TokenLibraryItem) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var tags = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Edit Token").font(.title2.bold())
            Form {
                TextField("Name", text: $item.name)
                TextField("Category", text: $item.category)
                TextField("Tags", text: $tags, prompt: Text("comma or space separated"))
                Picker("Default type", selection: $item.defaultType) {
                    Text("None").tag(CreatureType?.none)
                    Text("PC").tag(CreatureType?.some(.pc))
                    Text("NPC").tag(CreatureType?.some(.npc))
                }
                .pickerStyle(.segmented)
                Stepper(value: scaleBinding, in: 0.25...10, step: 0.25) {
                    Text("Default scale: \(jsNumber(item.defaultScale ?? 1))x")
                }
                if item.defaultType == .pc || item.category == "PC" {
                    Stepper(value: visionBinding, in: 0...300, step: 5) {
                        Text("Default vision: \(jsNumber(item.defaultVisionRadius ?? 0)) ft")
                    }
                }
            }
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                Button("Save") {
                    item.tags = TokenLibrarySearch.parseTags(tags)
                    item.name = item.name.trimmingCharacters(in: .whitespaces)
                    onSave(item)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(item.name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 440)
        .onAppear { tags = item.tags.joined(separator: ", ") }
    }

    private var scaleBinding: Binding<Double> {
        Binding(get: { item.defaultScale ?? 1 }, set: { item.defaultScale = $0 })
    }

    private var visionBinding: Binding<Double> {
        Binding(get: { item.defaultVisionRadius ?? 0 }, set: { item.defaultVisionRadius = $0 })
    }
}

/// 1:1 cropper for an image dropped onto the map as a token (PARITY §3.4): zoom 1–3x,
/// drag to position, "Crop & Import".
struct ImageCropperView: View {
    let image: CGImage
    let onCrop: (CGImage) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var zoom = 1.0
    @State private var offset = CGSize.zero
    @State private var dragStart = CGSize.zero
    private let frameSide = 320.0

    /// Points per pixel at zoom 1: the shorter side fills the frame.
    private var baseScale: Double { frameSide / Double(min(image.width, image.height)) }

    var body: some View {
        VStack(spacing: 16) {
            Text("Crop Token").font(.title2.bold())
            Image(decorative: image, scale: 1)
                .resizable()
                .frame(width: Double(image.width) * baseScale * zoom, height: Double(image.height) * baseScale * zoom)
                .offset(clampedOffset)
                .frame(width: frameSide, height: frameSide)
                .clipped()
                .overlay(Rectangle().strokeBorder(.white.opacity(0.8), lineWidth: 2))
                .contentShape(Rectangle())
                .gesture(
                    DragGesture()
                        .onChanged { offset = CGSize(width: dragStart.width + $0.translation.width, height: dragStart.height + $0.translation.height) }
                        .onEnded { _ in
                            offset = clampedOffset
                            dragStart = offset
                        })
                .gesture(MagnifyGesture().onChanged { zoom = min(max(zoom * $0.magnification, 1), 3) })
            HStack {
                Image(systemName: "minus.magnifyingglass")
                Slider(value: $zoom, in: 1...3)
                Image(systemName: "plus.magnifyingglass")
            }
            .frame(width: frameSide)
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                Button("Crop & Import") {
                    if let cropped = image.cropping(to: cropRect) { onCrop(cropped) }
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
    }

    /// Keeps the image covering the whole frame.
    private var clampedOffset: CGSize {
        let maxX = max(0, (Double(image.width) * baseScale * zoom - frameSide) / 2)
        let maxY = max(0, (Double(image.height) * baseScale * zoom - frameSide) / 2)
        return CGSize(width: min(max(offset.width, -maxX), maxX), height: min(max(offset.height, -maxY), maxY))
    }

    /// The square of image pixels visible in the frame.
    private var cropRect: CGRect {
        let scale = baseScale * zoom
        let side = frameSide / scale
        let centreX = Double(image.width) / 2 - clampedOffset.width / scale
        let centreY = Double(image.height) / 2 - clampedOffset.height / scale
        return CGRect(x: centreX - side / 2, y: centreY - side / 2, width: side, height: side).integral
    }
}
