import XCTest

@testable import GraphiumCore

final class LegacyImporterTests: XCTestCase {
    func testZipReaderInflatesDeflateEntriesAndChecksCRC() throws {
        let zip = try ZipArchive(data: Fixtures.modernGraphium)
        XCTAssertEqual(zip.entries["assets/goblin.webp"], Data((0...255).map { UInt8($0) }).repeated(4))
        XCTAssertNil(zip.entries["assets/"], "directory entries are skipped")
    }

    func testZipReaderRejectsNonZip() {
        XCTAssertThrowsError(try ZipArchive(data: Data("not a zip".utf8))) {
            XCTAssertEqual($0 as? ZipArchive.ZipError, .notAZip)
        }
    }

    func testZipReaderDetectsCorruptedData() {
        var bytes = [UInt8](Fixtures.legacyGraphium)
        // Flip a byte inside the stored manifest payload: the first local header is
        // 30 bytes + "manifest.json" (13), so the data starts at offset 43.
        bytes[50] ^= 0xFF
        XCTAssertThrowsError(try ZipArchive(data: Data(bytes)))
    }

    func testKeyOrderScannerKeepsFileOrder() {
        let json = #"{"a":{"x":[1,{"}":"]"}]},"maps":{"z":{"k":"v"},"bA":1,"m":[1,2]},"c":true}"#
        XCTAssertEqual(JSONKeyOrder.keysOfTopLevelObject("maps", in: Data(json.utf8)), ["z", "bA", "m"])
        XCTAssertNil(JSONKeyOrder.keysOfTopLevelObject("absent", in: Data(json.utf8)))
    }

    func testImportsModernCampaignPreservingMapOrderAndAssets() throws {
        let result = try LegacyImporter.importArchive(Fixtures.modernGraphium)
        let campaign = result.package.campaign

        XCTAssertEqual(campaign.name, "Ashen Crown")
        XCTAssertEqual(campaign.maps.map(\.id), ["zeta-map", "alpha-map"])
        XCTAssertEqual(campaign.activeMapID, "alpha-map")

        let alpha = campaign.activeMap
        XCTAssertEqual(alpha.gridType, .hexagonal)
        XCTAssertEqual(alpha.gridSize, 70)
        XCTAssertTrue(alpha.isDaylightMode)
        XCTAssertEqual(alpha.tokens.first?.src, "goblin.webp")
        XCTAssertEqual(alpha.tokens.first?.type, .npc)
        XCTAssertEqual(alpha.doors.first?.isLocked, true)
        XCTAssertEqual(alpha.drawings.first?.tool, .wall)
        XCTAssertEqual(alpha.exploredRegions.first?.points, [Point2D(x: 1, y: 2)])
        XCTAssertEqual(campaign.maps[0].gridSize, 50, "zeta's gridSize 0 falls back to 50")

        XCTAssertEqual(campaign.tokenLibrary.first?.thumbnailSrc, "thumb-goblin.webp")
        let tracks = campaign.sessionConsole.trackGroups[0].tracks
        XCTAssertEqual(tracks[0].src, "rain.mp3")
        XCTAssertEqual(tracks[1].youtubeId, "dQw4w9WgXcQ")
        XCTAssertNil(tracks[1].src)

        XCTAssertEqual(Set(result.package.assets.keys), ["goblin.webp", "thumb-goblin.webp", "rain.mp3"])
        XCTAssertEqual(alpha.background?.src, "assets/missing.webp", "missing assets are kept as-is")
        XCTAssertEqual(result.missingAssets, ["assets/missing.webp"])
    }

    func testImportedCampaignRoundTripsThroughNativeFormat() throws {
        let package = try LegacyImporter.importArchive(Fixtures.modernGraphium).package
        let reopened = try CampaignPackage(manifest: package.encodeManifest(), assets: package.assets)
        XCTAssertEqual(reopened, package)
    }

    func testMigratesPreCampaignSingleMapFile() throws {
        let result = try LegacyImporter.importArchive(Fixtures.legacyGraphium)
        let campaign = result.package.campaign
        XCTAssertEqual(campaign.name, "Imported Campaign")
        XCTAssertEqual(campaign.maps.count, 1)
        XCTAssertEqual(campaign.activeMap.name, "Imported Map")
        XCTAssertEqual(campaign.activeMap.gridSize, 40)
        XCTAssertEqual(campaign.activeMap.gridType, .dots)
        XCTAssertNil(campaign.activeMap.background)
        XCTAssertEqual(campaign.activeMap.tokens.first?.src, "hero.png")
        XCTAssertEqual(campaign.sessionConsole.stage.title, "Imported Campaign")
        XCTAssertEqual(result.package.assets["hero.png"], Data("png".utf8))
        XCTAssertTrue(result.missingAssets.isEmpty)
    }

    func testRejectsManifestThatIsNotAnObject() throws {
        XCTAssertThrowsError(try LegacyImporter.importManifest(Data("[]".utf8), zipAssets: [:]))
    }
}

extension Data {
    fileprivate func repeated(_ times: Int) -> Data {
        var out = Data()
        for _ in 0..<times { out.append(self) }
        return out
    }
}
