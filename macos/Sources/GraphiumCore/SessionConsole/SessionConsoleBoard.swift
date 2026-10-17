import Foundation

/// Board editing (TS `sessionConsoleReducers.ts` catalog actions and
/// `sessionConsoleBoard.ts`, CORE_SPEC §3.9-3.10). Not-found ids are no-ops.
extension SessionConsoleCatalog {
    // MARK: Image sets and plates

    public mutating func addImageSet(_ set: ImageSet) {
        guard !imageSets.contains(where: { $0.id == set.id }) else { return }
        imageSets.append(set)
    }

    public mutating func updateImageSet(id: String, title: String? = nil, note: String? = nil) {
        guard let i = imageSets.firstIndex(where: { $0.id == id }) else { return }
        if let title { imageSets[i].title = title }
        if let note { imageSets[i].note = note }
    }

    public mutating func removeImageSet(id: String) { imageSets.removeAll { $0.id == id } }

    public mutating func reorderImageSets(_ ids: [String]) { imageSets = reorder(imageSets, ids) }

    /// Image ids are unique across every set.
    public mutating func addImage(_ image: StageImage, toSet setID: String) {
        guard let i = imageSets.firstIndex(where: { $0.id == setID }),
            !imageSets.contains(where: { $0.images.contains { $0.id == image.id } })
        else { return }
        imageSets[i].images.append(image)
    }

    public mutating func updateImage(id: String, _ change: (inout StageImage) -> Void) {
        for s in imageSets.indices {
            if let i = imageSets[s].images.firstIndex(where: { $0.id == id }) {
                var image = imageSets[s].images[i]
                change(&image)
                image.id = id
                imageSets[s].images[i] = image
                return
            }
        }
    }

    public mutating func removeImage(id: String) {
        for s in imageSets.indices where imageSets[s].images.contains(where: { $0.id == id }) {
            imageSets[s].images.removeAll { $0.id == id }
            return
        }
    }

    public mutating func reorderImages(inSet setID: String, _ ids: [String]) {
        guard let s = imageSets.firstIndex(where: { $0.id == setID }) else { return }
        imageSets[s].images = reorder(imageSets[s].images, ids)
    }

    // MARK: Track groups and tracks

    public mutating func addTrackGroup(_ group: TrackGroup) {
        guard !trackGroups.contains(where: { $0.id == group.id }) else { return }
        trackGroups.append(group)
    }

    public mutating func updateTrackGroup(id: String, title: String? = nil, note: String? = nil, accent: TrackAccent? = nil) {
        guard let i = trackGroups.firstIndex(where: { $0.id == id }) else { return }
        if let title { trackGroups[i].title = title }
        if let note { trackGroups[i].note = note }
        if let accent { trackGroups[i].accent = accent }
    }

    public mutating func removeTrackGroup(id: String) { trackGroups.removeAll { $0.id == id } }

    public mutating func reorderTrackGroups(_ ids: [String]) { trackGroups = reorder(trackGroups, ids) }

    public mutating func addTrack(_ track: Track, toGroup groupID: String) {
        guard let g = trackGroups.firstIndex(where: { $0.id == groupID }),
            !trackGroups.contains(where: { $0.tracks.contains { $0.id == track.id } })
        else { return }
        trackGroups[g].tracks.append(track)
    }

    public mutating func updateTrack(id: String, _ change: (inout Track) -> Void) {
        for g in trackGroups.indices {
            if let i = trackGroups[g].tracks.firstIndex(where: { $0.id == id }) {
                var track = trackGroups[g].tracks[i]
                change(&track)
                track.id = id
                track.volumeOffset = SessionConsoleAudio.clampVolumeOffset(track.volumeOffset)
                trackGroups[g].tracks[i] = track
                return
            }
        }
    }

    public mutating func removeTrack(id: String) {
        for g in trackGroups.indices where trackGroups[g].tracks.contains(where: { $0.id == id }) {
            trackGroups[g].tracks.removeAll { $0.id == id }
            return
        }
    }

    public mutating func reorderTracks(inGroup groupID: String, _ ids: [String]) {
        guard let g = trackGroups.firstIndex(where: { $0.id == groupID }) else { return }
        trackGroups[g].tracks = reorder(trackGroups[g].tracks, ids)
    }

    // MARK: Chrome and defaults

    public mutating func updateDefaults(volume: Double? = nil, duckPercent: Double? = nil) {
        if let volume { defaults.volume = SessionConsoleAudio.clampVolume(volume) }
        if let duckPercent { defaults.duckPercent = SessionConsoleAudio.clampDuckPercent(duckPercent) }
    }

    /// TS `mergeCatalog`: append everything from `incoming`, giving colliding ids fresh
    /// ones (and remapping recommended plates); SFX already present by id are skipped.
    public mutating func merge(_ incoming: SessionConsoleCatalog) {
        var used = Set(imageSets.map(\.id) + imageSets.flatMap { $0.images.map(\.id) })
        used.formUnion(trackGroups.map(\.id) + trackGroups.flatMap { $0.tracks.map(\.id) })
        used.formUnion(sfx.map(\.id))
        func allocate(_ preferred: String) -> String {
            let id = used.contains(preferred) ? newID() : preferred
            used.insert(id)
            return id
        }
        var imageMap: [String: String] = [:]
        for var set in incoming.imageSets {
            set.id = allocate(set.id)
            set.images = set.images.map { image in
                var copy = image
                copy.id = allocate(image.id)
                imageMap[image.id] = copy.id
                return copy
            }
            imageSets.append(set)
        }
        for var group in incoming.trackGroups {
            group.id = allocate(group.id)
            group.tracks = group.tracks.map { track in
                var copy = track
                copy.id = allocate(track.id)
                if let rec = track.recommendedImageId { copy.recommendedImageId = imageMap[rec] ?? rec }
                return copy
            }
            trackGroups.append(group)
        }
        let existingSfx = Set(sfx.map(\.id))
        for var effect in incoming.sfx where !existingSfx.contains(effect.id) {
            effect.id = allocate(effect.id)
            sfx.append(effect)
        }
    }

    // MARK: Board helpers

    /// All tracks in board order.
    public var allTracks: [Track] { trackGroups.flatMap(\.tracks) }

    /// TS `formatSessionConsoleFallbackLinks`: numbered lines for pasting into chat.
    public var fallbackLinks: String {
        allTracks.enumerated().map { i, track in
            Self.fallbackLine(index: i + 1, track: track)
        }.joined(separator: "\n")
    }

    public static func fallbackLine(index: Int, track: Track) -> String {
        if track.source == .youtube, let id = track.youtubeId {
            return "\(index). \(track.title) \u{2014} https://www.youtube.com/watch?v=\(id)"
        }
        return "\(index). \(track.title) \u{2014} (local file)"
    }

    /// TS `nextBoardTitle`: `base`, else `base 2`, `base 3`, …
    public static func nextTitle(_ base: String, existing: [String]) -> String {
        if !existing.contains(base) { return base }
        var n = 2
        while existing.contains("\(base) \(n)") { n += 1 }
        return "\(base) \(n)"
    }

    @discardableResult
    public mutating func addNewImageSet() -> String {
        let set = ImageSet(title: Self.nextTitle("Plates", existing: imageSets.map(\.title)))
        imageSets.append(set)
        return set.id
    }

    @discardableResult
    public mutating func addNewTrackGroup() -> String {
        let group = TrackGroup(title: Self.nextTitle("Tracks", existing: trackGroups.map(\.title)), accent: .bed)
        trackGroups.append(group)
        return group.id
    }

    /// TS `ensureImageSet`: the set titled `title` (created if needed), else the last set, else a new "Plates".
    public mutating func ensureImageSet(title: String? = nil) -> String {
        if let title {
            if let set = imageSets.first(where: { $0.title == title }) { return set.id }
            let set = ImageSet(title: title)
            imageSets.append(set)
            return set.id
        }
        return imageSets.last?.id ?? addNewImageSet()
    }

    /// TS `ensureTrackGroup`: `id` if it exists, else the last group, else a new "Tracks".
    public mutating func ensureTrackGroup(id: String? = nil) -> String {
        if let id, trackGroups.contains(where: { $0.id == id }) { return id }
        return trackGroups.last?.id ?? addNewTrackGroup()
    }

    /// TS `addYouTubeFromText`. Returns the new track id, or nil for an invalid link.
    @discardableResult
    public mutating func addYouTube(_ text: String, toGroup groupID: String? = nil) -> String? {
        guard let videoID = SessionConsoleAudio.parseYouTubeVideoID(text) else { return nil }
        let group = ensureTrackGroup(id: groupID)
        let track = Track(title: "YouTube \(videoID)", source: .youtube, youtubeId: videoID)
        addTrack(track, toGroup: group)
        return track.id
    }
}

/// TS `reorderByIds`: any unknown id → unchanged; else listed ids first (duplicates
/// skipped), then the rest in their original order.
func reorder<T: Identifiable>(_ items: [T], _ ids: [String]) -> [T] where T.ID == String {
    let byID = Dictionary(items.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    guard ids.allSatisfy({ byID[$0] != nil }) else { return items }
    var seen = Set<String>()
    var result: [T] = []
    for id in ids where seen.insert(id).inserted { result.append(byID[id]!) }
    result += items.filter { !seen.contains($0.id) }
    return result
}
