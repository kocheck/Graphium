import XCTest

@testable import GraphiumCore

/// Note pins' Markdown (native), split into the blocks the inspector and World View draw.
final class NoteMarkdownTests: XCTestCase {
    func testARoomKeySplitsIntoBlocks() {
        let text = """
            # 1. Guard Room
            Two **hobgoblins** play dice.
            They _hate_ the captain.

            ## Treasure
            - 30 gp
              - a silver key
            - [ ] search the bunks
            - [x] killed the dog
            1. Open the door
            2) Roll initiative

            > The torches gutter as you enter.
            > Something moves.
            ---
            ```
            DC 15
            ```
            """
        XCTAssertEqual(
            NoteMarkdown.blocks(text),
            [
                .heading(level: 1, text: "1. Guard Room"),
                .paragraph("Two **hobgoblins** play dice.\nThey _hate_ the captain."),
                .heading(level: 2, text: "Treasure"),
                .bullet(text: "30 gp", depth: 0, checked: nil),
                .bullet(text: "a silver key", depth: 1, checked: nil),
                .bullet(text: "search the bunks", depth: 0, checked: false),
                .bullet(text: "killed the dog", depth: 0, checked: true),
                .numbered(number: 1, text: "Open the door", depth: 0),
                .numbered(number: 2, text: "Roll initiative", depth: 0),
                .quote("The torches gutter as you enter.\nSomething moves."),
                .rule,
                .code("DC 15"),
            ])
    }

    func testPlainTextStaysAsWritten() {
        XCTAssertEqual(NoteMarkdown.blocks(""), [])
        XCTAssertEqual(NoteMarkdown.blocks("#hashtag\n-5 hp\n2.5 ft"), [.paragraph("#hashtag\n-5 hp\n2.5 ft")])
        XCTAssertEqual(NoteMarkdown.blocks("#### Deep"), [.heading(level: 3, text: "Deep")])
        XCTAssertEqual(NoteMarkdown.blocks("```\nunclosed"), [.code("unclosed")])
        XCTAssertEqual(String(NoteMarkdown.inline("**bold** and *it*").characters), "bold and it")
        XCTAssertEqual(String(NoteMarkdown.inline("2 * 3 = 6").characters), "2 * 3 = 6")
    }
}
