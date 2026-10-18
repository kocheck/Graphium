import GraphiumCore
import XCTest

@testable import GraphiumRender

/// Golden-pixel tests of the Metal fog: the alpha at chosen map points against the numbers the
/// rules give (CORE_SPEC §3.3 step 7, decisions 009 and 010), plus the frame-time budget.
final class FogRendererTests: XCTestCase {
    private var renderer: FogRenderer!

    override func setUpWithError() throws {
        renderer = FogRenderer()
        try XCTSkipIf(renderer == nil, "This Mac has no Metal device")
    }

    /// A map whose fog bounds are `width` × `height` from the origin, with a PC whose centre
    /// is (`pc.x` + 25, `pc.y` + 25).
    private func map(width: Double, height: Double, pc: Point2D, vision: Double? = nil, darkvision: Double? = nil)
        -> GameMap
    {
        var map = GameMap(gridSize: 50)
        map.background = MapBackground(src: "map.png", width: width, height: height)
        map.tokens = [Token(id: "pc", x: pc.x, y: pc.y, src: "", type: .pc, visionRadius: vision, darkvision: darkvision)]
        return map
    }

    /// Renders one map pixel per map unit, with a 20-unit margin around the fog bounds.
    private func render(
        _ map: GameMap, explored: [ExploredRegion] = [], hatch: Bool = true, rock: Bool = false,
        flames: [String: TorchFlicker.Sample] = [:]
    ) throws -> (
        FogRenderer.Frame, (Double, Double) -> Double, (Double, Double) -> Double
    ) {
        let bounds = LineOfSight.fogBounds(of: map)
        let scene = FogScene(
            bounds: bounds, explored: explored, sight: LineOfSight.partySight(of: map, library: [:]),
            hatchRemembered: hatch, gridSize: map.gridSize, hatchWalls: rock ? LineOfSight.hatchWalls(of: map) : [],
            flames: flames)
        let view = FogView(
            origin: Point2D(x: bounds.x - 20, y: bounds.y - 20), scale: 1, width: Int(bounds.width) + 40,
            height: Int(bounds.height) + 40)
        let frame = try XCTUnwrap(renderer.render(scene, view: view))
        let alpha = { (x: Double, y: Double) in frame.alpha(x: Int(x) + 20, y: Int(y) + 20) }
        let white = { (x: Double, y: Double) in frame.white(x: Int(x) + 20, y: Int(y) + 20) }
        return (frame, alpha, white)
    }

    private let tolerance = 0.012

    func testVisionAndFogWithLightingOff() throws {
        // Vision 10 ft = 100 px around (100, 100).
        let (_, alpha, _) = try render(map(width: 400, height: 300, pc: Point2D(x: 75, y: 75), vision: 10))
        XCTAssertEqual(alpha(100, 100), 0, accuracy: tolerance, "clear at the PC")
        XCTAssertEqual(alpha(150, 100), 0, accuracy: tolerance, "clear to 60% of the radius")
        // The pixel sampled for x = 180 has its centre at 180.5: 80.5 px out, 19.5 px short of the edge.
        XCTAssertEqual(
            alpha(180, 100), FogShading.base * (1 - 19.5 / 40), accuracy: tolerance, "half way through the fade")
        XCTAssertEqual(alpha(350, 250), FogShading.base, accuracy: tolerance, "unexplored")
        XCTAssertEqual(alpha(-15, -15), 0, accuracy: tolerance, "no fog outside its bounds")
    }

    func testRememberedGroundIsHatchedAndSeenGroundIsNot() throws {
        let map = map(width: 400, height: 300, pc: Point2D(x: 75, y: 75), vision: 10)
        let remembered = ExploredRegion(
            points: [Point2D(x: 250, y: 20), Point2D(x: 390, y: 20), Point2D(x: 390, y: 90), Point2D(x: 250, y: 90)],
            timestamp: 1)
        let seenToo = ExploredRegion(
            points: [Point2D(x: 60, y: 60), Point2D(x: 140, y: 60), Point2D(x: 140, y: 140), Point2D(x: 60, y: 140)],
            timestamp: 1)
        let (_, alpha, white) = try render(map, explored: [remembered, seenToo])
        let row = (260..<380).map { Double($0) }
        let whites = row.map { white($0, 55) }
        let alphas = row.map { alpha($0, 55) }
        let remaining = FogShading.base * (1 - FogShading.exploredClearing)
        XCTAssertEqual(alphas.min()!, remaining, accuracy: tolerance, "between the lines: the explored fog")
        XCTAssertEqual(
            whites.max()!, FogShading.hatchAlpha, accuracy: 0.03, "on a line: white at the hatch alpha")
        XCTAssertEqual(whites.filter { $0 > 0.14 }.count, 120 / 12 * 2, accuracy: 6, "a 2 px line every 12 px")
        XCTAssertEqual(white(100, 100), 0, accuracy: tolerance, "explored and seen: no hatching")

        let (_, plainAlpha, plainWhite) = try render(map, explored: [remembered], hatch: false)
        XCTAssertEqual(row.map { plainWhite($0, 55) }.max()!, 0, accuracy: tolerance)
        XCTAssertEqual(plainAlpha(300, 55), remaining, accuracy: tolerance)
    }

    func testATorchInTheDark() throws {
        // PC centre (25, 25); a torch (20 ft bright, 40 ft dim) at (1025, 25).
        var dark = map(width: 1200, height: 400, pc: .zero)
        dark.ambientLight = .dark
        dark.lights = [LightPreset.torch.light(at: Point2D(x: 1025, y: 25))]
        let (_, alpha, _) = try render(dark)
        let dim = FogShading.base * (1 - FogShading.dimClearing)
        XCTAssertEqual(alpha(875, 25), 0, accuracy: tolerance, "15 ft: bright")
        XCTAssertEqual(alpha(725, 25), dim, accuracy: tolerance, "30 ft: dim")
        XCTAssertEqual(alpha(575, 25), FogShading.base, accuracy: tolerance, "45 ft: dark")

        var walled = dark
        walled.drawings = [Drawing(tool: .wall, points: [900, -200, 900, 250], color: "#f00", size: 8)]
        XCTAssertEqual(try render(walled).1(875, 25), FogShading.base, accuracy: tolerance, "a wall stops the light")
    }

    func testRockIsHatchedBehindSeenWallsOnly() throws {
        // Vision 10 ft around (100, 100); a seen wall at x = 150 and an unseen one at x = 350.
        var map = map(width: 400, height: 300, pc: Point2D(x: 75, y: 75), vision: 10)
        map.drawings = [
            Drawing(tool: .wall, points: [150, 0, 150, 300], color: "#f00", size: 8),
            Drawing(tool: .wall, points: [350, 0, 350, 300], color: "#f00", size: 8),
        ]
        let (frame, alpha, white) = try render(map, rock: true)
        XCTAssertEqual(alpha(151, 100), 1, accuracy: tolerance, "the wall's ink on the far side")
        XCTAssertEqual(white(151, 100), 0, accuracy: tolerance)
        // Just past the wall: paper with hatch lines on it, opaque.
        var band: [Double] = []
        for y in 60..<140 {
            for x in 155..<160 { band.append(frame.white(x: x + 20, y: y + 20)) }
        }
        XCTAssertEqual(band.max()!, FogShading.paper, accuracy: 0.02, "paper")
        XCTAssertLessThan(band.min()!, 0.3, "with ink lines")
        XCTAssertEqual(alpha(157, 100), 1, accuracy: tolerance)
        XCTAssertEqual(white(185, 100), 0, accuracy: tolerance, "black again past the band")
        XCTAssertEqual(white(140, 100), 0, accuracy: tolerance, "nothing on the side the party sees")
        XCTAssertEqual(white(360, 100), 0, accuracy: tolerance, "a wall nobody has seen draws nothing")
        XCTAssertEqual(alpha(360, 100), FogShading.base, accuracy: tolerance)

        let (_, _, plain) = try render(map)
        XCTAssertEqual(plain(157, 100), 0, accuracy: tolerance, "off without walls to hatch")
    }

    func testFlamesGlowWarmUnderTheFog() throws {
        var dark = map(width: 1200, height: 400, pc: .zero)
        dark.ambientLight = .dark
        let torch = LightPreset.torch.light(at: Point2D(x: 1025, y: 25))
        dark.lights = [torch]
        let (frame, alpha, white) = try render(dark, flames: [torch.id: TorchFlicker.steady])
        // 15 ft out: bright, so no fog; the glow is 14% × (1 − 150/400)².
        let glow = FogShading.glowStrength * pow(1 - 150.0 / 400, 2)
        XCTAssertEqual(alpha(875, 25), glow, accuracy: tolerance)
        XCTAssertEqual(white(875, 25), glow, accuracy: tolerance, "red at full strength")
        let blue = Double(frame.pixels[(45 * frame.width + 895) * 4 + 2]) / 255
        XCTAssertEqual(blue, glow * FogShading.glowColor.blue, accuracy: tolerance, "amber, not white")
        XCTAssertEqual(alpha(575, 25), FogShading.base, accuracy: tolerance, "nothing past its reach")

        // A dimmer moment of the flame pulls its edge in, never out.
        let (_, flickered, _) = try render(dark, flames: [torch.id: TorchFlicker.Sample(radius: 0.93, glow: 1)])
        XCTAssertEqual(flickered(1025 - 395, 25), FogShading.base, accuracy: tolerance)
        XCTAssertEqual(try render(dark).1(875, 25), 0, accuracy: tolerance, "lights that aren't flames don't glow")
    }

    func testDarkvisionStacksWithDimLight() throws {
        var map = map(width: 1200, height: 400, pc: .zero, darkvision: 60)
        map.ambientLight = .dark
        map.lights = [LightPreset.torch.light(at: Point2D(x: 900, y: 25))]
        let (_, alpha, _) = try render(map)
        let left = 1 - FogShading.dimClearing
        XCTAssertEqual(alpha(300, 25), FogShading.base * left, accuracy: tolerance, "darkness within darkvision")
        XCTAssertEqual(alpha(550, 25), FogShading.base * left * left, accuracy: tolerance, "dim light within darkvision")
        XCTAssertEqual(alpha(750, 25), 0, accuracy: tolerance, "bright light")
    }

    func testAmbientLight() throws {
        var map = map(width: 1200, height: 400, pc: .zero)
        map.ambientLight = .dim
        XCTAssertEqual(
            try render(map).1(1100, 300), FogShading.base * (1 - FogShading.dimClearing), accuracy: tolerance)
        map.ambientLight = .bright
        XCTAssertEqual(try render(map).1(1100, 300), 0, accuracy: tolerance)
    }

    /// The brief's budget: 120 fps on a 500-wall, 20-light map at 1080p.
    func testFrameTimeOnABusyLitMap() throws {
        var rng: UInt64 = 0x9E37_79B9_7F4A_7C15
        func random(_ range: ClosedRange<Double>) -> Double {
            rng = rng &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
            return range.lowerBound + Double(rng >> 11) / Double(1 << 53) * (range.upperBound - range.lowerBound)
        }
        var map = GameMap(gridSize: 50)
        map.background = MapBackground(src: "map.png", width: 3000, height: 2000)
        map.ambientLight = .dark
        map.drawings = (0..<500).map { _ in
            let x = random(0...3000)
            let y = random(0...2000)
            return Drawing(
                tool: .wall, points: [x, y, x + random(-150...150), y + random(-150...150)], color: "#f00", size: 8)
        }
        map.lights = (0..<20).map { _ in LightPreset.torch.light(at: Point2D(x: random(0...3000), y: random(0...2000))) }
        map.tokens = (0..<5).map {
            Token(id: "pc\($0)", x: 1300 + Double($0) * 60, y: 1000, src: "", type: .pc, darkvision: 60)
        }
        let scene = FogScene(
            bounds: LineOfSight.fogBounds(of: map),
            explored: (0..<300).map { i in
                let x = Double(i % 30) * 100
                let y = Double(i / 30) * 200
                return ExploredRegion(
                    points: [Point2D(x: x, y: y), Point2D(x: x + 90, y: y), Point2D(x: x + 45, y: y + 150)],
                    timestamp: 1)
            }, sight: LineOfSight.partySight(of: map, library: [:]))
        let view = FogView(origin: Point2D(x: 0, y: 0), scale: 0.64, width: 1920, height: 1080)
        for _ in 0..<3 { _ = renderer.render(scene, view: view) }
        var times: [Double] = []
        for _ in 0..<20 { times.append(try XCTUnwrap(renderer.render(scene, view: view)).gpuTime) }
        let median = times.sorted()[times.count / 2]
        print("Fog GPU time on the busy map: median \(median * 1000) ms on \(renderer.device.name)")
        XCTAssertLessThan(median, 1.0 / 120, "GPU time per frame")
        measure { _ = renderer.render(scene, view: view) }
    }
}
