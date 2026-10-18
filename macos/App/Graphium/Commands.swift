import GraphiumCore
import SwiftUI

/// The campaign whose window is frontmost, for menu commands.
struct FocusedCampaignKey: FocusedValueKey {
    typealias Value = CampaignDocument
}

/// Architect-window actions the menus can trigger.
struct ArchitectActions {
    var showPalette: () -> Void
    var showDungeon: () -> Void
    var togglePerformanceMonitor: () -> Void
    var isPerformanceMonitorShown: Bool
    var exportLegacy: () -> Void
    var tool: CanvasTool
    var selectTool: (CanvasTool) -> Void
    var showMapSettings: () -> Void
    var newMap: () -> Void
    /// Nil when calibration isn't possible (no map image, or not a square grid).
    var calibrate: (() -> Void)?
    var isDaylight: Bool
    var toggleDaylight: () -> Void
    /// Nil when nothing has been explored.
    var resetFog: (() -> Void)?
    /// Nil when nothing is selected.
    var deleteSelection: (() -> Void)?
    var showConsoleSettings: () -> Void
    var zoomIn: () -> Void
    var zoomOut: () -> Void
    var zoomToFit: () -> Void
    /// Frames the World View on what the Architect canvas is showing.
    var showViewOnWorld: () -> Void
    /// Nil when no selected token is waiting to join the initiative order.
    var addToInitiative: (() -> Void)?
    /// These four are nil while the active map has no initiative order.
    var nextTurn: (() -> Void)?
    var previousTurn: (() -> Void)?
    var sortInitiative: (() -> Void)?
    var clearInitiative: (() -> Void)?
}

struct FocusedArchitectActionsKey: FocusedValueKey {
    typealias Value = ArchitectActions
}

extension FocusedValues {
    var campaignDocument: CampaignDocument? {
        get { self[FocusedCampaignKey.self] }
        set { self[FocusedCampaignKey.self] = newValue }
    }

    var architectActions: ArchitectActions? {
        get { self[FocusedArchitectActionsKey.self] }
        set { self[FocusedArchitectActionsKey.self] = newValue }
    }
}

/// Edit > Command Palette (⌘K, PARITY §1.3). The Architect window also answers ⌘P, as TS does
/// (PARITY §1.4), without a second menu item of the same name.
struct ArchitectCommands: Commands {
    @FocusedValue(\.architectActions) private var actions

    var body: some Commands {
        CommandGroup(after: .textEditing) {
            Button("Command Palette…") { actions?.showPalette() }
                .keyboardShortcut("k")
                .disabled(actions == nil)
        }
        // ⌘P is the palette and ⇧⌘P pauses the World View; maps aren't printable.
        CommandGroup(replacing: .printItem) {}
    }
}

/// File > Export as .graphium… for the web/Electron app (PARITY §5.2).
struct ExportCommands: Commands {
    @FocusedValue(\.architectActions) private var actions

    var body: some Commands {
        CommandGroup(after: .saveItem) {
            Button("Export as .graphium…") { actions?.exportLegacy() }
                .keyboardShortcut("e", modifiers: [.command, .shift])
                .disabled(actions == nil)
        }
    }
}

/// View menu: World View and pause (PARITY §1.3, §1.12).
struct WorldViewCommands: Commands {
    @FocusedValue(\.campaignDocument) private var document
    @FocusedValue(\.architectActions) private var actions

    var body: some Commands {
        CommandGroup(after: .toolbar) {
            WorldViewMenuItems(document: document, actions: actions)
        }
    }
}

private struct WorldViewMenuItems: View {
    let document: CampaignDocument?
    let actions: ArchitectActions?
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Divider()
        Button("World View (Projector)") {
            if let document { openWindow(id: WorldWindow.id, value: document.sessionID) }
        }
        .keyboardShortcut("w", modifiers: [.command, .shift])
        .disabled(document == nil)

        Button("Show This View on World View") { actions?.showViewOnWorld() }
            .keyboardShortcut("y", modifiers: [.command, .shift])
            .disabled(actions == nil)

        if let document {
            PauseMenuItem(document: document)
        } else {
            Button("Pause World View") {}
                .keyboardShortcut("p", modifiers: [.command, .shift])
                .disabled(true)
        }
        Divider()
    }
}

private struct PauseMenuItem: View {
    @ObservedObject var document: CampaignDocument

    var body: some View {
        Button(document.isPaused ? "Resume World View" : "Pause World View") {
            document.isPaused.toggle()
        }
        .keyboardShortcut("p", modifiers: [.command, .shift])
    }
}

/// About, Help, Theme, Performance Monitor and Welcome (PARITY §1.3, §1.8, §1.11, §1.13).
struct ShellCommands: Commands {
    @FocusedValue(\.architectActions) private var actions
    @AppStorage(Prefs.theme) private var themeRaw = AppTheme.system.rawValue

    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            AboutMenuItem(title: "About Graphium", tab: .about)
        }
        CommandGroup(replacing: .help) {
            AboutMenuItem(title: "Graphium Tutorial", tab: .tutorial)
            AboutMenuItem(title: "Keyboard Shortcuts", tab: .shortcuts)
            Divider()
            Link("Report a Bug…", destination: AppLinks.issues)
            Link("View Source on GitHub", destination: AppLinks.source)
        }
        CommandGroup(before: .toolbar) {
            Button("Zoom In") { actions?.zoomIn() }
                .keyboardShortcut("=", modifiers: .command)
                .disabled(actions == nil)
            Button("Zoom Out") { actions?.zoomOut() }
                .keyboardShortcut("-", modifiers: .command)
                .disabled(actions == nil)
            Button("Zoom to Fit") { actions?.zoomToFit() }
                .keyboardShortcut("0", modifiers: .command)
                .disabled(actions == nil)
            Divider()
            Picker("Theme", selection: Binding(
                get: { themeRaw },
                set: { raw in
                    themeRaw = raw
                    (AppTheme(rawValue: raw) ?? .system).apply()
                })
            ) {
                ForEach(AppTheme.allCases) { Text($0.title).tag($0.rawValue) }
            }
            Toggle(
                "Performance Monitor",
                isOn: Binding(get: { actions?.isPerformanceMonitorShown ?? false }, set: { _ in actions?.togglePerformanceMonitor() })
            )
            .keyboardShortcut("m", modifiers: [.command, .shift])
            .disabled(actions == nil)
            Divider()
        }
        CommandGroup(before: .windowList) {
            WelcomeMenuItem()
            Divider()
        }
    }
}

private struct AboutMenuItem: View {
    let title: String
    let tab: AboutModel.Tab
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button(title) { ShowAbout(openWindow: openWindow)(tab) }
    }
}

private struct WelcomeMenuItem: View {
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button(WelcomeView.menuTitle) { openWindow(id: WelcomeView.windowID) }
            .keyboardShortcut("1", modifiers: [.command, .shift])
    }
}

/// Tools, Map and Session Console menus (every action reachable from a menu, so Help
/// search and System Settings > Keyboard shortcuts can find it). Single-letter tool
/// keys stay on the canvas; menu key equivalents would steal typing in text fields.
struct EditorCommands: Commands {
    @FocusedValue(\.architectActions) private var actions
    @FocusedValue(\.campaignDocument) private var document

    var body: some Commands {
        CommandMenu("Tools") {
            ForEach(CanvasTool.allCases) { tool in
                Toggle(
                    "\(tool.title) (\(String(tool.key).uppercased()))",
                    isOn: Binding(get: { actions?.tool == tool }, set: { if $0 { actions?.selectTool(tool) } }))
            }
            .disabled(actions == nil)
        }
        CommandMenu("Map") {
            Button("Map Settings…") { actions?.showMapSettings() }
                .keyboardShortcut(",", modifiers: [.command, .option])
                .disabled(actions == nil)
            Button("New Map…") { actions?.newMap() }
                .keyboardShortcut("n", modifiers: [.command, .option])
                .disabled(actions == nil)
            // ⇧⌘D, as on the Welcome card: ⇧⌘G is Edit > Find > Find Previous on macOS.
            Button("Generate Dungeon…") { actions?.showDungeon() }
                .keyboardShortcut("d", modifiers: [.command, .shift])
                .disabled(actions == nil)
            Button("Calibrate Map Image…") { actions?.calibrate?() }
                .disabled(actions?.calibrate == nil)
            Divider()
            Toggle("Daylight", isOn: Binding(get: { actions?.isDaylight ?? false }, set: { _ in actions?.toggleDaylight() }))
                .disabled(actions == nil)
            Button("Reset Explored Fog…") { actions?.resetFog?() }
                .disabled(actions?.resetFog == nil)
            if let document {
                MapAnimationMenuItem(document: document)
            } else {
                Toggle("Pause Animation", isOn: .constant(false)).disabled(true)
            }
            Divider()
            DoorsMenu(document: actions == nil ? nil : document)
            Divider()
            Button("Delete Selection") {
                // ⌘⌫ in an inspector field is the text system's Delete to Beginning of Line, not
                // a request to delete the token or note being edited.
                if let text = NSApp.keyWindow?.firstResponder as? NSTextView, text.isEditable {
                    text.deleteToBeginningOfLine(nil)
                } else {
                    actions?.deleteSelection?()
                }
            }
            .keyboardShortcut(.delete, modifiers: [.command])
                .disabled(actions?.deleteSelection == nil)
        }
        CommandMenu("Session") {
            if let document {
                SessionMenuItems(document: document, showSettings: actions?.showConsoleSettings)
            } else {
                // The same items, disabled, so the menu keeps its shape with no campaign open.
                Button("Stop Music") {}.disabled(true)
                Toggle("Duck Music", isOn: .constant(false)).disabled(true)
                Button("Return to Map") {}.disabled(true)
                Button("Play Test Tone") {}.disabled(true)
                Divider()
                Button("Session Console Window") {}
                    .keyboardShortcut("c", modifiers: [.command, .option])
                    .disabled(true)
                Button("Session Console Settings…") {}.disabled(true)
            }
            // Turn order on the active map (issue #356). ⌘] and ⌘[ step it, as Safari's
            // Forward and Back do; text fields don't use them.
            Divider()
            Button("Add Selection to Initiative") { actions?.addToInitiative?() }
                .disabled(actions?.addToInitiative == nil)
            Button("Next Turn") { actions?.nextTurn?() }
                .keyboardShortcut("]", modifiers: .command)
                .disabled(actions?.nextTurn == nil)
            Button("Previous Turn") { actions?.previousTurn?() }
                .keyboardShortcut("[", modifiers: .command)
                .disabled(actions?.previousTurn == nil)
            Button("Sort Initiative") { actions?.sortInitiative?() }
                .disabled(actions?.sortInitiative == nil)
            Button("Clear Initiative") { actions?.clearInitiative?() }
                .disabled(actions?.clearInitiative == nil)
        }
    }
}

/// Map > Pause Animation: holds a video map background on its frame in the Architect and
/// World View. Session-only; available while the active map's background is a video.
private struct MapAnimationMenuItem: View {
    @ObservedObject var document: CampaignDocument

    var body: some View {
        let isVideo = document.campaign.activeMap.background.map { isVideoAsset($0.src) } ?? false
        Toggle("Pause Animation", isOn: $document.isMapAnimationPaused)
            .disabled(!isVideo)
    }
}

/// Map > Doors: the sidebar's bulk door controls (PARITY §2.1), so they have a menu home and a
/// place in Help search. Every item stays listed, disabled when there's nothing for it to do.
private struct DoorsMenu: View {
    let document: CampaignDocument?

    var body: some View {
        if let document {
            Items(document: document)
        } else {
            Menu("Doors") {
                Button("Open All Unlocked Doors") {}
                Button("Close All Open Doors") {}
                Button("Unlock All Doors") {}
                Button("Reveal All Hidden Doors") {}
            }
            .disabled(true)
        }
    }

    private struct Items: View {
        @ObservedObject var document: CampaignDocument

        var body: some View {
            let doors = document.campaign.activeMap.doors
            let hidden = Set(doors.filter { $0.isHidden == true }.map(\.id))
            // A nil undo manager uses the Architect window's, as the World View's edits do.
            Menu("Doors") {
                Button("Open All Unlocked Doors") {
                    document.edit("Open Doors", undoManager: nil) { $0.activeMap.setAllUnlockedDoors(open: true) }
                }
                .disabled(!doors.contains { !$0.isOpen && !$0.isLocked && $0.isHidden != true })
                Button("Close All Open Doors") {
                    document.edit("Close Doors", undoManager: nil) { $0.activeMap.setAllUnlockedDoors(open: false) }
                }
                .disabled(!doors.contains { $0.isOpen && !$0.isLocked })
                Button("Unlock All Doors") {
                    document.edit("Unlock Doors", undoManager: nil) { $0.activeMap.setAllDoorLocks(locked: false) }
                }
                .disabled(!doors.contains(where: \.isLocked))
                Button("Reveal All Hidden Doors") {
                    document.edit("Reveal Doors", undoManager: nil) { $0.activeMap.setDoorsHidden(hidden, hidden: false) }
                }
                .disabled(hidden.isEmpty)
            }
            .disabled(doors.isEmpty)
        }
    }
}

private struct SessionMenuItems: View {
    @ObservedObject var document: CampaignDocument
    let showSettings: (() -> Void)?
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        let runtime = document.sessionRuntime
        Button("Stop Music") { document.dispatch(.stop) }
            .disabled(runtime.audio.trackId == nil)
        Toggle("Duck Music", isOn: Binding(get: { runtime.ducked }, set: { document.dispatch(.setDucked($0)) }))
        Button("Return to Map") { document.dispatch(.returnToMap) }
            .disabled(!runtime.stageVisible)
        Button("Play Test Tone") { document.dispatch(.fireSfx(sfxId: "test-tone")) }
        Divider()
        Button("Session Console Window") { openWindow(id: SessionConsoleWindow.id, value: document.sessionID) }
            .keyboardShortcut("c", modifiers: [.command, .option])
        Button("Session Console Settings…") { showSettings?() }
            .disabled(showSettings == nil)
    }
}
