import XCTest

@testable import GraphiumCore

/// Hit points and conditions on tokens (native only, DM only; issue #369).
final class TokenStateTests: XCTestCase {
    private func json(_ token: Token) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return String(decoding: try encoder.encode(token), as: UTF8.self)
    }

    func testUnsetHitPointsAndConditionsAreLeftOut() throws {
        let out = try json(Token(id: "t", x: 0, y: 0, src: ""))
        XCTAssertFalse(out.contains("hitPoints"), out)
        XCTAssertFalse(out.contains("maxHitPoints"), out)
        XCTAssertFalse(out.contains("conditions"), out)
        XCTAssertFalse(out.contains("null"), out)
    }

    func testEmptyConditionsAreLeftOut() throws {
        let out = try json(Token(id: "t", x: 0, y: 0, src: "", conditions: []))
        XCTAssertFalse(out.contains("conditions"), out)
        let read = try JSONDecoder().decode(Token.self, from: Data(#"{"id":"t","x":0,"y":0,"src":"","conditions":[]}"#.utf8))
        XCTAssertNil(read.conditions)
    }

    func testHitPointsAndConditionsRoundTrip() throws {
        let token = Token(id: "t", x: 0, y: 0, src: "", hitPoints: 3, maxHitPoints: 7, conditions: [.prone, .poisoned])
        let out = try json(token)
        XCTAssertTrue(out.contains(#""hitPoints":3"#), out)
        XCTAssertTrue(out.contains(#""maxHitPoints":7"#), out)
        XCTAssertTrue(out.contains(#""conditions":["prone","poisoned"]"#), out)
        XCTAssertEqual(try JSONDecoder().decode(Token.self, from: Data(out.utf8)), token)
    }

    func testUnknownConditionsAreSkipped() throws {
        let read = try JSONDecoder().decode(
            Token.self, from: Data(#"{"id":"t","x":0,"y":0,"src":"","conditions":["dazed","stunned"]}"#.utf8))
        XCTAssertEqual(read.conditions, [.stunned])
    }

    func testDamageAndHealClampToZeroAndMaximum() {
        var token = Token(x: 0, y: 0, src: "", hitPoints: 5, maxHitPoints: 7)
        token.applyDamage(3)
        XCTAssertEqual(token.hitPoints, 2)
        XCTAssertFalse(token.isDown)
        token.applyDamage(10)
        XCTAssertEqual(token.hitPoints, 0)
        XCTAssertTrue(token.isDown)
        token.heal(4)
        XCTAssertEqual(token.hitPoints, 4)
        token.heal(40)
        XCTAssertEqual(token.hitPoints, 7)
        token.applyDamage(-5)
        XCTAssertEqual(token.hitPoints, 7, "negative damage does nothing")
    }

    func testWithoutAMaximumOnlyZeroIsAFloor() {
        var token = Token(x: 0, y: 0, src: "", hitPoints: 5)
        token.heal(20)
        XCTAssertEqual(token.hitPoints, 25)
        token.applyDamage(30)
        XCTAssertEqual(token.hitPoints, 0)
    }

    func testUntrackedHitPointsStartFromTheMaximum() {
        var token = Token(x: 0, y: 0, src: "", maxHitPoints: 7)
        token.applyDamage(2)
        XCTAssertEqual(token.hitPoints, 5)
        var untracked = Token(x: 0, y: 0, src: "")
        untracked.applyDamage(2)
        untracked.heal(2)
        XCTAssertNil(untracked.hitPoints, "nothing to count from")
        XCTAssertFalse(untracked.isDown)
    }

    func testToggleAddsInOrderAndRemovesToNil() {
        var token = Token(x: 0, y: 0, src: "")
        token.toggle(.prone)
        token.toggle(.grappled)
        XCTAssertEqual(token.conditions, [.prone, .grappled])
        XCTAssertTrue(token.has(.prone))
        token.toggle(.prone)
        token.toggle(.grappled)
        XCTAssertNil(token.conditions)
        XCTAssertFalse(token.has(.prone))
    }

    func testConditionTitles() {
        XCTAssertEqual(Condition.allCases.count, 15)
        XCTAssertEqual(Condition.incapacitated.title, "Incapacitated")
        XCTAssertEqual(Set(Condition.allCases.map(\.symbolName)).count, 15, "each condition has its own glyph")
    }
}
