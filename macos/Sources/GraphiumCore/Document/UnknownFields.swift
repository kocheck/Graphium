import Foundation

/// Any JSON value, kept exactly enough to write it back.
public indirect enum RawJSON: Codable, Equatable, Sendable {
    case null
    case bool(Bool)
    /// Whole numbers stay whole, so `"formatVersion": 1` isn't rewritten as `1.0`.
    case integer(Int64)
    case number(Double)
    case string(String)
    case array([RawJSON])
    case object([String: RawJSON])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int64.self) {
            self = .integer(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([RawJSON].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: RawJSON].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .integer(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }

    var id: String? {
        if case .object(let fields) = self, case .string(let id)? = fields["id"] { return id }
        return nil
    }
}

/// The parts of a `campaign.json` this build doesn't understand: keys written by a newer
/// Graphium, another tool, or a hand edit. They are found when a file is read and put back
/// when it is written, so an older app or MCP server never deletes what it doesn't know
/// (PRINCIPLES.md, "Preserve what you don't own").
///
/// The tree follows the file: `keys` holds unknown keys of one object, `children` the known
/// keys whose values hold unknown keys further down. Array elements are matched by their
/// `"id"` when they have one, so a token's unknown fields follow the token even after
/// others are added or removed; arrays without ids match by position. A known field the
/// DM clears is never brought back, because only keys this build couldn't read are kept.
public struct UnknownFields: Equatable, Sendable {
    public var keys: [String: RawJSON] = [:]
    public var children: [String: UnknownFields] = [:]
    public var byID: [String: UnknownFields] = [:]
    public var byIndex: [Int: UnknownFields] = [:]

    var isEmpty: Bool { keys.isEmpty && children.isEmpty && byID.isEmpty && byIndex.isEmpty }

    /// What `original` (as read) has that `known` (the same file decoded and encoded again by
    /// this build) lost. Nil when nothing was lost.
    public static func diff(original: RawJSON, known: RawJSON) -> UnknownFields? {
        var result = UnknownFields()
        switch (original, known) {
        case (.object(let old), .object(let new)):
            for (key, value) in old {
                if let kept = new[key] {
                    if let child = diff(original: value, known: kept) { result.children[key] = child }
                } else {
                    result.keys[key] = value
                }
            }
        case (.array(let old), .array(let new)):
            let newByID = Dictionary(new.compactMap { item in item.id.map { ($0, item) } }, uniquingKeysWith: { a, _ in a })
            for (index, item) in old.enumerated() {
                if let id = item.id {
                    if let kept = newByID[id], let child = diff(original: item, known: kept) { result.byID[id] = child }
                } else if old.count == new.count, let child = diff(original: item, known: new[index]) {
                    result.byIndex[index] = child
                }
            }
        default:
            break
        }
        return result.isEmpty ? nil : result
    }

    /// Puts the kept keys back into `value` wherever their object still exists. A key this
    /// build now writes itself wins over the kept copy.
    public func merge(into value: inout RawJSON) {
        switch value {
        case .object(var fields):
            for (key, kept) in keys where fields[key] == nil { fields[key] = kept }
            for (key, child) in children {
                guard var nested = fields[key] else { continue }
                child.merge(into: &nested)
                fields[key] = nested
            }
            value = .object(fields)
        case .array(var items):
            for index in items.indices {
                let child = items[index].id.map { byID[$0] } ?? byIndex[index]
                child?.merge(into: &items[index])
            }
            value = .array(items)
        default:
            break
        }
    }
}
