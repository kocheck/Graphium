import Foundation
import GraphiumCore

/// Board pack import/export for the Session Console settings (PARITY §5.4).
@MainActor
enum BoardPackIO {
    enum Mode {
        case replace, merge
    }

    /// The hosts a chosen `board.json` would download from, so the DM can be asked first.
    static func remoteHosts(in url: URL) -> [String] {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return [] }
        return BoardPack.remoteHosts(in: BoardPack.parse(data).pack)
    }

    /// Materialises a chosen `board.json` into this campaign and returns a summary.
    /// Remote files are fetched only when `downloadRemoteFiles` is true (the DM agreed
    /// after seeing the hosts); otherwise they're skipped without contacting anyone.
    static func importPack(
        from url: URL, into document: CampaignDocument, mode: Mode, downloadRemoteFiles: Bool,
        undoManager: UndoManager?
    ) async -> String {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return "Couldn't read \(url.lastPathComponent)." }
        let root = url.deletingLastPathComponent()
        let (pack, errors) = BoardPack.parse(data)
        // Materialising runs off the main actor; collect assets and commit them after.
        let pending = PendingAssets(existing: Set(document.assets.keys))
        let result = await BoardPack.materialize(
            pack,
            resolveFile: { path in resolve(path, root: root) },
            fetch: { url in
                guard downloadRemoteFiles else { return .declined }
                return await fetchCapped(url)
            },
            persist: { data, name in pending.add(data, preferredName: name) })
        // Plates get a MAP-sized image and a THUMB thumbnail, as the dropzone does
        // (TS `processImportedCatalogPlates`); a plate that can't be processed keeps its bytes.
        let plateNames = Set(result.catalog.imageSets.flatMap { $0.images.map(\.src) })
        let raw = pending.assets
        let plates = await Task.detached(priority: .userInitiated) { BoardPackIO.processPlates(plateNames, in: raw) }.value
        // The DM may have added assets during the await, so names are allocated again
        // here (never overwriting existing bytes) and the catalog follows any rename.
        var renamed: [String: String] = [:]
        var thumbnails: [String: String] = [:]  // final plate name → its thumbnail
        for (name, bytes) in raw.sorted(by: { $0.key < $1.key }) {
            if let plate = plates[name] {
                let full = document.addAsset(plate.full.data, preferredName: plate.full.preferredName)
                renamed[name] = full
                if let thumb = plate.thumbnail {
                    thumbnails[full] = document.addAsset(thumb.data, preferredName: "thumb-" + thumb.preferredName)
                }
            } else {
                renamed[name] = document.addAsset(bytes, preferredName: name)
            }
        }
        var imported = result.catalog
        imported.rewriteAssetReferences { renamed[$0] ?? $0 }
        for s in imported.imageSets.indices {
            for i in imported.imageSets[s].images.indices {
                let image = imported.imageSets[s].images[i]
                if image.thumbnailSrc == image.src, let thumb = thumbnails[image.src] {
                    imported.imageSets[s].images[i].thumbnailSrc = thumb
                }
            }
        }
        document.editConsole(mode == .replace ? "Import Board Pack" : "Merge Board Pack", undoManager: undoManager) { catalog in
            if mode == .replace { catalog = imported } else { catalog.merge(imported) }
        }
        if mode == .replace { document.sessionRuntime = SessionConsoleRuntime(catalog: document.campaign.sessionConsole) }
        let skipped = errors + result.skipped
        var lines = ["Imported \(imported.imageSets.flatMap(\.images).count) plates and \(imported.allTracks.count) tracks."]
        if !skipped.isEmpty { lines.append("Skipped \(skipped.count):\n" + skipped.joined(separator: "\n")) }
        if !result.warnings.isEmpty { lines.append(Array(Set(result.warnings)).joined(separator: "\n")) }
        return lines.joined(separator: "\n\n")
    }

    /// Resizes each plate's bytes to MAP and THUMB; plates that aren't readable images are left out.
    nonisolated private static func processPlates(_ names: Set<String>, in assets: [String: Data]) -> [String: ProcessedPlate] {
        var processed: [String: ProcessedPlate] = [:]
        for name in names {
            guard let data = assets[name], let full = try? ImportedImage.load(data: data, name: name, kind: .map) else {
                continue
            }
            let thumbnail = try? ImportedImage.load(data: data, name: name, kind: .thumbnail)
            processed[name] = ProcessedPlate(full: full, thumbnail: thumbnail)
        }
        return processed
    }

    /// Relative or absolute paths, only if they stay inside the pack folder after
    /// resolving symlinks; 25 MB cap (TS `resolveSandboxedPackPath`).
    nonisolated private static func resolve(_ path: String, root: URL) -> BoardPack.FileResult? {
        let realRoot = root.resolvingSymlinksInPath().standardizedFileURL
        let candidate = (path.hasPrefix("/") ? URL(fileURLWithPath: path) : root.appendingPathComponent(path))
            .resolvingSymlinksInPath().standardizedFileURL
        guard candidate.path == realRoot.path || candidate.path.hasPrefix(realRoot.path + "/") else { return nil }
        guard let size = try? candidate.resourceValues(forKeys: [.fileSizeKey]).fileSize else { return nil }
        if size > BoardPack.httpMaxBytes { return .skip("file is larger than 25MB") }
        guard let data = try? Data(contentsOf: candidate) else { return nil }
        return .data(data, fileName: candidate.lastPathComponent)
    }

    /// https only (already checked by the classifier), no redirects to elsewhere, 25 MB cap.
    nonisolated private static func fetchCapped(_ url: URL) async -> BoardPack.FetchResult {
        do {
            let (bytes, response) = try await URLSession.shared.bytes(from: url)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                http.url?.host == url.host
            else { return .failed }
            if http.expectedContentLength > Int64(BoardPack.httpMaxBytes) { return .tooLarge }
            var data = Data()
            for try await byte in bytes {
                data.append(byte)
                if data.count > BoardPack.httpMaxBytes { return .tooLarge }
            }
            return .data(data)
        } catch {
            return .failed
        }
    }

    /// Writes board.json plus images/ and audio/ copies into a chosen folder.
    static func exportPack(from document: CampaignDocument, to folder: URL) -> String {
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        do {
            let export = try BoardPack.export(document.campaign.sessionConsole)
            var missing: [String] = []
            for file in export.files {
                guard let data = document.assets[file.asset] else {
                    missing.append(file.path)
                    continue
                }
                let destination = folder.appendingPathComponent(file.path)
                guard destination.standardizedFileURL.path.hasPrefix(folder.standardizedFileURL.path + "/") else { continue }
                try FileManager.default.createDirectory(
                    at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
                try data.write(to: destination, options: .atomic)
            }
            try export.boardJSON.write(to: folder.appendingPathComponent("board.json"), options: .atomic)
            return missing.isEmpty
                ? "Board pack exported"
                : "Board pack finished with errors. Missing files:\n" + missing.joined(separator: "\n")
        } catch {
            return "Export failed: \(error.localizedDescription)"
        }
    }
}

/// A board pack plate resized for the package (MAP image plus THUMB thumbnail).
private struct ProcessedPlate: Sendable {
    var full: ImportedImage
    var thumbnail: ImportedImage?
}

/// Names and holds imported bytes until they can be added to the document on the main actor.
private final class PendingAssets: @unchecked Sendable {
    private let lock = NSLock()
    private var names: Set<String>
    private(set) var assets: [String: Data] = [:]

    init(existing: Set<String>) {
        names = existing
    }

    func add(_ data: Data, preferredName: String) -> String {
        lock.lock()
        defer { lock.unlock() }
        let name = uniqueAssetName(for: preferredName, existing: names)
        names.insert(name)
        assets[name] = data
        return name
    }
}
