import Foundation

/// A note pinned to the map (native only). The DM's notes are for the DM alone; the player
/// notes are what the players may read, on the World View, once the pin is shared.
/// Empty texts and `isShared` false are left out of the file.
public struct MapNote: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    /// The pin's point, world pixels.
    public var x: Double
    public var y: Double
    public var title: String
    /// Never shown to players.
    public var dmNotes: String
    /// Read-aloud text, a handout or a clue: what players see when they open the pin.
    public var playerNotes: String
    /// The pin shows on the World View, where players can open its player notes.
    public var isShared: Bool
    /// Session Console tracks and effects the DM can play from the pin.
    public var sounds: [NoteSound]

    private enum CodingKeys: String, CodingKey {
        case id, x, y, title, dmNotes, playerNotes, isShared, sounds
    }

    public init(
        id: String = newID(), x: Double, y: Double, title: String = "", dmNotes: String = "", playerNotes: String = "",
        isShared: Bool = false, sounds: [NoteSound] = []
    ) {
        self.id = id
        self.x = x
        self.y = y
        self.title = title
        self.dmNotes = dmNotes
        self.playerNotes = playerNotes
        self.isShared = isShared
        self.sounds = sounds
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        x = try c.decode(Double.self, forKey: .x)
        y = try c.decode(Double.self, forKey: .y)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        dmNotes = try c.decodeIfPresent(String.self, forKey: .dmNotes) ?? ""
        playerNotes = try c.decodeIfPresent(String.self, forKey: .playerNotes) ?? ""
        isShared = try c.decodeIfPresent(Bool.self, forKey: .isShared) ?? false
        // A kind this app doesn't know (from a newer one) is skipped, not fatal to the map.
        sounds = (try c.decodeIfPresent([NoteSound.Lossy].self, forKey: .sounds) ?? []).compactMap(\.sound)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(x, forKey: .x)
        try c.encode(y, forKey: .y)
        if !title.isEmpty { try c.encode(title, forKey: .title) }
        if !dmNotes.isEmpty { try c.encode(dmNotes, forKey: .dmNotes) }
        if !playerNotes.isEmpty { try c.encode(playerNotes, forKey: .playerNotes) }
        if isShared { try c.encode(isShared, forKey: .isShared) }
        if !sounds.isEmpty { try c.encode(sounds, forKey: .sounds) }
    }

    /// The title, or "Note" when it has none.
    public var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Note" : trimmed
    }
}

/// A Session Console track or sound effect attached to a note pin, for the DM to play when
/// the moment comes (native only). It refers to the Session Console entry by id; the audio
/// itself stays in the campaign's Session Console, never copied onto the pin.
public struct NoteSound: Codable, Equatable, Sendable {
    public enum Kind: String, Codable, CaseIterable, Sendable {
        case track, sfx
    }

    public var kind: Kind
    /// The Session Console track or effect id.
    public var ref: String
    /// Plays by itself when the DM puts the note on the World View.
    public var playOnShow: Bool

    private enum CodingKeys: String, CodingKey {
        case kind, ref, playOnShow
    }

    public init(kind: Kind, ref: String, playOnShow: Bool = false) {
        self.kind = kind
        self.ref = ref
        self.playOnShow = playOnShow
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = try c.decode(Kind.self, forKey: .kind)
        ref = try c.decode(String.self, forKey: .ref)
        playOnShow = try c.decodeIfPresent(Bool.self, forKey: .playOnShow) ?? false
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind)
        try c.encode(ref, forKey: .ref)
        if playOnShow { try c.encode(playOnShow, forKey: .playOnShow) }
    }

    /// The Session Console command that plays it.
    public var command: SessionCommand {
        switch kind {
        case .track: .playTrack(trackId: ref)
        case .sfx: .fireSfx(sfxId: ref)
        }
    }

    /// Decodes to nil instead of failing, so one unknown sound doesn't lose the note.
    struct Lossy: Decodable {
        let sound: NoteSound?
        init(from decoder: Decoder) throws { sound = try? NoteSound(from: decoder) }
    }
}

extension SessionConsoleCatalog {
    /// The track title or effect label `sound` refers to; nil once it's gone from the Session Console.
    public func title(of sound: NoteSound) -> String? {
        switch sound.kind {
        case .track: trackGroups.lazy.flatMap(\.tracks).first { $0.id == sound.ref }?.title
        case .sfx: sfx.first { $0.id == sound.ref }?.label
        }
    }

    /// Every track and effect a note can play, tracks first, as the Session Console lists them.
    public var noteSoundChoices: [(sound: NoteSound, title: String)] {
        trackGroups.flatMap(\.tracks).map { (NoteSound(kind: .track, ref: $0.id), $0.title) }
            + sfx.map { (NoteSound(kind: .sfx, ref: $0.id), $0.label) }
    }
}

/// Placing and editing note pins (native only).
extension GameMap {
    /// The notes players may see: shared ones only.
    public var sharedNotes: [MapNote] { notes.filter(\.isShared) }

    /// A DM-only note at the centre of the cell under `point`, as lights are placed.
    @discardableResult
    public mutating func placeNote(at point: Point2D, title: String = "") -> MapNote {
        let centre: Point2D
        if gridType.isSquare {
            centre = Point2D(
                x: (point.x / gridSize).rounded(.down) * gridSize + gridSize / 2,
                y: (point.y / gridSize).rounded(.down) * gridSize + gridSize / 2)
        } else {
            centre = snapToGrid(point, gridSize: gridSize, gridType: gridType)
        }
        let note = MapNote(x: centre.x, y: centre.y, title: title)
        notes.append(note)
        return note
    }

    /// The note whose pin is under `point`, topmost first. `sharedOnly` for the World View.
    public func note(at point: Point2D, tolerance: Double, sharedOnly: Bool = false) -> MapNote? {
        notes.last { (!sharedOnly || $0.isShared) && hypot($0.x - point.x, $0.y - point.y) <= tolerance }
    }

    public func noteIDs(intersecting rect: Bounds) -> [String] {
        notes.filter {
            $0.x >= rect.x && $0.x <= rect.x + rect.width && $0.y >= rect.y && $0.y <= rect.y + rect.height
        }.map(\.id)
    }

    /// Moves notes by a map-space offset. With `duplicate`, copies move and originals stay.
    @discardableResult
    public mutating func moveNotes(_ ids: Set<String>, dx: Double, dy: Double, duplicate: Bool) -> [String] {
        var placed: [String] = []
        for index in notes.indices where ids.contains(notes[index].id) {
            var moved = notes[index]
            moved.x += dx
            moved.y += dy
            if duplicate {
                moved.id = newID()
                notes.append(moved)
            } else {
                notes[index] = moved
            }
            placed.append(moved.id)
        }
        return placed
    }

    public mutating func setNotesShared(_ ids: Set<String>, shared: Bool) {
        for index in notes.indices where ids.contains(notes[index].id) { notes[index].isShared = shared }
    }

    /// Applies `change` to the note `id`, if it is on this map.
    public mutating func updateNote(id: String, _ change: (inout MapNote) -> Void) {
        guard let index = notes.firstIndex(where: { $0.id == id }) else { return }
        change(&notes[index])
    }
}
