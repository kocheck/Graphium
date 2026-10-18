import XCTest

@testable import GraphiumMCP

/// The Agent window's command lines, and its reading of what Claude Code and Codex print,
/// replayed from recorded runs (`AgentFixtures`).
final class AgentCLITests: XCTestCase {
    let server = ClientSetup(
        command: "/Users/dm/Library/Application Support/Graphium/bin/graphium-mcp",
        folders: ["/Users/dm/Documents/Graphium/Sunken Crypt.graphiumcampaign"])

    func run(_ kind: AgentKind, session: String? = nil) -> AgentRun {
        AgentRun(kind: kind, server: server, session: session, context: "The DM has Sunken Crypt open.")
    }

    func events(_ kind: AgentKind, _ transcript: String) -> [AgentEvent] {
        transcript.split(separator: "\n").flatMap { run(kind).events(in: String($0)) }
    }

    // MARK: Command lines

    func testClaudeGetsOnlyGraphiumsServerAndNoBuiltInTools() throws {
        let args = run(.claudeCode).arguments
        XCTAssertEqual(Array(args.prefix(5)), ["-p", "--output-format", "stream-json", "--verbose", "--mcp-config"])
        let config = try JSONValue.parse(args[5])
        XCTAssertEqual(config["mcpServers"]?["graphium"]?["command"]?.stringValue, server.command)
        XCTAssertEqual(config["mcpServers"]?["graphium"]?["args"], .array(server.arguments.map { .string($0) }))
        XCTAssertEqual(config["mcpServers"]?.objectValue?.count, 1)
        for flag in ["--strict-mcp-config"] { XCTAssertTrue(args.contains(flag)) }
        XCTAssertEqual(args[args.firstIndex(of: "--tools")! + 1], "")
        XCTAssertEqual(args[args.firstIndex(of: "--setting-sources")! + 1], "")
        XCTAssertEqual(args[args.firstIndex(of: "--allowedTools")! + 1], "mcp__graphium")
        XCTAssertFalse(args.contains("--resume"))
        // --tools and --allowedTools take several values, so a flag must follow each.
        XCTAssertTrue(args[args.firstIndex(of: "--allowedTools")! + 2].hasPrefix("--"))
    }

    func testClaudeContinuesItsOwnSession() {
        let args = run(.claudeCode, session: "0c13f656").arguments
        XCTAssertEqual(Array(args.suffix(2)), ["--resume", "0c13f656"])
        XCTAssertEqual(run(.claudeCode).input(for: "Add a room"), "Add a room")
    }

    func testCodexHasNoShellAndOnlyGraphiumsServer() {
        let args = run(.codex).arguments
        XCTAssertEqual(args.first, "exec")
        XCTAssertEqual(args.last, "-")
        XCTAssertTrue(args.contains("--ignore-user-config"))
        XCTAssertTrue(args.contains("--json"))
        XCTAssertTrue(args.contains("shell_tool"))
        XCTAssertTrue(args.contains("unified_exec"))
        XCTAssertTrue(args.contains(#"sandbox_mode="read-only""#))
        XCTAssertTrue(args.contains(#"mcp_servers.graphium.command="/Users/dm/Library/Application Support/Graphium/bin/graphium-mcp""#))
        XCTAssertTrue(args.contains(#"mcp_servers.graphium.args=["--root","/Users/dm/Documents/Graphium/Sunken Crypt.graphiumcampaign"]"#))
    }

    func testCodexResumesWithOptionsBeforeTheThread() {
        let args = run(.codex, session: "01a14f5e").arguments
        XCTAssertEqual(Array(args.prefix(2)), ["exec", "resume"])
        XCTAssertEqual(Array(args.suffix(2)), ["01a14f5e", "-"])
        XCTAssertFalse(args.contains("-C"))
        XCTAssertFalse(args.contains("--sandbox"))
    }

    func testCodexGetsTheContextWithTheFirstMessageOnly() {
        XCTAssertEqual(run(.codex).input(for: "Add a room"), "The DM has Sunken Crypt open.\n\nAdd a room")
        XCTAssertEqual(run(.codex, session: "x").input(for: "Add a room"), "Add a room")
    }

    func testTOMLStringsEscapeQuotes() {
        XCTAssertEqual(AgentRun.toml(#"/Users/d"m/x"#), #""/Users/d\"m/x""#)
    }

    // MARK: Claude Code output

    func testClaudeBuildRun() {
        let events = events(.claudeCode, AgentFixtures.claudeBuild)
        XCTAssertEqual(events.first, .session("0c13f656-f590-424f-b02b-01fc8b45703c"))
        guard case .tools(let tools) = events[1] else { return XCTFail("no tools") }
        XCTAssertTrue(tools.allSatisfy { $0.hasPrefix("mcp__graphium__") })
        let calls = events.compactMap { event -> String? in
            if case .toolStarted(_, let name, _) = event { return name }
            return nil
        }
        XCTAssertEqual(calls, ["create_campaign", "add_rooms"])
        XCTAssertTrue(events.contains { if case .toolFinished("toolu_01FJmDys3nYmgzPMP7Nd1G4S", false, let output) = $0 { return output.contains("rooms") } else { return false } })
        XCTAssertTrue(events.contains { if case .text(let text) = $0 { return text.hasPrefix("I created the") } else { return false } })
        XCTAssertEqual(events.last, .finished(error: nil))
        XCTAssertFalse(events.contains { if case .warning = $0 { return true } else { return false } })
    }

    func testClaudeNotSignedIn() {
        let events = events(.claudeCode, AgentFixtures.claudeNoauth)
        XCTAssertFalse(events.contains { if case .text = $0 { return true } else { return false } })
        guard case .finished(let error?) = events.last else { return XCTFail("no error") }
        XCTAssertTrue(error.contains("isn't signed in"))
    }

    func testClaudeInterruptedReportsAnError() {
        let events = events(.claudeCode, AgentFixtures.claudeCancel)
        guard case .finished(let error?) = events.last else { return XCTFail("no error") }
        XCTAssertFalse(error.isEmpty)
    }

    func testClaudeStopsWhenTheMapToolsDidntStart() {
        let events = events(.claudeCode, AgentFixtures.claudeMcpfail)
        XCTAssertTrue(events.contains(.failed(AgentRun.serverFailed)))
        XCTAssertLessThan(events.firstIndex(of: .failed(AgentRun.serverFailed))!, events.firstIndex { if case .text = $0 { return true } else { return false } }!)
    }

    // MARK: Codex output

    func testCodexBuildRun() {
        let events = events(.codex, AgentFixtures.codexBuild)
        XCTAssertEqual(events.first, .session("01a14f5e-efb6-7dc2-9341-375b10eaacf0"))
        let calls = events.compactMap { event -> String? in
            if case .toolStarted(_, let name, _) = event { return name }
            return nil
        }
        XCTAssertEqual(calls, ["list_campaigns", "create_campaign", "add_rooms", "render_map"])
        XCTAssertTrue(events.contains { if case .toolFinished("item_3", false, let output) = $0 { return output.contains("rooms") } else { return false } })
        XCTAssertEqual(events.last, .finished(error: nil))
    }

    func testCodexResumeKeepsTheThread() {
        let first = events(.codex, AgentFixtures.codexBuild).first
        XCTAssertEqual(events(.codex, AgentFixtures.codexResume).first, first)
    }

    func testCodexNotSignedInIsOneMessage() {
        let events = events(.codex, AgentFixtures.codexNoauth)
        XCTAssertFalse(events.contains { if case .warning = $0 { return true } else { return false } })
        guard case .finished(let error?) = events.last else { return XCTFail("no error") }
        XCTAssertTrue(error.contains("isn't signed in"))
    }

    func testCodexInterruptedJustEnds() {
        let events = events(.codex, AgentFixtures.codexCancel)
        XCTAssertFalse(events.contains { if case .finished = $0 { return true } else { return false } })
    }

    func testLinesThatArentJSONAreIgnored() {
        XCTAssertEqual(run(.claudeCode).events(in: "Reading additional input from stdin..."), [])
        XCTAssertEqual(run(.codex).events(in: ""), [])
    }
}
