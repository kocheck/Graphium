import XCTest

@testable import GraphiumCore

/// Soundscapes: the runtime commands, the scatter schedule, and the bundled files
/// (macos/docs/planning/soundscapes/plan.md).
final class SoundscapeTests: XCTestCase {
    let catalog = SessionConsoleCatalog.empty(campaignName: "Crypt")

    func testPlayLevelMuteAndStop() {
        var r = SessionConsoleRuntime(catalog: catalog)
        XCTAssertTrue(SessionCommand.playSoundscape(id: "cave").apply(to: &r, catalog: catalog))
        XCTAssertEqual(r.soundscape?.title, "Cave")
        let drips = r.soundscape!.layers[1]
        XCTAssertEqual(r.ambience.level(of: drips), drips.level, "layers start at their own level")

        SessionCommand.setLayerLevel(layerId: drips.id, 130).apply(to: &r, catalog: catalog)
        XCTAssertEqual(r.ambience.level(of: drips), 100, "levels clamp to 0…100")
        SessionCommand.setLayerMuted(layerId: drips.id, true).apply(to: &r, catalog: catalog)
        XCTAssertEqual(r.ambience.level(of: drips), 0)
        SessionCommand.setLayerMuted(layerId: drips.id, false).apply(to: &r, catalog: catalog)
        XCTAssertEqual(r.ambience.level(of: drips), 100)

        XCTAssertFalse(SessionCommand.playSoundscape(id: "cave").apply(to: &r, catalog: catalog), "already playing")
        XCTAssertTrue(SessionCommand.playSoundscape(id: "storm").apply(to: &r, catalog: catalog))
        XCTAssertEqual(r.ambience.levels, [:], "a new scene starts from its own levels")

        XCTAssertTrue(SessionCommand.stop.apply(to: &r, catalog: catalog))
        XCTAssertNil(r.soundscape, "Stop is the hard cut for the soundscape too")
    }

    func testUnknownScenesAndLayersAreNoOps() {
        var r = SessionConsoleRuntime(catalog: catalog)
        XCTAssertFalse(SessionCommand.playSoundscape(id: "nope").apply(to: &r, catalog: catalog))
        XCTAssertFalse(SessionCommand.setLayerLevel(layerId: "cave-drips", 50).apply(to: &r, catalog: catalog))
        SessionCommand.playSoundscape(id: "cave").apply(to: &r, catalog: catalog)
        XCTAssertFalse(SessionCommand.setLayerMuted(layerId: "storm-rain", true).apply(to: &r, catalog: catalog))
        XCTAssertTrue(SessionCommand.stopSoundscape.apply(to: &r, catalog: catalog))
        XCTAssertFalse(SessionCommand.stopSoundscape.apply(to: &r, catalog: catalog))
    }

    func testAmbienceFollowsVolumeAndDuckButNotTrackOffset() {
        var r = SessionConsoleRuntime(catalog: catalog)
        r.volume = 60
        r.audio.volumeOffset = 20
        XCTAssertEqual(r.ambienceVolume, 60)
        r.ducked = true
        XCTAssertEqual(r.ambienceVolume, SessionConsoleAudio.effectiveVolume(volume: 60, ducked: true, duckPercent: 27))
    }

    func testScatterStaysInBoundsAndNeverRepeatsBackToBack() {
        let files = ["a", "b", "c"]
        var schedule = ScatterSchedule(files: files, interval: 4...11, seed: 42)
        var previous: String?
        for _ in 0..<500 {
            let firing = schedule.next()!
            XCTAssertTrue((4...11).contains(firing.delay))
            XCTAssertLessThanOrEqual(abs(firing.gainDB), ScatterSchedule.gainJitterDB)
            XCTAssertTrue(files.contains(firing.file))
            XCTAssertNotEqual(firing.file, previous)
            previous = firing.file
        }
    }

    func testScatterIsReproducibleFromItsSeed() {
        var a = ScatterSchedule(files: ["a", "b"], interval: 1...2, seed: 7)
        var b = ScatterSchedule(files: ["a", "b"], interval: 1...2, seed: 7)
        for _ in 0..<20 { XCTAssertEqual(a.next(), b.next()) }
        var single = ScatterSchedule(files: ["only"], interval: 1...2, seed: 1)
        XCTAssertEqual(single.next()?.file, "only")
        var empty = ScatterSchedule(files: [], interval: 1...2, seed: 1)
        XCTAssertNil(empty.next())
    }

    /// Every file a built-in scene names is bundled and has a CC0 row in the rights ledger.
    func testBuiltInScenesUseLedgeredSounds() throws {
        let sounds = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("App/Graphium/Sounds")
        let rows = try JSONSerialization.jsonObject(with: Data(contentsOf: sounds.appendingPathComponent("ledger.json")))
            as! [[String: Any]]
        let licensed = Dictionary(uniqueKeysWithValues: rows.map { ($0["file"] as! String, $0["license"] as! String) })
        XCTAssertEqual(Set(Soundscape.builtIn.map(\.id)).count, Soundscape.builtIn.count)
        for scene in Soundscape.builtIn {
            XCTAssertEqual(Set(scene.layers.map(\.id)).count, scene.layers.count, scene.id)
            for file in scene.layers.flatMap(\.files) {
                XCTAssertEqual(licensed[file], "CC0-1.0", file)
                XCTAssertTrue(FileManager.default.fileExists(atPath: sounds.appendingPathComponent(file).path), file)
            }
        }
    }
}
