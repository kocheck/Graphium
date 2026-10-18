import XCTest

@testable import GraphiumCore

final class VideoAssetTests: XCTestCase {
    func testVideoAssetsByExtension() {
        XCTAssertTrue(isVideoAsset("cave.mp4"))
        XCTAssertTrue(isVideoAsset("river.MOV"))
        XCTAssertTrue(isVideoAsset("torches-2.m4v"))
        XCTAssertFalse(isVideoAsset("cave.png"))
        XCTAssertFalse(isVideoAsset("cave.jpg"))
        XCTAssertFalse(isVideoAsset("mp4"))
        XCTAssertFalse(isVideoAsset(""))
    }

    func testWebMIsRecognisedButNotPlayable() {
        XCTAssertTrue(isWebMVideo("lava.webm"))
        XCTAssertTrue(isWebMVideo("Lava.WEBM"))
        XCTAssertFalse(isWebMVideo("lava.mp4"))
        XCTAssertFalse(isVideoAsset("lava.webm"))
    }

    func testUniqueNamesKeepTheVideoExtension() {
        let name = uniqueAssetName(for: "Flowing River (4K).MP4", existing: ["Flowing-River-4K.mp4"])
        XCTAssertEqual(name, "Flowing-River-4K-2.mp4")
        XCTAssertTrue(isVideoAsset(name))
        XCTAssertTrue(CampaignPackage.isValidAssetName(name))
    }
}
