import AppKit
import GraphiumMCP
import SwiftUI

/// Where AI apps find graphium-mcp, the MCP server built into Graphium.app (docs/MCP.md).
/// Apps are pointed at a link in Application Support rather than into the bundle, so moving
/// or updating Graphium doesn't break them, and turning AI Tools off removes the link.
enum MCPInstall {
    static var enabled: Bool { UserDefaults.standard.bool(forKey: Prefs.mcpEnabled) }

    static var link: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Graphium/bin/graphium-mcp")
    }

    static var bundled: URL? { Bundle.main.url(forAuxiliaryExecutable: "graphium-mcp") }

    static var defaultFolder: String {
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/Graphium").path
    }

    static var folder: String {
        UserDefaults.standard.string(forKey: Prefs.mcpFolder) ?? defaultFolder
    }

    /// Called at launch: keeps the link on this copy of the app while AI Tools is on.
    static func refresh() {
        guard enabled else { return }
        try? install()
    }

    static func install() throws {
        guard let bundled else { throw CocoaError(.fileNoSuchFile) }
        let files = FileManager.default
        try files.createDirectory(at: link.deletingLastPathComponent(), withIntermediateDirectories: true)
        if (try? files.destinationOfSymbolicLink(atPath: link.path)) == bundled.path { return }
        // A dangling link or a copy from scripts/build-mcp.sh is replaced.
        if exists(link) { try files.removeItem(at: link) }
        try files.createSymbolicLink(at: link, withDestinationURL: bundled)
        try files.createDirectory(atPath: folder, withIntermediateDirectories: true)
    }

    static func uninstall() throws {
        if exists(link) { try FileManager.default.removeItem(at: link) }
    }

    /// True for links too, even ones whose target is gone.
    private static func exists(_ url: URL) -> Bool {
        (try? url.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) == true
            || FileManager.default.fileExists(atPath: url.path)
    }
}

@MainActor
final class AIToolsModel: ObservableObject {
    @Published private(set) var enabled = MCPInstall.enabled
    @Published private(set) var folder = MCPInstall.folder
    @Published private(set) var states: [MCPClient: ClientSetup.State] = [:]
    @Published var notice: String?

    private let home = FileManager.default.homeDirectoryForCurrentUser

    init() { reload() }

    var setup: ClientSetup { ClientSetup(command: MCPInstall.link.path, folders: [folder]) }

    func reload() {
        for client in MCPClient.allCases {
            guard let file = client.configFile(home: home) else { continue }
            states[client] = setup.state(in: try? Data(contentsOf: file))
        }
    }

    func setEnabled(_ on: Bool) {
        do {
            if on { try MCPInstall.install() } else { try MCPInstall.uninstall() }
            UserDefaults.standard.set(on, forKey: Prefs.mcpEnabled)
            enabled = on
            notice = on ? nil : "AI apps can no longer start Graphium's map tools. Your campaigns are unchanged."
        } catch {
            notice = "Couldn't change the setting: \(error.localizedDescription)"
        }
    }

    func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.prompt = "Choose"
        panel.message = "AI apps can read and change campaigns only in this folder."
        panel.directoryURL = URL(fileURLWithPath: folder, isDirectory: true)
        guard panel.runModal() == .OK, let url = panel.url else { return }
        UserDefaults.standard.set(url.path, forKey: Prefs.mcpFolder)
        folder = url.path
        reload()
        if states.values.contains(.outdated) {
            notice = "Update the apps below so they use the new folder."
        }
    }

    func copy(_ client: MCPClient) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(setup.snippet(for: client), forType: .string)
        switch client {
        case .claudeCode, .codex:
            notice = "Copied. Paste it in Terminal, then restart \(client.name)."
        case .claudeDesktop, .cursor:
            notice = "Copied. Add it to \(client.name)'s MCP settings, then restart \(client.name)."
        }
    }

    /// Adds Graphium to (or removes it from) a JSON-configured app, keeping its other settings.
    func toggle(_ client: MCPClient) {
        guard let file = client.configFile(home: home) else { return }
        do {
            let existing = try? Data(contentsOf: file)
            let adding = states[client] != .current
            let data = try (adding ? setup.adding(to: existing) : ClientSetup.removing(from: existing))
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: file, options: .atomic)
            reload()
            notice = adding ? "Added. Restart \(client.name) to use Graphium's map tools." : "Removed from \(client.name)."
        } catch {
            notice = error.localizedDescription
        }
    }
}

/// Settings > AI Tools: lets Claude, Codex and Cursor build maps with graphium-mcp.
/// Off until the DM turns it on (PRINCIPLES.md: network and outside access are opt-in).
struct AIToolsSettings: View {
    @StateObject private var model = AIToolsModel()
    @AppStorage(Prefs.agentEnabled) private var agentEnabled = false

    var body: some View {
        Form {
            Section {
                Toggle("Let AI apps build maps", isOn: Binding(get: { model.enabled }, set: { model.setEnabled($0) }))
            } footer: {
                Text(
                    "Claude, Codex and Cursor can make campaigns and maps with Graphium's map tools, which run on this Mac. "
                        + "What you ask and what the tools return goes to the AI app's provider, like anything else you type into it."
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Section {
                LabeledContent("Campaign folder") {
                    HStack {
                        Text((model.folder as NSString).abbreviatingWithTildeInPath)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .textSelection(.enabled)
                        Button("Choose…") { model.chooseFolder() }
                    }
                }
            } footer: {
                Text("AI apps can read and change campaigns only in this folder.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .disabled(!model.enabled)

            Section {
                Toggle("Chat with an agent in Graphium", isOn: $agentEnabled)
            } footer: {
                Text(
                    "Adds Window > Agent (⌥⌘A), which runs Claude Code or Codex from this Mac with your own account. "
                        + "It can change only the open campaign, through the map tools. What you type goes to Anthropic or OpenAI."
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .disabled(!model.enabled)

            Section {
                ForEach(MCPClient.allCases) { client in
                    row(client)
                }
            } header: {
                Text("Apps")
            } footer: {
                if let notice = model.notice {
                    Text(notice).font(.caption).foregroundStyle(.secondary)
                }
            }
            .disabled(!model.enabled)
        }
        .formStyle(.grouped)
        .frame(width: 520)
        .fixedSize()
        .onAppear { model.reload() }
    }

    @ViewBuilder
    private func row(_ client: MCPClient) -> some View {
        LabeledContent {
            HStack {
                switch client {
                case .claudeCode, .codex:
                    Button("Copy Command") { model.copy(client) }
                        .help("Copy the Terminal command that adds Graphium to \(client.name)")
                case .claudeDesktop, .cursor:
                    Button("Copy Settings") { model.copy(client) }
                        .help("Copy the settings to add to \(client.name) by hand")
                    Button(title(for: model.states[client])) { model.toggle(client) }
                        .help(model.states[client] == .current ? "Remove Graphium from \(client.name)" : "Add Graphium to \(client.name)")
                }
            }
        } label: {
            Text(client.name)
            if let status = status(for: model.states[client]) {
                Text(status)
            }
        }
    }

    private func title(for state: ClientSetup.State?) -> String {
        switch state {
        case .current: return "Remove"
        case .outdated: return "Update"
        case .missing, nil: return "Add"
        }
    }

    private func status(for state: ClientSetup.State?) -> String? {
        switch state {
        case .current: return "Added"
        case .outdated: return "Uses an old folder or location"
        case .missing, nil: return nil
        }
    }
}
