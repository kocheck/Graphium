import Foundation

/// What the World View is showing and playing right now (TS `SessionConsoleRuntime`,
/// CORE_SPEC §1.12). Session-only: rebuilt from the catalog on open, never saved.
/// TS "arming" (a browser autoplay workaround) has no native equivalent and is dropped.
public struct SessionConsoleRuntime: Equatable, Sendable {
    public struct ActiveImage: Equatable, Sendable {
        public var id, src, alt, name: String
    }

    public enum Status: String, Sendable {
        case stopped, playing, paused
    }

    public struct Audio: Equatable, Sendable {
        public var trackId: String?
        public var title = ""
        public var source: TrackSource?
        public var youtubeId: String?
        public var src: String?
        public var status = Status.stopped
        public var loop = true
        /// Bumped by RESTART so players restart even if already playing.
        public var restartSeq = 0
        public var volumeOffset = 0.0
    }

    /// The soundscape playing under the music: which scene, and the DM's level and mute per layer.
    public struct Ambience: Equatable, Sendable {
        public var soundscapeId: String?
        /// Layer id → 0…100. Starts at each layer's own level.
        public var levels: [String: Double] = [:]
        public var muted: Set<String> = []

        public func level(of layer: SoundLayer) -> Double {
            muted.contains(layer.id) ? 0 : levels[layer.id] ?? layer.level
        }
    }

    public var stageVisible = false
    public var activeImage: ActiveImage?
    public var stage: StageChrome
    public var audio = Audio()
    public var ambience = Ambience()
    public var volume: Double
    public var ducked = false
    public var duckPercent: Double
    /// Bumped per FIRE_SFX so the same effect can fire twice in a row.
    public var sfxSeq = 0
    public var sfxId: String?
    public var sfxKind: SfxKind?
    public var sfxSynthType: SynthType?
    public var sfxSrc: String?

    /// TS `sessionConsoleRuntimeFromCatalog`.
    public init(catalog: SessionConsoleCatalog) {
        stage = catalog.stage
        volume = catalog.defaults.volume
        duckPercent = catalog.defaults.duckPercent
    }

    /// TS `copySessionConsoleChrome`: stage and duck% follow catalog edits.
    public mutating func copyChrome(from catalog: SessionConsoleCatalog) {
        stage = catalog.stage
        duckPercent = catalog.defaults.duckPercent
    }

    /// Master level for the soundscape: the volume slider and duck, without a track's offset.
    public var ambienceVolume: Double {
        SessionConsoleAudio.effectiveVolume(volume: volume, ducked: ducked, duckPercent: duckPercent)
    }

    /// Volume the World View should play at now.
    public var effectiveVolume: Double {
        SessionConsoleAudio.effectiveVolume(
            volume: volume, ducked: ducked, offset: audio.volumeOffset, duckPercent: duckPercent)
    }
}

extension SessionConsoleRuntime {
    public var soundscape: Soundscape? { ambience.soundscapeId.flatMap(Soundscape.builtIn(id:)) }

    func playingLayer(_ id: String) -> SoundLayer? { soundscape?.layers.first { $0.id == id } }
}

/// DM transport commands (TS `applyRuntimeCommand`, CORE_SPEC §3.9). Unknown ids and
/// invalid transitions are no-ops; `apply` returns whether anything changed (rule R5).
public enum SessionCommand: Equatable, Sendable {
    case showPlate(imageId: String)
    case returnToMap
    case playTrack(trackId: String)
    case pause, resume, restart, stop
    case setVolume(Double)
    case setDucked(Bool)
    case fireSfx(sfxId: String)
    case playSoundscape(id: String)
    case stopSoundscape
    case setLayerLevel(layerId: String, Double)
    case setLayerMuted(layerId: String, Bool)

    @discardableResult
    public func apply(to runtime: inout SessionConsoleRuntime, catalog: SessionConsoleCatalog) -> Bool {
        let before = runtime
        switch self {
        case .showPlate(let id):
            guard let image = catalog.imageSets.lazy.flatMap(\.images).first(where: { $0.id == id }) else { break }
            runtime.stageVisible = true
            runtime.activeImage = .init(id: image.id, src: image.src, alt: image.alt, name: image.name)
        case .returnToMap:
            if runtime.stageVisible { runtime.stageVisible = false }
        case .playTrack(let id):
            guard let track = catalog.trackGroups.lazy.flatMap(\.tracks).first(where: { $0.id == id }) else { break }
            runtime.audio = .init(
                trackId: track.id, title: track.title, source: track.source, youtubeId: track.youtubeId, src: track.src,
                status: .playing, loop: track.loop, restartSeq: runtime.audio.restartSeq, volumeOffset: track.volumeOffset)
        case .pause:
            if runtime.audio.status == .playing, runtime.audio.trackId != nil { runtime.audio.status = .paused }
        case .resume:
            if runtime.audio.status == .paused, runtime.audio.trackId != nil { runtime.audio.status = .playing }
        case .restart:
            if runtime.audio.trackId != nil {
                runtime.audio.status = .playing
                runtime.audio.restartSeq += 1
            }
        case .stop:
            // The hard cut: music and soundscape both.
            if runtime.audio.status != .stopped { runtime.audio.status = .stopped }
            runtime.ambience.soundscapeId = nil
        case .setVolume(let v):
            runtime.volume = SessionConsoleAudio.clampVolume(v)
        case .setDucked(let d):
            runtime.ducked = d
        case .fireSfx(let id):
            guard let sfx = catalog.sfx.first(where: { $0.id == id }) else { break }
            runtime.sfxSeq += 1
            runtime.sfxId = sfx.id
            runtime.sfxKind = sfx.kind
            runtime.sfxSynthType = sfx.synthType
            runtime.sfxSrc = sfx.src
        case .playSoundscape(let id):
            guard Soundscape.builtIn(id: id) != nil, runtime.ambience.soundscapeId != id else { break }
            runtime.ambience = .init(soundscapeId: id)
        case .stopSoundscape:
            runtime.ambience.soundscapeId = nil
        case .setLayerLevel(let layerId, let level):
            guard runtime.playingLayer(layerId) != nil else { break }
            runtime.ambience.levels[layerId] = SessionConsoleAudio.clampVolume(level)
        case .setLayerMuted(let layerId, let muted):
            guard runtime.playingLayer(layerId) != nil else { break }
            if muted { runtime.ambience.muted.insert(layerId) } else { runtime.ambience.muted.remove(layerId) }
        }
        return runtime != before
    }
}

/// Volume, YouTube and local-audio rules (TS `sessionConsole.ts`, `localAudioLimits.ts`).
public enum SessionConsoleAudio {
    public static func clampVolume(_ v: Double) -> Double { min(100, max(0, v)) }
    public static func clampVolumeOffset(_ v: Double) -> Double { min(30, max(-30, v)) }
    public static func clampDuckPercent(_ v: Double) -> Double { min(100, max(1, v)) }

    /// TS `effectiveVolume`: clamp(volume + offset), then × duck% when ducked.
    public static func effectiveVolume(volume: Double, ducked: Bool, offset: Double = 0, duckPercent: Double = 27) -> Double {
        let level = clampVolume(volume + offset)
        return ducked ? jsRound(level * duckPercent / 100) : level
    }

    public static func isYouTubeHostname(_ host: String) -> Bool {
        let h = host.lowercased().hasPrefix("www.") ? String(host.lowercased().dropFirst(4)) : host.lowercased()
        return ["youtu.be", "youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].contains(h)
    }

    /// A bare YouTube video id: exactly 11 of `A–Z a–z 0–9 _ -`.
    public static func isVideoID<S: StringProtocol>(_ s: S) -> Bool {
        s.count == 11 && s.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_" || $0 == "-") }
    }

    /// TS `parseYouTubeVideoId`: raw 11-char ids, youtu.be/, watch?v=, /shorts/, /embed/, /v/.
    /// Playlist-only and non-YouTube URLs → nil.
    public static func parseYouTubeVideoID(_ input: String) -> String? {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        if isVideoID(text[...]) { return text }
        guard let components = URLComponents(string: text), let host = components.host, isYouTubeHostname(host) else {
            return nil
        }
        let segments = components.path.split(separator: "/")
        if host.lowercased().hasSuffix("youtu.be") {
            return segments.first.flatMap { isVideoID($0) ? String($0) : nil }
        }
        if let v = components.queryItems?.first(where: { $0.name == "v" })?.value, isVideoID(v[...]) { return v }
        if segments.count >= 2, ["shorts", "embed", "v"].contains(segments[0]), isVideoID(segments[1]) {
            return String(segments[1])
        }
        return nil
    }

    public static let allowedAudioExtensions: Set<String> = ["mp3", "ogg", "wav", "m4a"]
    public static let warnBytes = 8 * 1024 * 1024
    public static let maxBytes = 25 * 1024 * 1024

    public enum AudioCheck: Equatable {
        case ok
        /// Allowed, but the campaign gets large.
        case warning(String)
        case rejected(String)
    }

    /// TS `localAudioLimits` (messages verbatim).
    public static func check(audioFileName name: String, byteCount: Int) -> AudioCheck {
        guard allowedAudioExtensions.contains((name as NSString).pathExtension.lowercased()) else {
            return .rejected("Unsupported audio format (mp3, ogg, wav, m4a)")
        }
        if byteCount > maxBytes { return .rejected("Audio file is larger than 25MB and cannot be added to the campaign.") }
        if byteCount > warnBytes { return .warning("This audio file is larger than 8MB and will bloat the campaign zip.") }
        return .ok
    }
}
