import AppKit
import GraphiumCore
import GraphiumMCP
import MetricKit
import OSLog

/// Help > Collect Diagnostics: gathers what a bug report needs into a folder and a zip in
/// `~/Library/Logs/Graphium/Reports`, then shows them in Finder. Nothing is sent; the DM
/// reads the folder before attaching the zip anywhere (PRINCIPLES.md).
///
/// Holds Graphium's and graphium-mcp's log files, this run's errors from the unified log,
/// macOS crash and hang reports for both from the last 30 days, MetricKit diagnostics, and
/// a system summary. Never campaigns, maps, notes or Agent conversations. The home folder
/// is written as `~` throughout.
enum DiagnosticsReport {
    static var reportsDirectory: URL { Diagnostics.logsDirectory.appendingPathComponent("Reports", isDirectory: true) }
    static var metricKitDirectory: URL { Diagnostics.logsDirectory.appendingPathComponent("MetricKit", isDirectory: true) }

    static let crashReportAge: TimeInterval = 30 * 24 * 60 * 60
    static let maxReportsPerKind = 10

    @MainActor
    static func collectAndShow() {
        Task.detached(priority: .userInitiated) {
            let result = Result { try collect() }
            await MainActor.run { present(result) }
        }
    }

    @MainActor
    private static func present(_ result: Result<URL, Error>) {
        let alert = NSAlert()
        switch result {
        case .failure(let error):
            Diagnostics.log(.error, "Collect Diagnostics failed: \(error.localizedDescription)", category: "app")
            alert.alertStyle = .warning
            alert.messageText = "Couldn't Collect Diagnostics"
            alert.informativeText = error.localizedDescription
            alert.runModal()
        case .success(let zip):
            alert.messageText = "Diagnostics Collected"
            alert.informativeText =
                "Nothing was sent. Look through the folder (README.txt lists what's in it), then attach the zip "
                + "to your bug report."
            alert.addButton(withTitle: "Show in Finder")
            alert.addButton(withTitle: "Report a Bug…")
            alert.addButton(withTitle: "Done")
            let response = alert.runModal()
            if response == .alertFirstButtonReturn || response == .alertSecondButtonReturn {
                NSWorkspace.shared.activateFileViewerSelecting([zip])
            }
            if response == .alertSecondButtonReturn {
                NSWorkspace.shared.open(AppLinks.issues.appendingPathComponent("new"))
            }
        }
    }

    /// Builds the folder and its zip and returns the zip.
    static func collect(now: Date = Date()) throws -> URL {
        let fm = FileManager.default
        let stamp = DateFormatter()
        stamp.locale = Locale(identifier: "en_US_POSIX")
        stamp.dateFormat = "yyyy-MM-dd HH.mm.ss"
        let folder = reportsDirectory.appendingPathComponent("Graphium Diagnostics \(stamp.string(from: now))", isDirectory: true)
        let logs = folder.appendingPathComponent("logs", isDirectory: true)
        try fm.createDirectory(at: logs, withIntermediateDirectories: true)
        Diagnostics.log(.info, "Collecting diagnostics", category: "app")

        // Graphium's own log files, current and previous.
        let logNames = (try? fm.contentsOfDirectory(atPath: Diagnostics.logsDirectory.path)) ?? []
        for name in logNames.sorted() where name.hasSuffix(".log") {
            copyRedacted(Diagnostics.logsDirectory.appendingPathComponent(name), to: logs.appendingPathComponent(name))
        }
        try write(unifiedLog(since: now.addingTimeInterval(-3600)), to: logs.appendingPathComponent("this-run-unified-log.txt"))

        // macOS's crash, hang and resource reports for the app and the MCP server.
        let systemReports = fm.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/DiagnosticReports")
        let crashes = recentFiles(in: systemReports, since: now.addingTimeInterval(-crashReportAge)) { name in
            name.hasPrefix("Graphium") || name.hasPrefix("graphium-mcp")
        }
        if !crashes.isEmpty {
            let target = folder.appendingPathComponent("crash-reports", isDirectory: true)
            try fm.createDirectory(at: target, withIntermediateDirectories: true)
            for url in crashes { copyRedacted(url, to: target.appendingPathComponent(url.lastPathComponent)) }
        }
        let metrics = recentFiles(in: metricKitDirectory, since: now.addingTimeInterval(-crashReportAge)) { $0.hasSuffix(".json") }
        if !metrics.isEmpty {
            let target = folder.appendingPathComponent("metrickit", isDirectory: true)
            try fm.createDirectory(at: target, withIntermediateDirectories: true)
            for url in metrics { copyRedacted(url, to: target.appendingPathComponent(url.lastPathComponent)) }
        }

        try write(systemSummary(crashReports: crashes.count), to: folder.appendingPathComponent("system.txt"))
        try write(readme(collected: now), to: folder.appendingPathComponent("README.txt"))

        let zip = folder.appendingPathExtension("zip")
        let ditto = Process()
        ditto.executableURL = URL(fileURLWithPath: "/usr/bin/ditto")
        ditto.arguments = ["-c", "-k", "--keepParent", folder.path, zip.path]
        try ditto.run()
        ditto.waitUntilExit()
        guard ditto.terminationStatus == 0 else {
            throw CocoaError(.fileWriteUnknown, userInfo: [NSLocalizedDescriptionKey: "Couldn't make the zip. The folder is at \(Diagnostics.redacted(folder.path))."])
        }
        return zip
    }

    /// Newest first, at most `maxReportsPerKind`.
    private static func recentFiles(in folder: URL, since: Date, where matches: (String) -> Bool) -> [URL] {
        let keys: [URLResourceKey] = [.contentModificationDateKey, .isRegularFileKey]
        let urls = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: keys)) ?? []
        let dated: [(URL, Date)] = urls.compactMap { url in
            guard matches(url.lastPathComponent), let values = try? url.resourceValues(forKeys: Set(keys)),
                values.isRegularFile == true, let date = values.contentModificationDate, date >= since
            else { return nil }
            return (url, date)
        }
        return dated.sorted { $0.1 > $1.1 }.prefix(maxReportsPerKind).map(\.0)
    }

    private static func copyRedacted(_ source: URL, to target: URL) {
        guard let data = try? Data(contentsOf: source) else { return }
        let text = String(decoding: data, as: UTF8.self)
        try? Data(Diagnostics.redacted(text).utf8).write(to: target, options: .atomic)
    }

    private static func write(_ text: String, to url: URL) throws {
        try Data(Diagnostics.redacted(text).utf8).write(to: url, options: .atomic)
    }

    /// This process's errors and faults from any framework (NSDocument, AppKit, AVFoundation…)
    /// plus everything Graphium logged, from the last hour. macOS only lets an app read its
    /// own process here, so earlier runs come from the log files instead.
    static func unifiedLog(since: Date) -> String {
        guard let store = try? OSLogStore(scope: .currentProcessIdentifier),
            let entries = try? store.getEntries(at: store.position(date: since))
        else { return "The unified log couldn't be read.\n" }
        var lines: [String] = []
        let formatter = ISO8601DateFormatter()
        for case let entry as OSLogEntryLog in entries {
            guard entry.subsystem == "com.graphium" || entry.level == .error || entry.level == .fault else { continue }
            let level = entry.level == .fault ? "fault" : entry.level == .error ? "error" : "info"
            lines.append("\(formatter.string(from: entry.date)) [\(level)] \(entry.subsystem) \(entry.category): \(entry.composedMessage)")
        }
        if lines.count > 5000 { lines = Array(lines.suffix(5000)) }
        return lines.isEmpty ? "Nothing logged in the last hour.\n" : lines.joined(separator: "\n") + "\n"
    }

    static func systemSummary(crashReports: Int) -> String {
        let info = ProcessInfo.processInfo
        var model = [CChar](repeating: 0, count: 256)
        var size = model.count
        let hardware = sysctlbyname("hw.model", &model, &size, nil, 0) == 0 ? String(cString: model) : "unknown"
        let memory = ByteCountFormatter.string(fromByteCount: Int64(info.physicalMemory), countStyle: .memory)
        let lines = [
            "Graphium \(AppLinks.version) (\(AppLinks.build))",
            "graphium-mcp \(GraphiumTools.version)",
            "macOS \(info.operatingSystemVersionString)",
            "Mac \(hardware), \(info.activeProcessorCount) cores, \(memory)",
            "Running for \(Int(info.systemUptime / 3600)) h since the Mac started",
            "Thermal state \(info.thermalState.rawValue), Low Power Mode \(info.isLowPowerModeEnabled ? "on" : "off")",
            "Crash reports from the last 30 days \(crashReports)",
        ]
        return lines.joined(separator: "\n") + "\n"
    }

    static func readme(collected: Date) -> String {
        """
        Graphium diagnostics, collected \(ISO8601DateFormatter().string(from: collected)).

        Nothing in this folder has been sent anywhere. Look through it, delete anything you'd
        rather not share, then attach the zip to your bug report.

        system.txt       Graphium, graphium-mcp and macOS versions, and the Mac's model.
        logs/            What Graphium and graphium-mcp recorded: campaigns opened and saved,
                         AI tool calls, Agent runs and errors. File names, counts and timings,
                         never what's in a campaign. The unified log file holds this run's
                         errors from macOS frameworks too.
        crash-reports/   macOS's reports of Graphium or graphium-mcp crashing or hanging in the
                         last 30 days (only when there are some).
        metrickit/       Crash and hang details macOS handed to Graphium (only when there are some).

        Your home folder is written as ~. Not included: campaigns, maps, notes, images, sounds
        or Agent conversations.

        """
    }
}

/// Receives crash and hang diagnostics macOS gathers for Graphium (MetricKit) and keeps
/// them in `~/Library/Logs/Graphium/MetricKit` for Collect Diagnostics. Delivered on a later
/// launch; nothing leaves the Mac.
final class MetricKitReceiver: NSObject, MXMetricManagerSubscriber {
    static let shared = MetricKitReceiver()

    func start() {
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        let folder = DiagnosticsReport.metricKitDirectory
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        for payload in payloads {
            let stamp = Int(payload.timeStampEnd.timeIntervalSince1970)
            try? payload.jsonRepresentation().write(to: folder.appendingPathComponent("diagnostic-\(stamp).json"), options: .atomic)
            Diagnostics.log(
                .error,
                "macOS reported \(payload.crashDiagnostics?.count ?? 0) crashes and \(payload.hangDiagnostics?.count ?? 0) hangs",
                category: "app")
        }
    }
}
