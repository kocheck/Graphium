import AppKit
import GraphiumCore
import SwiftUI

/// View > Theme (PARITY §1.11). System follows macOS live; every window switches together
/// because the appearance is set app-wide.
enum AppTheme: String, CaseIterable, Identifiable {
    case light, dark, system

    var id: Self { self }

    var title: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .system: return "System"
        }
    }

    var symbol: String {
        switch self {
        case .light: return "sun.max"
        case .dark: return "moon"
        case .system: return "circle.lefthalf.filled"
        }
    }

    /// Light → Dark → System, like the TS home footer button.
    var next: AppTheme {
        switch self {
        case .light: return .dark
        case .dark: return .system
        case .system: return .light
        }
    }

    @MainActor
    func apply() {
        switch self {
        case .light: NSApp.appearance = NSAppearance(named: .aqua)
        case .dark: NSApp.appearance = NSAppearance(named: .darkAqua)
        case .system: NSApp.appearance = nil
        }
    }
}

/// UserDefaults keys shared by @AppStorage users.
enum Prefs {
    static let theme = "graphium.theme"
    static let pressureEnabled = "graphium.pressureEnabled"
    static let pressureCurve = "graphium.pressureCurve"
    static let hiddenRecents = "graphium.hiddenRecents"
    static let mcpEnabled = "graphium.mcpEnabled"
    static let mcpFolder = "graphium.mcpFolder"
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillFinishLaunching(_ notification: Notification) {
        // Launch into the Welcome window rather than the system open panel (PARITY §1.2).
        UserDefaults.standard.register(defaults: [
            "NSShowAppCentricOpenPanelInsteadOfUntitledFile": false,
        ])
        let stored = UserDefaults.standard.string(forKey: Prefs.theme) ?? AppTheme.system.rawValue
        (AppTheme(rawValue: stored) ?? .system).apply()
        // Point AI apps at this copy of the server, wherever the app now lives.
        MCPInstall.refresh()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        #if DEBUG
            MainActor.assumeIsolated { UIAudit.runIfRequested() }
        #endif
    }

    func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool {
        false
    }

    /// Clicking the Dock icon with no windows open shows the Welcome window, as Electron
    /// re-creates its main window on `activate` (PARITY §1.1). Minimised windows are left
    /// for AppKit to restore.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        guard !flag, !sender.windows.contains(where: { $0.isMiniaturized }),
            let found = Self.menuItem(titled: WelcomeView.menuTitle, in: sender.mainMenu)
        else { return true }
        // Window > Welcome to Graphium is a SwiftUI command that calls `openWindow`.
        found.menu.performActionForItem(at: found.index)
        return false
    }

    private static func menuItem(titled title: String, in menu: NSMenu?) -> (menu: NSMenu, index: Int)? {
        guard let menu else { return nil }
        for (index, item) in menu.items.enumerated() {
            if item.title == title, item.isEnabled { return (menu, index) }
            if let found = menuItem(titled: title, in: item.submenu) { return found }
        }
        return nil
    }
}

extension Notification.Name {
    /// `?` in either window (PARITY §1.4): opens About.
    static let graphiumShowAbout = Notification.Name("graphium.showAbout")
}
