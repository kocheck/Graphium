import XCTest

@testable import GraphiumMCP

/// Settings > AI Tools: the commands it copies and the app configs it edits.
final class ClientSetupTests: XCTestCase {
    let setup = ClientSetup(
        command: "/Users/dm/Library/Application Support/Graphium/bin/graphium-mcp", folders: ["/Users/dm/Documents/Graphium"])

    func testCommandsQuotePathsWithSpaces() {
        XCTAssertEqual(
            setup.snippet(for: .claudeCode),
            "claude mcp add --scope user graphium -- '/Users/dm/Library/Application Support/Graphium/bin/graphium-mcp' "
                + "--root /Users/dm/Documents/Graphium")
        XCTAssertTrue(setup.snippet(for: .codex).hasPrefix("codex mcp add graphium -- '/Users/dm/Library/"))
        XCTAssertEqual(ClientSetup.shellQuoted("it's"), "'it'\\''s'")
    }

    func testJSONSnippetIsAConfigTheAppsRead() throws {
        let data = Data(setup.snippet(for: .claudeDesktop).utf8)
        XCTAssertEqual(setup.state(in: data), .current)
    }

    func testAddingKeepsTheAppsOtherSettings() throws {
        let existing = Data(#"{"theme":"dark","mcpServers":{"other":{"command":"x","args":[]}},"flag":true}"#.utf8)
        XCTAssertEqual(setup.state(in: existing), .missing)
        let added = try setup.adding(to: existing)
        XCTAssertEqual(setup.state(in: added), .current)
        let root = try XCTUnwrap(JSONSerialization.jsonObject(with: added) as? [String: Any])
        XCTAssertEqual(root["theme"] as? String, "dark")
        XCTAssertEqual(root["flag"] as? Bool, true)
        XCTAssertNotNil((root["mcpServers"] as? [String: Any])?["other"])

        let moved = ClientSetup(command: setup.command, folders: ["/Volumes/Games"])
        XCTAssertEqual(moved.state(in: added), .outdated)

        let removed = try ClientSetup.removing(from: added)
        XCTAssertEqual(setup.state(in: removed), .missing)
        XCTAssertNotNil(
            (try JSONSerialization.jsonObject(with: removed) as? [String: Any]).flatMap { $0["mcpServers"] as? [String: Any] }?["other"])
    }

    func testStartsAMissingOrEmptyConfig() throws {
        XCTAssertEqual(setup.state(in: try setup.adding(to: nil)), .current)
        XCTAssertEqual(setup.state(in: try setup.adding(to: Data("\n".utf8))), .current)
    }

    func testLeavesAConfigItCantReadAlone() {
        XCTAssertThrowsError(try setup.adding(to: Data("[1, 2]".utf8)))
        XCTAssertThrowsError(try setup.adding(to: Data(#"{"mcpServers": []}"#.utf8)))
        XCTAssertThrowsError(try setup.adding(to: Data("{not json".utf8)))
    }

    func testOnlyJSONAppsHaveAConfigFile() {
        let home = URL(fileURLWithPath: "/Users/dm")
        XCTAssertEqual(
            MCPClient.claudeDesktop.configFile(home: home)?.path,
            "/Users/dm/Library/Application Support/Claude/claude_desktop_config.json")
        XCTAssertEqual(MCPClient.cursor.configFile(home: home)?.path, "/Users/dm/.cursor/mcp.json")
        XCTAssertNil(MCPClient.claudeCode.configFile(home: home))
        XCTAssertNil(MCPClient.codex.configFile(home: home))
    }
}
