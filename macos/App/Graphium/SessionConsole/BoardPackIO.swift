import Foundation
import GraphiumCore

/// Board pack import/export for the Session Console settings (PARITY §5.4).
@MainActor
enum BoardPackIO {
    enum Mode {
        case replace, merge
    }

    /// Materialises a chosen `board.json` into this campaign and returns a summary.
    static func importPack(
        from url: URL, into document: CampaignDocument, mode: Mode, undoManager: UndoManager?
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
            fetch: { url in await fetchCapped(url) },
            persist: { data, name in pending.add(data, preferredName: name) })
        for (name, bytes) in pending.assets { document.assets[name] = bytes }
        document.editConsole(mode == .replace ? "Import Board Pack" : "Merge Board Pack", undoManager: undoManager) { catalog in
            if mode == .replace { catalog = result.catalog } else { catalog.merge(result.catalog) }
        }
        if mode == .replace { document.sessionRuntime = SessionConsoleRuntime(catalog: document.campaign.sessionConsole) }
        let skipped = errors + result.skipped
        var lines = ["Imported \(result.catalog.imageSets.flatMap(\.images).count) plates and \(result.catalog.allTracks.count) tracks."]
        if !skipped.isEmpty { lines.append("Skipped \(skipped.count):\n" + skipped.joined(separator: "\n")) }
        if !result.warnings.isEmpty { lines.append(Array(Set(result.warnings)).joined(separator: "\n")) }
        return lines.joined(separator: "\n\n")
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
