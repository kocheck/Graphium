import GraphiumCore
import SwiftUI

/// Edits the selected tokens (PARITY §2.3). Values shown are resolved through the
/// library; edits are per-token overrides and apply to every selected token.
struct TokenInspector: View {
    @ObservedObject var document: CampaignDocument
    let selection: Set<String>
    /// Shows a toast in the Architect window (`isError` picks the style).
    var notify: (_ message: String, _ isError: Bool) -> Void = { _, _ in }
    @Environment(\.undoManager) private var undoManager

    @State private var nameDraft = ""
    /// What the field was seeded with; an unchanged draft is never written back.
    @State private var nameOrigin = ""
    @FocusState private var nameFocused: Bool
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
                .focused($nameFocused)
                .onSubmit {
                    commitName(ids: selection)
                    if tokens.count == 1 { resetDraft() }
                }
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
                        visionPresetButton(feet, active: commonVision(tokens) == feet)
                    }
                }
                LabeledContent("Radius") {
                    HStack(spacing: 4) {
                        TextField("Radius", value: visionFieldBinding(tokens), format: .number, prompt: Text("Mixed"))
                            .labelsHidden()
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                            .frame(width: 64)
                        Text("ft")
                        Stepper("Radius", value: visionBinding(tokens), in: 0...300, step: 5)
                            .labelsHidden()
                    }
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
                    LabeledContent("Scale") { Text("\(jsNumber(token.scale))×").monospacedDigit() }
                    LabeledContent("Position") {
                        Text("\(Int(jsRound(token.token.x))), \(Int(jsRound(token.token.y)))").monospacedDigit()
                    }
                    LabeledContent("Speed") { Text("\(jsNumber(token.movementSpeed)) ft").monospacedDigit() }
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
        // A typed name is kept when focus or the selection moves on (TS writes every keystroke).
        .onChange(of: nameFocused) { _, focused in
            if !focused { commitName(ids: selection) }
        }
        .onChange(of: selection) { old, _ in
            commitName(ids: old)
            resetDraft()
        }
        // Undo/redo and other windows: follow the tokens' names unless the field is being edited.
        .onChange(of: tokens.map(\.name)) { _, _ in
            if !nameFocused { resetDraft() }
        }
        .onDisappear { commitName(ids: selection) }
    }

    /// PARITY §2.3: writes the token's name, type and vision back as library defaults
    /// (campaign copy and app-wide library), then clears those overrides so the token
    /// inherits them. Scale stays a per-token override. One undo step reverts both copies.
    private func saveToLibrary(_ token: ResolvedToken, itemID: String) {
        let tokenID = token.token.id
        // A name typed but not yet committed is part of what gets saved (TS reads the live field).
        commitName(ids: selection)
        let saved = selected.first(where: { $0.token.id == tokenID }) ?? token
        let previousName = document.campaign.tokenLibrary.first(where: { $0.id == itemID })?.name ?? saved.name
        document.edit("Save to Library", undoManager: undoManager) { campaign in
            guard let index = campaign.tokenLibrary.firstIndex(where: { $0.id == itemID }) else { return }
            campaign.tokenLibrary[index].adoptDefaults(from: saved)
            if let t = campaign.activeMap.tokens.firstIndex(where: { $0.id == tokenID }) {
                campaign.activeMap.tokens[t].name = nil
                campaign.activeMap.tokens[t].type = nil
                campaign.activeMap.tokens[t].visionRadius = nil
            }
        }
        resetDraft()
        let store = LibraryStore.shared
        if let previous = store.items.first(where: { $0.id == itemID }) {
            var global = previous
            global.adoptDefaults(from: saved)
            // The in-memory copy changes even if writing index.json fails, so undo is registered either way.
            defer { store.registerUndo(restoring: previous, undoManager: undoManager) }
            do {
                try store.update(global)
            } catch {
                notify("Failed to save to library", true)
                return
            }
        }
        notify("Updated \"\(previousName)\" in library", false)
    }

    /// Seeds the field with the effective name (library-inherited included) for one
    /// token, or leaves it empty for several (TS).
    private func resetDraft() {
        let tokens = selected
        nameDraft = tokens.count == 1 ? tokens[0].name : ""
        nameOrigin = nameDraft
    }

    private func update(_ actionName: String, ids: Set<String>? = nil, _ change: @escaping (inout Token) -> Void) {
        let ids = ids ?? selection
        document.edit(actionName, undoManager: undoManager) { campaign in
            for index in campaign.activeMap.tokens.indices where ids.contains(campaign.activeMap.tokens[index].id) {
                change(&campaign.activeMap.tokens[index])
            }
        }
    }

    /// Writes the draft to `ids` if it was edited. An untouched field (including an
    /// empty multi-selection field) writes nothing.
    private func commitName(ids: Set<String>) {
        guard nameDraft != nameOrigin else { return }
        nameOrigin = nameDraft
        let trimmed = nameDraft.trimmingCharacters(in: .whitespaces)
        // An empty name clears the override, so the library name shows again.
        update("Rename Token", ids: ids) { $0.name = trimmed.isEmpty ? nil : trimmed }
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

    /// The selection's shared vision radius (unset counts as 0), or nil when mixed.
    private func commonVision(_ tokens: [ResolvedToken]) -> Double? {
        let values = Set(tokens.map { $0.visionRadius ?? 0 })
        return values.count == 1 ? values.first : nil
    }

    /// The active preset is highlighted (TS).
    @ViewBuilder
    private func visionPresetButton(_ feet: Double, active: Bool) -> some View {
        let button = Button(feet == 0 ? "None" : "\(Int(feet)) ft") { setVision(feet) }
        if active {
            button.buttonStyle(.borderedProminent)
        } else {
            button.buttonStyle(.bordered)
        }
    }

    /// Typed vision radius, clamped to 0…300 ft (TS number field). Empty when mixed.
    private func visionFieldBinding(_ tokens: [ResolvedToken]) -> Binding<Double?> {
        Binding(
            get: { commonVision(tokens) },
            set: { newValue in
                guard let newValue, newValue.isFinite else { return }
                setVision(min(max(newValue, 0), 300))
            })
    }

}
