import XCTest

@testable import GraphiumCore

final class LegacyExporterTests: XCTestCase {
    func testZipWriterRoundTripsThroughReader() throws {
        var writer = ZipWriter()
        try writer.add("manifest.json", Data("{}".utf8))
        try writer.add("assets/é.bin", Data([0, 1, 2, 255]))
        let zip = try ZipArchive(data: writer.finish())
        XCTAssertEqual(zip.entries["manifest.json"], Data("{}".utf8))
        XCTAssertEqual(zip.entries["assets/é.bin"], Data([0, 1, 2, 255]))
    }

    func testExportRoundTripsMapOrderAndAssets() throws {
        var zeta = GameMap(name: "Zeta")
        zeta.id = "zeta-map"
        zeta.tokens = [Token(id: "t", x: 10, y: 20, src: "goblin.png")]
        zeta.background = MapBackground(src: "cave.jpg", width: 100, height: 80)
        var alpha = GameMap(name: "Alpha")
        alpha.id = "alpha-map"
        var campaign = Campaign(name: "Ashen", maps: [zeta, alpha], activeMapID: "alpha-map")
        campaign.tokenLibrary = []
        let package = CampaignPackage(
            campaign: campaign, assets: ["goblin.png": Data([1, 2]), "cave.jpg": Data([3]), "unused.png": Data([9])])

        let data = try LegacyExporter.export(package)
        let zip = try ZipArchive(data: data)
        XCTAssertNil(zip.entries["assets/unused.png"], "only referenced assets are written")
        let manifest = String(decoding: zip.entries["manifest.json"]!, as: UTF8.self)
        XCTAssertTrue(manifest.contains(#""src":"assets/goblin.png""#))
        XCTAssertEqual(JSONKeyOrder.keysOfTopLevelObject("maps", in: zip.entries["manifest.json"]!), ["zeta-map", "alpha-map"])

        let back = try LegacyImporter.importArchive(data)
        XCTAssertEqual(back.missingAssets, [])
        XCTAssertEqual(back.package.campaign, campaign)
        XCTAssertEqual(back.package.assets, ["goblin.png": Data([1, 2]), "cave.jpg": Data([3])])
    }
}
