import GraphiumCore
import SwiftUI

/// Edits the selected tokens (PARITY §2.3). Values shown are resolved through the
/// library; edits are per-token overrides and apply to every selected token.
struct TokenInspector: View {
    @ObservedObject var document: CampaignDocument
    let selection: Set<String>
    @Environment(\.undoManager) private var undoManager

    @State private var nameDraft = ""
    // Collapsible sections, remembered across launches.
    @AppStorage("graphium.inspector.visionExpanded") private var visionExpanded = true
    @AppStorage("graphium.inspector.detailsExpanded") private var detailsExpanded = true

    static let visionPresets: [Double] = [0, 30, 60, 120]

    private var library: [String: TokenLibraryItem] { document.campaign.libraryIndex }

    private var selected: [ResolvedToken] {
        document.campaign.activeMap.tokens
            .filter { selection.contains($0.id) }
            .map { ResolvedToken($0, library: library) }
    }

    var body: some View {
        let tokens = selected
        Form {
            Section {
                TextField(
                    "Name", text: $nameDraft, prompt: Text(tokens.count > 1 ? "Multiple tokens" : "Token")
                )
                .onSubmit { commitName() }
            } header: {
                Text(tokens.count == 1 ? tokens[0].name : "\(tokens.count) Tokens Selected")
                    .font(.headline)
            }

            Section {
                Picker("Type", selection: typeBinding(tokens)) {
                    Text("PC").tag(CreatureType?.some(.pc))
                    Text("NPC").tag(CreatureType?.some(.npc))
                    if tokens.contains(where: { $0.type == nil }) || Set(tokens.map(\.type)).count > 1 {
                        Text("—").tag(CreatureType?.none)
                    }
                }
                .pickerStyle(.segmented)
                Text("Only PC tokens emit vision for Fog of War.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Vision", isExpanded: $visionExpanded) {
                HStack {
                    ForEach(Self.visionPresets, id: \.self) { feet in
                        Button(feet == 0 ? "None" : "\(Int(feet)) ft") { setVision(feet) }
                            .buttonStyle(.bordered)
                    }
                }
                Stepper(value: visionBinding(tokens), in: 0...300, step: 5) {
                    Text(visionLabel(tokens))
                }
            }

            if tokens.count == 1, let token = tokens.first, let itemID = token.token.libraryItemId,
                document.campaign.tokenLibrary.contains(where: { $0.id == itemID })
            {
                Section {
                    Button("Save to Library") { saveToLibrary(token, itemID: itemID) }
                } footer: {
                    Text("Makes this token's name, type and vision the library defaults.")
                }
            }

            if tokens.count == 1, let token = tokens.first {
                Section("Details", isExpanded: $detailsExpanded) {
                    LabeledContent("Scale", value: "\(jsNumber(token.scale))x")
                    LabeledContent("Position", value: "\(Int(jsRound(token.token.x))), \(Int(jsRound(token.token.y)))")
                    LabeledContent("Speed", value: "\(jsNumber(token.movementSpeed)) ft")
                    if !token.inherited.isEmpty {
                        Text("Some values come from the library item.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .formStyle(.grouped)
        .onAppear { resetDraft() }
        .onChange(of: selection) { _, _ in resetDraft() }
    }

    /// PARITY §2.3: writes the token's values back as library defaults (campaign copy
    /// and app-wide library), then clears the overrides so the token inherits them.
    private func saveToLibrary(_ token: ResolvedToken, itemID: String) {
        let tokenID = token.token.id
        document.edit("Save to Library", undoManager: undoManager) { campaign in
            guard let index = campaign.tokenLibrary.firstIndex(where: { $0.id == itemID }) else { return }
            campaign.tokenLibrary[index].adoptDefaults(from: token)
            if let t = campaign.activeMap.tokens.firstIndex(where: { $0.id == tokenID }) {
                campaign.activeMap.tokens[t].name = nil
                campaign.activeMap.tokens[t].type = nil
                campaign.activeMap.tokens[t].visionRadius = nil
                campaign.activeMap.tokens[t].scale = nil
            }
        }
        let store = LibraryStore.shared
        if var global = store.items.first(where: { $0.id == itemID }) {
            global.adoptDefaults(from: token)
            try? store.update(global)
        }
    }

    private func resetDraft() {
        let tokens = selected
        nameDraft = tokens.count == 1 ? (tokens[0].token.name ?? "") : ""
    }

    private func update(_ actionName: String, _ change: @escaping (inout Token) -> Void) {
        let ids = selection
        document.edit(actionName, undoManager: undoManager) { campaign in
            for index in campaign.activeMap.tokens.indices where ids.contains(campaign.activeMap.tokens[index].id) {
                change(&campaign.activeMap.tokens[index])
            }
        }
    }

    private func commitName() {
        let trimmed = nameDraft.trimmingCharacters(in: .whitespaces)
        // An empty name clears the override, so the library name shows again.
        update("Rename Token") { $0.name = trimmed.isEmpty ? nil : trimmed }
    }

    private func typeBinding(_ tokens: [ResolvedToken]) -> Binding<CreatureType?> {
        Binding(
            get: { Set(tokens.map(\.type)).count == 1 ? tokens.first?.type : nil },
            set: { newValue in
                guard let newValue else { return }
                update("Change Token Type") { $0.type = newValue }
            })
    }

    private func setVision(_ feet: Double) {
        update("Change Vision") { $0.visionRadius = feet }
    }

    private func visionBinding(_ tokens: [ResolvedToken]) -> Binding<Double> {
        Binding(
            get: { tokens.first?.visionRadius ?? 0 },
            set: { setVision($0) })
    }

    private func visionLabel(_ tokens: [ResolvedToken]) -> String {
        let values = Set(tokens.map { $0.visionRadius ?? 0 })
        guard values.count == 1, let feet = values.first else { return "Mixed" }
        return feet == 0 ? "No vision" : "\(jsNumber(feet)) ft"
    }
}
