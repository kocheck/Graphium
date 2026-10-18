import XCTest

@testable import GraphiumCore

/// Note pins (native): DM notes and player notes in the campaign file.
final class MapNoteTests: XCTestCase {
    func testTheFileOnlyGainsKeysWhenNotesAreUsed() throws {
        let plain = String(decoding: try JSONEncoder().encode(GameMap(id: "m")), as: UTF8.self)
        XCTAssertFalse(plain.contains("notes"))
        let old = #"{"id":"m","tokens":[],"drawings":[]}"#
        XCTAssertEqual(try JSONDecoder().decode(GameMap.self, from: Data(old.utf8)).notes, [])

        let bare = String(decoding: try JSONEncoder().encode(MapNote(id: "n", x: 1, y: 2)), as: UTF8.self)
        for key in ["title", "dmNotes", "playerNotes", "isShared"] { XCTAssertFalse(bare.contains(key), key) }
        let read = try JSONDecoder().decode(MapNote.self, from: Data(#"{"id":"n","x":1,"y":2}"#.utf8))
        XCTAssertEqual(read, MapNote(id: "n", x: 1, y: 2))

        var map = GameMap(id: "m")
        map.notes = [MapNote(x: 5, y: 6, title: "Crypt", dmNotes: "Lich", playerNotes: "Cold air.", isShared: true)]
        XCTAssertEqual(try JSONDecoder().decode(GameMap.self, from: JSONEncoder().encode(map)), map)
    }

    func testNoteSounds() throws {
        let bare = String(decoding: try JSONEncoder().encode(MapNote(id: "n", x: 1, y: 2)), as: UTF8.self)
        XCTAssertFalse(bare.contains("sounds"))
        let note = MapNote(
            id: "n", x: 1, y: 2,
            sounds: [NoteSound(kind: .track, ref: "t1"), NoteSound(kind: .sfx, ref: "chime", playOnShow: true)])
        XCTAssertEqual(try JSONDecoder().decode(MapNote.self, from: JSONEncoder().encode(note)), note)

        // A sound kind from a newer app is dropped; the note and its other sounds survive.
        let newer = #"{"id":"n","x":1,"y":2,"sounds":[{"kind":"jukebox","ref":"s"},{"kind":"sfx","ref":"chime"}]}"#
        XCTAssertEqual(try JSONDecoder().decode(MapNote.self, from: Data(newer.utf8)).sounds, [NoteSound(kind: .sfx, ref: "chime")])

        let track = Track(id: "t1", title: "Crypt Drone", source: .local, src: "a.m4a")
        let console = SessionConsoleCatalog(
            stage: StageChrome(title: "C"), trackGroups: [TrackGroup(title: "Dread", accent: .dread, tracks: [track])])
        XCTAssertEqual(console.title(of: note.sounds[0]), "Crypt Drone")
        XCTAssertEqual(console.title(of: note.sounds[1]), "Chime")
        XCTAssertNil(console.title(of: NoteSound(kind: .track, ref: "gone")))
        XCTAssertEqual(console.noteSoundChoices.first?.title, "Crypt Drone", "tracks first")

        var runtime = SessionConsoleRuntime(catalog: console)
        XCTAssertTrue(note.sounds[0].command.apply(to: &runtime, catalog: console))
        XCTAssertEqual(runtime.audio.trackId, "t1")
        XCTAssertTrue(note.sounds[1].command.apply(to: &runtime, catalog: console))
        XCTAssertEqual(runtime.sfxId, "chime")

        let cave = NoteSound(kind: .soundscape, ref: "cave")
        XCTAssertEqual(console.title(of: cave), "Cave")
        XCTAssertTrue(console.noteSoundChoices.contains { $0.sound == cave })
        XCTAssertTrue(cave.command.apply(to: &runtime, catalog: console))
        XCTAssertEqual(runtime.ambience.soundscapeId, "cave")
    }

    func testPlacingAndEditingNotes() {
        var map = GameMap(gridSize: 50)
        let note = map.placeNote(at: Point2D(x: 62, y: 96))
        XCTAssertEqual(Point2D(x: note.x, y: note.y), Point2D(x: 75, y: 75), "the cell's centre")
        XCTAssertFalse(note.isShared, "new notes are the DM's alone")
        XCTAssertEqual(note.displayTitle, "Note")
        XCTAssertEqual(map.note(at: Point2D(x: 80, y: 70), tolerance: 10)?.id, note.id)
        XCTAssertNil(map.note(at: Point2D(x: 80, y: 70), tolerance: 10, sharedOnly: true), "players can't open it")

        map.setNotesShared([note.id], shared: true)
        XCTAssertEqual(map.sharedNotes.map(\.id), [note.id])
        XCTAssertNotNil(map.note(at: Point2D(x: 80, y: 70), tolerance: 10, sharedOnly: true))

        map.updateNote(id: note.id) { $0.title = "Altar" }
        XCTAssertEqual(map.notes[0].displayTitle, "Altar")
        XCTAssertEqual(map.noteIDs(intersecting: Bounds(x: 0, y: 0, width: 100, height: 100)), [note.id])

        let copies = map.moveNotes([note.id], dx: 50, dy: 0, duplicate: true)
        XCTAssertEqual(map.notes.map(\.x), [75, 125])
        XCTAssertNotEqual(copies, [note.id])
        map.removeItems([note.id])
        XCTAssertEqual(map.notes.map(\.id), copies)
    }
}
