import AppKit
import GraphiumCore
import GraphiumMCP
import SwiftUI

/// Settings > AI Tools > "Chat with an agent in Graphium". Off until the DM turns it on, and
/// only with the map tools on, since the agent works through them (PRINCIPLES.md).
enum AgentSettings {
    /// The agent the DM last picked, when both are installed.
    static var preferred: AgentKind {
        UserDefaults.standard.string(forKey: Prefs.agentKind).flatMap(AgentKind.init(rawValue:)) ?? .claudeCode
    }
}

/// An installed CLI, found the way an app opened from the Dock has to find it.
struct InstalledAgent: Equatable, Sendable {
    var kind: AgentKind
    var executable: URL
    var version: String
    /// The login shell's `PATH`, so a CLI installed with npm finds `node`.
    var path: String
}

/// Finds `claude` and `codex`. Runs only when the DM turns the Agent window on or opens it,
/// never at launch.
enum AgentLocator {
    static func findAll() async -> [InstalledAgent] {
        await Task.detached(priority: .userInitiated) {
            let path = loginPath()
            return AgentKind.allCases.compactMap { locate($0, path: path) }
        }.value
    }

    private static func locate(_ kind: AgentKind, path: String) -> InstalledAgent? {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let fromPath = path.split(separator: ":").map { "\($0)/\(kind.executableName)" }
        var seen = Set<String>()
        for candidate in kind.candidatePaths(home: home) + fromPath where seen.insert(candidate).inserted {
            guard FileManager.default.isExecutableFile(atPath: candidate) else { continue }
            // The first one found can be a broken install (a Homebrew codex missing its binary was
            // ahead of a working nvm one on Kyle's Mac), so each has to answer --version.
            let url = URL(fileURLWithPath: candidate)
            guard let version = run(url, ["--version"], path: path, timeout: 10)?.trimmingCharacters(in: .whitespacesAndNewlines),
                !version.isEmpty
            else { continue }
            return InstalledAgent(kind: kind, executable: url, version: version, path: path)
        }
        return nil
    }

    /// `PATH` as the DM's own shell sets it up. Interactive as well as login, because nvm is
    /// usually set up in `.zshrc`. Falls back to the usual folders when the shell takes too long.
    private static func loginPath() -> String {
        let fallback = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].joined(separator: ":")
        let shell = ProcessInfo.processInfo.environment["SHELL"] ?? "/bin/zsh"
        let marker = "__GRAPHIUM_PATH__"
        guard let output = run(URL(fileURLWithPath: shell), ["-ilc", "printf '\(marker)%s\(marker)' \"$PATH\""], path: fallback, timeout: 5),
            let start = output.range(of: marker), let end = output.range(of: marker, range: start.upperBound..<output.endIndex)
        else { return fallback }
        let path = String(output[start.upperBound..<end.lowerBound])
        return path.isEmpty ? fallback : path
    }

    /// Standard output of a short command, or nil if it fails or overruns.
    private static func run(_ executable: URL, _ arguments: [String], path: String, timeout: TimeInterval) -> String? {
        let process = Process()
        process.executableURL = executable
        process.arguments = arguments
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = path
        process.environment = environment
        let output = Pipe()
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        process.standardInput = FileHandle.nullDevice
        do { try process.run() } catch { return nil }
        let deadline = Date().addingTimeInterval(timeout)
        while process.isRunning, Date() < deadline { Thread.sleep(forTimeInterval: 0.05) }
        if process.isRunning {
            process.terminate()
            return nil
        }
        let data = output.fileHandleForReading.readDataToEndOfFile()
        return process.terminationStatus == 0 ? String(decoding: data, as: UTF8.self) : nil
    }
}

/// Splits the CLI's output into lines. Used only from its pipe's handler, which runs one
/// call at a time.
private final class LineBuffer: @unchecked Sendable {
    private var data = Data()

    func lines(adding chunk: Data) -> [String] {
        data.append(chunk)
        var lines: [String] = []
        while let newline = data.firstIndex(of: 0x0A) {
            lines.append(String(decoding: data[data.startIndex..<newline], as: UTF8.self))
            data.removeSubrange(data.startIndex...newline)
        }
        return lines
    }
}

/// One line of the Agent window's conversation.
struct AgentEntry: Identifiable, Equatable {
    enum Kind: Equatable {
        case user(String)
        case reply(String)
        case tool(name: String, arguments: String, state: ToolState, output: String)
        case notice(String)
    }

    enum ToolState: Equatable { case running, done, failed }

    let id: String
    var kind: Kind
}

/// The conversation in one Agent window. Graphium keeps it in memory only: the CLI keeps its
/// own history, and closing the window forgets this copy.
@MainActor
final class AgentChatModel: ObservableObject {
    @Published private(set) var entries: [AgentEntry] = []
    @Published private(set) var installed: [InstalledAgent] = []
    @Published private(set) var searching = true
    @Published var kind: AgentKind = AgentSettings.preferred {
        didSet {
            guard kind != oldValue else { return }
            UserDefaults.standard.set(kind.rawValue, forKey: Prefs.agentKind)
            newConversation()
        }
    }
    @Published private(set) var running = false
    @Published private(set) var undoing = false

    private var session: String?
    private var process: Process?
    private var stopRequested = false
    /// Graphium stopped the turn itself and already said why.
    private var silentStop = false
    private var stderr = Data()
    private var counter = 0
    /// Which turn is current; output from an older one is dropped.
    private var generation = 0

    var agent: InstalledAgent? { installed.first { $0.kind == kind } }

    func locate() async {
        searching = true
        installed = await AgentLocator.findAll()
        if agent == nil, let first = installed.first { kind = first.kind }
        searching = false
    }

    func newConversation() {
        stop()
        generation += 1
        running = false
        process = nil
        session = nil
        entries = []
    }

    func send(_ text: String, document: CampaignDocument) {
        let message = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, !running, let agent else { return }
        guard let package = document.fileURL else {
            append(.notice("Save the campaign first, so the agent has a file to work on."))
            return
        }
        append(.user(message))
        // Codex says nothing when its MCP server can't start, so check the link first.
        guard FileManager.default.isExecutableFile(atPath: MCPInstall.link.path) else {
            append(.notice("Graphium's map tools aren't set up. Turn Let AI apps build maps off and on in Settings > AI Tools."))
            return
        }
        let run = AgentRun(
            kind: agent.kind, server: ClientSetup(command: MCPInstall.link.path, folders: [package.path]), session: session,
            context: Self.context(document: document, package: package))
        start(run, agent: agent, input: run.input(for: message), folder: package.deletingLastPathComponent())
    }

    /// Asks the CLI to stop (as Control-C would), then ends it if it doesn't.
    func stop() {
        guard let process, process.isRunning else { return }
        stopRequested = true
        process.interrupt()
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak process] in
            if let process, process.isRunning { process.terminate() }
        }
    }

    /// Puts back the campaign as it was before the map tools' last change, through the same
    /// undo the `undo` tool uses (docs/MCP.md).
    func undoLastChange(document: CampaignDocument) {
        guard let package = document.fileURL, !running else { return }
        undoing = true
        Task.detached {
            let result: String
            do {
                let left = try CampaignStore(roots: [package]).undo(package.path)
                result = left == 0 ? "Undid the agent's last change. No earlier changes to undo." : "Undid the agent's last change."
            } catch let error as ToolError {
                result = error.message
            } catch {
                result = error.localizedDescription
            }
            await MainActor.run {
                self.undoing = false
                self.append(.notice(result))
            }
        }
    }

    private func start(_ run: AgentRun, agent: InstalledAgent, input message: String, folder: URL) {
        let process = Process()
        process.executableURL = agent.executable
        process.arguments = run.arguments
        process.currentDirectoryURL = folder
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = agent.path
        process.environment = environment

        let input = Pipe()
        let output = Pipe()
        let errors = Pipe()
        process.standardInput = input
        process.standardOutput = output
        process.standardError = errors

        generation += 1
        let generation = generation
        let buffer = LineBuffer()
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            guard !chunk.isEmpty else { return }
            let events = buffer.lines(adding: chunk).flatMap(run.events(in:))
            guard !events.isEmpty else { return }
            // The main queue keeps the events in order.
            DispatchQueue.main.async { self?.handle(events, generation: generation) }
        }
        errors.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            guard !chunk.isEmpty else { return }
            DispatchQueue.main.async { if self?.generation == generation { self?.stderr.append(chunk) } }
        }
        process.terminationHandler = { [weak self] process in
            let status = process.terminationStatus
            // Let the last lines through before reporting how it ended.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                output.fileHandleForReading.readabilityHandler = nil
                errors.fileHandleForReading.readabilityHandler = nil
                self?.ended(status: status, generation: generation)
            }
        }

        stderr = Data()
        stopRequested = false
        silentStop = false
        finished = false
        do {
            try process.run()
        } catch {
            append(.notice("Couldn't start \(agent.kind.name): \(error.localizedDescription)"))
            return
        }
        self.process = process
        running = true
        input.fileHandleForWriting.write(Data(message.utf8))
        try? input.fileHandleForWriting.close()
    }

    /// Whether this turn already reported its end, so the exit status adds nothing.
    private var finished = false

    private func handle(_ events: [AgentEvent], generation: Int) {
        // Lines from a turn that was stopped for a new conversation, or after Graphium stopped it.
        guard generation == self.generation, !silentStop else { return }
        for event in events where !silentStop {
            switch event {
            case .session(let id):
                session = id
            case .tools:
                break
            case .warning(let text):
                append(.notice(text))
            case .failed(let text):
                finished = true
                append(.notice(text))
                stopRequested = true
                silentStop = true
                process?.terminate()
            case .text(let text):
                append(.reply(text))
            case .toolStarted(let id, let name, let arguments):
                entries.append(AgentEntry(id: "tool-\(id)-\(counter)", kind: .tool(name: name, arguments: arguments, state: .running, output: "")))
                counter += 1
            case .toolFinished(let id, let isError, let output):
                guard let index = entries.lastIndex(where: { $0.id.hasPrefix("tool-\(id)-") }),
                    case .tool(let name, let arguments, _, _) = entries[index].kind
                else { continue }
                entries[index].kind = .tool(name: name, arguments: arguments, state: isError ? .failed : .done, output: output)
            case .finished(let error):
                finished = true
                if let error, !stopRequested { append(.notice(error)) }
            }
        }
    }

    private func ended(status: Int32, generation: Int) {
        guard generation == self.generation else { return }
        running = false
        process = nil
        for index in entries.indices {
            if case .tool(let name, let arguments, .running, let output) = entries[index].kind {
                entries[index].kind = .tool(name: name, arguments: arguments, state: .failed, output: output)
            }
        }
        if silentStop {
            silentStop = false
        } else if stopRequested {
            append(.notice("Stopped."))
        } else if status != 0, !finished {
            let detail = String(decoding: stderr.suffix(600), as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
            append(.notice(detail.isEmpty ? "\(kind.name) stopped (exit \(status))." : detail))
        }
    }

    private func append(_ kind: AgentEntry.Kind) {
        entries.append(AgentEntry(id: "entry-\(counter)", kind: kind))
        counter += 1
    }

    /// Which campaign and map the DM has open, so "this map" means something.
    static func context(document: CampaignDocument, package: URL) -> String {
        let campaign = document.campaign
        return """
            You are working inside Graphium, a virtual tabletop, for the DM who is chatting with you. \
            You can change only the campaign file at \(package.path) ("\(campaign.name)"), using the graphium tools. \
            The DM is looking at the map "\(campaign.activeMap.name)" (id \(campaign.activeMapID)); "this map" means that one. \
            Graphium reloads the campaign after each change, so the DM sees your edits as you make them. \
            Keep replies short: say what you changed and anything the DM should check.
            """
    }
}

/// Window > Agent: chat with Claude Code or Codex about the open campaign.
struct AgentWindow: View {
    static let id = "agent"
    let sessionID: UUID?
    @AppStorage(Prefs.agentEnabled) private var agentEnabled = false
    @AppStorage(Prefs.mcpEnabled) private var mcpEnabled = false

    var body: some View {
        if !(agentEnabled && mcpEnabled) {
            // Turning it off in Settings closes the window, which stops any running agent.
            OrphanedWindow(title: "Agent Is Off", systemImage: "bubble.left.and.text.bubble.right", description: "Turn it on in Settings > AI Tools.")
        } else if let sessionID, let document = DocumentRegistry.shared.document(for: sessionID) {
            AgentChatView(document: document)
        } else {
            OrphanedWindow(title: "No Campaign", systemImage: "bubble.left.and.text.bubble.right", description: "Open a campaign, then choose Agent.")
        }
    }
}

private struct AgentChatView: View {
    @ObservedObject var document: CampaignDocument
    @StateObject private var model = AgentChatModel()
    @State private var draft = ""
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        intro
                        ForEach(model.entries) { entry in
                            AgentEntryView(entry: entry).id(entry.id)
                        }
                        if model.running {
                            ProgressView().controlSize(.small).id("progress")
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .onChange(of: model.entries) { _, entries in
                    if let last = entries.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                }
            }
            Divider()
            composer
        }
        .frame(minWidth: 360, idealWidth: 420, minHeight: 420)
        .navigationTitle("Agent — \(document.campaign.name)")
        .focusedSceneValue(\.campaignDocument, document)
        .toolbar {
            if model.installed.count > 1 {
                ToolbarItem {
                    Picker("Agent", selection: $model.kind) {
                        ForEach(model.installed, id: \.kind) { Text($0.kind.name).tag($0.kind) }
                    }
                    .pickerStyle(.segmented)
                    .help("Which installed agent to use")
                }
            }
            ToolbarItem {
                Button {
                    model.undoLastChange(document: document)
                } label: {
                    Label("Undo Agent Change", systemImage: "arrow.uturn.backward")
                }
                .help("Put back the campaign as it was before the agent's last change")
                .disabled(model.running || model.undoing || document.fileURL == nil)
            }
            ToolbarItem {
                Button {
                    model.newConversation()
                } label: {
                    Label("New Conversation", systemImage: "square.and.pencil")
                }
                .help("Start a new conversation")
                .disabled(model.entries.isEmpty)
            }
        }
        .task { await model.locate() }
        .onDisappear { model.stop() }
    }

    @ViewBuilder
    private var intro: some View {
        if model.searching {
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text("Looking for Claude Code and Codex…").foregroundStyle(.secondary)
            }
        } else if let agent = model.agent {
            VStack(alignment: .leading, spacing: 6) {
                Text("Ask \(agent.kind.name) to build or change maps in \(document.campaign.name).")
                    .font(.headline)
                Text(
                    "This runs \(agent.kind.name) on this Mac with your own account. What you type and what the map tools return go to \(agent.kind.provider). "
                        + "It can change only this campaign, and only through Graphium's map tools."
                )
                .font(.callout)
                .foregroundStyle(.secondary)
                Text("\(agent.kind.name) \(agent.version) · \((agent.executable.path as NSString).abbreviatingWithTildeInPath)")
                    .font(.caption.monospaced())
                    .foregroundStyle(.tertiary)
                    .textSelection(.enabled)
            }
            .fixedSize(horizontal: false, vertical: true)
        } else {
            ContentUnavailableView {
                Label("No Agent Found", systemImage: "terminal")
            } description: {
                Text("Install Claude Code or Codex and sign in from Terminal, then open this window again.")
            } actions: {
                Button("Look Again") { Task { await model.locate() } }
            }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Ask for a map, a room, a monster…", text: $draft, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...6)
                .focused($inputFocused)
                .onSubmit(send)
                .disabled(model.agent == nil)
            if model.running {
                Button("Stop", action: model.stop)
                    .keyboardShortcut(.cancelAction)
                    .help("Stop the agent (Esc)")
            } else {
                Button("Send", action: send)
                    .keyboardShortcut(.return, modifiers: .command)
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.agent == nil)
                    .help("Send (⌘↩)")
            }
        }
        .padding(12)
        .onAppear { inputFocused = true }
    }

    private func send() {
        guard !model.running else { return }
        model.send(draft, document: document)
        draft = ""
    }
}

private struct AgentEntryView: View {
    let entry: AgentEntry
    @State private var expanded = false

    var body: some View {
        switch entry.kind {
        case .user(let text):
            Text(text)
                .textSelection(.enabled)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
                .frame(maxWidth: .infinity, alignment: .trailing)
        case .reply(let text):
            Text((try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .tool(let name, let arguments, let state, let output):
            DisclosureGroup(isExpanded: $expanded) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(arguments).font(.caption.monospaced()).foregroundStyle(.secondary).lineLimit(12)
                    if !output.isEmpty {
                        Text(output).font(.caption.monospaced()).lineLimit(20)
                    }
                }
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
            } label: {
                Label {
                    Text(Self.title(name))
                } icon: {
                    switch state {
                    case .running: ProgressView().controlSize(.mini)
                    case .done: Image(systemName: "checkmark.circle")
                    case .failed: Image(systemName: "exclamationmark.triangle")
                    }
                }
                .font(.callout)
                .foregroundStyle(.secondary)
            }
            .accessibilityLabel("\(Self.title(name)), \(state == .running ? "running" : state == .done ? "done" : "failed")")
        case .notice(let text):
            Label(text, systemImage: "info.circle")
                .font(.callout)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
        }
    }

    /// `add_rooms` → "Add rooms".
    static func title(_ name: String) -> String {
        let words = name.replacingOccurrences(of: "_", with: " ")
        return words.prefix(1).uppercased() + words.dropFirst()
    }
}

/// Window > Agent (⌥⌘A), listed only while the Agent window is turned on in Settings.
struct AgentMenuItem: View {
    @FocusedValue(\.campaignDocument) private var document
    @AppStorage(Prefs.agentEnabled) private var agentEnabled = false
    @AppStorage(Prefs.mcpEnabled) private var mcpEnabled = false
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        if agentEnabled && mcpEnabled {
            Button("Agent") {
                if let document { openWindow(id: AgentWindow.id, value: document.sessionID) }
            }
            .keyboardShortcut("a", modifiers: [.command, .option])
            .disabled(document == nil)
        }
    }
}
