import Foundation

/// The persisted Session Console catalog: stage chrome, audio defaults, image
/// sets, track groups and sound effects (TS `SessionConsoleCatalog`,
/// CORE_SPEC §1.11). The transient runtime (what's playing) is not persisted.
public struct SessionConsoleCatalog: Codable, Equatable, Sendable {
    public static let defaultVolume = 45.0
    public static let defaultDuckPercent = 27.0

    public var version: Int
    public var stage: StageChrome
    public var defaults: AudioDefaults
    public var imageSets: [ImageSet]
    public var trackGroups: [TrackGroup]
    public var sfx: [SfxDefinition]

    public init(
        version: Int = 1, stage: StageChrome, defaults: AudioDefaults = AudioDefaults(),
        imageSets: [ImageSet] = [], trackGroups: [TrackGroup] = [], sfx: [SfxDefinition] = SfxDefinition.builtIn
    ) {
        self.version = version
        self.stage = stage
        self.defaults = defaults
        self.imageSets = imageSets
        self.trackGroups = trackGroups
        self.sfx = sfx
    }

    /// TS `emptySessionConsoleCatalog(campaignName)`.
    public static func empty(campaignName: String) -> SessionConsoleCatalog {
        SessionConsoleCatalog(stage: StageChrome(title: campaignName))
    }
}

public struct StageChrome: Codable, Equatable, Sendable {
    public var title: String
    public var subtitle: String
    public var showFrame: Bool

    public init(title: String, subtitle: String = "", showFrame: Bool = true) {
        self.title = title
        self.subtitle = subtitle
        self.showFrame = showFrame
    }
}

public struct AudioDefaults: Codable, Equatable, Sendable {
    /// 0…100.
    public var volume: Double
    /// 1…100.
    public var duckPercent: Double

    public init(
        volume: Double = SessionConsoleCatalog.defaultVolume,
        duckPercent: Double = SessionConsoleCatalog.defaultDuckPercent
    ) {
        self.volume = volume
        self.duckPercent = duckPercent
    }
}

public struct ImageSet: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var note: String
    public var images: [StageImage]

    public init(id: String = newID(), title: String, note: String = "", images: [StageImage] = []) {
        self.id = id
        self.title = title
        self.note = note
        self.images = images
    }
}

public struct StageImage: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var cue: String
    public var src: String
    public var thumbnailSrc: String
    public var alt: String

    public init(id: String = newID(), name: String, cue: String = "", src: String, thumbnailSrc: String, alt: String = "") {
        self.id = id
        self.name = name
        self.cue = cue
        self.src = src
        self.thumbnailSrc = thumbnailSrc
        self.alt = alt
    }
}

public enum TrackAccent: String, Codable, CaseIterable, Sendable {
    case bed, road, dread, combat, arrive
}

public struct TrackGroup: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var note: String
    public var accent: TrackAccent
    public var tracks: [Track]

    public init(id: String = newID(), title: String, note: String = "", accent: TrackAccent, tracks: [Track] = []) {
        self.id = id
        self.title = title
        self.note = note
        self.accent = accent
        self.tracks = tracks
    }
}

public enum TrackSource: String, Codable, Sendable {
    case youtube, local
}

public struct Track: Codable, Equatable, Identifiable, Sendable {
    public static let volumeOffsetRange: ClosedRange<Double> = -30...30

    public var id: String
    public var title: String
    public var cue: String
    /// Free text (board default "bed").
    public var tag: String
    public var source: TrackSource
    /// 11 chars `[A-Za-z0-9_-]` when source is YouTube.
    public var youtubeId: String?
    /// Asset reference when source is local.
    public var src: String?
    /// ±30.
    public var volumeOffset: Double
    public var loop: Bool
    public var recommendedImageId: String?

    public init(
        id: String = newID(), title: String, cue: String = "", tag: String = "bed",
        source: TrackSource, youtubeId: String? = nil, src: String? = nil,
        volumeOffset: Double = 0, loop: Bool = true, recommendedImageId: String? = nil
    ) {
        self.id = id
        self.title = title
        self.cue = cue
        self.tag = tag
        self.source = source
        self.youtubeId = youtubeId
        self.src = src
        self.volumeOffset = volumeOffset
        self.loop = loop
        self.recommendedImageId = recommendedImageId
    }
}

public enum SynthType: String, Codable, CaseIterable, Sendable {
    case chime, drone, snap, ping
    case testTone = "test-tone"
}

public enum SfxKind: String, Codable, Sendable {
    case synth, local
}

public struct SfxDefinition: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var label: String
    public var kind: SfxKind
    public var synthType: SynthType? {
        didSet { unknownSynthType = nil }
    }
    public var src: String?
    /// A `synthType` this app doesn't know. TS board packs copy the string unchecked
    /// (sessionConsolePack.ts:636-640), so Electron campaigns can hold any value; it is
    /// kept so a re-export doesn't lose it, and plays nothing here.
    private var unknownSynthType: String?

    private enum CodingKeys: String, CodingKey {
        case id, label, kind, synthType, src
    }

    public init(id: String, label: String, kind: SfxKind, synthType: SynthType? = nil, src: String? = nil) {
        self.id = id
        self.label = label
        self.kind = kind
        self.synthType = synthType
        self.src = src
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        label = try c.decode(String.self, forKey: .label)
        kind = try c.decode(SfxKind.self, forKey: .kind)
        src = try c.decodeIfPresent(String.self, forKey: .src)
        if let raw = try c.decodeIfPresent(String.self, forKey: .synthType) {
            synthType = SynthType(rawValue: raw)
            if synthType == nil { unknownSynthType = raw }
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(label, forKey: .label)
        try c.encode(kind, forKey: .kind)
        try c.encodeIfPresent(synthType?.rawValue ?? unknownSynthType, forKey: .synthType)
        try c.encodeIfPresent(src, forKey: .src)
    }

    /// The five synth effects every new catalog starts with, in order.
    public static let builtIn: [SfxDefinition] = [
        ("chime", "Chime", SynthType.chime), ("drone", "Drone", .drone), ("snap", "Snap", .snap),
        ("ping", "Ping", .ping), ("test-tone", "Test Tone", .testTone),
    ].map { SfxDefinition(id: $0.0, label: $0.1, kind: .synth, synthType: $0.2) }
}
