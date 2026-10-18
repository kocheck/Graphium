import Foundation

/// What a tool call returns: text and images for the model, or an error it can read
/// and act on (MCP reports tool failures as results with `isError`, not as JSON-RPC
/// errors, so the model sees them).
public struct ToolResult: Equatable, Sendable {
    public enum Content: Equatable, Sendable {
        case text(String)
        case png(Data)
    }

    public var content: [Content]
    public var isError = false

    public static func text(_ text: String) -> ToolResult { ToolResult(content: [.text(text)]) }
    public static func json(_ value: JSONValue) -> ToolResult { .text(value.serialized(pretty: true)) }
    public static func error(_ message: String) -> ToolResult { ToolResult(content: [.text(message)], isError: true) }

    var payload: JSONValue {
        let items: [JSONValue] = content.map {
            switch $0 {
            case .text(let text): return ["type": "text", "text": .string(text)]
            case .png(let data): return ["type": "image", "data": .string(data.base64EncodedString()), "mimeType": "image/png"]
            }
        }
        return ["content": .array(items), "isError": .bool(isError)]
    }
}

/// A tool failure with a message written for the model: what was wrong and what to do.
public struct ToolError: Error, Equatable, CustomStringConvertible {
    public var message: String
    public init(_ message: String) { self.message = message }
    public var description: String { message }
}

/// The Model Context Protocol over stdio: one JSON-RPC 2.0 message per line on stdin,
/// replies on stdout, logs on stderr. Handles the lifecycle, tools, resources and
/// prompts; everything Graphium-specific lives in `GraphiumTools`.
public final class MCPServer {
    public static let supportedProtocolVersions = ["2025-06-18", "2025-03-26", "2024-11-05"]

    let tools: GraphiumTools
    let output: (String) -> Void

    public init(tools: GraphiumTools, output: @escaping (String) -> Void) {
        self.tools = tools
        self.output = output
    }

    /// Reads stdin until it closes.
    public func run() {
        while let line = readLine(strippingNewline: true) {
            if let reply = handle(line: line) { output(reply) }
        }
    }

    /// Handles one line; returns the reply line, or nil for notifications.
    public func handle(line: String) -> String? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        let message: JSONValue
        do {
            message = try JSONValue.parse(trimmed)
        } catch {
            return Self.errorReply(id: .null, code: -32700, message: "Parse error: \(error)")
        }
        if case .array(let batch) = message {
            let replies = batch.compactMap { handle(message: $0) }
            return replies.isEmpty ? nil : JSONValue.array(replies).serialized()
        }
        return handle(message: message)?.serialized()
    }

    func handle(message: JSONValue) -> JSONValue? {
        guard let method = message["method"]?.stringValue else {
            // A response to a request we never sent, or junk: nothing to answer.
            return nil
        }
        let id = message["id"]
        let params = message["params"] ?? [:]
        let isNotification = id == nil
        do {
            let result = try dispatch(method: method, params: params)
            guard !isNotification else { return nil }
            return ["jsonrpc": "2.0", "id": id ?? .null, "result": result]
        } catch let error as RPCError {
            guard !isNotification else { return nil }
            return Self.errorObject(id: id ?? .null, code: error.code, message: error.message)
        } catch {
            guard !isNotification else { return nil }
            return Self.errorObject(id: id ?? .null, code: -32603, message: "\(error)")
        }
    }

    struct RPCError: Error {
        var code: Int
        var message: String
    }

    func dispatch(method: String, params: JSONValue) throws -> JSONValue {
        switch method {
        case "initialize":
            let requested = params["protocolVersion"]?.stringValue ?? Self.supportedProtocolVersions[0]
            let version =
                Self.supportedProtocolVersions.contains(requested) ? requested : Self.supportedProtocolVersions[0]
            return [
                "protocolVersion": .string(version),
                "capabilities": [
                    "tools": ["listChanged": false],
                    "resources": ["listChanged": false, "subscribe": false],
                    "prompts": ["listChanged": false],
                ],
                "serverInfo": ["name": "graphium", "title": "Graphium", "version": .string(GraphiumTools.version)],
                "instructions": .string(AgentGuide.instructions),
            ]
        case "ping":
            return [:]
        case "tools/list":
            return ["tools": .array(tools.definitions)]
        case "tools/call":
            guard let name = params["name"]?.stringValue else {
                throw RPCError(code: -32602, message: "tools/call needs a tool name")
            }
            guard tools.has(name) else { throw RPCError(code: -32602, message: "Unknown tool: \(name)") }
            return tools.call(name, arguments: params["arguments"] ?? [:]).payload
        case "resources/list":
            return ["resources": .array(AgentGuide.resources.map(\.listing))]
        case "resources/templates/list":
            return ["resourceTemplates": []]
        case "resources/read":
            guard let uri = params["uri"]?.stringValue, let resource = AgentGuide.resources.first(where: { $0.uri == uri })
            else { throw RPCError(code: -32002, message: "Resource not found") }
            return ["contents": [["uri": .string(resource.uri), "mimeType": "text/markdown", "text": .string(resource.text)]]]
        case "prompts/list":
            return ["prompts": .array(AgentGuide.prompts.map(\.listing))]
        case "prompts/get":
            guard let name = params["name"]?.stringValue, let prompt = AgentGuide.prompts.first(where: { $0.name == name })
            else { throw RPCError(code: -32602, message: "Unknown prompt") }
            var arguments: [String: String] = [:]
            for (key, value) in params["arguments"]?.objectValue ?? [:] {
                arguments[key] = value.stringValue ?? value.serialized()
            }
            return [
                "description": .string(prompt.description),
                "messages": [["role": "user", "content": ["type": "text", "text": .string(prompt.render(arguments))]]],
            ]
        case "logging/setLevel":
            return [:]
        default:
            if method.hasPrefix("notifications/") { return .null }
            throw RPCError(code: -32601, message: "Method not found: \(method)")
        }
    }

    static func errorObject(id: JSONValue, code: Int, message: String) -> JSONValue {
        ["jsonrpc": "2.0", "id": id, "error": ["code": .number(Double(code)), "message": .string(message)]]
    }

    static func errorReply(id: JSONValue, code: Int, message: String) -> String {
        errorObject(id: id, code: code, message: message).serialized()
    }
}
