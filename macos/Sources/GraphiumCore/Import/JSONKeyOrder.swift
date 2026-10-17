import Foundation

/// Recovers the key order of a JSON object, which `JSONSerialization` and
/// `JSONDecoder` drop. Legacy campaigns store maps as an id-keyed object whose
/// insertion order is the navigator order (CORE_SPEC §1.2).
enum JSONKeyOrder {
    /// Keys, in file order, of the object at top-level key `key`; nil if absent or not an object.
    static func keysOfTopLevelObject(_ key: String, in data: Data) -> [String]? {
        var scanner = Scanner(bytes: [UInt8](data))
        scanner.skipWhitespace()
        guard scanner.consume(UInt8(ascii: "{")) else { return nil }
        while true {
            scanner.skipWhitespace()
            guard let name = scanner.readString() else { return nil }
            scanner.skipWhitespace()
            guard scanner.consume(UInt8(ascii: ":")) else { return nil }
            scanner.skipWhitespace()
            if name == key { return scanner.readObjectKeys() }
            guard scanner.skipValue() else { return nil }
            scanner.skipWhitespace()
            guard scanner.consume(UInt8(ascii: ",")) else { return nil }
        }
    }

    private struct Scanner {
        let bytes: [UInt8]
        var index = 0

        init(bytes: [UInt8]) { self.bytes = bytes }

        var current: UInt8? { index < bytes.count ? bytes[index] : nil }

        mutating func skipWhitespace() {
            while let c = current, c == 0x20 || c == 0x0A || c == 0x0D || c == 0x09 { index += 1 }
        }

        mutating func consume(_ byte: UInt8) -> Bool {
            guard current == byte else { return false }
            index += 1
            return true
        }

        /// Reads a JSON string literal and decodes its escapes.
        mutating func readString() -> String? {
            let start = index
            guard skipString() else { return nil }
            return try? JSONDecoder().decode(String.self, from: Data(bytes[start..<index]))
        }

        mutating func skipString() -> Bool {
            guard consume(UInt8(ascii: "\"")) else { return false }
            while let c = current {
                index += 1
                if c == UInt8(ascii: "\\") {
                    index += 1
                } else if c == UInt8(ascii: "\"") {
                    return true
                }
            }
            return false
        }

        mutating func skipValue() -> Bool {
            switch current {
            case UInt8(ascii: "\""): return skipString()
            case UInt8(ascii: "{"), UInt8(ascii: "["):
                var depth = 0
                while let c = current {
                    if c == UInt8(ascii: "\"") {
                        guard skipString() else { return false }
                        continue
                    }
                    index += 1
                    if c == UInt8(ascii: "{") || c == UInt8(ascii: "[") { depth += 1 }
                    if c == UInt8(ascii: "}") || c == UInt8(ascii: "]") {
                        depth -= 1
                        if depth == 0 { return true }
                    }
                }
                return false
            case nil: return false
            default:
                // number, true, false, null
                while let c = current, c != UInt8(ascii: ","), c != UInt8(ascii: "}"), c != UInt8(ascii: "]"),
                    c != 0x20, c != 0x0A, c != 0x0D, c != 0x09
                {
                    index += 1
                }
                return true
            }
        }

        mutating func readObjectKeys() -> [String]? {
            guard consume(UInt8(ascii: "{")) else { return nil }
            var keys: [String] = []
            skipWhitespace()
            if consume(UInt8(ascii: "}")) { return keys }
            while true {
                skipWhitespace()
                guard let key = readString() else { return nil }
                keys.append(key)
                skipWhitespace()
                guard consume(UInt8(ascii: ":")) else { return nil }
                skipWhitespace()
                guard skipValue() else { return nil }
                skipWhitespace()
                if consume(UInt8(ascii: "}")) { return keys }
                guard consume(UInt8(ascii: ",")) else { return nil }
            }
        }
    }
}
