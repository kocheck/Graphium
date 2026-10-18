import XCTest

@testable import GraphiumCore

/// What the Spotlight importer indexes for a campaign package.
final class CampaignSearchTextTests: XCTestCase {
    private func campaign() -> Campaign {
        let goblin = TokenLibraryItem(
            id: "lib-goblin", name: "Goblin", src: "goblin.png", thumbnailSrc: "", dateAdded: 0, defaultType: .npc)
        let wizard = TokenLibraryItem(id: "lib-wizard", name: "Wizard", src: "wizard.png", thumbnailSrc: "", dateAdded: 0)
        var crypt = GameMap(name: "Crypt of Ash")
        crypt.tokens = [
            Token(x: 0, y: 0, src: "goblin.png", libraryItemId: goblin.id),
            Token(x: 50, y: 0, src: "", name: "Mirela Voss", playerName: "Hooded figure"),
            Token(x: 100, y: 0, src: "", name: "  "),
        ]
        crypt.notes = [
            MapNote(
                x: 10, y: 10, title: "Altar", dmNotes: "Brother Aldric hides the key under the altar.",
                playerNotes: "A cold stone altar."),
            MapNote(x: 20, y: 20, dmNotes: "Untitled pin"),
        ]
        var vault = GameMap(name: "Lower Vault")
        vault.tokens = [Token(x: 0, y: 0, src: "goblin.png", libraryItemId: goblin.id)]
        return Campaign(
            name: "Ashen Crown", maps: [crypt, vault], activeMapID: crypt.id, tokenLibrary: [goblin, wizard])
    }

    func testKeywordsAreNamesInOrderWithoutRepeatsOrBlanks() {
        let text = CampaignSearchText(campaign: campaign())
        XCTAssertEqual(text.title, "Ashen Crown")
        XCTAssertEqual(text.mapNames, ["Crypt of Ash", "Lower Vault"])
        XCTAssertEqual(
            text.keywords,
            ["Crypt of Ash", "Goblin", "Mirela Voss", "Hooded figure", "Altar", "Lower Vault", "Wizard"])
    }

    func testTextContentHasTheNotesSoSpotlightFindsAnNPCNamedOnlyThere() {
        let text = CampaignSearchText(campaign: campaign()).textContent
        XCTAssertTrue(text.contains("Brother Aldric"))
        XCTAssertTrue(text.contains("A cold stone altar."))
        XCTAssertTrue(text.contains("Untitled pin"))
        XCTAssertTrue(text.contains("Mirela Voss"))
        XCTAssertTrue(text.hasPrefix("Ashen Crown\n"))
    }

    func testSummaryCountsMaps() {
        XCTAssertEqual(CampaignSearchText(campaign: campaign()).summary, "2 maps: Crypt of Ash, Lower Vault")
        XCTAssertEqual(CampaignSearchText(campaign: .makeDefault()).summary, "1 map: Map 1")
    }

    func testLongNotesAreCapped() {
        var c = Campaign.makeDefault()
        c.maps[0].notes = [MapNote(x: 0, y: 0, dmNotes: String(repeating: "a", count: CampaignSearchText.maxTextLength))]
        XCTAssertEqual(CampaignSearchText(campaign: c).textContent.count, CampaignSearchText.maxTextLength)
    }

    func testReadsCampaignFromAPackageFolder() throws {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString).appendingPathExtension("graphiumcampaign")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        XCTAssertThrowsError(try CampaignPackage.readCampaign(packageAt: folder)) { error in
            XCTAssertEqual(error as? CampaignPackage.FormatError, .missingManifest)
        }
        let original = campaign()
        try CampaignPackage(campaign: original).encodeManifest()
            .write(to: folder.appendingPathComponent(CampaignPackage.manifestFileName))
        XCTAssertEqual(try CampaignPackage.readCampaign(packageAt: folder), original)
    }
}
