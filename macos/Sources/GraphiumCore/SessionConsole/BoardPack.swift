import Foundation

/// Session Console board packs: a `board.json` plus image/audio files, for sharing a
/// board between campaigns (TS `sessionConsolePack.ts`, CORE_SPEC §3.11).
public enum BoardPack {
    public static let kind = "graphium.sessionConsolePack"
    public static let httpMaxBytes = 25 * 1024 * 1024

    // MARK: Parsed pack (authoring shape)

    public struct Pack: Equatable, Sendable {
        public var stage = StageChrome(title: "")
        public var defaults = AudioDefaults()
        public var imageSets: [PackSet] = []
        public var trackGroups: [PackGroup] = []
        public var sfx: [PackSfx] = []
    }

    public struct PackSet: Equatable, Sendable {
        public var id, title, note: String
        public var images: [PackImage]
    }

    public struct PackImage: Equatable, Sendable {
        public var id, name, cue, src, alt: String
    }

    public struct PackGroup: Equatable, Sendable {
        public var id, title, note: String
        public var accent: TrackAccent
        public var tracks: [PackTrack]
    }

    public struct PackTrack: Equatable, Sendable {
        public var id: String?
        public var title, cue, tag, src: String
        public var recommendedImage: String?
        public var loop: Bool
        public var volumeOffset: Double
    }

    public struct PackSfx: Equatable, Sendable {
        public var id, label: String
        public var kind: SfxKind
        public var synthType: String?
        public var src: String?
    }

    // MARK: Parsing

    /// TS `parseSessionConsolePack`: keeps every valid row and reports the rest.
    public static func parse(_ data: Data) -> (pack: Pack, errors: [String]) {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            return (Pack(), ["Pack JSON must be an object"])
        }
        guard root["kind"] as? String == kind else { return (Pack(), ["Expected kind \"\(kind)\""]) }
        guard (root["version"] as? NSNumber)?.intValue == 1, (root["version"] as? Double) == 1 else {
            return (Pack(), ["Expected pack version 1"])
        }
        var errors: [String] = []
        var pack = Pack()
        let stage = root["stage"] as? [String: Any] ?? [:]
        pack.stage = StageChrome(
            title: stage["title"] as? String ?? "", subtitle: stage["subtitle"] as? String ?? "",
            showFrame: stage["showFrame"] as? Bool ?? true)
        let defaults = root["defaults"] as? [String: Any] ?? [:]
        pack.defaults = AudioDefaults(
            volume: finite(defaults["volume"]) ?? SessionConsoleCatalog.defaultVolume,
            duckPercent: finite(defaults["duckPercent"]) ?? SessionConsoleCatalog.defaultDuckPercent)

        for (i, raw) in (root["imageSets"] as? [Any] ?? []).enumerated() {
            guard let set = raw as? [String: Any] else {
                errors.append("imageSets[\(i)] is not an object")
                continue
            }
            let id = nonEmpty(set["id"]) ?? "image-set-\(i + 1)"
            var images: [PackImage] = []
            for rawImage in set["images"] as? [Any] ?? [] {
                guard let image = rawImage as? [String: Any], let imageID = nonEmpty(image["id"]),
                    let src = nonEmpty(image["src"])?.trimmingCharacters(in: .whitespaces), !src.isEmpty
                else {
                    errors.append("Image in \"\(id)\": needs an id and a src")
                    continue
                }
                switch classify(src) {
                case .invalid(let reason): errors.append("Image \"\(imageID)\": \(reason)"); continue
                case .youtube: errors.append("Image \"\(imageID)\": must be a file or http src"); continue
                default: break
                }
                images.append(
                    PackImage(
                        id: imageID, name: nonEmpty(image["name"]) ?? imageID, cue: image["cue"] as? String ?? "",
                        src: src, alt: image["alt"] as? String ?? ""))
            }
            pack.imageSets.append(
                PackSet(id: id, title: nonEmpty(set["title"]) ?? id, note: set["note"] as? String ?? "", images: images))
        }

        for (i, raw) in (root["trackGroups"] as? [Any] ?? []).enumerated() {
            guard let group = raw as? [String: Any] else {
                errors.append("trackGroups[\(i)] is not an object")
                continue
            }
            let id = nonEmpty(group["id"]) ?? "track-group-\(i + 1)"
            var accent = TrackAccent.bed
            if let rawAccent = group["accent"] as? String {
                if let parsed = TrackAccent(rawValue: rawAccent) { accent = parsed } else {
                    errors.append("Track group \"\(id)\": unknown accent \"\(rawAccent)\"")
                }
            }
            var tracks: [PackTrack] = []
            for rawTrack in group["tracks"] as? [Any] ?? [] {
                guard let track = rawTrack as? [String: Any], let title = nonEmpty(track["title"]),
                    let src = nonEmpty(track["src"])?.trimmingCharacters(in: .whitespaces)
                else {
                    errors.append("Track in \"\(id)\": needs a title and a src")
                    continue
                }
                if case .invalid(let reason) = classify(src) {
                    errors.append("Track \"\(title)\": \(reason)")
                    continue
                }
                tracks.append(
                    PackTrack(
                        id: nonEmpty(track["id"]), title: title, cue: track["cue"] as? String ?? "",
                        tag: track["tag"] as? String ?? "", src: src, recommendedImage: nonEmpty(track["recommendedImage"]),
                        loop: track["loop"] as? Bool ?? true, volumeOffset: finite(track["volumeOffset"]) ?? 0))
            }
            pack.trackGroups.append(
                PackGroup(id: id, title: nonEmpty(group["title"]) ?? id, note: group["note"] as? String ?? "", accent: accent, tracks: tracks))
        }

        for raw in root["sfx"] as? [Any] ?? [] {
            guard let sfx = raw as? [String: Any], let id = sfx["id"] as? String else { continue }
            pack.sfx.append(
                PackSfx(
                    id: id, label: nonEmpty(sfx["label"]) ?? id, kind: sfx["kind"] as? String == "local" ? .local : .synth,
                    synthType: sfx["synthType"] as? String, src: sfx["src"] as? String))
        }
        return (pack, errors)
    }

    private static func nonEmpty(_ value: Any?) -> String? {
        guard let s = value as? String, !s.isEmpty else { return nil }
        return s
    }

    private static func finite(_ value: Any?) -> Double? {
        guard let n = value as? NSNumber, !(value is Bool) else { return nil }
        let d = n.doubleValue
        return d.isFinite ? d : nil
    }

    // MARK: Source classification

    public enum Source: Equatable, Sendable {
        case youtube(String)
        case http(URL)
        case relative(String)
        case absolute(String)
        case invalid(String)
    }

    /// TS `classifyPackSrc`.
    public static func classify(_ raw: String) -> Source {
        let src = raw.trimmingCharacters(in: .whitespaces)
        guard !src.isEmpty else { return .invalid("empty src") }
        if let id = SessionConsoleAudio.parseYouTubeVideoID(src) { return .youtube(id) }
        let lower = src.lowercased()
        if lower.hasPrefix("file:") {
            guard let url = URL(string: src) else { return .invalid("invalid file URL") }
            if let host = url.host, !host.isEmpty { return .invalid("network path is not allowed") }
            if src.hasPrefix("file:////") { return .invalid("network path is not allowed") }
            return .absolute(url.path)
        }
        if lower.hasPrefix("http://") || lower.hasPrefix("https://") {
            guard let url = URL(string: src), let host = url.host else { return .invalid("invalid http URL") }
            if SessionConsoleAudio.isYouTubeHostname(host) { return .invalid("youtube URL is missing a video id") }
            guard isSafeHTTPURL(url) else { return .invalid("remote file host is not allowed") }
            return .http(url)
        }
        if src.hasPrefix("\\\\") || src.hasPrefix("//") { return .invalid("network path is not allowed") }
        if let colon = src.firstIndex(of: ":"), src.distance(from: src.startIndex, to: colon) > 1,
            src[..<colon].allSatisfy({ $0.isLetter || $0.isNumber || "+-.".contains($0) })
        {
            return .invalid("unsupported scheme in \"\(src)\"")
        }
        let isDrive = src.count >= 3 && src.dropFirst().first == ":" && (src.dropFirst(2).first == "/" || src.dropFirst(2).first == "\\")
        if isDrive || src.hasPrefix("/") { return .absolute(src) }
        let hasExtension = src.range(of: #"\.[a-zA-Z0-9]{2,5}$"#, options: .regularExpression) != nil
        if src.hasPrefix("./") || src.hasPrefix("../") || src.contains("/") || src.contains("\\") || hasExtension {
            return .relative(src)
        }
        return .invalid("unrecognized src \"\(src)\"")
    }

    /// TS `isSafePackHttpUrl`: public https hosts only (including its quirk of rejecting
    /// any host that starts with "fc"/"fd", which covers IPv6 ULA ranges).
    public static func isSafeHTTPURL(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "https", let rawHost = url.host?.lowercased() else { return false }
        let host = rawHost.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        if ["localhost", "metadata.google.internal", "0.0.0.0", "::1"].contains(host) { return false }
        if host.hasPrefix("fe80:") || host.hasPrefix("fc") || host.hasPrefix("fd") { return false }
        let octets = host.split(separator: ".").compactMap { Int($0) }
        if octets.count == 4 {
            switch (octets[0], octets[1]) {
            case (0, _), (10, _), (127, _), (169, 254), (192, 168): return false
            case (172, 16...31): return false
            default: break
            }
        }
        return true
    }

    /// TS `isPathInsidePackRoot` (after resolving `..` segments).
    public static func isInside(root: String, path: String) -> Bool {
        let base = URL(fileURLWithPath: root).standardizedFileURL.path
        let target = URL(fileURLWithPath: path, relativeTo: URL(fileURLWithPath: root, isDirectory: true)).standardizedFileURL.path
        return target == base || target.hasPrefix(base.hasSuffix("/") ? base : base + "/")
    }

    /// TS `slugId`.
    public static func slug(_ text: String, used: inout Set<String>) -> String {
        var slug = ""
        var dash = false
        for ch in text.lowercased() {
            if ch.isASCII && (ch.isLetter || ch.isNumber) {
                slug.append(ch)
                dash = false
            } else if !dash {
                slug.append("-")
                dash = true
            }
        }
        slug = slug.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        if slug.isEmpty { slug = "item" }
        var candidate = slug
        var n = 2
        while used.contains(candidate) {
            candidate = "\(slug)-\(n)"
            n += 1
        }
        used.insert(candidate)
        return candidate
    }

    // MARK: Materialising

    public enum FileResult: Sendable {
        case data(Data, fileName: String)
        case skip(String)
    }

    public enum FetchResult: Sendable {
        case data(Data)
        case tooLarge
        case failed
    }

    public struct Materialized: Sendable {
        public var catalog: SessionConsoleCatalog
        public var skipped: [String]
        public var warnings: [String]
    }

    /// TS `materializePack`. `resolveFile` gets relative/absolute paths (the app
    /// sandboxes them to the pack folder); `persist` stores bytes as a campaign asset
    /// and returns its name. Each distinct src is ingested once.
    public static func materialize(
        _ pack: Pack,
        resolveFile: (String) -> FileResult?,
        fetch: ((URL) async -> FetchResult)?,
        persist: (Data, String) -> String
    ) async -> Materialized {
        var catalog = SessionConsoleCatalog.empty(campaignName: pack.stage.title)
        catalog.stage = pack.stage
        catalog.defaults = pack.defaults
        var skipped: [String] = []
        var warnings: [String] = []
        var cache: [String: String?] = [:]

        func ingest(_ src: String, label: String) async -> String? {
            let key = src.trimmingCharacters(in: .whitespaces)
            if let cached = cache[key] { return cached }
            var result: String?
            switch classify(key) {
            case .youtube: skipped.append("\(label): must be a file or http src")
            case .invalid(let reason): skipped.append("\(label): \(reason)")
            case .http(let url):
                switch await fetch?(url) ?? .failed {
                case .tooLarge:
                    skipped.append("\(label): remote file is larger than 25MB")
                case .data(let data) where data.count > httpMaxBytes:
                    skipped.append("\(label): remote file is larger than 25MB")
                case .data(let data):
                    if SessionConsoleAudio.allowedAudioExtensions.contains(url.pathExtension.lowercased()),
                        data.count > SessionConsoleAudio.warnBytes
                    {
                        warnings.append("This audio file is larger than 8MB and will bloat the campaign zip.")
                    }
                    result = persist(data, url.lastPathComponent.isEmpty ? "remote" : url.lastPathComponent)
                case .failed:
                    skipped.append("\(label): failed to fetch remote file")
                }
            case .relative(let path), .absolute(let path):
                switch resolveFile(path) {
                case .data(let data, let name)?: result = persist(data, name)
                case .skip(let reason)?: skipped.append("\(label): \(reason)")
                case nil: skipped.append("\(label): missing or unsandboxed file")
                }
            }
            cache[key] = result
            return result
        }

        var used = Set(SfxDefinition.builtIn.map(\.id))
        var imagesByID: [String: String] = [:]
        var imagesByName: [String: String] = [:]
        for set in pack.imageSets {
            var images: [StageImage] = []
            for image in set.images {
                guard let src = await ingest(image.src, label: "Image \"\(image.id)\"") else { continue }
                let id = used.contains(image.id) ? slug(image.id, used: &used) : image.id
                used.insert(id)
                imagesByID[image.id] = id
                imagesByName[image.name.lowercased()] = id
                images.append(StageImage(id: id, name: image.name, cue: image.cue, src: src, thumbnailSrc: src, alt: image.alt))
            }
            catalog.imageSets.append(ImageSet(id: set.id, title: set.title, note: set.note, images: images))
        }

        for group in pack.trackGroups {
            var tracks: [Track] = []
            for track in group.tracks {
                let id = slug(track.id ?? track.title, used: &used)
                let recommended = track.recommendedImage.flatMap { imagesByID[$0] ?? imagesByName[$0.lowercased()] }
                let offset = SessionConsoleAudio.clampVolumeOffset(track.volumeOffset)
                if case .youtube(let videoID) = classify(track.src) {
                    tracks.append(
                        Track(
                            id: id, title: track.title, cue: track.cue, tag: track.tag, source: .youtube, youtubeId: videoID,
                            volumeOffset: offset, loop: track.loop, recommendedImageId: recommended))
                } else if let src = await ingest(track.src, label: "Track \"\(track.title)\"") {
                    tracks.append(
                        Track(
                            id: id, title: track.title, cue: track.cue, tag: track.tag, source: .local, src: src,
                            volumeOffset: offset, loop: track.loop, recommendedImageId: recommended))
                }
            }
            catalog.trackGroups.append(TrackGroup(id: group.id, title: group.title, note: group.note, accent: group.accent, tracks: tracks))
        }

        if !pack.sfx.isEmpty {
            var incoming: [SfxDefinition] = []
            for effect in pack.sfx {
                switch effect.kind {
                case .synth:
                    incoming.append(
                        SfxDefinition(id: effect.id, label: effect.label, kind: .synth, synthType: effect.synthType.flatMap { SynthType(rawValue: $0) }))
                case .local:
                    guard let rawSrc = effect.src else {
                        skipped.append("SFX \"\(effect.id)\": local clip is missing src")
                        continue
                    }
                    if let src = await ingest(rawSrc, label: "SFX \"\(effect.id)\"") {
                        incoming.append(SfxDefinition(id: effect.id, label: effect.label, kind: .local, src: src))
                    }
                }
            }
            // TS `unionSfx`: seeded order with same-id replacements, then new ids appended.
            var merged = catalog.sfx.map { seeded in incoming.first { $0.id == seeded.id } ?? seeded }
            merged += incoming.filter { item in !merged.contains { $0.id == item.id } }
            catalog.sfx = merged
        }
        return Materialized(catalog: catalog, skipped: skipped, warnings: warnings)
    }

    // MARK: Export

    public struct Export {
        /// `board.json`, pretty-printed with a trailing newline.
        public var boardJSON: Data
        /// Relative path in the pack folder → campaign asset name to copy there.
        public var files: [(path: String, asset: String)]
    }

    /// TS `catalogToSessionConsolePack`. Deliberate fix: local SFX files are exported too.
    public static func export(_ catalog: SessionConsoleCatalog) throws -> Export {
        var files: [(path: String, asset: String)] = []
        func ext(_ src: String, fallback: String) -> String {
            let e = (src as NSString).pathExtension
            return e.range(of: #"^[a-zA-Z0-9]{1,5}$"#, options: .regularExpression) != nil ? ".\(e)" : fallback
        }
        let sets: [[String: Any]] = catalog.imageSets.map { set in
            [
                "id": set.id, "title": set.title, "note": set.note,
                "images": set.images.map { image -> [String: Any] in
                    let path = "./images/\(sanitizeExportID(image.id))\(ext(image.src, fallback: ".png"))"
                    files.append((path: String(path.dropFirst(2)), asset: image.src))
                    return ["id": image.id, "name": image.name, "cue": image.cue, "src": path, "alt": image.alt]
                },
            ]
        }
        let groups: [[String: Any]] = catalog.trackGroups.map { group in
            [
                "id": group.id, "title": group.title, "note": group.note, "accent": group.accent.rawValue,
                "tracks": group.tracks.map { track -> [String: Any] in
                    var row: [String: Any] = [
                        "id": track.id, "title": track.title, "cue": track.cue, "tag": track.tag, "loop": track.loop,
                        "volumeOffset": track.volumeOffset,
                    ]
                    if track.source == .youtube, let id = track.youtubeId {
                        row["src"] = "https://www.youtube.com/watch?v=\(id)"
                    } else if let src = track.src {
                        let path = "./audio/\(sanitizeExportID(track.id))\(ext(src, fallback: ".mp3"))"
                        files.append((path: String(path.dropFirst(2)), asset: src))
                        row["src"] = path
                    }
                    if let rec = track.recommendedImageId { row["recommendedImage"] = rec }
                    return row
                },
            ]
        }
        let sfx: [[String: Any]] = catalog.sfx.map { effect in
            var row: [String: Any] = ["id": effect.id, "label": effect.label, "kind": effect.kind.rawValue]
            if let type = effect.synthType { row["synthType"] = type.rawValue }
            if effect.kind == .local, let src = effect.src {
                let path = "./audio/\(sanitizeExportID(effect.id))\(ext(src, fallback: ".mp3"))"
                files.append((path: String(path.dropFirst(2)), asset: src))
                row["src"] = path
            }
            return row
        }
        let root: [String: Any] = [
            "version": 1, "kind": kind,
            "stage": ["title": catalog.stage.title, "subtitle": catalog.stage.subtitle, "showFrame": catalog.stage.showFrame],
            "defaults": ["volume": catalog.defaults.volume, "duckPercent": catalog.defaults.duckPercent],
            "imageSets": sets, "trackGroups": groups, "sfx": sfx,
        ]
        var json = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
        json.append(0x0A)
        return Export(boardJSON: json, files: files)
    }

    /// TS `sanitizeExportId`: a single safe path component, so ".." can't escape.
    public static func sanitizeExportID(_ id: String) -> String {
        let base = (id as NSString).lastPathComponent
        var out = ""
        var dash = false
        for ch in base {
            if ch.isASCII && (ch.isLetter || ch.isNumber || "._-".contains(ch)) {
                out.append(ch)
                dash = false
            } else if !dash {
                out.append("-")
                dash = true
            }
        }
        out = out.trimmingCharacters(in: CharacterSet(charactersIn: "-."))
        return out.isEmpty || out == "." || out == ".." ? "asset" : out
    }
}
