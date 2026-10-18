import GraphiumCore
import XCTest

@testable import GraphiumRender

/// The Core Graphics map picture that render_map and the Quick Look extensions draw.
final class MapRendererTests: XCTestCase {
    func testImageFitsMaxPixelsWithAndWithoutLabels() throws {
        var campaign = Campaign.makeDefault(name: "Crypt")
        campaign.maps[0].tokens = [Token(x: 100, y: 100, src: "", type: .npc, name: "Mirela")]
        campaign.maps[0].notes = [MapNote(x: 300, y: 200, title: "Altar")]
        let renderer = MapRenderer(map: campaign.activeMap, campaign: campaign, packageURL: URL(fileURLWithPath: "/nonexistent"))
        for labels in [true, false] {
            let image = try XCTUnwrap(renderer.image(region: nil, maxPixels: 256, playersView: false, labels: labels))
            XCTAssertLessThanOrEqual(max(image.width, image.height), 256)
            XCTAssertGreaterThan(min(image.width, image.height), 0)
        }
        let png = try XCTUnwrap(renderer.png(region: nil, maxPixels: 256, playersView: false))
        XCTAssertEqual(Array(png.prefix(4)), [0x89, 0x50, 0x4E, 0x47])
    }

    func testActiveMapOfPackageReadsTheManifestOrFailsQuietly() throws {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString).appendingPathExtension("graphiumcampaign")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        XCTAssertNil(MapRenderer(activeMapOfPackageAt: folder))

        var campaign = Campaign.makeDefault(name: "Crypt")
        campaign.addMap(named: "Vault")
        try CampaignPackage(campaign: campaign).encodeManifest()
            .write(to: folder.appendingPathComponent(CampaignPackage.manifestFileName))
        let renderer = try XCTUnwrap(MapRenderer(activeMapOfPackageAt: folder))
        XCTAssertEqual(renderer.map.name, "Vault")
        XCTAssertEqual(renderer.campaign.name, "Crypt")
    }
}
