import XCTest

@testable import GraphiumCore

/// Mirrors sessionConsoleReducers.test.ts, sessionConsoleBoard.test.ts,
/// sessionConsole.test.ts and localAudioAsset.test.ts (CORE_SPEC §1.11-1.12, §3.9-3.10).
final class SessionConsoleTests: XCTestCase {
    func catalog() -> SessionConsoleCatalog {
        var c = SessionConsoleCatalog.empty(campaignName: "Crypt")
        c.imageSets = [ImageSet(id: "set", title: "Plates", images: [
            StageImage(id: "img", name: "Gate", cue: "secret", src: "gate.png", thumbnailSrc: "t.png", alt: "A gate")
        ])]
        c.trackGroups = [TrackGroup(id: "grp", title: "Tracks", accent: .dread, tracks: [
            Track(id: "yt", title: "Theme", source: .youtube, youtubeId: "dQw4w9WgXcQ", volumeOffset: 5, loop: false),
            Track(id: "local", title: "Rain", source: .local, src: "rain.mp3"),
        ])]
        return c
    }

    func testRuntimeStartsFromCatalogChrome() {
        var c = catalog()
        c.defaults = AudioDefaults(volume: 60, duckPercent: 40)
        let runtime = SessionConsoleRuntime(catalog: c)
        XCTAssertEqual(runtime.stage.title, "Crypt")
        XCTAssertEqual(runtime.volume, 60)
        XCTAssertEqual(runtime.duckPercent, 40)
        XCTAssertFalse(runtime.stageVisible)
        XCTAssertEqual(runtime.audio.status, .stopped)
    }

    func testShowPlateCopiesPlayerSafeFieldsAndReturnToMapKeepsAudio() {
        let c = catalog()
        var r = SessionConsoleRuntime(catalog: c)
        SessionCommand.playTrack(trackId: "yt").apply(to: &r, catalog: c)
        XCTAssertTrue(SessionCommand.showPlate(imageId: "img").apply(to: &r, catalog: c))
        XCTAssertEqual(r.activeImage, .init(id: "img", src: "gate.png", alt: "A gate", name: "Gate"))
        SessionCommand.returnToMap.apply(to: &r, catalog: c)
        XCTAssertFalse(r.stageVisible)
        XCTAssertEqual(r.audio.status, .playing, "returning to the map doesn't stop audio")
    }

    func testPlayTrackCopiesFieldsAndTransportRules() {
        let c = catalog()
        var r = SessionConsoleRuntime(catalog: c)
        XCTAssertFalse(SessionCommand.pause.apply(to: &r, catalog: c), "nothing playing")
        SessionCommand.playTrack(trackId: "yt").apply(to: &r, catalog: c)
        XCTAssertEqual(r.audio.youtubeId, "dQw4w9WgXcQ")
        XCTAssertEqual(r.audio.volumeOffset, 5)
        XCTAssertFalse(r.audio.loop)
        SessionCommand.pause.apply(to: &r, catalog: c)
        XCTAssertEqual(r.audio.status, .paused)
        SessionCommand.resume.apply(to: &r, catalog: c)
        XCTAssertEqual(r.audio.status, .playing)
        SessionCommand.restart.apply(to: &r, catalog: c)
        XCTAssertEqual(r.audio.restartSeq, 1, "restart while playing still bumps")
        SessionCommand.stop.apply(to: &r, catalog: c)
        XCTAssertEqual(r.audio.status, .stopped)
        XCTAssertEqual(r.audio.trackId, "yt", "stop keeps track info")
    }

    func testUnknownIdsAreNoOps() {
        let c = catalog()
        var r = SessionConsoleRuntime(catalog: c)
        XCTAssertFalse(SessionCommand.showPlate(imageId: "nope").apply(to: &r, catalog: c))
        XCTAssertFalse(SessionCommand.playTrack(trackId: "nope").apply(to: &r, catalog: c))
        XCTAssertFalse(SessionCommand.fireSfx(sfxId: "nope").apply(to: &r, catalog: c))
    }

    func testVolumeDuckAndSfx() {
        let c = catalog()
        var r = SessionConsoleRuntime(catalog: c)
        SessionCommand.setVolume(150).apply(to: &r, catalog: c)
        XCTAssertEqual(r.volume, 100)
        SessionCommand.setDucked(true).apply(to: &r, catalog: c)
        XCTAssertEqual(r.effectiveVolume, 27, "100 × 27%")
        SessionCommand.fireSfx(sfxId: "chime").apply(to: &r, catalog: c)
        SessionCommand.fireSfx(sfxId: "chime").apply(to: &r, catalog: c)
        XCTAssertEqual(r.sfxSeq, 2)
        XCTAssertEqual(r.sfxSynthType, .chime)
    }

    func testEffectiveVolumeAppliesOffsetThenDuck() {
        XCTAssertEqual(SessionConsoleAudio.effectiveVolume(volume: 45, ducked: false, offset: 10), 55)
        XCTAssertEqual(SessionConsoleAudio.effectiveVolume(volume: 95, ducked: false, offset: 10), 100)
        XCTAssertEqual(SessionConsoleAudio.effectiveVolume(volume: 50, ducked: true, offset: 0, duckPercent: 25), 13, "12.5 → 13")
    }

    func testYouTubeParsing() {
        let id = "dQw4w9WgXcQ"
        XCTAssertEqual(SessionConsoleAudio.parseYouTubeVideoID(id), id)
        XCTAssertEqual(SessionConsoleAudio.parseYouTubeVideoID("https://www.youtube.com/watch?v=\(id)&t=3"), id)
        XCTAssertEqual(SessionConsoleAudio.parseYouTubeVideoID("https://youtu.be/\(id)"), id)
        XCTAssertEqual(SessionConsoleAudio.parseYouTubeVideoID("https://youtube.com/shorts/\(id)"), id)
        XCTAssertEqual(SessionConsoleAudio.parseYouTubeVideoID("https://www.youtube-nocookie.com/embed/\(id)"), id)
        XCTAssertNil(SessionConsoleAudio.parseYouTubeVideoID("https://www.youtube.com/playlist?list=PL123"))
        XCTAssertNil(SessionConsoleAudio.parseYouTubeVideoID("https://vimeo.com/\(id)"))
        XCTAssertNil(SessionConsoleAudio.parseYouTubeVideoID("garbage"))
    }

    func testVideoIDValidation() {
        XCTAssertTrue(SessionConsoleAudio.isVideoID("dQw4w9WgXcQ"))
        XCTAssertTrue(SessionConsoleAudio.isVideoID("a-b_c-d_e-f"))
        XCTAssertFalse(SessionConsoleAudio.isVideoID("dQw4w9WgXc"), "too short")
        XCTAssertFalse(SessionConsoleAudio.isVideoID("dQw4w9WgXcQQ"), "too long")
        XCTAssertFalse(SessionConsoleAudio.isVideoID("');alert(1)//"), "script injection")
        XCTAssertFalse(SessionConsoleAudio.isVideoID("dQw4w9WgXc'"), "quote")
        XCTAssertFalse(SessionConsoleAudio.isVideoID("dQw4w9WgXcé"), "non-ASCII")
    }

    func testAudioLimits() {
        XCTAssertEqual(SessionConsoleAudio.check(audioFileName: "bed.mp3", byteCount: 1000), .ok)
        XCTAssertEqual(SessionConsoleAudio.check(audioFileName: "BED.M4A", byteCount: 9 * 1024 * 1024),
                       .warning("This audio file is larger than 8MB and will bloat the campaign zip."))
        XCTAssertEqual(SessionConsoleAudio.check(audioFileName: "bed.mp3", byteCount: 26 * 1024 * 1024),
                       .rejected("Audio file is larger than 25MB and cannot be added to the campaign."))
        XCTAssertEqual(SessionConsoleAudio.check(audioFileName: "bed.exe", byteCount: 10),
                       .rejected("Unsupported audio format (mp3, ogg, wav, m4a)"))
    }

    func testBoardEditingAndReorder() {
        var c = catalog()
        c.addImage(StageImage(id: "img", name: "dup", src: "", thumbnailSrc: ""), toSet: "set")
        XCTAssertEqual(c.imageSets[0].images.count, 1, "image ids are unique across sets")
        let second = c.addNewImageSet()
        XCTAssertEqual(c.imageSets.last?.title, "Plates 2")
        c.reorderImageSets([second])
        XCTAssertEqual(c.imageSets.map(\.id), [second, "set"])
        c.reorderImageSets(["unknown"])
        XCTAssertEqual(c.imageSets.map(\.id), [second, "set"], "unknown id → unchanged")
        c.updateTrack(id: "yt") { $0.volumeOffset = 99 }
        XCTAssertEqual(c.trackGroups[0].tracks[0].volumeOffset, 30)
        c.removeTrack(id: "local")
        XCTAssertEqual(c.allTracks.map(\.id), ["yt"])
        c.updateDefaults(volume: -5, duckPercent: 0)
        XCTAssertEqual(c.defaults.volume, 0)
        XCTAssertEqual(c.defaults.duckPercent, 1)
    }

    func testFallbackLinksKeepIndexContiguous() {
        var c = catalog()
        c.trackGroups[0].tracks.append(Track(title: "Missing", source: .youtube))
        XCTAssertEqual(c.fallbackLinks, """
            1. Theme — https://www.youtube.com/watch?v=dQw4w9WgXcQ
            2. Rain — (local file)
            3. Missing — (local file)
            """)
    }

    func testAddYouTubeCreatesGroupWhenNeeded() {
        var c = SessionConsoleCatalog.empty(campaignName: "x")
        XCTAssertNil(c.addYouTube("not a link"))
        XCTAssertNotNil(c.addYouTube("https://youtu.be/dQw4w9WgXcQ"))
        XCTAssertEqual(c.trackGroups.map(\.title), ["Tracks"])
        XCTAssertEqual(c.allTracks.first?.title, "YouTube dQw4w9WgXcQ")
    }

    func testMergeRemapsCollisionsAndSkipsSeededSfx() {
        var c = catalog()
        var incoming = catalog()
        incoming.trackGroups[0].tracks[0].recommendedImageId = "img"
        c.merge(incoming)
        XCTAssertEqual(c.imageSets.count, 2)
        let newImage = c.imageSets[1].images[0].id
        XCTAssertNotEqual(newImage, "img", "colliding ids get new ids")
        XCTAssertEqual(c.trackGroups[1].tracks[0].recommendedImageId, newImage)
        XCTAssertEqual(c.sfx.count, 5, "seeded SFX are not duplicated")
    }
}
