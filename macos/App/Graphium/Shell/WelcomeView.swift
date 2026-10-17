import AppKit
import GraphiumCore
import SwiftUI

/// Something to do in the next new Architect window (Welcome's Generate Dungeon and
/// Templates cards). Consumed once, and only shortly after it was set.
@MainActor
final class LaunchIntent {
    static let shared = LaunchIntent()

    enum Action: Equatable {
        case generateDungeon
        case template(CampaignTemplate)
    }

    private var pending: (action: Action, at: Date)?

    func newCampaign(then action: Action) {
        pending = (action, Date())
        NSDocumentController.shared.newDocument(nil)
    }

    func take() -> Action? {
        defer { pending = nil }
        guard let pending, Date().timeIntervalSince(pending.at) < 10 else { return nil }
        return pending.action
    }
}

/// Recents hidden with the Welcome window's x (PARITY §1.2), stored as newline-separated
/// paths. Like TS `removeRecentCampaign`, hiding only lasts until the campaign is opened
/// or saved again, which brings it back to the list.
enum HiddenRecents {
    static func decode(_ raw: String) -> Set<String> {
        Set(raw.split(separator: "\n").map(String.init))
    }

    static func encode(_ paths: Set<String>) -> String {
        paths.sorted().joined(separator: "\n")
    }

    /// Called when a campaign window opens a file or saves to a new one.
    static func unhide(_ url: URL?) {
        guard let url else { return }
        let defaults = UserDefaults.standard
        var hidden = decode(defaults.string(forKey: Prefs.hiddenRecents) ?? "")
        guard hidden.remove(url.path) != nil else { return }
        defaults.set(encode(hidden), forKey: Prefs.hiddenRecents)
    }
}

/// TS home-screen templates (PARITY §1.2): a new campaign with 50 px cells. The
/// native app also names the first map after the template.
struct CampaignTemplate: Identifiable, Hashable {
    let id: String
    let name: String
    let symbol: String
    let description: String
    let cells: Int

    static let all = [
        CampaignTemplate(id: "dungeon", name: "Classic Dungeon", symbol: "building.columns", description: "5-room dungeon with fog of war", cells: 30),
        CampaignTemplate(id: "wilderness", name: "Wilderness Map", symbol: "tree", description: "Large outdoor exploration area", cells: 40),
        CampaignTemplate(id: "tavern", name: "Starting Tavern", symbol: "wineglass", description: "Small indoor social encounter", cells: 20),
        CampaignTemplate(id: "arena", name: "Combat Arena", symbol: "shield.lefthalf.filled", description: "Tactical battle grid", cells: 25),
    ]

    func apply(to campaign: inout Campaign) {
        campaign.activeMap.gridSize = 50
        campaign.activeMap.name = name
    }
}

/// The launch window (PARITY §1.2): hero, quick actions, recents and footer.
struct WelcomeView: View {
    static let windowID = "welcome"
    /// Window menu item; the app delegate also finds it by this title for Dock reopen.
    static let menuTitle = "Welcome to Graphium"

    @Environment(\.openWindow) private var openWindow
    @AppStorage(Prefs.theme) private var themeRaw = AppTheme.system.rawValue
    @AppStorage(Prefs.hiddenRecents) private var hiddenRecentsRaw = ""
    @State private var showingTemplates = false
    @State private var recentsQuery = ""
    @State private var recents: [RecentCampaign] = []
    @State private var openError: String?

    /// Fixed for the session, like the TS `useState` initializer.
    private static let subtitle = [
        "Storytellers", "World Builders", "Game Guides", "Adventure Architects", "Keepers of Lore",
        "Dice Rollers", "Party Leaders", "Campaign Curators", "Narrative Weavers", "Fantasy Facilitators",
        "Myth Makers", "Legend Spinners", "Plot Twisters", "Tabletop Tacticians", "Grid Guardians",
        "Scene Setters", "Roleplay Referees", "Quest Givers", "Map Makers", "Saga Shapers", "Chroniclers",
        "Chaos Coordinators", "Rules Lawyers (The Good Kind)",
    ].randomElement() ?? "Dungeon Masters"

    private var theme: AppTheme { AppTheme(rawValue: themeRaw) ?? .system }

    var body: some View {
        VStack(spacing: 28) {
            hero
            HStack(spacing: 14) {
                card("New Campaign", "doc.badge.plus", "Start a fresh campaign (⌘N)") {
                    NSDocumentController.shared.newDocument(nil)
                }
                card("Load Campaign", "folder", "Open a .graphiumcampaign or .graphium file (⌘O)") {
                    NSDocumentController.shared.openDocument(nil)
                }
                // ⌘G is Find Next in the Edit menu, so these use Shift (TS: Ctrl/⌘ G and T).
                card("Generate Dungeon", "square.grid.3x3.topleft.filled", "A new campaign with a random dungeon (⇧⌘D)") {
                    LaunchIntent.shared.newCampaign(then: .generateDungeon)
                }
                .keyboardShortcut("d", modifiers: [.command, .shift])
                card("Templates", "square.on.square", "Start from a pre-made campaign (⇧⌘T)") {
                    showingTemplates = true
                }
                .keyboardShortcut("t", modifiers: [.command, .shift])
            }
            Button("New to Graphium? Learn the basics") { ShowAbout(openWindow: openWindow)(.tutorial) }
                .buttonStyle(.link)
            recentList
            Spacer(minLength: 0)
            footer
        }
        .padding(32)
        .frame(minWidth: 760, minHeight: 600)
        .onAppear(perform: reloadRecents)
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            reloadRecents()
        }
        .onChange(of: hiddenRecentsRaw) { _, _ in reloadRecents() }
        .alert(
            "Couldn't open the campaign",
            isPresented: Binding(get: { openError != nil }, set: { if !$0 { openError = nil } })
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(openError ?? "")
        }
        .sheet(isPresented: $showingTemplates) {
            TemplatesSheet { template in
                showingTemplates = false
                LaunchIntent.shared.newCampaign(then: .template(template))
            }
        }
    }

    private var hero: some View {
        VStack(spacing: 10) {
            Image("Logo").resizable().frame(width: 96, height: 96).accessibilityHidden(true)
            (Text("Virtual Tabletop for ") + Text(Self.subtitle).foregroundColor(.accentColor))
                .font(.largeTitle.bold())
                .multilineTextAlignment(.center)
            Text("Dual-window VTT with fog of war • Local-first, no subscriptions")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
    }

    private func card(_ title: String, _ symbol: String, _ help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Image(systemName: symbol).font(.system(size: 28))
                Text(title).font(.headline)
            }
            .frame(width: 150, height: 100)
            .contentShape(Rectangle())
        }
        .buttonStyle(.bordered)
        .help(help)
        .accessibilityLabel(title)
    }

    // MARK: Recents

    private struct RecentCampaign: Identifiable, Hashable {
        var id: URL { url }
        let url: URL
        let opened: Date?
        var name: String { url.deletingPathExtension().lastPathComponent }
    }

    private var hiddenRecents: Set<String> {
        HiddenRecents.decode(hiddenRecentsRaw)
    }

    private func reloadRecents() {
        let hidden = hiddenRecents
        let urls = NSDocumentController.shared.recentDocumentURLs
        // Forget hidden paths that have dropped off the system list, so the set stays bounded.
        let kept = hidden.intersection(urls.map(\.path))
        if kept != hidden { hiddenRecentsRaw = HiddenRecents.encode(kept) }
        recents = urls
            .filter { !hidden.contains($0.path) }
            .map { url in
                let values = try? url.resourceValues(forKeys: [.contentAccessDateKey])
                return RecentCampaign(url: url, opened: values?.contentAccessDate)
            }
    }

    private func hide(_ recent: RecentCampaign) {
        hiddenRecentsRaw = HiddenRecents.encode(hiddenRecents.union([recent.url.path]))
        reloadRecents()
    }

    @ViewBuilder
    private var recentList: some View {
        if !recents.isEmpty {
            let query = recentsQuery.trimmingCharacters(in: .whitespaces).lowercased()
            let shown = query.isEmpty ? recents : recents.filter { $0.name.lowercased().contains(query) }
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Recent Campaigns").font(.headline)
                    Spacer()
                    if recents.count >= 6 {
                        TextField("Search", text: $recentsQuery).textFieldStyle(.roundedBorder).frame(width: 200)
                    }
                }
                ForEach(shown) { recent in
                    HStack {
                        Button {
                            NSDocumentController.shared.openDocument(withContentsOf: recent.url, display: true) { _, _, error in
                                if let error { openError = error.localizedDescription }
                            }
                        } label: {
                            HStack {
                                Image(systemName: "map")
                                Text(recent.name).lineLimit(1)
                                Spacer()
                                if let opened = recent.opened {
                                    Text(opened.formatted(date: .abbreviated, time: .shortened)).foregroundStyle(.secondary)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        Button {
                            hide(recent)
                        } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove \(recent.name) from recent campaigns")
                    }
                    .padding(.vertical, 4)
                }
            }
            .frame(maxWidth: 560)
        }
    }

    // MARK: Footer

    private var footer: some View {
        HStack(spacing: 18) {
            Link("GitHub", destination: AppLinks.source)
            Button("About") { ShowAbout(openWindow: openWindow)(.about) }.buttonStyle(.link)
            Link("Report Bug", destination: AppLinks.issues)
            Button("Help") { ShowAbout(openWindow: openWindow)(.shortcuts) }.buttonStyle(.link)
                .keyboardShortcut("?", modifiers: [])
                .help("Keyboard shortcuts (?)")
            Button {
                themeRaw = theme.next.rawValue
                theme.next.apply()
            } label: {
                Label("Theme: \(theme.title)", systemImage: theme.symbol)
            }
            .buttonStyle(.link)
            .help("Cycle Light, Dark and System appearance")
            Spacer()
            Text("Version \(AppLinks.version) · macOS Edition").foregroundStyle(.secondary)
        }
        .font(.callout)
    }
}

private struct TemplatesSheet: View {
    let choose: (CampaignTemplate) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Campaign Templates").font(.title2.bold())
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 200), spacing: 12)], spacing: 12) {
                ForEach(CampaignTemplate.all) { template in
                    Button {
                        choose(template)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Image(systemName: template.symbol).font(.title)
                            Text(template.name).font(.headline)
                            Text(template.description).foregroundStyle(.secondary)
                            Text("\(template.cells) × \(template.cells) cells · 50 px").font(.caption).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.bordered)
                }
            }
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }.keyboardShortcut(.cancelAction)
            }
        }
        .padding(20)
        .frame(width: 480)
    }
}
