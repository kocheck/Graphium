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
    /// The note the draft belongs to.
    @State private var draftID: String?
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
            // A pin just placed: start on its title.
            if let note = notes.first, notes.count == 1, Draft(note) == Draft() { focus = .title }
        }
        .onChange(of: selection) { _, _ in
            commit()
            resetDraft()
        }
        .onChange(of: focus) { _, field in
            if field == nil {
                commit()
                resetDraft()
            }
        }
        // Undo/redo and other edits: follow the note unless a field is being edited.
        .onChange(of: notes) { _, _ in
            if focus == nil { resetDraft() }
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

    private func resetDraft() {
        let notes = self.notes
        if notes.count == 1, let note = notes.first {
            draft = Draft(note)
            draftID = note.id
        } else {
            draft = Draft()
            draftID = nil
        }
        origin = draft
    }

    private func commit() {
        guard let id = draftID, draft != origin else { return }
        let next = draft
        origin = next
        document.edit("Edit Note", undoManager: undoManager) { campaign in
            campaign.activeMap.updateNote(id: id) { note in
                note.title = next.title.trimmingCharacters(in: .whitespacesAndNewlines)
                note.dmNotes = next.dmNotes
                note.playerNotes = next.playerNotes
            }
        }
    }
}
