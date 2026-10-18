import Foundation

#if canImport(os)
    import os
#endif

/// Graphium's log: the unified log (Console.app, subsystem `com.graphium`) and, once a
/// process calls `startFileLog`, a small rolling file in `~/Library/Logs/Graphium` that
/// survives a crash and goes into Help > Collect Diagnostics.
///
/// Privacy (PRINCIPLES.md): a message names what happened and to which file (its name, never
/// its folder), with counts, sizes and timings. It never holds campaign content: no token or
/// map names, notes, or text the DM typed. The home folder is written as `~`. Nothing is sent
/// anywhere; the DM reads the bundle before attaching it to a report.
public enum Diagnostics {
    public enum Level: String, Sendable {
        case debug, info, error, fault
    }

    /// The folder the app and graphium-mcp write their logs to.
    public static var logsDirectory: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/Graphium", isDirectory: true)
    }

    /// Each file is kept under this size; the previous one is kept as `<name>.1.log`.
    public static let maxFileBytes = 1_000_000

    private static let lock = NSLock()
    nonisolated(unsafe) private static var file: FileHandle?
    nonisolated(unsafe) private static var fileURL: URL?
    nonisolated(unsafe) private static var fileBytes = 0

    /// Starts writing `<name>.log` in `directory` (default `logsDirectory`). Tests never call
    /// this, so they only reach the unified log.
    public static func startFileLog(name: String, directory: URL? = nil) {
        let folder = directory ?? logsDirectory
        let url = folder.appendingPathComponent("\(name).log")
        lock.lock()
        defer { lock.unlock() }
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        file = openForAppending(url)
        fileBytes = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
        fileURL = url
    }

    /// Append mode, so several graphium-mcp processes (one per AI app) share a file
    /// without writing over each other's lines.
    private static func openForAppending(_ url: URL) -> FileHandle? {
        let descriptor = open(url.path, O_WRONLY | O_APPEND | O_CREAT, 0o644)
        guard descriptor >= 0 else { return nil }
        return FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
    }

    public static func log(_ level: Level, _ message: @autoclosure () -> String, category: String = "general") {
        let text = redacted(message())
        #if canImport(os)
            let logger = Logger(subsystem: "com.graphium", category: category)
            switch level {
            case .debug: logger.debug("\(text, privacy: .public)")
            case .info: logger.info("\(text, privacy: .public)")
            case .error: logger.error("\(text, privacy: .public)")
            case .fault: logger.fault("\(text, privacy: .public)")
            }
        #endif
        guard level != .debug else { return }
        write("\(timestamp()) [\(level.rawValue)] \(category): \(text)\n")
    }

    /// The home folder as `~`, so a pasted log doesn't name the Mac's user.
    public static func redacted(_ text: String) -> String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        guard home.count > 1 else { return text }
        return text.replacingOccurrences(of: home, with: "~")
    }

    private static func write(_ line: String) {
        lock.lock()
        defer { lock.unlock() }
        guard let handle = file, let url = fileURL else { return }
        let data = Data(line.utf8)
        if fileBytes + data.count > maxFileBytes {
            try? handle.close()
            let previous = url.deletingPathExtension().appendingPathExtension("1.log")
            try? FileManager.default.removeItem(at: previous)
            try? FileManager.default.moveItem(at: url, to: previous)
            file = openForAppending(url)
            fileBytes = 0
        }
        // Written straight away (no buffering), so the lines before a crash are on disk.
        try? file?.write(contentsOf: data)
        fileBytes += data.count
    }

    private static func timestamp() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }
}
