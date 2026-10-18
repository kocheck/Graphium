import XCTest

@testable import GraphiumCore

/// Lights and darkvision (native only), checked against the 5e 2024 rules (SRD 5.2.1).
/// Grid 50 px = 5 ft, so 10 px is a foot.
final class LightingTests: XCTestCase {
    /// A PC whose centre is (25, 25), on a dark map with no background.
    private func darkMap(darkvision: Double? = nil, lights: [LightSource] = []) -> GameMap {
        var map = GameMap(gridSize: 50)
        map.tokens = [Token(id: "pc", x: 0, y: 0, src: "", type: .pc, darkvision: darkvision)]
        map.lights = lights
        map.ambientLight = .dark
        return map
    }

    private func torch(_ x: Double, _ y: Double = 25) -> LightSource {
        LightPreset.torch.light(at: Point2D(x: x, y: y))
    }

    private func seen(_ x: Double, _ y: Double = 25, in map: GameMap) -> LightLevel? {
        LineOfSight.partySight(of: map, library: [:]).perceived(at: Point2D(x: x, y: y))
    }

    func testPresetsAreTheRulesNumbers() {
        // (bright radius, additional dim) from the SRD's equipment and spells.
        let rules: [String: (Double, Double)] = [
            "Candle": (5, 5), "Lamp": (15, 30), "Torch": (20, 20), "Lantern": (30, 30), "Light": (20, 20),
            "Daylight": (60, 60),
        ]
        XCTAssertEqual(Set(LightPreset.all.map(\.name)), Set(rules.keys))
        for preset in LightPreset.all {
            let (bright, more) = rules[preset.name]!
            XCTAssertEqual(preset.bright, bright, preset.name)
            XCTAssertEqual(preset.dim, bright + more, preset.name)
        }
    }

    func testDarkvisionSeesDimAsBrightAndDarknessAsDim() {
        XCTAssertEqual(LightLevel.dark.throughDarkvision, .dim)
        XCTAssertEqual(LightLevel.dim.throughDarkvision, .bright)
        XCTAssertEqual(LightLevel.bright.throughDarkvision, .bright)
    }

    func testATorchGivesTwentyFeetBrightAndTwentyMoreDim() {
        let map = darkMap(lights: [torch(1025)])
        XCTAssertEqual(seen(875, in: map), .bright, "15 ft from the torch")
        XCTAssertEqual(seen(725, in: map), .dim, "30 ft")
        XCTAssertNil(seen(575, in: map), "45 ft: darkness, and the PC has no darkvision")
        XCTAssertNil(seen(300, 900, in: map), "in sight but dark")
    }

    func testWallsStopLight() {
        var map = darkMap(lights: [torch(1025)])
        map.drawings = [Drawing(tool: .wall, points: [900, -200, 900, 250], color: "#f00", size: 8)]
        XCTAssertNil(seen(875, in: map), "the PC sees the spot, but the torch is behind the wall")
        XCTAssertEqual(seen(950, 100, in: map), nil, "and the PC can't see past the wall to the lit side")
        map.drawings[0].oneWay = true  // drawn downwards: sight and light pass from the east
        XCTAssertEqual(seen(875, in: map), .bright)
    }

    func testDarkvisionRange() {
        let map = darkMap(darkvision: 60)
        XCTAssertEqual(seen(525, in: map), .dim, "50 ft: darkness seen as dim")
        XCTAssertNil(seen(725, in: map), "70 ft: out of range")

        let lit = darkMap(darkvision: 60, lights: [torch(900)])
        XCTAssertEqual(seen(550, in: lit), .bright, "the torch's dim light, within darkvision, is bright")
        XCTAssertEqual(seen(550, in: darkMap(lights: [torch(900)])), .dim, "without darkvision it stays dim")
    }

    func testAmbientLight() {
        var map = darkMap()
        map.ambientLight = .dim
        XCTAssertEqual(seen(2500, 2500, in: map), .dim, "sight has no range of its own")
        map.ambientLight = .bright
        XCTAssertEqual(seen(2500, 2500, in: map), .bright)
    }

    func testLightingOffKeepsTheTSRules() {
        var map = GameMap(gridSize: 50)
        map.tokens = [
            Token(id: "pc", x: 0, y: 0, src: "", type: .pc, visionRadius: 60, darkvision: 120),
            Token(id: "blind", x: 0, y: 500, src: "", type: .pc),
        ]
        map.lights = [torch(1025)]
        XCTAssertEqual(LineOfSight.viewers(of: map, library: [:]).map(\.tokenID), ["pc"])
        XCTAssertEqual(seen(525, in: map), .bright, "inside the 60 ft vision radius")
        XCTAssertNil(seen(875, in: map), "lights do nothing with lighting off")

        map.ambientLight = .dark
        XCTAssertEqual(
            Set(LineOfSight.viewers(of: map, library: [:]).map(\.tokenID)), ["pc", "blind"],
            "with lighting on every PC sees, by light or darkvision")
    }

    func testNPCsInTheDarkAreHidden() {
        var map = darkMap()
        map.tokens.append(Token(id: "goblin", x: 1500, y: 0, src: "", type: .npc))
        let sight = LineOfSight.partySight(of: map, library: [:])
        XCTAssertEqual(LineOfSight.hiddenNPCIDs(of: map, library: [:], sight: sight), ["goblin"])
        XCTAssertEqual(map.tokensHiddenFromPlayers(library: [:]), ["goblin"])
        map.lights = [torch(1525)]
        XCTAssertEqual(map.tokensHiddenFromPlayers(library: [:]), [])
    }

    func testOnlyWhatWasSeenIsExplored() {
        var previous = darkMap(lights: [torch(1025)])
        previous.isDaylightMode = true
        var map = previous
        map.isDaylightMode = false
        map.recordExploration(since: previous, library: [:], timestamp: 1)
        let explored = map.exploredRegions.map(\.points)
        XCTAssertTrue(LineOfSight.containsInAny(explored, Point2D(x: 875, y: 25)))
        XCTAssertFalse(LineOfSight.containsInAny(explored, Point2D(x: 575, y: 25)), "dark, 45 ft from the torch")
        XCTAssertFalse(LineOfSight.containsInAny(explored, Point2D(x: 300, y: 900)))

        // Turning the torch off is a lighting change: nothing new is explored, nothing is lost.
        let before = map
        map.setLights([map.lights[0].id], on: false)
        map.recordExploration(since: before, library: [:], timestamp: 2)
        XCTAssertEqual(map.exploredRegions.count, before.exploredRegions.count)
    }

    func testTheFileOnlyGainsKeysWhenLightingIsUsed() throws {
        let plain = String(decoding: try JSONEncoder().encode(GameMap(id: "m")), as: UTF8.self)
        XCTAssertFalse(plain.contains("lights"))
        XCTAssertFalse(plain.contains("ambientLight"))
        let old = #"{"id":"m","tokens":[],"drawings":[]}"#
        let decoded = try JSONDecoder().decode(GameMap.self, from: Data(old.utf8))
        XCTAssertEqual(decoded.lights, [])
        XCTAssertNil(decoded.ambientLight)

        let map = darkMap(lights: [torch(100)])
        XCTAssertEqual(try JSONDecoder().decode(GameMap.self, from: JSONEncoder().encode(map)), map)
        XCTAssertFalse(String(decoding: try JSONEncoder().encode(map.lights[0]), as: UTF8.self).contains("isOn"))
        let light = #"{"id":"l","x":1,"y":2,"bright":30,"dim":10}"#
        let read = try JSONDecoder().decode(LightSource.self, from: Data(light.utf8))
        XCTAssertTrue(read.isOn)
        XCTAssertEqual(read.dim, 30, "dim is never inside bright")
    }

    func testPlacingALight() {
        var map = GameMap(gridSize: 50)
        let light = map.placeLight(.lantern, at: Point2D(x: 62, y: 96))
        XCTAssertEqual(Point2D(x: light.x, y: light.y), Point2D(x: 75, y: 75), "the cell's centre")
        XCTAssertEqual(light.name, "Lantern")
        XCTAssertEqual(map.ambientLight, .dark, "the first light turns lighting on")
        XCTAssertEqual(map.light(at: Point2D(x: 80, y: 70), tolerance: 10)?.id, light.id)
        map.moveLights([light.id], dx: 50, dy: 0, duplicate: true)
        XCTAssertEqual(map.lights.map(\.x), [75, 125])
        map.applyLightPreset(.candle, to: [light.id])
        XCTAssertEqual(map.lights[0].dim, 10)
        map.removeItems([light.id])
        XCTAssertEqual(map.lights.count, 1)
    }

    func testClippingToAConvexPolygon() {
        let square = [Point2D(x: 0, y: 0), Point2D(x: 10, y: 0), Point2D(x: 10, y: 10), Point2D(x: 0, y: 10)]
        let shifted = square.map { Point2D(x: $0.x + 5, y: $0.y + 5) }
        let clipped = Lighting.clip(square, toConvex: shifted)
        var area = 0.0
        for i in clipped.indices {
            let a = clipped[i]
            let b = clipped[(i + 1) % clipped.count]
            area += a.x * b.y - b.x * a.y
        }
        XCTAssertEqual(abs(area) / 2, 25, accuracy: 1e-9)
        XCTAssertTrue(Lighting.clip(square, toConvex: square.map { Point2D(x: $0.x + 50, y: $0.y) }).isEmpty)
    }
}
