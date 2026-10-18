import Foundation

/// Placing and editing lights (native only).
extension GameMap {
    /// A light from `preset` at the centre of the cell under `point`, so it never sits on a
    /// wall drawn along the grid. Placing the first light turns lighting on, in darkness.
    @discardableResult
    public mutating func placeLight(_ preset: LightPreset, at point: Point2D) -> LightSource {
        let centre: Point2D
        if gridType.isSquare {
            centre = Point2D(
                x: (point.x / gridSize).rounded(.down) * gridSize + gridSize / 2,
                y: (point.y / gridSize).rounded(.down) * gridSize + gridSize / 2)
        } else {
            centre = snapToGrid(point, gridSize: gridSize, gridType: gridType)
        }
        let light = preset.light(at: centre)
        lights.append(light)
        if ambientLight == nil { ambientLight = .dark }
        return light
    }

    /// The light whose marker is under `point`, topmost first.
    public func light(at point: Point2D, tolerance: Double) -> LightSource? {
        lights.last { hypot($0.x - point.x, $0.y - point.y) <= tolerance }
    }

    public func lightIDs(intersecting rect: Bounds) -> [String] {
        lights.filter {
            $0.x >= rect.x && $0.x <= rect.x + rect.width && $0.y >= rect.y && $0.y <= rect.y + rect.height
        }.map(\.id)
    }

    /// Moves lights by a map-space offset. With `duplicate`, copies move and originals stay.
    @discardableResult
    public mutating func moveLights(_ ids: Set<String>, dx: Double, dy: Double, duplicate: Bool) -> [String] {
        var placed: [String] = []
        for index in lights.indices where ids.contains(lights[index].id) {
            var moved = lights[index]
            moved.x += dx
            moved.y += dy
            if duplicate {
                moved.id = newID()
                lights.append(moved)
            } else {
                lights[index] = moved
            }
            placed.append(moved.id)
        }
        return placed
    }

    public mutating func setLights(_ ids: Set<String>, on: Bool) {
        for index in lights.indices where ids.contains(lights[index].id) { lights[index].isOn = on }
    }

    public mutating func applyLightPreset(_ preset: LightPreset, to ids: Set<String>) {
        for index in lights.indices where ids.contains(lights[index].id) {
            lights[index].bright = preset.bright
            lights[index].dim = preset.dim
            lights[index].name = preset.name
        }
    }
}
