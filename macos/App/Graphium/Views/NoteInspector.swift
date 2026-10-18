import GraphiumCore
import SwiftUI

/// Edits the selected note pins (native). DM notes stay on the DM's screen; player notes are
/// what the World View shows when the DM shares the pin or shows the note there.
struct NoteInspector: View {
    @ObservedObject var document: CampaignDocument
    let selection: Set<String>
    @Environment(\.undoManager) private var undoManager

    private struct Draft: Equatable {
        var title = ""
        var dmNotes = ""
        var playerNotes = ""

        init() {}

        init(_ note: MapNote) {
            title = note.title
            dmNotes = note.dmNotes
            playerNotes = note.playerNotes
        }
    }

    private enum Field: Hashable {
        case title, dm, player
    }

    /// Typing is written back after a pause, when focus or the selection moves on, and when
    /// the panel closes, so undo steps are phrases rather than keystrokes.
    @State private var draft = Draft()
    /// What the fields were seeded with; an unchanged draft is never written back.
    @State private var origin = Draft()
    /// The note the draft belongs to, and its map (the active map can change before a commit).
    @State private var draftID: String?
    @State private var draftMapID: String?
    @FocusState private var focus: Field?

    private var notes: [MapNote] {
        document.campaign.activeMap.notes.filter { selection.contains($0.id) }
    }

    var body: some View {
        let notes = self.notes
        Form {
            if notes.count == 1, let note = notes.first {
                single(note)
            } else {
                Section {
                    sharingToggle(notes)
                } header: {
                    Text("\(notes.count) Notes Selected").font(.headline)
                }
            }
        }
        .formStyle(.grouped)
        .onAppear {
            resetDraft()
            focusIfNew()
        }
        .onChange(of: selection) { _, _ in
            commit()
            resetDraft()
            focusIfNew()
        }
        .onChange(of: focus) { _, field in
            if field == nil {
                commit()
                resetDraft()
            }
        }
        // Undo/redo and other edits: follow the note unless a field is being edited.
        .onChange(of: notes) { _, _ in
            if focus == nil {
                commit()
                resetDraft()
            }
        }
        .task(id: draft) {
            try? await Task.sleep(for: .seconds(0.8))
            if !Task.isCancelled { commit() }
        }
        .onDisappear { commit() }
    }

    @ViewBuilder
    private func single(_ note: MapNote) -> some View {
        Section {
            TextField("Title", text: $draft.title, prompt: Text("Note"))
                .focused($focus, equals: .title)
                .onSubmit { commit() }
        } header: {
            Text(note.displayTitle).font(.headline)
        }

        Section {
            TextEditor(text: $draft.dmNotes)
                .focused($focus, equals: .dm)
                .frame(minHeight: 120)
                .accessibilityLabel("DM notes")
        } header: {
            Label("DM Notes", systemImage: "eye.slash")
        } footer: {
            Text("Only you see these.")
        }

        Section {
            TextEditor(text: $draft.playerNotes)
                .focused($focus, equals: .player)
                .frame(minHeight: 120)
                .accessibilityLabel("Player notes")
        } header: {
            Label("Player Notes", systemImage: "person.2")
        } footer: {
            Text("Read-aloud text, a handout or a clue. Players see only this, and only when you share it.")
        }

        soundsSection(note)

        Section {
            sharingToggle([note])
            let showing = document.worldNoteID == note.id
            Button {
                if showing {
                    document.worldNoteID = nil
                } else {
                    commit()
                    document.worldNoteID = note.id
                }
            } label: {
                Label(showing ? "Hide from World View" : "Show on World View", systemImage: showing ? "tv.fill" : "tv")
            }
            .help("Put this note's title and player notes on the World View, over the map")
            if document.worldViewsOpen == 0 {
                Text("The World View isn't open.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func soundsSection(_ note: MapNote) -> some View {
        let console = document.campaign.sessionConsole
        Section {
            ForEach(note.sounds, id: \.ref) { sound in
                soundRow(note, sound: sound, title: console.title(of: sound))
            }
            let choices = console.noteSoundChoices.filter { choice in !note.sounds.contains { $0.ref == choice.sound.ref } }
            Menu {
                let tracks = choices.filter { $0.sound.kind == .track }
                if !tracks.isEmpty {
                    Section("Tracks") {
                        ForEach(tracks, id: \.sound.ref) { choice in
                            Button(choice.title) { editSounds(note, "Add Sound") { $0.append(choice.sound) } }
                        }
                    }
                }
                let effects = choices.filter { $0.sound.kind == .sfx }
                if !effects.isEmpty {
                    Section("Effects") {
                        ForEach(effects, id: \.sound.ref) { choice in
                            Button(choice.title) { editSounds(note, "Add Sound") { $0.append(choice.sound) } }
                        }
                    }
                }
            } label: {
                Label("Add Sound", systemImage: "plus")
            }
            .disabled(choices.isEmpty)
            .help("Attach a Session Console track or effect to this note")
        } header: {
            Label("Sounds", systemImage: "speaker.wave.2")
        } footer: {
            Text("Play these when the moment comes. Sounds set to play when shown start by themselves when you show this note on the World View.")
        }
    }

    private func soundRow(_ note: MapNote, sound: NoteSound, title: String?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label {
                    Text(title ?? "Missing from the Session Console")
                        .foregroundStyle(title == nil ? .secondary : .primary)
                        .lineLimit(1)
                } icon: {
                    Image(systemName: sound.kind == .track ? "music.note" : "speaker.wave.2")
                }
                Spacer()
                Button {
                    document.play(sound)
                } label: {
                    Label("Play", systemImage: "play.fill")
                }
                .disabled(title == nil)
                .help(document.worldViewsOpen == 0 ? "Play (the World View isn't open, so nobody will hear it)" : "Play on the World View")
                Button {
                    editSounds(note, "Remove Sound") { $0.removeAll { $0.ref == sound.ref } }
                } label: {
                    Label("Remove", systemImage: "minus.circle")
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.borderless)
                .help("Remove this sound from the note")
            }
            Toggle(
                "Play when shown",
                isOn: Binding(
                    get: { sound.playOnShow },
                    set: { on in
                        editSounds(note, "Edit Sound") { sounds in
                            for i in sounds.indices where sounds[i].ref == sound.ref { sounds[i].playOnShow = on }
                        }
                    })
            )
            .controlSize(.small)
            .help("Play this by itself when you show the note on the World View")
        }
    }

    /// Undoable change to one note's sounds, on the map it is on.
    private func editSounds(_ note: MapNote, _ actionName: String, _ change: (inout [NoteSound]) -> Void) {
        let mapID = document.campaign.activeMapID
        document.edit(actionName, undoManager: undoManager) { campaign in
            guard let index = campaign.maps.firstIndex(where: { $0.id == mapID }) else { return }
            campaign.maps[index].updateNote(id: note.id) { change(&$0.sounds) }
        }
    }

    private func sharingToggle(_ notes: [MapNote]) -> some View {
        Toggle(
            "Show Pin to Players",
            isOn: Binding(
                get: { !notes.isEmpty && notes.allSatisfy(\.isShared) },
                set: { shared in
                    let ids = Set(notes.map(\.id))
                    let plural = ids.count == 1 ? "Note" : "Notes"
                    document.edit(shared ? "Share \(plural)" : "Unshare \(plural)", undoManager: undoManager) {
                        $0.activeMap.setNotesShared(ids, shared: shared)
                    }
                })
        )
        .help("Players see the pin on the World View and can click it to read the player notes")
    }

    /// A pin just placed: start on its title.
    private func focusIfNew() {
        let notes = self.notes
        if notes.count == 1, let note = notes.first, Draft(note) == Draft() { focus = .title }
    }

    private func resetDraft() {
        let notes = self.notes
        if notes.count == 1, let note = notes.first {
            draft = Draft(note)
            draftID = note.id
            draftMapID = document.campaign.activeMapID
        } else {
            draft = Draft()
            draftID = nil
            draftMapID = nil
        }
        origin = draft
    }

    private func commit() {
        guard let id = draftID, let mapID = draftMapID, draft != origin else { return }
        let next = draft
        origin = next
        document.edit("Edit Note", undoManager: undoManager) { campaign in
            guard let index = campaign.maps.firstIndex(where: { $0.id == mapID }) else { return }
            campaign.maps[index].updateNote(id: id) { note in
                note.title = next.title.trimmingCharacters(in: .whitespacesAndNewlines)
                note.dmNotes = next.dmNotes
                note.playerNotes = next.playerNotes
            }
        }
    }
}
