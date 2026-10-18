import Foundation
import GraphiumCore

/// Typed access to a tool's JSON arguments, with errors the model can act on.
struct Arguments {
    let values: [String: JSONValue]
    /// Where these arguments sit, for error messages ("walls[2]").
    let context: String

    init(_ value: JSONValue, context: String = "") {
        values = value.objectValue ?? [:]
        self.context = context
    }

    private func name(_ key: String) -> String { context.isEmpty ? key : "\(context).\(key)" }

    func has(_ key: String) -> Bool { values[key].map { !$0.isNull } ?? false }

    func string(_ key: String) throws -> String? {
        guard let value = values[key], !value.isNull else { return nil }
        guard let s = value.stringValue else { throw ToolError("\(name(key)) must be a string.") }
        return s
    }

    func requiredString(_ key: String) throws -> String {
        guard let s = try string(key), !s.isEmpty else { throw ToolError("\(name(key)) is required.") }
        return s
    }

    func double(_ key: String) throws -> Double? {
        guard let value = values[key], !value.isNull else { return nil }
        guard let d = value.doubleValue, d.isFinite else { throw ToolError("\(name(key)) must be a number.") }
        return d
    }

    func requiredDouble(_ key: String) throws -> Double {
        guard let d = try double(key) else { throw ToolError("\(name(key)) is required.") }
        return d
    }

    func int(_ key: String) throws -> Int? { try double(key).map { Int($0.rounded()) } }

    func bool(_ key: String) throws -> Bool? {
        guard let value = values[key], !value.isNull else { return nil }
        guard let b = value.boolValue else { throw ToolError("\(name(key)) must be true or false.") }
        return b
    }

    func array(_ key: String) throws -> [JSONValue]? {
        guard let value = values[key], !value.isNull else { return nil }
        guard let a = value.arrayValue else { throw ToolError("\(name(key)) must be an array.") }
        return a
    }

    func requiredArray(_ key: String) throws -> [JSONValue] {
        guard let a = try array(key), !a.isEmpty else { throw ToolError("\(name(key)) needs at least one item.") }
        return a
    }

    /// Each item of an array of objects, as its own `Arguments`.
    func objects(_ key: String) throws -> [Arguments] {
        try requiredArray(key).enumerated().map { index, item in
            guard item.objectValue != nil else { throw ToolError("\(name(key))[\(index)] must be an object.") }
            return Arguments(item, context: "\(name(key))[\(index)]")
        }
    }

    func strings(_ key: String) throws -> [String]? {
        guard let items = try array(key) else { return nil }
        return try items.map {
            guard let s = $0.stringValue else { throw ToolError("\(name(key)) must be an array of strings.") }
            return s
        }
    }

    func enumValue<T: RawRepresentable>(_ key: String, _ type: T.Type, allowed: [String]) throws -> T?
    where T.RawValue == String {
        guard let raw = try string(key) else { return nil }
        let match = allowed.first { $0.caseInsensitiveCompare(raw) == .orderedSame } ?? raw
        guard let value = T(rawValue: match) else {
            throw ToolError("\(name(key)) must be one of: \(allowed.joined(separator: ", ")).")
        }
        return value
    }

    /// A point given as `[x, y]` or `{ "x": …, "y": … }`.
    static func point(_ value: JSONValue, _ label: String) throws -> Point2D {
        if let items = value.arrayValue, items.count == 2, let x = items[0].doubleValue, let y = items[1].doubleValue {
            return Point2D(x: x, y: y)
        }
        if let x = value["x"]?.doubleValue, let y = value["y"]?.doubleValue { return Point2D(x: x, y: y) }
        throw ToolError("\(label) must be a point like [x, y].")
    }

    func points(_ key: String, minimum: Int) throws -> [Point2D] {
        let items = try requiredArray(key)
        let points = try items.enumerated().map { try Self.point($1, "\(name(key))[\($0)]") }
        guard points.count >= minimum else { throw ToolError("\(name(key)) needs at least \(minimum) points.") }
        return points
    }

    func point(_ key: String) throws -> Point2D? {
        guard let value = values[key], !value.isNull else { return nil }
        return try Self.point(value, name(key))
    }
}
