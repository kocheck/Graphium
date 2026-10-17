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
enum PreferenceKey {
    static let theme = "graphium.theme"
    static let pressureEnabled = "graphium.pressureEnabled"
    static let pressureCurve = "graphium.pressureCurve"
    static let hiddenRecents = "graphium.hiddenRecents"
}

/// Pen settings both windows render with, so strokes look the same on the projector.
struct PenPreferences {
    @AppStorage(PreferenceKey.pressureEnabled) var enabled = true
    @AppStorage(PreferenceKey.pressureCurve) var curveRaw = PressureCurve.normal.rawValue

    var curve: PressureCurve { PressureCurve(rawValue: curveRaw) ?? .normal }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillFinishLaunching(_ notification: Notification) {
        // Launch into the Welcome window rather than the system open panel (PARITY §1.2).
        UserDefaults.standard.register(defaults: [
            "NSShowAppCentricOpenPanelInsteadOfUntitledFile": false,
        ])
        let stored = UserDefaults.standard.string(forKey: PreferenceKey.theme) ?? AppTheme.system.rawValue
        (AppTheme(rawValue: stored) ?? .system).apply()
    }

    func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool {
        false
    }
}

extension Notification.Name {
    /// `?` in either window (PARITY §1.4): opens About.
    static let graphiumShowAbout = Notification.Name("graphium.showAbout")
}
