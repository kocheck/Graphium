import Foundation
import GraphiumCore

/// Reads and writes `.graphiumcampaign` packages for the MCP tools.
///
/// - Only paths inside the folders the DM listed with `--root` are touched, so an AI
///   client can't read or write anywhere else on the Mac.
/// - Every tool call loads the package fresh and saves straight away, so the file on
///   disk is always the truth, and Graphium (or a person) can edit it in between.
/// - Reads and writes are coordinated (`NSFileCoordinator`), so a campaign open in
///   Graphium autosaves its edits before the server reads it and reloads after a write.
/// - Before each write the previous `campaign.json` is kept in the user's Caches folder
///   for `undo`. That copy is rebuildable app-private storage, never the campaign itself.
public final class CampaignStore {
    public static let packageExtension = "graphiumcampaign"
    public static let maxUndoSteps = 30

    public let roots: [URL]
    let undoDirectory: URL

    public init(roots: [URL], undoDirectory: URL? = nil) {
        self.roots = roots.map(Self.canonical)
        self.undoDirectory =
            undoDirectory
            ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Graphium MCP", isDirectory: true)
            .appendingPathComponent("undo", isDirectory: true)
    }

    // MARK: Paths

    /// A path the client gave, as a URL inside a root. Relative paths resolve against the
    /// first root; `~` expands to the home folder.
    public func resolve(_ path: String) throws -> URL {
        guard !roots.isEmpty else {
            throw ToolError(
                "This Graphium server has no folders to work in. Ask the user to add `--root <folder>` to the "
                    + "graphium-mcp command in their MCP client settings (see macos/docs/MCP.md).")
        }
        let expanded = (path as NSString).expandingTildeInPath
        let url =
            expanded.hasPrefix("/")
            ? URL(fileURLWithPath: expanded) : roots[0].appendingPathComponent(expanded)
        let resolved = Self.canonical(url)
        guard isInsideRoots(resolved) else {
            throw ToolError(
                "\(path) is outside the folders this server may use (\(roots.map(\.path).joined(separator: ", "))). "
                    + "Use a path inside one of them.")
        }
        return resolved
    }

    /// An image to import (backgrounds, token art). Like `resolve`, but when the file is
    /// outside the folders the error says where to put it: the server copies the picture
    /// into the campaign package, so the copy in the folder is only a staging step.
    public func resolveImage(_ path: String) throws -> URL {
        do {
            return try resolve(path)
        } catch let error as ToolError {
            guard let root = roots.first else { throw error }
            let staging = root.appendingPathComponent("Imports", isDirectory: true).path
            throw ToolError(
                "\(path) is outside the folders this server may read (\(roots.map(\.path).joined(separator: ", "))). "
                    + "Copy the image into \(staging)/ (or anywhere in those folders) and pass that path; the server then "
                    + "copies it into the campaign package, so the staged copy can be deleted afterwards.")
        }
    }

    /// Symlinks resolved through the deepest folder that exists, so a file that doesn't exist
    /// yet compares the same way as its root (`/var` vs `/private/var` on macOS).
    static func canonical(_ url: URL) -> URL {
        var existing = url.standardizedFileURL
        var rest: [String] = []
        while !FileManager.default.fileExists(atPath: existing.path), existing.pathComponents.count > 1 {
            rest.insert(existing.lastPathComponent, at: 0)
            existing = existing.deletingLastPathComponent()
        }
        var result = existing.resolvingSymlinksInPath()
        for component in rest { result.appendPathComponent(component) }
        return result
    }

    func isInsideRoots(_ url: URL) -> Bool {
        let path = url.path
        return roots.contains { root in
            let rootPath = root.path.hasSuffix("/") ? root.path : root.path + "/"
            return path == root.path || path.hasPrefix(rootPath)
        }
    }

    /// The package URL for a campaign path, adding the extension when it's missing.
    public func packageURL(_ path: String) throws -> URL {
        var url = try resolve(path)
        if url.pathExtension != Self.packageExtension {
            url = url.appendingPathExtension(Self.packageExtension)
        }
        return url
    }

    /// Campaign packages under the roots (or under `folder`), a few levels deep.
    public func findCampaigns(in folder: String?, maxDepth: Int = 4) throws -> [URL] {
        let starts = try folder.map { [try resolve($0)] } ?? roots
        var found: [URL] = []
        let fm = FileManager.default
        func walk(_ url: URL, depth: Int) {
            guard depth <= maxDepth, found.count < 500,
                let children = try? fm.contentsOfDirectory(
                    at: url, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles])
            else { return }
            for child in children.sorted(by: { $0.path < $1.path }) {
                if child.pathExtension == Self.packageExtension {
                    found.append(child)
                } else if (try? child.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true,
                    child.pathExtension != "app"
                {
                    walk(child, depth: depth + 1)
                }
            }
        }
        for start in starts { walk(start, depth: 0) }
        return found
    }

    // MARK: Load and save

    /// An open package: the campaign, the asset names already on disk, and new asset
    /// bytes to write on save.
    public struct Loaded {
        public var url: URL
        public var campaign: Campaign
        public var existingAssets: Set<String>
        public var newAssets: [String: Data] = [:]
        /// What the file held that this server doesn't own (keys from a newer Graphium,
        /// the app's orphan list), written back unchanged.
        public var preserved = CampaignPackage.Preserved()

        public var allAssetNames: Set<String> { existingAssets.union(newAssets.keys) }

        /// Stores bytes under a fresh, package-safe name and returns the name.
        public mutating func addAsset(_ data: Data, preferredName: String) -> String {
            let name = uniqueAssetName(for: preferredName, existing: allAssetNames)
            newAssets[name] = data
            return name
        }
    }

    public func load(_ path: String) throws -> Loaded {
        let url = try packageURL(path)
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw ToolError("No campaign at \(url.path). Use list_campaigns to find one, or create_campaign to make it.")
        }
        var result: Result<Loaded, Error> = .failure(ToolError("Couldn't read \(url.path)."))
        coordinate(reading: url) {
            result = Result { try Self.read(url) }
        }
        return try result.get()
    }

    static func read(_ url: URL) throws -> Loaded {
        let manifestURL = url.appendingPathComponent(CampaignPackage.manifestFileName)
        let data: Data
        do {
            data = try Data(contentsOf: manifestURL)
        } catch {
            throw ToolError("\(url.lastPathComponent) has no readable campaign.json.")
        }
        let package: CampaignPackage
        do {
            package = try CampaignPackage(manifest: data, assets: [:])
        } catch CampaignPackage.FormatError.newerFormat(let found, let supported) {
            throw ToolError(
                "\(url.lastPathComponent) was saved by a newer Graphium (format \(found); this server reads \(supported)). "
                    + "Update Graphium and graphium-mcp; the file was not changed.")
        } catch {
            throw ToolError("\(url.lastPathComponent) couldn't be read as a Graphium campaign: \(error)")
        }
        let assetsURL = url.appendingPathComponent(CampaignPackage.assetsDirectoryName)
        let names = (try? FileManager.default.contentsOfDirectory(atPath: assetsURL.path)) ?? []
        var loaded = Loaded(
            url: url, campaign: package.campaign, existingAssets: Set(names.filter(CampaignPackage.isValidAssetName)))
        loaded.preserved = package.preserved
        return loaded
    }

    /// Writes new assets, then `campaign.json`, keeping the previous manifest for `undo`.
    public func save(_ loaded: inout Loaded) throws {
        let url = loaded.url
        let manifest = try CampaignPackage(campaign: loaded.campaign, preserved: loaded.preserved).encodeManifest()
        let newAssets = loaded.newAssets
        var failure: Error?
        coordinate(writing: url) {
            do {
                let fm = FileManager.default
                let assetsURL = url.appendingPathComponent(CampaignPackage.assetsDirectoryName, isDirectory: true)
                try fm.createDirectory(at: assetsURL, withIntermediateDirectories: true)
                for (name, data) in newAssets {
                    try data.write(to: assetsURL.appendingPathComponent(name), options: .atomic)
                }
                let manifestURL = url.appendingPathComponent(CampaignPackage.manifestFileName)
                if let previous = try? Data(contentsOf: manifestURL) {
                    guard previous != manifest else { return }
                    self.keepForUndo(previous, written: manifest, of: url)
                }
                try manifest.write(to: manifestURL, options: .atomic)
            } catch {
                failure = error
            }
        }
        if let failure { throw ToolError("Couldn't save \(url.lastPathComponent): \(failure.localizedDescription)") }
        loaded.existingAssets.formUnion(newAssets.keys)
        loaded.newAssets = [:]
    }

    /// Makes a new package. Fails if something is already there.
    public func create(_ path: String, campaign: Campaign) throws -> Loaded {
        let url = try packageURL(path)
        guard !FileManager.default.fileExists(atPath: url.path) else {
            throw ToolError("\(url.path) already exists. Pick another name, or edit that campaign instead.")
        }
        do {
            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        } catch {
            throw ToolError("Couldn't create \(url.path): \(error.localizedDescription)")
        }
        var loaded = Loaded(url: url, campaign: campaign, existingAssets: [])
        try save(&loaded)
        return loaded
    }

    // MARK: Undo

    func undoFolder(for url: URL) -> URL {
        // FNV-1a of the path keeps one folder per campaign without putting its path in a name.
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in url.path.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01B3
        }
        return undoDirectory.appendingPathComponent(String(hash, radix: 16), isDirectory: true)
    }

    func undoSteps(for url: URL) -> [URL] {
        let folder = undoFolder(for: url)
        let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
        return names.filter { $0.hasSuffix(".json") }.sorted().map { folder.appendingPathComponent($0) }
    }

    /// Keeps `manifest` (the file before a change) as an undo step, with `written` (the file
    /// after it) beside it, so undo can tell whether anyone changed the campaign since.
    func keepForUndo(_ manifest: Data, written: Data, of url: URL) {
        let folder = undoFolder(for: url)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let stamp = String(format: "%016.0f", Date().timeIntervalSince1970 * 1_000_000)
        try? manifest.write(to: folder.appendingPathComponent("\(stamp).json"), options: .atomic)
        try? written.write(to: Self.writtenURL(for: folder.appendingPathComponent("\(stamp).json")), options: .atomic)
        let steps = undoSteps(for: url)
        for old in steps.dropLast(Self.maxUndoSteps) {
            try? FileManager.default.removeItem(at: old)
            try? FileManager.default.removeItem(at: Self.writtenURL(for: old))
        }
    }

    static func writtenURL(for step: URL) -> URL {
        step.deletingPathExtension().appendingPathExtension("after")
    }

    /// Puts back the `campaign.json` from before the last change. Returns how many
    /// earlier steps remain. Undo swaps the whole file, so when the campaign changed after
    /// this server's last change (the DM edited it in Graphium) it refuses unless `force`,
    /// rather than throw those edits away too.
    public func undo(_ path: String, force: Bool = false) throws -> Int {
        let url = try packageURL(path)
        var steps = undoSteps(for: url)
        guard let last = steps.popLast(), let data = try? Data(contentsOf: last) else {
            throw ToolError("Nothing to undo for \(url.lastPathComponent) (this server keeps only its own changes).")
        }
        // Check it still decodes before putting it back.
        _ = try CampaignPackage(manifest: data, assets: [:])
        if !force, let written = try? Data(contentsOf: Self.writtenURL(for: last)),
            let current = try? load(path).campaign,
            let expected = try? CampaignPackage(manifest: written, assets: [:]).campaign, current != expected
        {
            throw ToolError(
                "\(url.lastPathComponent) changed after this server's last change (probably edited in Graphium). "
                    + "Undo puts back the whole file, so it would throw those edits away too. Fix the problem with "
                    + "update_objects or remove_objects instead, or pass force: true if the DM agrees to lose them.")
        }
        var failure: Error?
        coordinate(writing: url) {
            do {
                try data.write(to: url.appendingPathComponent(CampaignPackage.manifestFileName), options: .atomic)
            } catch {
                failure = error
            }
        }
        if let failure { throw ToolError("Couldn't undo: \(failure.localizedDescription)") }
        try? FileManager.default.removeItem(at: last)
        try? FileManager.default.removeItem(at: Self.writtenURL(for: last))
        return steps.count
    }

    // MARK: Coordination

    private func coordinate(reading url: URL, _ body: () -> Void) {
        #if canImport(Darwin)
            var error: NSError?
            var ran = false
            NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: url, options: [], error: &error) { _ in
                ran = true
                body()
            }
            if !ran { body() }
        #else
            body()
        #endif
    }

    private func coordinate(writing url: URL, _ body: () -> Void) {
        #if canImport(Darwin)
            var error: NSError?
            var ran = false
            NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: [], error: &error) { _ in
                ran = true
                body()
            }
            if !ran { body() }
        #else
            body()
        #endif
    }
}
