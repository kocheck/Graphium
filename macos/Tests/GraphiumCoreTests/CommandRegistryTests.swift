import XCTest

@testable import GraphiumCore

/// Mirrors commandRegistry.test.ts (CORE_SPEC §3.15).
final class CommandRegistryTests: XCTestCase {
    func testRegistersSessionConsoleCommandsWithoutReusingDoorShortcut() {
        let commands = PaletteCommand.registry(isPaused: false)
        XCTAssertEqual(
            commands.filter { $0.id.hasPrefix("session-console-") }.map(\.id),
            ["session-console-stop", "session-console-duck", "session-console-return-to-map",
             "session-console-test-tone", "session-console-settings"])
        XCTAssertNotEqual(commands.first { $0.id == "session-console-duck" }?.shortcut, "D")
    }

    func testPauseLabelFollowsState() {
        XCTAssertEqual(PaletteCommand.registry(isPaused: true).first { $0.id == "world-view-toggle-pause" }?.label, "Resume World View (Play)")
        XCTAssertEqual(PaletteCommand.registry(isPaused: false).first { $0.id == "world-view-toggle-pause" }?.label, "Pause World View")
    }

    func testSearch() {
        let commands = PaletteCommand.registry(isPaused: false)
        XCTAssertEqual(PaletteCommand.search(commands, query: " ").count, commands.count)
        XCTAssertEqual(PaletteCommand.search(commands, query: "wall").first?.id, "tool-wall")
        XCTAssertEqual(PaletteCommand.search(commands, query: "dungeon").first?.id, "dungeon-generate")
        XCTAssertEqual(PaletteCommand.search(commands, query: "actions").count, commands.count)
        XCTAssertTrue(PaletteCommand.search(commands, query: "zzzz").isEmpty)
    }
}
