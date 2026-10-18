import Foundation

/// Any JSON value. MCP messages and tool arguments are free-form JSON, so the server
/// works with this instead of a Codable type per message.
public enum JSONValue: Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public subscript(key: String) -> JSONValue? {
        if case .object(let o) = self { return o[key] }
        return nil
    }

    public var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    public var doubleValue: Double? {
        switch self {
        case .number(let n): return n
        case .string(let s): return Double(s)
        default: return nil
        }
    }

    public var intValue: Int? { doubleValue.map { Int($0) } }

    public var boolValue: Bool? {
        switch self {
        case .bool(let b): return b
        case .string(let s): return s == "true" ? true : s == "false" ? false : nil
        default: return nil
        }
    }

    public var arrayValue: [JSONValue]? {
        if case .array(let a) = self { return a }
        return nil
    }

    public var objectValue: [String: JSONValue]? {
        if case .object(let o) = self { return o }
        return nil
    }

    public var isNull: Bool { self == .null }

    /// JSON text with sorted keys. Whole numbers print without a fraction.
    public func serialized(pretty: Bool = false) -> String {
        var out = ""
        JSONWriter(pretty: pretty).write(self, into: &out, indent: 0)
        return out
    }

    public static func parse(_ text: String) throws -> JSONValue {
        var parser = JSONParser(Array(text.utf8))
        return try parser.parseDocument()
    }
}

/// A small JSON reader and writer. Foundation's decoders bridge numbers and booleans
/// differently across OS versions (1 can decode as `true`), and MCP arguments must keep
/// the type the client sent, so the server reads and writes JSON itself.
struct JSONParser {
    struct SyntaxError: Error, CustomStringConvertible {
        var offset: Int
        var description: String { "Invalid JSON at byte \(offset)" }
    }

    private let bytes: [UInt8]
    private var i = 0

    init(_ bytes: [UInt8]) { self.bytes = bytes }

    mutating func parseDocument() throws -> JSONValue {
        let value = try parseValue(depth: 0)
        skipSpace()
        guard i == bytes.count else { throw SyntaxError(offset: i) }
        return value
    }

    private mutating func skipSpace() {
        while i < bytes.count, [0x20, 0x09, 0x0A, 0x0D].contains(bytes[i]) { i += 1 }
    }

    private mutating func expect(_ literal: String) throws {
        for byte in literal.utf8 {
            guard i < bytes.count, bytes[i] == byte else { throw SyntaxError(offset: i) }
            i += 1
        }
    }

    private mutating func parseValue(depth: Int) throws -> JSONValue {
        guard depth < 256 else { throw SyntaxError(offset: i) }
        skipSpace()
        guard i < bytes.count else { throw SyntaxError(offset: i) }
        switch bytes[i] {
        case UInt8(ascii: "n"): try expect("null"); return .null
        case UInt8(ascii: "t"): try expect("true"); return .bool(true)
        case UInt8(ascii: "f"): try expect("false"); return .bool(false)
        case UInt8(ascii: "\""): return .string(try parseString())
        case UInt8(ascii: "["):
            i += 1
            var items: [JSONValue] = []
            skipSpace()
            if i < bytes.count, bytes[i] == UInt8(ascii: "]") { i += 1; return .array(items) }
            while true {
                items.append(try parseValue(depth: depth + 1))
                skipSpace()
                guard i < bytes.count else { throw SyntaxError(offset: i) }
                if bytes[i] == UInt8(ascii: ",") { i += 1; continue }
                if bytes[i] == UInt8(ascii: "]") { i += 1; return .array(items) }
                throw SyntaxError(offset: i)
            }
        case UInt8(ascii: "{"):
            i += 1
            var members: [String: JSONValue] = [:]
            skipSpace()
            if i < bytes.count, bytes[i] == UInt8(ascii: "}") { i += 1; return .object(members) }
            while true {
                skipSpace()
                guard i < bytes.count, bytes[i] == UInt8(ascii: "\"") else { throw SyntaxError(offset: i) }
                let key = try parseString()
                skipSpace()
                try expect(":")
                members[key] = try parseValue(depth: depth + 1)
                skipSpace()
                guard i < bytes.count else { throw SyntaxError(offset: i) }
                if bytes[i] == UInt8(ascii: ",") { i += 1; continue }
                if bytes[i] == UInt8(ascii: "}") { i += 1; return .object(members) }
                throw SyntaxError(offset: i)
            }
        default:
            return .number(try parseNumber())
        }
    }

    private mutating func parseNumber() throws -> Double {
        let start = i
        while i < bytes.count, "+-0123456789.eE".utf8.contains(bytes[i]) { i += 1 }
        guard i > start, let text = String(bytes: bytes[start..<i], encoding: .utf8), let value = Double(text),
            value.isFinite
        else { throw SyntaxError(offset: start) }
        return value
    }

    private mutating func parseHex4() throws -> UInt32 {
        guard i + 4 <= bytes.count, let text = String(bytes: bytes[i..<i + 4], encoding: .utf8),
            let value = UInt32(text, radix: 16)
        else { throw SyntaxError(offset: i) }
        i += 4
        return value
    }

    private mutating func parseString() throws -> String {
        i += 1  // opening quote
        var scalars = String.UnicodeScalarView()
        var run: [UInt8] = []
        func flush() {
            if !run.isEmpty {
                scalars.append(contentsOf: String(decoding: run, as: UTF8.self).unicodeScalars)
                run.removeAll()
            }
        }
        while i < bytes.count {
            let byte = bytes[i]
            if byte == UInt8(ascii: "\"") {
                i += 1
                flush()
                return String(scalars)
            }
            if byte == UInt8(ascii: "\\") {
                flush()
                i += 1
                guard i < bytes.count else { break }
                let escape = bytes[i]
                i += 1
                switch escape {
                case UInt8(ascii: "\""): scalars.append("\"")
                case UInt8(ascii: "\\"): scalars.append("\\")
                case UInt8(ascii: "/"): scalars.append("/")
                case UInt8(ascii: "b"): scalars.append("\u{08}")
                case UInt8(ascii: "f"): scalars.append("\u{0C}")
                case UInt8(ascii: "n"): scalars.append("\n")
                case UInt8(ascii: "r"): scalars.append("\r")
                case UInt8(ascii: "t"): scalars.append("\t")
                case UInt8(ascii: "u"):
                    var code = try parseHex4()
                    if (0xD800..<0xDC00).contains(code), i + 1 < bytes.count, bytes[i] == UInt8(ascii: "\\"),
                        bytes[i + 1] == UInt8(ascii: "u")
                    {
                        i += 2
                        let low = try parseHex4()
                        code = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00)
                    }
                    scalars.append(Unicode.Scalar(code) ?? "\u{FFFD}")
                default: throw SyntaxError(offset: i - 1)
                }
                continue
            }
            run.append(byte)
            i += 1
        }
        throw SyntaxError(offset: i)
    }
}

struct JSONWriter {
    var pretty: Bool

    func write(_ value: JSONValue, into out: inout String, indent: Int) {
        switch value {
        case .null: out += "null"
        case .bool(let b): out += b ? "true" : "false"
        case .number(let n): out += Self.format(n)
        case .string(let s): Self.writeString(s, into: &out)
        case .array(let items):
            if items.isEmpty { out += "[]"; return }
            out += "["
            for (index, item) in items.enumerated() {
                if index > 0 { out += "," }
                newline(&out, indent + 1)
                write(item, into: &out, indent: indent + 1)
            }
            newline(&out, indent)
            out += "]"
        case .object(let members):
            if members.isEmpty { out += "{}"; return }
            out += "{"
            for (index, key) in members.keys.sorted().enumerated() {
                if index > 0 { out += "," }
                newline(&out, indent + 1)
                Self.writeString(key, into: &out)
                out += pretty ? ": " : ":"
                write(members[key]!, into: &out, indent: indent + 1)
            }
            newline(&out, indent)
            out += "}"
        }
    }

    private func newline(_ out: inout String, _ indent: Int) {
        guard pretty else { return }
        out += "\n" + String(repeating: "  ", count: indent)
    }

    static func format(_ n: Double) -> String {
        guard n.isFinite else { return "null" }
        if n.rounded() == n, abs(n) < 1e15 { return String(Int64(n)) }
        return String(n)
    }

    static func writeString(_ s: String, into out: inout String) {
        out += "\""
        for scalar in s.unicodeScalars {
            switch scalar {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            default:
                if scalar.value < 0x20 {
                    out += String(format: "\\u%04x", scalar.value)
                } else {
                    out.unicodeScalars.append(scalar)
                }
            }
        }
        out += "\""
    }
}

extension JSONValue: ExpressibleByStringLiteral, ExpressibleByBooleanLiteral, ExpressibleByIntegerLiteral,
    ExpressibleByFloatLiteral, ExpressibleByArrayLiteral, ExpressibleByDictionaryLiteral
{
    public init(stringLiteral value: String) { self = .string(value) }
    public init(booleanLiteral value: Bool) { self = .bool(value) }
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
    public init(floatLiteral value: Double) { self = .number(value) }
    public init(arrayLiteral elements: JSONValue...) { self = .array(elements) }
    public init(dictionaryLiteral elements: (String, JSONValue)...) {
        self = .object(Dictionary(elements, uniquingKeysWith: { _, last in last }))
    }
}

extension JSONValue {
    /// A number rounded to 3 decimals, so cell coordinates read cleanly.
    static func rounded(_ value: Double) -> JSONValue {
        .number((value * 1000).rounded() / 1000)
    }

    static func point(_ x: Double, _ y: Double) -> JSONValue {
        .array([rounded(x), rounded(y)])
    }
}
