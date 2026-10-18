import GraphiumCore
import SwiftUI

/// Edits the selected spell effects (native): label, shape, size, direction, look, the token that
/// carries it, and whether players see it.
struct EffectInspector: View {
    @ObservedObject var document: CampaignDocument
    let selection: Set<String>
    @Environment(\.undoManager) private var undoManager

    /// The label and custom colour are written back after a pause, so undo steps are words and
    /// finished colour picks rather than keystrokes and every step of a colour drag.
    @State private var label = ""
    @State private var color: Color = .white
    @State private var colorEdited = false
    @State private var draftID: String?

    private var effects: [SpellEffect] {
        document.campaign.activeMap.effects.filter { selection.contains($0.id) }
    }

    var body: some View {
        let effects = self.effects
        Form {
            if effects.count == 1, let effect = effects.first {
                single(effect)
            } else {
                Section {
                    visibilityToggle(effects)
                    lookPicker(effects)
                } header: {
                    Text("\(effects.count) Effects Selected").font(.headline)
                }
            }
        }
        .formStyle(.grouped)
        .onAppear { resetDraft() }
        .onChange(of: selection) { _, _ in
            commit()
            resetDraft()
        }
        .onChange(of: effects) { _, _ in
            if effects.first?.id != draftID { resetDraft() }
        }
        .task(id: label) {
            try? await Task.sleep(for: .seconds(0.8))
            if !Task.isCancelled { commit() }
        }
        .task(id: colorEdited ? color.description : "") {
            try? await Task.sleep(for: .seconds(0.4))
            if !Task.isCancelled { commitColor() }
        }
        .onDisappear { commit() }
    }

    @ViewBuilder
    private func single(_ effect: SpellEffect) -> some View {
        Section {
            TextField("Label", text: $label, prompt: Text(effect.sizeDescription))
                .onSubmit { commit() }
            Picker("Shape", selection: binding(effect, \.shape, "Change Shape")) {
                ForEach(SpellEffect.Shape.allCases) { shape in
                    Text(shape.title).tag(shape)
                }
            }
            // A pop-up, like Look below: four segments overflow the inspector at its narrowest.
            .pickerStyle(.menu)
        } header: {
            Text(effect.displayLabel).font(.headline)
        }

        Section("Size") {
            Stepper(value: feetBinding(effect, \.size, "Resize Effect"), in: SpellEffect.minimumSize...1000, step: 5) {
                LabeledContent(effect.shape.sizeName.capitalized) {
                    Text("\(jsNumber(effect.size)) ft").readoutStyle()
                }
            }
            if effect.shape == .line {
                Stepper(value: feetBinding(effect, \.width, "Change Line Width"), in: SpellEffect.minimumSize...100, step: 5) {
                    LabeledContent("Width") {
                        Text("\(jsNumber(effect.width)) ft").readoutStyle()
                    }
                }
            }
            if effect.shape.hasDirection {
                Stepper {
                    LabeledContent("Direction") {
                        Text("\(jsNumber(effect.angle.rounded()))°").readoutStyle()
                    }
                } onIncrement: {
                    rotate(effect, by: 15)
                } onDecrement: {
                    rotate(effect, by: -15)
                }
                .help("Clockwise from pointing right. The arrow keys turn it too; Shift turns 45°.")
            }
        }

        Section("Look") {
            lookPicker([effect])
            ColorPicker("Colour", selection: $color, supportsOpacity: false)
                .onChange(of: color) { _, _ in colorEdited = true }
            if effect.color != nil {
                // Its own row: beside the well it pushed the swatch onto a second line.
                Button("Use \(effect.look.title) Colour") {
                    edit(effect, "Reset Colour") { $0.color = nil }
                    resetDraft()
                }
                .buttonStyle(.link)
            }
        }

        Section {
            Picker("Carried by", selection: carrierBinding(effect)) {
                Text("Nobody").tag(String?.none)
                ForEach(carriers) { carrier in
                    Text(carrier.name).tag(String?.some(carrier.id))
                }
            }
            visibilityToggle([effect])
        } footer: {
            Text("A token that carries an effect takes it along when it moves, like Spirit Guardians.")
        }

        Section {
            Button("Delete Effect", role: .destructive) {
                document.edit("Delete Effect", undoManager: undoManager) { $0.activeMap.removeItems([effect.id]) }
            }
        }
    }

    private struct Carrier: Identifiable {
        let id: String
        let name: String
    }

    /// Tokens on this map, by name (numbered when several share one).
    private var carriers: [Carrier] {
        let campaign = document.campaign
        let library = campaign.libraryIndex
        let names = campaign.activeMap.tokens.map { ResolvedToken($0, library: library).name }
        var seen: [String: Int] = [:]
        return zip(campaign.activeMap.tokens, names).map { token, name in
            let count = names.filter { $0 == name }.count
            guard count > 1 else { return Carrier(id: token.id, name: name) }
            seen[name, default: 0] += 1
            return Carrier(id: token.id, name: "\(name) \(seen[name]!)")
        }
    }

    private func lookPicker(_ effects: [SpellEffect]) -> some View {
        Picker(
            "Look",
            selection: Binding(
                get: { Set(effects.map(\.look)).count == 1 ? effects.first?.look : nil },
                set: { look in
                    guard let look else { return }
                    let ids = effects.map(\.id)
                    document.edit("Change Look to \(look.title)", undoManager: undoManager) { campaign in
                        for id in ids {
                            campaign.activeMap.updateEffect(id: id) {
                                $0.look = look
                                $0.color = nil
                            }
                        }
                    }
                    resetDraft()
                })
        ) {
            if Set(effects.map(\.look)).count > 1 { Text("Mixed").tag(SpellEffect.Look?.none) }
            ForEach(SpellEffect.Look.allCases) { look in
                Label {
                    Text(look.title)
                } icon: {
                    Image(systemName: "circle.fill").foregroundStyle(Color(nsColor: NSColor(hex: look.tint) ?? .gray))
                }
                .tag(SpellEffect.Look?.some(look))
            }
        }
    }

    private func visibilityToggle(_ effects: [SpellEffect]) -> some View {
        Toggle(
            "Show to Players",
            isOn: Binding(
                get: { !effects.isEmpty && effects.allSatisfy { !$0.isHidden } },
                set: { shown in
                    let ids = Set(effects.map(\.id))
                    let plural = ids.count == 1 ? "Effect" : "Effects"
                    document.edit(shown ? "Show \(plural) to Players" : "Hide \(plural) from Players", undoManager: undoManager) {
                        $0.activeMap.setEffectsHidden(ids, hidden: !shown)
                    }
                })
        )
        .help("Players see the area on the World View")
    }

    private func binding<T: Equatable>(_ effect: SpellEffect, _ key: WritableKeyPath<SpellEffect, T>, _ name: String)
        -> Binding<T>
    {
        Binding(
            get: { effect[keyPath: key] },
            set: { value in
                guard value != effect[keyPath: key] else { return }
                edit(effect, name) { $0[keyPath: key] = value }
            })
    }

    private func feetBinding(_ effect: SpellEffect, _ key: WritableKeyPath<SpellEffect, Double>, _ name: String) -> Binding<Double> {
        Binding(
            get: { effect[keyPath: key] },
            set: { value in
                let feet = SpellEffect.roundedFeet(value)
                guard feet != effect[keyPath: key] else { return }
                edit(effect, name) { $0[keyPath: key] = feet }
            })
    }

    private func carrierBinding(_ effect: SpellEffect) -> Binding<String?> {
        Binding(
            get: { effect.tokenID },
            set: { tokenID in
                guard tokenID != effect.tokenID else { return }
                document.edit(tokenID == nil ? "Leave Effect on the Map" : "Give Effect to Token", undoManager: undoManager) {
                    campaign in
                    let library = campaign.libraryIndex
                    campaign.activeMap.attachEffects([effect.id], to: tokenID, library: library)
                }
            })
    }

    private func rotate(_ effect: SpellEffect, by degrees: Double) {
        document.edit("Rotate Effect", undoManager: undoManager) { $0.activeMap.rotateEffects([effect.id], by: degrees) }
    }

    private func edit(_ effect: SpellEffect, _ name: String, _ change: @escaping (inout SpellEffect) -> Void) {
        document.edit(name, undoManager: undoManager) { $0.activeMap.updateEffect(id: effect.id, change) }
    }

    private func resetDraft() {
        let effects = self.effects
        if effects.count == 1, let effect = effects.first {
            draftID = effect.id
            label = effect.label
            color = Color(nsColor: NSColor(hex: effect.tint) ?? .white)
        } else {
            draftID = nil
            label = ""
        }
        colorEdited = false
    }

    private func commit() {
        guard let id = draftID, let effect = document.campaign.activeMap.effects.first(where: { $0.id == id }) else { return }
        let next = label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard next != effect.label else { return }
        document.edit("Rename Effect", undoManager: undoManager) { $0.activeMap.updateEffect(id: id) { $0.label = next } }
    }

    private func commitColor() {
        guard colorEdited, let id = draftID, let hex = NSColor(color).usingColorSpace(.sRGB)?.hexString,
            let effect = document.campaign.activeMap.effects.first(where: { $0.id == id }), hex != effect.tint
        else { return }
        colorEdited = false
        document.edit("Change Effect Colour", undoManager: undoManager) { $0.activeMap.updateEffect(id: id) { $0.color = hex } }
    }
}
