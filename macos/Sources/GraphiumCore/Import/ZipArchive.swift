import Foundation

#if canImport(Compression)
    import Compression
#endif

/// Minimal read-only ZIP reader for legacy `.graphium` files: central directory,
/// STORE and DEFLATE entries, CRC-32 checked. No ZIP64, encryption or multi-disk
/// (JSZip never writes those for files this size).
public struct ZipArchive {
    /// Entry path → uncompressed bytes. Directory entries are skipped.
    public let entries: [String: Data]

    /// Refuse entries that would inflate beyond this (guards against zip bombs).
    public static let maxEntrySize = 1 << 30

    public enum ZipError: Error, Equatable {
        case notAZip
        case unsupported(String)
        case corrupt(String)
    }

    public init(data: Data) throws {
        let bytes = [UInt8](data)
        guard let eocd = Self.findEndOfCentralDirectory(bytes) else { throw ZipError.notAZip }
        let count = Int(bytes.u16(eocd + 10))
        let directoryOffset = Int(bytes.u32(eocd + 16))
        guard bytes.u32(eocd + 16) != 0xFFFF_FFFF, count != 0xFFFF else { throw ZipError.unsupported("ZIP64") }

        var result: [String: Data] = [:]
        var cursor = directoryOffset
        for _ in 0..<count {
            guard cursor + 46 <= bytes.count, bytes.u32(cursor) == 0x0201_4b50 else {
                throw ZipError.corrupt("central directory")
            }
            let flags = bytes.u16(cursor + 8)
            let method = bytes.u16(cursor + 10)
            let crc = bytes.u32(cursor + 16)
            let compressedSize = Int(bytes.u32(cursor + 20))
            let size = Int(bytes.u32(cursor + 24))
            let nameLength = Int(bytes.u16(cursor + 28))
            let extraLength = Int(bytes.u16(cursor + 30))
            let commentLength = Int(bytes.u16(cursor + 32))
            let localOffset = Int(bytes.u32(cursor + 42))
            guard cursor + 46 + nameLength <= bytes.count else { throw ZipError.corrupt("entry name") }
            let name = String(decoding: bytes[(cursor + 46)..<(cursor + 46 + nameLength)], as: UTF8.self)
            cursor += 46 + nameLength + extraLength + commentLength

            if name.hasSuffix("/") { continue }
            guard flags & 0x1 == 0 else { throw ZipError.unsupported("encrypted entry \(name)") }
            guard size <= Self.maxEntrySize else { throw ZipError.unsupported("entry too large: \(name)") }

            guard localOffset + 30 <= bytes.count, bytes.u32(localOffset) == 0x0403_4b50 else {
                throw ZipError.corrupt("local header for \(name)")
            }
            let start = localOffset + 30 + Int(bytes.u16(localOffset + 26)) + Int(bytes.u16(localOffset + 28))
            guard start + compressedSize <= bytes.count else { throw ZipError.corrupt("data for \(name)") }
            let payload = Array(bytes[start..<(start + compressedSize)])

            let contents: [UInt8]
            switch method {
            case 0: contents = payload
            case 8: contents = try Self.inflate(payload, expectedSize: size, name: name)
            default: throw ZipError.unsupported("compression method \(method) for \(name)")
            }
            guard contents.count == size, CRC32.checksum(contents) == crc else {
                throw ZipError.corrupt("checksum for \(name)")
            }
            result[name] = Data(contents)
        }
        entries = result
    }

    private static func findEndOfCentralDirectory(_ bytes: [UInt8]) -> Int? {
        guard bytes.count >= 22 else { return nil }
        let lowest = max(0, bytes.count - 22 - 0xFFFF)
        var index = bytes.count - 22
        while index >= lowest {
            if bytes.u32(index) == 0x0605_4b50 { return index }
            index -= 1
        }
        return nil
    }

    private static func inflate(_ input: [UInt8], expectedSize: Int, name: String) throws -> [UInt8] {
        #if canImport(Compression)
            if expectedSize == 0 { return [] }
            var output = [UInt8](repeating: 0, count: expectedSize)
            // COMPRESSION_ZLIB is raw DEFLATE (RFC 1951), which is what ZIP stores.
            let written = output.withUnsafeMutableBufferPointer { out in
                input.withUnsafeBufferPointer { inp in
                    compression_decode_buffer(
                        out.baseAddress!, expectedSize, inp.baseAddress!, input.count, nil, COMPRESSION_ZLIB)
                }
            }
            guard written == expectedSize else { throw ZipError.corrupt("deflate stream for \(name)") }
            return output
        #else
            throw ZipError.unsupported("DEFLATE on this platform")
        #endif
    }
}

enum CRC32 {
    private static let table: [UInt32] = (0..<256).map { n -> UInt32 in
        var c = UInt32(n)
        for _ in 0..<8 { c = (c & 1) != 0 ? 0xEDB8_8320 ^ (c >> 1) : c >> 1 }
        return c
    }

    static func checksum(_ bytes: [UInt8]) -> UInt32 {
        var crc: UInt32 = 0xFFFF_FFFF
        for byte in bytes { crc = table[Int((crc ^ UInt32(byte)) & 0xFF)] ^ (crc >> 8) }
        return crc ^ 0xFFFF_FFFF
    }
}

extension Array where Element == UInt8 {
    fileprivate func u16(_ i: Int) -> UInt16 {
        guard i + 1 < count else { return 0 }
        return UInt16(self[i]) | UInt16(self[i + 1]) << 8
    }

    fileprivate func u32(_ i: Int) -> UInt32 {
        guard i + 3 < count else { return 0 }
        return UInt32(self[i]) | UInt32(self[i + 1]) << 8 | UInt32(self[i + 2]) << 16 | UInt32(self[i + 3]) << 24
    }
}

/// Minimal ZIP writer (STORE only) for exporting legacy `.graphium` files. Images
/// and audio are already compressed, so DEFLATE would buy little. No ZIP64:
/// archives must stay under 4 GB.
public struct ZipWriter {
    private var body: [UInt8] = []
    private var directory: [UInt8] = []
    private var count = 0

    public enum WriteError: Error, Equatable {
        case tooLarge
    }

    public init() {}

    public mutating func add(_ path: String, _ data: Data) throws {
        let name = Array(path.utf8)
        let bytes = [UInt8](data)
        guard body.count + bytes.count + name.count + 30 < 0xFFFF_FFFF, count < 0xFFFF else { throw WriteError.tooLarge }
        let crc = CRC32.checksum(bytes)
        let offset = UInt32(body.count)
        let size = UInt32(bytes.count)
        // Local file header. Flag bit 11: names are UTF-8.
        body.le32(0x0403_4b50)
        body.le16(20)
        body.le16(0x0800)
        body.le16(0)
        body.le16(0)
        body.le16(0x21)  // 1980-01-01 00:00, a fixed time keeps exports reproducible
        body.le32(crc)
        body.le32(size)
        body.le32(size)
        body.le16(UInt16(name.count))
        body.le16(0)
        body += name
        body += bytes
        // Central directory entry.
        directory.le32(0x0201_4b50)
        directory.le16(20)
        directory.le16(20)
        directory.le16(0x0800)
        directory.le16(0)
        directory.le16(0)
        directory.le16(0x21)
        directory.le32(crc)
        directory.le32(size)
        directory.le32(size)
        directory.le16(UInt16(name.count))
        directory.le16(0)
        directory.le16(0)
        directory.le16(0)
        directory.le16(0)
        directory.le32(0)
        directory.le32(offset)
        directory += name
        count += 1
    }

    public func finish() -> Data {
        var out = body
        out += directory
        out.le32(0x0605_4b50)
        out.le16(0)
        out.le16(0)
        out.le16(UInt16(count))
        out.le16(UInt16(count))
        out.le32(UInt32(directory.count))
        out.le32(UInt32(body.count))
        out.le16(0)
        return Data(out)
    }
}

extension Array where Element == UInt8 {
    fileprivate mutating func le16(_ v: UInt16) {
        append(UInt8(v & 0xFF))
        append(UInt8(v >> 8))
    }

    fileprivate mutating func le32(_ v: UInt32) {
        for shift in stride(from: 0, to: 32, by: 8) { append(UInt8((v >> UInt32(shift)) & 0xFF)) }
    }
}
