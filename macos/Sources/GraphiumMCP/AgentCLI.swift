import Foundation

/// The coding-agent command-line tools Graphium's Agent window can drive (docs/MCP.md, "Agent
/// window"). Graphium never talks to a model itself: it runs the DM's own installed CLI, signed
/// in to the DM's own account, and gives it only Graphium's map tools for the open campaign.
///
/// Every flag and event here was checked against Claude Code 2.1.302 and Codex 0.160.0 on a
/// Mac (2026-10-18); `AgentCLITests` replays lines recorded from them.
public enum AgentKind: String, CaseIterable, Identifiable, Sendable {
    case claudeCode, codex

    public var id: Self { self }

    public var name: String {
        switch self {
        case .claudeCode: return "Claude Code"
        case .codex: return "Codex"
        }
    }

    public var executableName: String {
        switch self {
        case .claudeCode: return "claude"
        case .codex: return "codex"
        }
    }

    /// Who receives what the DM types, named before the first message (PRINCIPLES.md).
    public var provider: String {
        switch self {
        case .claudeCode: return "Anthropic"
        case .codex: return "OpenAI"
        }
    }

    /// Where the installers put the binary. Apps opened from the Dock don't get the shell's
    /// `PATH`, so these are checked along with the login shell's `PATH`.
    public func candidatePaths(home: URL) -> [String] {
        let name = executableName
        let homeBins = [".local/bin", ".claude/local", ".npm-global/bin", ".bun/bin", ".volta/bin"]
        return homeBins.map { home.appendingPathComponent($0).appendingPathComponent(name).path }
            + ["/opt/homebrew/bin/\(name)", "/usr/local/bin/\(name)"]
    }
}

/// One thing the CLI reported while answering, in the form the Agent window shows.
public enum AgentEvent: Equatable, Sendable {
    /// The CLI's conversation id, used to continue the conversation with the next message.
    case session(String)
    /// The tools the CLI says it was given (Claude Code's start-up report).
    case tools([String])
    /// Something went wrong outside a tool that the DM should see; the turn goes on.
    case warning(String)
    /// The turn can't do anything useful (the map tools didn't start), so Graphium stops it.
    case failed(String)
    /// A complete piece of the agent's reply.
    case text(String)
    case toolStarted(id: String, name: String, arguments: String)
    case toolFinished(id: String, isError: Bool, output: String)
    /// The turn is over. `error` explains a failed turn.
    case finished(error: String?)
}

/// Builds the command line for one message and reads the CLI's JSON lines back.
public struct AgentRun: Sendable {
    public var kind: AgentKind
    /// Graphium's MCP server and the only folders it may use: the open campaign's package.
    public var server: ClientSetup
    /// The conversation to continue, from an earlier `.session` event.
    public var session: String?
    /// What the agent should know about the DM's window (which campaign and map are open).
    public var context: String

    public init(kind: AgentKind, server: ClientSetup, session: String? = nil, context: String) {
        self.kind = kind
        self.server = server
        self.session = session
        self.context = context
    }

    /// Tool names as Claude Code reports them: `mcp__graphium__add_rooms`.
    public static let claudeToolPrefix = "mcp__\(ClientSetup.serverName)__"

    /// Arguments after the executable. The message itself goes on standard input (`input`),
    /// so nothing the DM types is read as an option.
    public var arguments: [String] {
        let name = ClientSetup.serverName
        switch kind {
        case .claudeCode:
            let config: JSONValue = [
                "mcpServers": [name: ["command": .string(server.command), "args": .array(server.arguments.map { .string($0) })]],
            ]
            var args = [
                "-p", "--output-format", "stream-json", "--verbose",
                // Only Graphium's server, not the ones the DM set up for other work...
                "--mcp-config", config.serialized(), "--strict-mcp-config",
                // ...none of the DM's settings, hooks or plugins...
                "--setting-sources", "",
                // ...no built-in tools (shell, files, web): the tools list is exactly Graphium's...
                "--tools", "",
                // ...and Graphium's tools run without asking, since nobody can answer a prompt here.
                "--allowedTools", "mcp__\(name)",
                "--append-system-prompt", context,
            ]
            if let session { args += ["--resume", session] }
            return args
        case .codex:
            let options = [
                "--json", "--skip-git-repo-check",
                // Only Graphium's server and no shell. The read-only sandbox alone still lets the
                // shell read the whole disk.
                "--ignore-user-config", "--disable", "shell_tool", "--disable", "unified_exec",
                "-c", #"sandbox_mode="read-only""#,
                "-c", "mcp_servers.\(name).command=\(Self.toml(server.command))",
                "-c", "mcp_servers.\(name).args=[\(server.arguments.map(Self.toml).joined(separator: ","))]",
            ]
            // `exec resume` has no -C or --sandbox, so the folder comes from the working directory.
            if let session { return ["exec", "resume"] + options + [session, "-"] }
            return ["exec"] + options + ["-"]
        }
    }

    /// What to write on standard input. Codex has no flag for extra instructions, so the first
    /// message of a conversation carries them.
    public func input(for message: String) -> String {
        guard kind == .codex, session == nil else { return message }
        return context + "\n\n" + message
    }

    /// A TOML basic string (written as JSON, which escapes the same way) for `-c key=value`.
    static func toml(_ text: String) -> String {
        JSONValue.string(text).serialized()
    }

    /// The events in one line of the CLI's output. Lines that aren't JSON, or events Graphium
    /// doesn't show (hooks, thinking, rate limits), give none.
    public func events(in line: String) -> [AgentEvent] {
        guard let json = try? JSONValue.parse(line) else { return [] }
        switch kind {
        case .claudeCode: return Self.claudeEvents(json)
        case .codex: return Self.codexEvents(json)
        }
    }

    // MARK: Claude Code (`claude -p --output-format stream-json --verbose`)

    static func claudeEvents(_ json: JSONValue) -> [AgentEvent] {
        switch json["type"]?.stringValue {
        case "system" where json["subtype"]?.stringValue == "init":
            var events: [AgentEvent] = []
            if let id = json["session_id"]?.stringValue { events.append(.session(id)) }
            if let tools = json["tools"]?.arrayValue { events.append(.tools(tools.compactMap(\.stringValue))) }
            let graphium = json["mcp_servers"]?.arrayValue?.first { $0["name"]?.stringValue == ClientSetup.serverName }
            if let status = graphium?["status"]?.stringValue, status != "connected" {
                // Without its tools the model improvises (it wrote fake tool calls as text when
                // this was tried), so the turn is stopped rather than shown.
                events.append(.failed(Self.serverFailed))
            }
            return events
        case "assistant":
            // A stand-in message for a failed request ("Not logged in"); the result line explains it.
            if let error = json["error"], !error.isNull { return [] }
            return (json["message"]?["content"]?.arrayValue ?? []).compactMap { block in
                switch block["type"]?.stringValue {
                case "text":
                    guard let text = block["text"]?.stringValue, !text.isEmpty else { return nil }
                    return .text(text)
                case "tool_use":
                    return .toolStarted(
                        id: block["id"]?.stringValue ?? "", name: toolName(block["name"]?.stringValue ?? ""),
                        arguments: block["input"]?.serialized() ?? "{}")
                default:
                    return nil
                }
            }
        case "user":
            return (json["message"]?["content"]?.arrayValue ?? []).compactMap { block in
                guard block["type"]?.stringValue == "tool_result" else { return nil }
                return .toolFinished(
                    id: block["tool_use_id"]?.stringValue ?? "", isError: block["is_error"]?.boolValue ?? false,
                    output: plainText(block["content"]))
            }
        case "result":
            // "Not logged in" arrives as subtype "success" with is_error true, so is_error decides.
            guard json["is_error"]?.boolValue == true else { return [.finished(error: nil)] }
            let message = json["result"]?.stringValue ?? "Claude Code stopped before finishing."
            if message.hasPrefix("Not logged in") {
                return [.finished(error: "Claude Code isn't signed in. Run claude in Terminal and sign in with /login, then try again.")]
            }
            return [.finished(error: message)]
        default:
            return []
        }
    }

    static let serverFailed =
        "Graphium's map tools didn't start, so nothing was changed. Turn Let AI apps build maps off and on in Settings > AI Tools, then try again."

    /// `mcp__graphium__add_rooms` → `add_rooms`.
    static func toolName(_ name: String) -> String {
        name.hasPrefix(claudeToolPrefix) ? String(name.dropFirst(claudeToolPrefix.count)) : name
    }

    /// A tool result's text: a string, or the text blocks of a content array.
    static func plainText(_ value: JSONValue?) -> String {
        switch value {
        case .string(let text): return text
        case .array(let blocks):
            return blocks.compactMap { $0["type"]?.stringValue == "text" ? $0["text"]?.stringValue : nil }
                .joined(separator: "\n")
        default: return ""
        }
    }

    // MARK: Codex (`codex exec --json`)

    static func codexEvents(_ json: JSONValue) -> [AgentEvent] {
        switch json["type"]?.stringValue {
        case "thread.started":
            return json["thread_id"]?.stringValue.map { [.session($0)] } ?? []
        case "item.started", "item.completed":
            guard let item = json["item"] else { return [] }
            let id = item["id"]?.stringValue ?? ""
            let done = json["type"]?.stringValue == "item.completed"
            switch item["type"]?.stringValue {
            case "agent_message":
                guard done, let text = item["text"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty
                else { return [] }
                return [.text(text)]
            case "mcp_tool_call":
                guard done else {
                    return [.toolStarted(id: id, name: item["tool"]?.stringValue ?? "", arguments: item["arguments"]?.serialized() ?? "{}")]
                }
                let error = item["error"].flatMap { $0.isNull ? nil : $0 }
                let failed = item["status"]?.stringValue == "failed" || error != nil
                let output = error.map { $0["message"]?.stringValue ?? $0.serialized() } ?? plainText(item["result"]?["content"])
                return [.toolFinished(id: id, isError: failed, output: output)]
            case "command_execution":
                // Not expected with the shell turned off, but shown if a Codex version brings it back.
                guard done else {
                    return [.toolStarted(id: id, name: "shell", arguments: item["command"]?.stringValue ?? "")]
                }
                let failed = item["status"]?.stringValue == "failed" || (item["exit_code"]?.intValue ?? 0) != 0
                return [.toolFinished(id: id, isError: failed, output: item["aggregated_output"]?.stringValue ?? "")]
            case "error":
                // Codex reports its own transport fallbacks as items; those aren't the DM's problem.
                guard done, let message = item["message"]?.stringValue, !message.hasPrefix("Falling back") else { return [] }
                return [.warning(message)]
            default:
                return []
            }
        case "turn.completed":
            return [.finished(error: nil)]
        case "turn.failed":
            let message = json["error"]?["message"]?.stringValue ?? "Codex stopped before finishing."
            if message.contains("401 Unauthorized") {
                return [.finished(error: "Codex isn't signed in. Run codex login in Terminal, then try again.")]
            }
            return [.finished(error: message)]
        default:
            // Top-level "error" events are retries ("Reconnecting... 2/5"); a real failure ends
            // with turn.failed.
            return []
        }
    }
}
