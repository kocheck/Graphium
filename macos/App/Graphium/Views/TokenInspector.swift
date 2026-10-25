import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// Edits the selected tokens (PARITY §2.3). Values shown are resolved through the
/// library; edits are per-token overrides and apply to every selected token.
struct TokenInspector: View {
    @ObservedObject var document: CampaignDocument
    let selection: Set<String>
    /// Shows a toast in the Architect window (`isError` picks the style).
    var notify: (_ message: String, _ isError: Bool) -> Void = { _, _ in }
    /// Change Image…: the Architect's file picker, then the cropper.
    var chooseImageFile: () -> Void = {}
    /// An image file dropped on the image well, for the cropper.
    var useImageFile: (URL) -> Void = { _ in }
    @Environment(\.undoManager) private var undoManager

    @State private var showingLibraryPicker = false
    @State private var imageDropTargeted = false

    @State private var nameDraft = ""
    /// What the field was seeded with; an unchanged draft is never written back.
    @State private var nameOrigin = ""
    @FocusState private var nameFocused: Bool
    /// The name players see (decision 014); same draft rules as the name.
    @State private var playerNameDraft = ""
    @State private var playerNameOrigin = ""
    @FocusState private var playerNameFocused: Bool
    /// The amount the Damage and Heal buttons apply.
    @State private var hitPointAmount: Int?
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
            identitySection(tokens)

            playersSection(tokens)

            initiativeSection(tokens)

            if tokens.count == 1, let token = tokens.first {
                hitPointsSection(token.token)
            }

            Section("Vision", isExpanded: $visionExpanded) {
                // Small buttons, so "120 ft" fits at the inspector's narrowest.
                HStack(spacing: 6) {
                    ForEach(Self.visionPresets, id: \.self) { feet in
                        visionPresetButton(feet, active: commonVision(tokens) == feet)
                    }
                }
                .controlSize(.small)
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
                LabeledContent("Darkvision") {
                    HStack(spacing: 4) {
                        TextField(
                            "Darkvision", value: darkvisionFieldBinding(tokens), format: .number, prompt: Text("Mixed")
                        )
                        .labelsHidden()
                        .multilineTextAlignment(.trailing)
                        .monospacedDigit()
                        .frame(width: 64)
                        Text("ft")
                        Stepper(
                            "Darkvision",
                            value: Binding(get: { tokens.first?.darkvision ?? 0 }, set: { setDarkvision($0) }),
                            in: 0...300, step: 30
                        )
                        .labelsHidden()
                    }
                }
                Text(
                    document.campaign.activeMap.ambientLight == nil
                        ? "Lighting is off on this map, so PCs see out to their radius and darkvision does nothing."
                        : "Lighting is on: PCs see what is lit, and darkness within their darkvision. The radius isn't used."
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            if tokens.count == 1, let token = tokens.first, let itemID = token.token.libraryItemId,
                document.campaign.tokenLibrary.contains(where: { $0.id == itemID })
            {
                Section {
                    Button("Save to Library") { saveToLibrary(token, itemID: itemID) }
                } footer: {
                    Text("Makes this token's name, type, vision and darkvision the library defaults.")
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
        .onChange(of: playerNameFocused) { _, focused in
            if !focused { commitPlayerName(ids: selection) }
        }
        .onChange(of: selection) { old, _ in
            commitName(ids: old)
            commitPlayerName(ids: old)
            resetDraft()
        }
        // Undo/redo and other windows: follow the tokens' names unless the field is being edited.
        .onChange(of: tokens.map(\.name)) { _, _ in
            if !nameFocused { resetDraft() }
        }
        .onChange(of: tokens.map(\.token.playerName)) { _, _ in
            if !playerNameFocused, !nameFocused { resetDraft() }
        }
        .onDisappear {
            commitName(ids: selection)
            commitPlayerName(ids: selection)
        }
    }

    /// What players read under the token on the World View: its name, another name, or none.
    private func playersSection(_ tokens: [ResolvedToken]) -> some View {
        let showsName = !tokens.contains { $0.token.playerName == "" }
        return Section {
            Toggle(
                "Show Name to Players",
                isOn: Binding(
                    get: { showsName },
                    set: { show in
                        commitPlayerName(ids: selection)
                        update(show ? "Show Token Name to Players" : "Hide Token Name from Players") {
                            $0.playerName = show ? nil : ""
                        }
                    }))
            if showsName {
                TextField(
                    "Players See", text: $playerNameDraft,
                    prompt: Text(tokens.count == 1 ? tokens[0].name : "Each token's name")
                )
                .focused($playerNameFocused)
                .onSubmit { commitPlayerName(ids: selection) }
            }
        } footer: {
            Text(
                showsName
                    ? "Shown under the token on the World View. Leave it empty to show the token's name."
                    : "Players see the token with no name.")
        }
    }

    /// Add to or Remove from Initiative for the selected tokens, and one token's initiative (issue #356).
    private func initiativeSection(_ tokens: [ResolvedToken]) -> some View {
        let initiative = document.campaign.activeMap.initiative
        let ids = Set(tokens.map(\.token.id))
        let inOrder = !ids.isEmpty && ids.allSatisfy { initiative.contains($0) }
        return Section {
            if tokens.count == 1, let id = ids.first, let value = initiative.value(of: id) {
                LabeledContent("Initiative") {
                    TextField(
                        "Initiative",
                        value: Binding(
                            get: { value },
                            set: { new in
                                document.edit("Change Initiative", undoManager: undoManager) {
                                    $0.activeMap.initiative.setValue(new, for: id)
                                }
                            }),
                        format: .number
                    )
                    .labelsHidden()
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                    .frame(width: 64)
                }
            }
            Button(inOrder ? "Remove from Initiative" : "Add to Initiative") {
                document.edit(inOrder ? "Remove from Initiative" : "Add to Initiative", undoManager: undoManager) { campaign in
                    if inOrder {
                        campaign.activeMap.initiative.remove(ids)
                    } else {
                        campaign.activeMap.addToInitiative(ids)
                    }
                }
            }
        } footer: {
            Text("The turn order is in the sidebar. The World View lists it for players, by the names they see, without NPCs they can't see.")
        }
    }

    /// One token's hit points and conditions, for the DM alone: players never see them (issue #369).
    private func hitPointsSection(_ token: Token) -> some View {
        let ids: Set<String> = [token.id]
        let amount = max(0, hitPointAmount ?? 0)
        let canChange = amount > 0 && (token.hitPoints ?? token.maxHitPoints) != nil
        return Section {
            LabeledContent("Current / Max") {
                HStack(spacing: 4) {
                    TextField(
                        "Current",
                        value: Binding(
                            get: { token.hitPoints },
                            set: { new in
                                update("Set Hit Points", ids: ids) { t in
                                    // Cleared is untracked; a typed value stays within 0…max.
                                    let clamped = new.map { t.clampedHitPoints($0) }
                                    t.hitPoints = clamped
                                }
                            }),
                        format: .number, prompt: Text("—")
                    )
                    .labelsHidden()
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                    .frame(width: 48)
                    Text("/").foregroundStyle(.secondary)
                    TextField(
                        "Max",
                        value: Binding(
                            get: { token.maxHitPoints },
                            set: { new in
                                update("Set Hit Points", ids: ids) { t in
                                    t.maxHitPoints = new.map { max(0, $0) }
                                    // A new maximum starts an untracked token at full; current never exceeds it.
                                    if let current = t.hitPoints ?? t.maxHitPoints { t.hitPoints = t.clampedHitPoints(current) }
                                }
                            }),
                        format: .number, prompt: Text("—")
                    )
                    .labelsHidden()
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                    .frame(width: 48)
                }
            }
            LabeledContent("Amount") {
                HStack(spacing: 4) {
                    TextField("Amount", value: $hitPointAmount, format: .number, prompt: Text("0"))
                        .labelsHidden()
                        .multilineTextAlignment(.trailing)
                        .monospacedDigit()
                        .frame(width: 48)
                    Button("Damage") { update("Damage Token", ids: ids) { $0.applyDamage(amount) } }
                        .disabled(!canChange)
                    Button("Heal") { update("Heal Token", ids: ids) { $0.heal(amount) } }
                        .disabled(!canChange)
                }
            }
            Menu("Add Condition") {
                ForEach(Condition.allCases) { condition in
                    Toggle(
                        isOn: Binding(
                            get: { token.has(condition) },
                            set: { on in setCondition(condition, on: on, ids: ids) })
                    ) {
                        Label(condition.title, systemImage: condition.symbolName)
                    }
                }
            }
            if let conditions = token.conditions, !conditions.isEmpty {
                // Each chip names its condition beside the glyph; a click removes it.
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), alignment: .leading)], alignment: .leading, spacing: 6) {
                    ForEach(conditions) { condition in
                        Button {
                            setCondition(condition, on: false, ids: ids)
                        } label: {
                            HStack(spacing: 4) {
                                Label(condition.title, systemImage: condition.symbolName)
                                Image(systemName: "xmark").font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .help("Remove \(condition.title)")
                        .accessibilityLabel("\(condition.title), remove")
                    }
                }
            }
        } header: {
            Text("Hit Points")
        } footer: {
            Text(
                token.isDown
                    ? "Down at 0 hit points. Only you see hit points and conditions."
                    : "Only you see hit points and conditions; the World View never shows them.")
        }
    }

    private func setCondition(_ condition: Condition, on: Bool, ids: Set<String>) {
        update(on ? "Add Condition" : "Remove Condition", ids: ids) { token in
            if token.has(condition) != on { token.toggle(condition) }
        }
    }

    /// Writes the players' name draft to `ids` if it was edited; empty goes back to the name.
    private func commitPlayerName(ids: Set<String>) {
        guard playerNameDraft != playerNameOrigin else { return }
        playerNameOrigin = playerNameDraft
        let trimmed = playerNameDraft.trimmingCharacters(in: .whitespaces)
        update("Change Name for Players", ids: ids) { $0.playerName = trimmed.isEmpty ? nil : trimmed }
    }

    /// The current picture (or a placeholder when the selection's differ), Change Image…
    /// and the library picker. The well takes dropped image files and library items.
    /// Who this is: the picture, the name and the type together at the top, the way a card header reads.
    private func identitySection(_ tokens: [ResolvedToken]) -> some View {
        let sources = Set(tokens.map(\.token.src))
        let image = sources.count == 1 ? sources.first.flatMap { document.imageCache.image(named: $0, in: document.assets) } : nil
        return Section {
            HStack(alignment: .center, spacing: Spacing.md) {
                Group {
                    if let image {
                        Image(decorative: image, scale: 1).resizable().scaledToFit()
                    } else {
                        Image(systemName: sources.count > 1 ? "square.stack" : "questionmark.square.dashed")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 64, height: 64)
                .background(Palette.surfaceSunken.color, in: RoundedRectangle(cornerRadius: Radius.tile))
                .overlay {
                    if imageDropTargeted {
                        RoundedRectangle(cornerRadius: Radius.tile).strokeBorder(Palette.accent.color, lineWidth: 2)
                    }
                }
                .accessibilityLabel(sources.count > 1 ? "Different images" : "Token image")
                .help("Drop an image file or a library token here. The image is kept in this campaign file.")
                .onDrop(of: [.fileURL, .plainText], isTargeted: $imageDropTargeted) { providers in
                    handleImageDrop(providers)
                }
                .popover(isPresented: $showingLibraryPicker, arrowEdge: .leading) {
                    TokenImageLibraryPicker(document: document) { item in
                        showingLibraryPicker = false
                        useLibraryItem(item)
                    }
                }
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    TextField(
                        "Name", text: $nameDraft, prompt: Text(tokens.count > 1 ? "Multiple tokens" : "Token")
                    )
                    .labelsHidden()
                    .textFieldStyle(.plain)
                    .font(.title3.weight(.semibold))
                    .focused($nameFocused)
                    .onSubmit {
                        commitName(ids: selection)
                        if tokens.count == 1 { resetDraft() }
                    }
                    Text(tokens.count == 1 ? "Token" : "\(tokens.count) tokens selected")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Menu("Image") {
                        Button("Change Image…") { chooseImageFile() }
                        Button("From Library…") { showingLibraryPicker = true }
                    }
                    .menuStyle(.borderlessButton)
                    .fixedSize()
                }
            }
            Picker("Type", selection: typeBinding(tokens)) {
                Text("PC").tag(CreatureType?.some(.pc))
                Text("NPC").tag(CreatureType?.some(.npc))
                if tokens.contains(where: { $0.type == nil }) || Set(tokens.map(\.type)).count > 1 {
                    Text("—").tag(CreatureType?.none)
                }
            }
            .pickerStyle(.segmented)
            .help("Players see only what PCs see. Make your players' tokens PCs.")
        }
    }

    /// A Finder image file goes to the cropper; a library drag sets its image directly.
    private func handleImageDrop(_ providers: [NSItemProvider]) -> Bool {
        guard let provider = providers.first else { return false }
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            _ = provider.loadObject(ofClass: URL.self) { url, _ in
                guard let url else { return }
                DispatchQueue.main.async { useImageFile(url) }
            }
            return true
        }
        guard provider.canLoadObject(ofClass: String.self) else { return false }
        _ = provider.loadObject(ofClass: String.self) { string, _ in
            let id = string.flatMap(LibraryDrag.itemID)
            DispatchQueue.main.async {
                if id.map({ useLibraryItem(id: $0) }) != true {
                    notify("Drop an image file or a library token.", true)
                }
            }
        }
        return true
    }

    @discardableResult
    private func useLibraryItem(id: String) -> Bool {
        guard let item = document.browsableLibrary.items.first(where: { $0.id == id }) else { return false }
        useLibraryItem(item)
        return true
    }

    private func useLibraryItem(_ item: TokenLibraryItem) {
        if !document.setTokenImage(from: item, for: selection, undoManager: undoManager) {
            notify("“\(item.name)” is missing its image in the library.", true)
        }
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
                campaign.activeMap.tokens[t].darkvision = nil
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
        playerNameDraft = tokens.count == 1 ? tokens[0].token.playerName ?? "" : ""
        playerNameOrigin = playerNameDraft
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
                // A new PC with no vision would leave the players' screen black, so it gets some.
                let unsighted = Set(tokens.filter { $0.visionRadius == nil }.map(\.token.id))
                update("Change Token Type") { token in
                    token.type = newValue
                    if newValue == .pc, unsighted.contains(token.id) { token.visionRadius = GameMap.newPCVision }
                }
            })
    }

    private func setDarkvision(_ feet: Double) {
        update("Change Darkvision") { $0.darkvision = feet > 0 ? feet : nil }
    }

    /// The shared darkvision, or nil (shown as "Mixed") when the selection differs.
    private func darkvisionFieldBinding(_ tokens: [ResolvedToken]) -> Binding<Double?> {
        Binding(
            get: {
                let values = Set(tokens.map { $0.darkvision ?? 0 })
                return values.count == 1 ? values.first : nil
            },
            set: { if let feet = $0 { setDarkvision(max(0, feet)) } })
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
