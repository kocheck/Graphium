import GraphiumCore
import SwiftUI

/// Graphium > Settings…: General, and AI Tools for the MCP server (docs/MCP.md).
struct SettingsView: View {
    var body: some View {
        TabView {
            GeneralSettings()
                .tabItem { Label("General", systemImage: "gearshape") }
            AIToolsSettings()
                .tabItem { Label("AI Tools", systemImage: "sparkles") }
        }
    }
}

/// PARITY §6: the TS touch settings had no UI; this is the intended pane, limited to what
/// a Mac has: appearance and pen pressure.
struct GeneralSettings: View {
    @AppStorage(Prefs.theme) private var themeRaw = AppTheme.system.rawValue
    @AppStorage(Prefs.pressureEnabled) private var pressureEnabled = true
    @AppStorage(Prefs.pressureCurve) private var pressureCurve = PressureCurve.normal.rawValue

    var body: some View {
        Form {
            Section("Appearance") {
                Picker("Theme", selection: $themeRaw) {
                    ForEach(AppTheme.allCases) { Text($0.title).tag($0.rawValue) }
                }
                .onChange(of: themeRaw) { _, raw in (AppTheme(rawValue: raw) ?? .system).apply() }
            }
            Section {
                Toggle("Pressure sensitivity", isOn: $pressureEnabled)
                Picker("Pressure curve", selection: $pressureCurve) {
                    Text("Light").tag(PressureCurve.light.rawValue)
                    Text("Normal").tag(PressureCurve.normal.rawValue)
                    Text("Heavy").tag(PressureCurve.heavy.rawValue)
                }
                .disabled(!pressureEnabled)
            } header: {
                Text("Pen tablet")
            } footer: {
                Text("Marker strokes from a pen tablet vary in width with pressure. Mouse and trackpad strokes are constant.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(width: 440)
        .fixedSize()
    }
}
