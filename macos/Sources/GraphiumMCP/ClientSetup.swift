import Foundation

/// The AI apps Graphium can set up to use its MCP server, and the settings each one needs.
/// Graphium's Settings > AI Tools pane and `scripts/build-mcp.sh` describe the same setup.
public enum MCPClient: String, CaseIterable, Identifiable, Sendable {
    case claudeCode, codex, claudeDesktop, cursor

    public var id: Self { self }

    public var name: String {
        switch self {
        case .claudeCode: return "Claude Code"
        case .codex: return "Codex"
        case .claudeDesktop: return "Claude Desktop"
        case .cursor: return "Cursor"
        }
    }

    /// The JSON file Graphium can add itself to, for apps configured that way. Claude Code
    /// and Codex are set up from their own command line instead.
    public func configFile(home: URL) -> URL? {
        switch self {
        case .claudeDesktop:
            return home.appendingPathComponent("Library/Application Support/Claude/claude_desktop_config.json")
        case .cursor:
            return home.appendingPathComponent(".cursor/mcp.json")
        case .claudeCode, .codex:
            return nil
        }
    }
}

/// How an AI app starts graphium-mcp: the program and the folders it may use.
public struct ClientSetup: Equatable, Sendable {
    /// The name the server is registered under in every app.
    public static let serverName = "graphium"

    public var command: String
    public var folders: [String]

    public init(command: String, folders: [String]) {
        self.command = command
        self.folders = folders
    }

    public var arguments: [String] { folders.flatMap { ["--root", $0] } }

    /// What to paste for `client`: a Terminal command, or the config to add by hand.
    public func snippet(for client: MCPClient) -> String {
        let words = ([command] + arguments).map(Self.shellQuoted).joined(separator: " ")
        switch client {
        case .claudeCode:
            return "claude mcp add --scope user \(Self.serverName) -- \(words)"
        case .codex:
            return "codex mcp add \(Self.serverName) -- \(words)"
        case .claudeDesktop, .cursor:
            let config: [String: Any] = ["mcpServers": [Self.serverName: entry]]
            let data = (try? JSONSerialization.data(withJSONObject: config, options: Self.writing)) ?? Data()
            return String(decoding: data, as: UTF8.self)
        }
    }

    private var entry: [String: Any] { ["command": command, "args": arguments] }

    private static let writing: JSONSerialization.WritingOptions = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]

    public enum ConfigError: Error, LocalizedError, Equatable {
        case notAnObject

        public var errorDescription: String? {
            "The app's settings file isn't in the expected format, so Graphium left it alone. Add the settings by hand."
        }
    }

    /// Whether a JSON config (contents of `configFile`) has Graphium, and set up like this.
    public enum State: Equatable, Sendable {
        case missing, current, outdated
    }

    public func state(in config: Data?) -> State {
        guard let config, let root = try? JSONSerialization.jsonObject(with: config) as? [String: Any],
            let servers = root["mcpServers"] as? [String: Any], let existing = servers[Self.serverName] as? [String: Any]
        else { return .missing }
        let same = existing["command"] as? String == command && existing["args"] as? [String] == arguments
        return same ? .current : .outdated
    }

    /// `config` with Graphium's server added or updated, everything else kept.
    public func adding(to config: Data?) throws -> Data {
        var root = try Self.root(of: config)
        guard var servers = (root["mcpServers"] ?? [String: Any]()) as? [String: Any] else { throw ConfigError.notAnObject }
        servers[Self.serverName] = entry
        root["mcpServers"] = servers
        return try JSONSerialization.data(withJSONObject: root, options: Self.writing)
    }

    /// `config` without Graphium's server, everything else kept.
    public static func removing(from config: Data?) throws -> Data {
        var root = try Self.root(of: config)
        if var servers = root["mcpServers"] as? [String: Any] {
            servers[serverName] = nil
            root["mcpServers"] = servers
        }
        return try JSONSerialization.data(withJSONObject: root, options: writing)
    }

    private static func root(of config: Data?) throws -> [String: Any] {
        guard let config, !String(decoding: config, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return [:] }
        guard let root = try JSONSerialization.jsonObject(with: config) as? [String: Any] else { throw ConfigError.notAnObject }
        return root
    }

    /// Quotes a word for zsh/bash when it needs it.
    static func shellQuoted(_ word: String) -> String {
        let safe = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_./=:@+,")
        if !word.isEmpty, word.unicodeScalars.allSatisfy(safe.contains) { return word }
        return "'" + word.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}
