import Foundation

/// A scene's ambience: looping beds plus pools of short clips fired at random
/// (macos/docs/planning/soundscapes/plan.md). The six built-in scenes play bundled CC0
/// recordings listed in `App/Graphium/Sounds/ledger.json`; they aren't saved in the campaign.
public struct Soundscape: Equatable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var layers: [SoundLayer]

    public init(id: String, title: String, layers: [SoundLayer]) {
        self.id = id
        self.title = title
        self.layers = layers
    }

    public static func builtIn(id: String) -> Soundscape? { builtIn.first { $0.id == id } }
}

public struct SoundLayer: Equatable, Identifiable, Sendable {
    public enum Kind: Equatable, Sendable {
        /// One recording, looped seamlessly.
        case bed(String)
        /// Clips fired one at a time, a random `interval` (seconds) apart.
        case scatter([String], interval: ClosedRange<Double>)
    }

    public var id: String
    public var title: String
    public var kind: Kind
    /// 0…100, the starting level; the DM's slider changes it for the session.
    public var level: Double

    public init(id: String, title: String, kind: Kind, level: Double) {
        self.id = id
        self.title = title
        self.kind = kind
        self.level = level
    }

    public var files: [String] {
        switch kind {
        case .bed(let file): return [file]
        case .scatter(let files, _): return files
        }
    }
}

/// When the next scatter clip plays, which one, and how loud. A shuffle bag never repeats a
/// clip back to back; each firing varies by up to ±3 dB. Seeded, so tests can check bounds.
public struct ScatterSchedule: Sendable {
    public struct Firing: Equatable, Sendable {
        public var delay: Double
        public var file: String
        public var gainDB: Double
    }

    public static let gainJitterDB = 3.0

    private let files: [String]
    private let interval: ClosedRange<Double>
    private var random: SeededRandom
    private var bag: [String] = []
    private var last: String?

    public init(files: [String], interval: ClosedRange<Double>, seed: UInt64) {
        self.files = files
        self.interval = interval
        random = SeededRandom(seed: seed)
    }

    public mutating func next() -> Firing? {
        guard !files.isEmpty else { return nil }
        if bag.isEmpty {
            bag = files.shuffled(using: &random)
            if bag.count > 1, bag.last == last { bag.swapAt(0, bag.count - 1) }
        }
        let file = bag.removeLast()
        last = file
        return Firing(
            delay: Double.random(in: interval, using: &random), file: file,
            gainDB: Double.random(in: -Self.gainJitterDB...Self.gainJitterDB, using: &random))
    }
}

/// SplitMix64: small, fast and reproducible from a seed.
public struct SeededRandom: RandomNumberGenerator, Sendable {
    private var state: UInt64

    public init(seed: UInt64) { state = seed }

    public mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

extension Soundscape {
    /// Levels are starting points, to be set from a recording of the Discord stream (plan.md).
    public static let builtIn: [Soundscape] = [
        Soundscape(
            id: "cave", title: "Cave",
            layers: [
                SoundLayer(id: "cave-air", title: "Cave air", kind: .bed("AMBCave_cave-01_FS343742.m4a"), level: 80),
                SoundLayer(
                    id: "cave-drips", title: "Drips",
                    kind: .scatter(
                        [
                            "WATRDrip_water-drop_FS425209.m4a", "WATRDrip_water-drop_FS457768.m4a",
                            "WATRDrip_water-drop-splash_FS410335.m4a",
                        ], interval: 3...9), level: 45),
                SoundLayer(
                    id: "cave-growls", title: "Something deeper",
                    kind: .scatter(
                        [
                            "CREAMisc_deep-monster-growl_FS222523.m4a", "CREAMisc_beast-breath_FS676477.m4a",
                            "CREAMisc_growl6_FS77637.m4a",
                        ], interval: 30...75), level: 35),
            ]),
        Soundscape(
            id: "tavern", title: "Tavern",
            layers: [
                SoundLayer(
                    id: "tavern-room", title: "Laughter",
                    kind: .bed("AMBRest_tavern-ambience-inside-laughter_FS326313.m4a"), level: 75),
                SoundLayer(
                    id: "tavern-walla", title: "Crowd",
                    kind: .bed("CROWDWalla_small-crowd-pre-concert-talking-party-ba_FS243373.m4a"), level: 50),
                SoundLayer(
                    id: "tavern-table", title: "Mugs and glasses",
                    kind: .scatter(
                        [
                            "FOODGlas_putting-down-a-mug-on-a-table_FS404922.m4a", "FOODGlas_mug-2_FS179997.m4a",
                            "FOODGlas_clinking-glass_FS104815.m4a",
                            "FOODGlas_glass-ding-toast-with-champagne-glasses_FS458408.m4a",
                        ], interval: 4...12), level: 40),
                SoundLayer(
                    id: "tavern-corner", title: "Dice, door, lute",
                    kind: .scatter(
                        [
                            "MOVEMisc_dice-rolling-dungeon-and-dragons_FS177208.m4a",
                            "MOVEMisc_squeaky-wooden-door-solid-close_FS216879.m4a",
                            "MOVEMisc_medieval-lute-chords_FS506266.m4a",
                        ], interval: 15...40), level: 40),
            ]),
        Soundscape(
            id: "forest-night", title: "Forest night",
            layers: [
                SoundLayer(
                    id: "forest-crickets", title: "Crickets",
                    kind: .bed("AMBForst_night-crickets-back-porch_FS333221.m4a"), level: 80),
                SoundLayer(
                    id: "forest-owls", title: "Owls",
                    kind: .scatter(
                        [
                            "BIRDOwl_owl-hoot_FS465697.m4a", "BIRDOwl_owl_FS398734.m4a",
                            "BIRDOwl_owl-hooting_FS415153.m4a",
                        ], interval: 12...35), level: 40),
                SoundLayer(
                    id: "forest-wild", title: "Wolves and snaps",
                    kind: .scatter(
                        [
                            "ANMLWolf_wolf-howl_FS398430.m4a", "ANMLWolf_howling-wolves_FS378334.m4a",
                            "ANMLWolf_branch-breaking-forest-twig-snap-crunch_FS452570.m4a",
                        ], interval: 30...80), level: 35),
            ]),
        Soundscape(
            id: "storm", title: "Storm",
            layers: [
                SoundLayer(
                    id: "storm-rain", title: "Rain", kind: .bed("WEATStorm_thunderstorm-1_FS278867.m4a"), level: 80),
                SoundLayer(
                    id: "storm-thunder", title: "Thunder",
                    kind: .scatter(
                        [
                            "WEATThun_thunder-clap2_FS436794.m4a", "WEATThun_thunder-1-no-reverb_FS327986.m4a",
                            "WEATThun_thunder3_FS475094.m4a",
                        ], interval: 15...45), level: 50),
                SoundLayer(
                    id: "storm-gusts", title: "Gusts",
                    kind: .scatter(
                        [
                            "WINDGust_wind-gust_FS146932.m4a", "WINDGust_gust-of-wind_FS80937.m4a",
                            "WINDGust_winter-winds_FS400992.m4a",
                        ], interval: 8...20), level: 40),
            ]),
        Soundscape(
            id: "dungeon", title: "Dungeon",
            layers: [
                SoundLayer(
                    id: "dungeon-air", title: "Dungeon air",
                    kind: .bed("AMBDungn_dark-dungeon-ambience_FS516566.m4a"), level: 80),
                SoundLayer(
                    id: "dungeon-metal", title: "Gates and doors",
                    kind: .scatter(
                        [
                            "DOORMisc_gate-close-and-rattle_FS494823.m4a", "DOORMisc_keys-rattle6_FS51446.m4a",
                            "DOORMisc_wooden-creak_FS377552.m4a", "DOORMisc_stone-door-close_FS530987.m4a",
                        ], interval: 15...40), level: 40),
                SoundLayer(
                    id: "dungeon-vermin", title: "Rats and bones",
                    kind: .scatter(
                        [
                            "ANMLRodnt_rat-squeak_FS288941.m4a", "ANMLRodnt_rats_FS134791.m4a",
                            "ANMLRodnt_rattling-bones_FS202102.m4a",
                        ], interval: 10...30), level: 35),
            ]),
        Soundscape(
            id: "battle", title: "Battle",
            layers: [
                SoundLayer(
                    id: "battle-field", title: "Melee", kind: .bed("AMBBtl_swordbattle2_FS175951.m4a"), level: 75),
                SoundLayer(
                    id: "battle-swords", title: "Swords",
                    kind: .scatter(
                        [
                            "WEAPSwrd_sword-clash_FS275159.m4a", "WEAPSwrd_sword-clash_FS334169.m4a",
                            "WEAPSwrd_sword-block-combo_FS440069.m4a", "WEAPSwrd_swosh-sword-swing_FS59992.m4a",
                        ], interval: 1.5...5), level: 40),
                SoundLayer(
                    id: "battle-cries", title: "War cries",
                    kind: .scatter(
                        [
                            "VOXBtl_middle-ages-war-cry_FS521830.m4a", "VOXBtl_middle-ages-war-cry-3_FS521831.m4a",
                            "VOXBtl_middle-ages-war-cry-2_FS521832.m4a", "VOXBtl_war-horn_FS539956.m4a",
                        ], interval: 8...20), level: 40),
            ]),
    ]
}
