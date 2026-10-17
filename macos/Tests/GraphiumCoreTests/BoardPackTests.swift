import XCTest

@testable import GraphiumCore

/// Mirrors sessionConsolePack.test.ts (CORE_SPEC §3.11).
final class BoardPackTests: XCTestCase {
    let example = """
        {
          "version": 1, "kind": "graphium.sessionConsolePack",
          "stage": { "title": "Ashen Crown", "subtitle": "Act I", "showFrame": false },
          "defaults": { "volume": 60, "duckPercent": 30 },
          "imageSets": [
            { "id": "act-1", "title": "Act I", "images": [
              { "id": "gate", "name": "Iron Gate", "src": "./images/gate.png" },
              { "id": "bad", "src": "https://youtu.be/dQw4w9WgXcQ" }
            ]},
            "nope"
          ],
          "trackGroups": [
            { "id": "amb", "title": "Ambience", "accent": "dread", "tracks": [
              { "title": "Theme", "src": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "recommendedImage": "iron gate" },
              { "title": "Rain", "src": "audio/rain.mp3", "volumeOffset": 99, "loop": false },
              { "title": "Bad", "src": "ftp://example.com/x.mp3" }
            ]},
            { "title": "Odd", "accent": "jazz", "tracks": [] }
          ],
          "sfx": [
            { "id": "chime", "label": "Bell", "kind": "synth", "synthType": "ping" },
            { "id": "creak", "kind": "local", "src": "audio/creak.ogg" },
            { "id": "lost", "kind": "local" }
          ]
        }
        """

    func testParseCollectsRowErrorsAndKeepsTheRest() {
        let (pack, errors) = BoardPack.parse(Data(example.utf8))
        XCTAssertEqual(pack.stage.title, "Ashen Crown")
        XCTAssertFalse(pack.stage.showFrame)
        XCTAssertEqual(pack.defaults.volume, 60)
        XCTAssertEqual(pack.imageSets.count, 1)
        XCTAssertEqual(pack.imageSets[0].images.map(\.id), ["gate"])
        XCTAssertEqual(pack.trackGroups[0].tracks.map(\.title), ["Theme", "Rain"])
        XCTAssertEqual(pack.trackGroups[1].id, "track-group-2")
        XCTAssertEqual(pack.trackGroups[1].accent, .bed)
        XCTAssertTrue(errors.contains("imageSets[1] is not an object"))
        XCTAssertTrue(errors.contains("Image \"bad\": must be a file or http src"))
        XCTAssertTrue(errors.contains { $0.hasPrefix("Track \"Bad\": unsupported scheme") })
        XCTAssertTrue(errors.contains { $0.contains("unknown accent") })
    }

    func testRejectsWrongKindOrVersion() {
        XCTAssertEqual(BoardPack.parse(Data("[]".utf8)).errors, ["Pack JSON must be an object"])
        XCTAssertEqual(BoardPack.parse(Data(#"{"kind":"x","version":1}"#.utf8)).errors, ["Expected kind \"graphium.sessionConsolePack\""])
        XCTAssertEqual(BoardPack.parse(Data(#"{"kind":"graphium.sessionConsolePack","version":2}"#.utf8)).errors, ["Expected pack version 1"])
    }

    func testClassify() {
        XCTAssertEqual(BoardPack.classify("dQw4w9WgXcQ"), .youtube("dQw4w9WgXcQ"))
        XCTAssertEqual(BoardPack.classify("./images/a.png"), .relative("./images/a.png"))
        XCTAssertEqual(BoardPack.classify("a.png"), .relative("a.png"))
        XCTAssertEqual(BoardPack.classify("/Users/dm/a.png"), .absolute("/Users/dm/a.png"))
        XCTAssertEqual(BoardPack.classify("file:///Users/dm/a.png"), .absolute("/Users/dm/a.png"))
        XCTAssertEqual(BoardPack.classify("//server/share/a.png"), .invalid("network path is not allowed"))
        XCTAssertEqual(BoardPack.classify("\\\\server\\a.png"), .invalid("network path is not allowed"))
        XCTAssertEqual(BoardPack.classify("https://127.0.0.1/a.png"), .invalid("remote file host is not allowed"))
        XCTAssertEqual(BoardPack.classify("http://example.com/a.png"), .invalid("remote file host is not allowed"))
        XCTAssertEqual(BoardPack.classify("https://www.youtube.com/playlist?list=x"), .invalid("youtube URL is missing a video id"))
        XCTAssertEqual(BoardPack.classify("https://cdn.example.com/a.png"), .http(URL(string: "https://cdn.example.com/a.png")!))
        XCTAssertEqual(BoardPack.classify(""), .invalid("empty src"))
    }

    func testSafeHosts() {
        for bad in ["https://localhost/x", "https://10.0.0.1/x", "https://172.20.1.1/x", "https://192.168.1.1/x",
                    "https://169.254.169.254/x", "https://metadata.google.internal/x", "https://fdn.example.com/x"] {
            XCTAssertFalse(BoardPack.isSafeHTTPURL(URL(string: bad)!), bad)
        }
        XCTAssertTrue(BoardPack.isSafeHTTPURL(URL(string: "https://172.32.0.1/x")!))
    }

    func testPathInsideRoot() {
        XCTAssertTrue(BoardPack.isInside(root: "/packs/a", path: "images/x.png"))
        XCTAssertFalse(BoardPack.isInside(root: "/packs/a", path: "../b/x.png"))
        XCTAssertFalse(BoardPack.isInside(root: "/packs/a", path: "/etc/passwd"))
    }

    func testMaterialize() async {
        let pack = BoardPack.parse(Data(example.utf8)).pack
        var resolved: [String] = []
        var persisted: [String] = []
        let result = await BoardPack.materialize(
            pack,
            resolveFile: { path in
                resolved.append(path)
                return path.contains("creak") ? .skip("file is larger than 25MB") : .data(Data([1]), fileName: (path as NSString).lastPathComponent)
            },
            fetch: nil,
            persist: { _, name in
                persisted.append(name)
                return "asset-\(name)"
            })
        let catalog = result.catalog
        XCTAssertEqual(catalog.stage.subtitle, "Act I")
        XCTAssertEqual(catalog.imageSets[0].images[0].src, "asset-gate.png")
        let tracks = catalog.allTracks
        XCTAssertEqual(tracks[0].youtubeId, "dQw4w9WgXcQ")
        XCTAssertEqual(tracks[0].recommendedImageId, "gate", "matched by lowercased name")
        XCTAssertEqual(tracks[1].src, "asset-rain.mp3")
        XCTAssertEqual(tracks[1].volumeOffset, 30)
        XCTAssertEqual(tracks.map(\.id), ["theme", "rain"])
        XCTAssertEqual(catalog.sfx.first { $0.id == "chime" }?.label, "Bell", "same-id SFX replaces the seeded one in place")
        XCTAssertEqual(catalog.sfx.first?.id, "chime")
        XCTAssertTrue(result.skipped.contains("SFX \"creak\": file is larger than 25MB"))
        XCTAssertTrue(result.skipped.contains("SFX \"lost\": local clip is missing src"))
        XCTAssertEqual(resolved.count, Set(resolved).count, "each src resolved once")
    }

    func testHTTPCapAndFailure() async {
        var pack = BoardPack.Pack()
        pack.imageSets = [.init(id: "s", title: "S", note: "", images: [
            .init(id: "big", name: "big", cue: "", src: "https://cdn.example.com/big.png", alt: ""),
            .init(id: "down", name: "down", cue: "", src: "https://cdn.example.com/down.png", alt: ""),
        ])]
        let result = await BoardPack.materialize(
            pack, resolveFile: { _ in nil },
            fetch: { url in url.lastPathComponent == "big.png" ? .tooLarge : .failed },
            persist: { _, n in n })
        XCTAssertEqual(result.skipped, [
            "Image \"big\": remote file is larger than 25MB", "Image \"down\": failed to fetch remote file",
        ])
    }

    func testExportWritesWatchURLsAndSanitizedPaths() throws {
        var catalog = SessionConsoleCatalog.empty(campaignName: "x")
        catalog.imageSets = [ImageSet(title: "S", images: [StageImage(id: "../evil", name: "e", src: "e.webp", thumbnailSrc: "e.webp")])]
        catalog.trackGroups = [TrackGroup(title: "T", accent: .bed, tracks: [
            Track(id: "yt", title: "Y", source: .youtube, youtubeId: "dQw4w9WgXcQ"),
            Track(id: "rain", title: "R", source: .local, src: "rain.ogg"),
        ])]
        catalog.sfx.append(SfxDefinition(id: "creak", label: "Creak", kind: .local, src: "creak.wav"))
        let export = try BoardPack.export(catalog)
        let text = String(decoding: export.boardJSON, as: UTF8.self)
        XCTAssertTrue(text.contains("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        XCTAssertTrue(text.hasSuffix("\n"))
        XCTAssertEqual(export.files.map { $0.path }, ["images/evil.webp", "audio/rain.ogg", "audio/creak.wav"])
        XCTAssertEqual(BoardPack.sanitizeExportID(".."), "asset")
        // The export re-imports.
        XCTAssertTrue(BoardPack.parse(export.boardJSON).errors.isEmpty)
    }
}
