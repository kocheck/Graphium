import XCTest

@testable import GraphiumCore

/// Spell effects (native): 5e area templates, pinned to the map or carried by a token.
final class SpellEffectTests: XCTestCase {
    func testTheFileOnlyGainsKeysWhenEffectsAreUsed() throws {
        let plain = String(decoding: try JSONEncoder().encode(GameMap(id: "m")), as: UTF8.self)
        XCTAssertFalse(plain.contains("effects"))

        let bare = String(decoding: try JSONEncoder().encode(SpellEffect(id: "e", shape: .circle, size: 20, x: 1, y: 2)), as: UTF8.self)
        for key in ["width", "angle", "tokenId", "color", "label", "isHidden"] { XCTAssertFalse(bare.contains(key), key) }

        var map = GameMap(id: "m")
        map.effects = [
            SpellEffect(shape: .line, size: 100, width: 10, angle: 90, x: 5, y: 6, look: .lightning, label: "Bolt", isHidden: true),
            SpellEffect(shape: .cone, size: 15, angle: 45, x: 0, y: 0, tokenID: "t", look: .fire, color: "#ff0000"),
        ]
        XCTAssertEqual(try JSONDecoder().decode(GameMap.self, from: JSONEncoder().encode(map)), map)
    }

    func testUnknownShapesAreSkippedAndUnknownLooksReadAsArcane() throws {
        let json = #"{"id":"m","effects":[{"id":"a","shape":"torus","size":10,"x":0,"y":0},{"id":"b","shape":"cube","size":10,"x":0,"y":0,"look":"glitter"}]}"#
        let map = try JSONDecoder().decode(GameMap.self, from: Data(json.utf8))
        XCTAssertEqual(map.effects.map(\.id), ["b"])
        XCTAssertEqual(map.effects.first?.look, .arcane)
    }

    func testPolygonsMatchTheTemplates() {
        // 50 px cells: 5 ft = 50 px.
        let circle = SpellEffect(shape: .circle, size: 20, x: 0, y: 0).polygon(origin: Point2D(x: 0, y: 0), gridSize: 50)
        XCTAssertEqual(circle.map { hypot($0.x, $0.y) }.max() ?? 0, 200, accuracy: 0.001)

        let cone = SpellEffect(shape: .cone, size: 15, x: 0, y: 0).polygon(origin: Point2D(x: 0, y: 0), gridSize: 50)
        XCTAssertEqual(cone.first, Point2D(x: 0, y: 0), "the tip is the point of origin")
        // As wide as it is long: 150 px across at 150 px (to the chord, slightly less).
        let ys = cone.map(\.y)
        XCTAssertEqual((ys.max() ?? 0) - (ys.min() ?? 0), 150 * 2 * sin(SpellEffect.coneAngle / 2 * .pi / 180), accuracy: 0.5)

        let line = SpellEffect(shape: .line, size: 30, angle: 90, x: 0, y: 0).polygon(origin: Point2D(x: 0, y: 0), gridSize: 50)
        XCTAssertEqual(line.map(\.y).max() ?? 0, 300, accuracy: 0.001, "pointing down")
        XCTAssertEqual(line.map(\.x).max() ?? 0, 25, accuracy: 0.001, "5 ft wide")

        let cube = SpellEffect(shape: .cube, size: 15, x: 0, y: 0).polygon(origin: Point2D(x: 0, y: 0), gridSize: 50)
        XCTAssertEqual(cube.map(\.x).min() ?? 1, 0, accuracy: 0.001, "spreads from the face")
        XCTAssertEqual(cube.map(\.x).max() ?? 0, 150, accuracy: 0.001)
        XCTAssertEqual(cube.map(\.y).max() ?? 0, 75, accuracy: 0.001)
    }

    func testCarriedEffectsFollowTheirTokenAndGoWithIt() {
        var map = GameMap(id: "m")
        let token = Token(id: "t", x: 100, y: 100, src: "")
        map.tokens = [token]
        let placed = map.placeEffect(
            SpellEffect(shape: .circle, size: 15, x: 125, y: 125, tokenID: "t", look: .radiant), library: [:])
        XCTAssertEqual(placed.x, 0)
        XCTAssertEqual(placed.y, 0)
        map.tokens[0].x = 300
        XCTAssertEqual(map.effectOrigin(map.effects[0], library: [:]), Point2D(x: 325, y: 125))
        XCTAssertEqual(map.effect(at: Point2D(x: 400, y: 125), tolerance: 1, library: [:])?.id, placed.id)

        map.attachEffects([placed.id], to: nil, library: [:])
        XCTAssertNil(map.effects[0].tokenID)
        XCTAssertEqual(map.effectOrigin(map.effects[0], library: [:]), Point2D(x: 325, y: 125), "left where it was")

        map.attachEffects([placed.id], to: "t", library: [:])
        map.effects.append(SpellEffect(shape: .cube, size: 10, x: 0, y: 0))
        map.removeItems(["t"])
        XCTAssertEqual(map.effects.count, 1, "the token's effect went with it; the pinned one stayed")
    }

    func testRotationAndSizes() {
        var map = GameMap(id: "m")
        map.effects = [SpellEffect(id: "c", shape: .cone, size: 15, angle: 350, x: 0, y: 0), SpellEffect(id: "o", shape: .circle, size: 20, x: 0, y: 0)]
        map.rotateEffects(["c", "o"], by: 20)
        XCTAssertEqual(map.effects[0].angle, 10)
        XCTAssertEqual(map.effects[1].angle, 0, "circles have no direction")
        XCTAssertEqual(SpellEffect.roundedFeet(17), 15)
        XCTAssertEqual(SpellEffect.roundedFeet(1), 5)
        XCTAssertEqual(map.effects[1].displayLabel, "20 ft radius")
    }
}
