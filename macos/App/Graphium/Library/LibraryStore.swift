import AppKit
import CoreGraphics
import Foundation
import GraphiumCore
import ImageIO

/// The app-wide token library (PARITY §5.3), shared by every campaign:
/// `~/Library/Application Support/Graphium/Library/` with `index.json` plus
/// `<id>.<ext>` images and `thumb-<id>.png` thumbnails. Library item `src` /
/// `thumbnailSrc` here are file names in that folder.
@MainActor
final class LibraryStore: ObservableObject {
    static let shared = LibraryStore()

    @Published private(set) var items: [TokenLibraryItem] = []
    let images = AssetImageCache()

    private let folder: URL
    private var indexURL: URL { folder.appendingPathComponent("index.json") }

    init(folder: URL? = nil) {
        let base =
            folder
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Graphium/Library", isDirectory: true)
        self.folder = base
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        items = LibraryIndex.decode(try? Data(contentsOf: indexURL)).items
    }

    func data(for fileName: String) -> Data? {
        guard CampaignPackage.isValidAssetName(fileName) else { return nil }
        return try? Data(contentsOf: folder.appendingPathComponent(fileName))
    }

    /// The image for a library file name, decoded once.
    func image(_ fileName: String) -> CGImage? {
        guard let data = data(for: fileName) else { return nil }
        return images.image(named: fileName, in: [fileName: data])
    }

    @discardableResult
    func add(
        image: ImportedImage, name: String, category: String, tags: [String], defaultType: CreatureType? = nil
    ) throws -> TokenLibraryItem {
        let id = newID()
        let ext = (image.preferredName as NSString).pathExtension
        let fileName = "\(id).\(ext.isEmpty ? "png" : ext)"
        let thumbName = "thumb-\(id).png"
        try image.data.write(to: folder.appendingPathComponent(fileName), options: .atomic)
        try Self.thumbnail(of: image.data).write(to: folder.appendingPathComponent(thumbName), options: .atomic)
        let item = TokenLibraryItem(
            id: id, name: name, src: fileName, thumbnailSrc: thumbName, category: category, tags: tags,
            dateAdded: (Date().timeIntervalSince1970 * 1000).rounded(), defaultType: defaultType)
        items.append(item)
        try save()
        return item
    }

    func update(_ item: TokenLibraryItem) throws {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[index] = item
        try save()
    }

    func delete(_ item: TokenLibraryItem) throws {
        items.removeAll { $0.id == item.id }
        for name in [item.src, item.thumbnailSrc] where CampaignPackage.isValidAssetName(name) {
            try? FileManager.default.removeItem(at: folder.appendingPathComponent(name))
        }
        try save()
    }

    private func save() throws {
        try LibraryIndex(items: items).encoded().write(to: indexURL, options: .atomic)
    }

    /// 256 px (THUMB limit) aspect-fit thumbnail. TS stretched to 128×128; keeping
    /// the aspect ratio is a deliberate fix.
    static func thumbnail(of data: Data) throws -> Data {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
            let thumb = CGImageSourceCreateThumbnailAtIndex(
                source, 0,
                [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceThumbnailMaxPixelSize: ImageKind.thumbnail.maxDimension,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                ] as CFDictionary)
        else { throw ImportedImage.ImportError.unreadable("thumbnail") }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, "public.png" as CFString, 1, nil) else {
            throw ImportedImage.ImportError.unreadable("thumbnail")
        }
        CGImageDestinationAddImage(destination, thumb, nil)
        guard CGImageDestinationFinalize(destination) else { throw ImportedImage.ImportError.unreadable("thumbnail") }
        return output as Data
    }
}

extension CampaignDocument {
    /// Places a library token (PARITY §3.4): copies its image into this campaign's
    /// package (so the file is self-contained), keeps a campaign copy of the library
    /// item for inheritance, and adds a library-linked token. `point` is where the
    /// token's centre should land (nil = map centre placement, as TS).
    @MainActor
    func placeLibraryItem(_ item: TokenLibraryItem, centredAt point: Point2D?, undoManager: UndoManager?) -> String? {
        let store = LibraryStore.shared
        var campaignItem = campaign.tokenLibrary.first { $0.id == item.id }
        if campaignItem == nil {
            guard let image = store.data(for: item.src) else { return nil }
            var copy = item
            copy.src = addAsset(image, preferredName: item.src)
            copy.thumbnailSrc = store.data(for: item.thumbnailSrc).map { addAsset($0, preferredName: item.thumbnailSrc) } ?? copy.src
            campaignItem = copy
        }
        guard let linked = campaignItem else { return nil }
        let map = campaign.activeMap
        var library = campaign.libraryIndex
        library[linked.id] = linked
        var token = Token(x: 0, y: 0, src: linked.src, libraryItemId: linked.id)
        let size = map.tokenSize(token, library: library)
        let topLeft =
            point.map { Point2D(x: $0.x - size / 2, y: $0.y - size / 2) } ?? map.centrePlacementPoint
        let snapped = snapToGrid(topLeft, gridSize: map.gridSize, gridType: map.gridType, width: size, height: size)
        token.x = snapped.x
        token.y = snapped.y
        let placed = token
        edit("Place \(linked.name)", undoManager: undoManager) { campaign in
            if !campaign.tokenLibrary.contains(where: { $0.id == linked.id }) { campaign.tokenLibrary.append(linked) }
            campaign.activeMap.tokens.append(placed)
        }
        return placed.id
    }

    /// Keeps the campaign's copy of a library item in step with an edit made in the library.
    @MainActor
    func syncLibraryItem(_ item: TokenLibraryItem, undoManager: UndoManager?) {
        guard let index = campaign.tokenLibrary.firstIndex(where: { $0.id == item.id }) else { return }
        let existing = campaign.tokenLibrary[index]
        var updated = item
        updated.src = existing.src  // campaign copies point at campaign assets
        updated.thumbnailSrc = existing.thumbnailSrc
        edit("Update Library Item", undoManager: undoManager) { $0.tokenLibrary[index] = updated }
    }
}

/// Drag payload for library items (the canvas reads it from the string pasteboard).
enum LibraryDrag {
    static let prefix = "graphium-library-item:"

    static func payload(for item: TokenLibraryItem) -> String { prefix + item.id }

    static func itemID(from string: String) -> String? {
        string.hasPrefix(prefix) ? String(string.dropFirst(prefix.count)) : nil
    }
}
