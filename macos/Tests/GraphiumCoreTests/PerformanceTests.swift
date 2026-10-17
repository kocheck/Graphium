import XCTest

@testable import GraphiumCore

/// Baselines on the TS stress fixture (PARITY §3.15). Set baselines in Xcode
/// (Test navigator > Set Baseline) on the Mac you profile with.
final class PerformanceTests: XCTestCase {
    func testStressFixtureMatchesTSCounts() {
        let map = StressFixture.map()
        XCTAssertEqual(map.tokens.count, 200)
        XCTAssertEqual(map.tokens.filter { $0.type == .pc }.count, 5)
        XCTAssertEqual(map.drawings.filter { $0.tool == .wall }.count, 50)
        XCTAssertEqual(map.drawings.filter { $0.tool == .marker }.count, 200)
    }

    func testLineOfSightOnStressMap() {
        let map = StressFixture.map()
        measure {
            let vision = LineOfSight.polygons(of: map, library: [:])
            _ = LineOfSight.hiddenNPCIDs(of: map, library: [:], polygons: vision.map(\.polygon))
        }
    }

    func testCachedVisibilityIsCheap() {
        let map = StressFixture.map()
        let cache = VisibilityCache()
        _ = cache.visibility(of: map, library: [:])
        measure {
            for _ in 0..<100 { _ = cache.visibility(of: map, library: [:]) }
        }
        XCTAssertEqual(cache.computeCount, 1)
    }

    func testRecordExplorationWithLongFogHistory() {
        let before = StressFixture.map(exploredRegions: 1500)
        var after = before
        after.tokens[0].x += 50
        measure {
            var map = after
            map.recordExploration(since: before, library: [:], timestamp: 1)
        }
    }

    func testDungeonGeneration() {
        measure {
            var rng = SplitMix64(seed: 42)
            _ = DungeonGenerator.generate(DungeonOptions(numRooms: 20), using: &rng)
        }
    }

    func testCampaignEncodeDecode() throws {
        var campaign = Campaign.makeDefault()
        campaign.maps = [StressFixture.map(scale: 3, exploredRegions: 500)]
        campaign.activeMapID = campaign.maps[0].id
        let package = CampaignPackage(campaign: campaign)
        measure {
            let data = try? package.encodeManifest()
            _ = try? CampaignPackage(manifest: data, assets: [:])
        }
    }
}
