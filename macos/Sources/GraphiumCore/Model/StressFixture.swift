import Foundation

/// A deterministic combat-scale map for profiling (TS `stressFixture.ts`): 200 tokens
/// (5 PCs with 60 ft vision), 50 walls and 200 marker strokes on a 50 px grid, no map
/// image. `scale` multiplies the counts. `exploredRegions` adds saved fog memory.
public enum StressFixture {
    public static func map(scale: Int = 1, exploredRegions: Int = 0) -> GameMap {
        let grid = 50.0
        let tokenCount = 200 * scale, pcCount = 5, wallCount = 50 * scale, strokeCount = 200 * scale
        var map = GameMap(name: "Stress Test", gridSize: grid)
        map.tokens = (0..<tokenCount).map { i in
            let isPC = i < pcCount
            return Token(
                id: "stress-token-\(i)", x: Double(i % 20) * grid * 2, y: Double(i / 20) * grid * 2, src: "",
                scale: 1, type: isPC ? .pc : .npc, visionRadius: isPC ? 60 : nil,
                name: isPC ? "PC \(i + 1)" : "NPC \(i + 1)", movementSpeed: 30)
        }
        let walls = (0..<wallCount).map { i -> Drawing in
            let x = Double(i % 10) * grid * 4, y = Double(i / 10) * grid * 4
            return Drawing(
                id: "stress-wall-\(i)", tool: .wall, points: [x, y, x + grid * 3, y, x + grid * 3, y + grid * 2],
                color: "#000000", size: 4)
        }
        let strokes = (0..<strokeCount).map { i -> Drawing in
            let x = Double(i % 20) * grid, y = 800 + Double(i / 20) * grid
            return Drawing(
                id: "stress-stroke-\(i)", tool: .marker, points: [x, y, x + 30, y + 10, x + 60, y],
                color: StrokeDefaults.markerColor, size: 3)
        }
        map.drawings = walls + strokes
        map.exploredRegions = (0..<exploredRegions).map { i in
            let cx = Double(i % 40) * grid, cy = Double(i / 40) * grid
            let ring = (0..<24).map { k -> Point2D in
                let angle = Double(k) / 24 * 2 * Double.pi
                return Point2D(x: cx + cos(angle) * 300, y: cy + sin(angle) * 300)
            }
            return ExploredRegion(points: ring, timestamp: Double(i))
        }
        return map
    }
}
