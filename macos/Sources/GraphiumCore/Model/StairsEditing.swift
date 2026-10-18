import Foundation

/// Linked stairs (native; decision 017): two ends on one map, so a token dropped on one end
/// arrives at the other and a multi-floor dungeon can sit side by side on one sheet.
extension GameMap {
    /// Topmost stairs under `point`.
    public func stairs(at point: Point2D) -> Stairs? {
        stairs.last { $0.bounds.contains(point) }
    }

    /// The sister end of `s`, if it is linked to other stairs that are still on this map.
    public func sister(of s: Stairs) -> Stairs? {
        guard let id = s.linkedStairsId, id != s.id else { return nil }
        return stairs.first { $0.id == id }
    }

    /// A letter per linked pair (A, B, … Z, AA, AB …), shared by both ends, in the order the
    /// pairs' first ends appear on the map. Unlinked stairs have none.
    public var stairsLabels: [String: String] {
        var labels: [String: String] = [:]
        var next = 0
        for s in stairs where labels[s.id] == nil {
            guard let other = sister(of: s), labels[other.id] == nil else { continue }
            let label = Self.pairLabel(next)
            labels[s.id] = label
            labels[other.id] = label
            next += 1
        }
        return labels
    }

    static func pairLabel(_ index: Int) -> String {
        let letters = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        var n = index
        var label = ""
        repeat {
            label = String(letters[n % 26]) + label
            n = n / 26 - 1
        } while n >= 0
        return label
    }

    /// The centre of the cell under `point`, where a one-cell stairs end goes.
    public func stairsCentre(near point: Point2D) -> Point2D {
        let grid = makeGridGeometry(gridType, cellSize: gridSize)
        return grid.gridToPixel(grid.pixelToGrid(point))
    }

    /// Places one end of a pair, a cell wide, on the cell under `point`. With `sisterID` (the end
    /// placed by the previous click) it is the upper end and the two are linked; otherwise it is
    /// the lower end and waits for its sister. Returns the new stairs.
    @discardableResult
    public mutating func placeStairs(
        at point: Point2D, direction: CompassDirection, linkingTo sisterID: String? = nil
    ) -> Stairs {
        let centre = stairsCentre(near: point)
        let sisterExists = sisterID.map { id in stairs.contains { $0.id == id } } ?? false
        let placed = Stairs(
            x: centre.x, y: centre.y, direction: direction, type: sisterExists ? .up : .down,
            width: gridSize, height: gridSize)
        stairs.append(placed)
        if sisterExists, let sisterID { linkStairs(sisterID, placed.id) }
        return stairs.last { $0.id == placed.id } ?? placed
    }

    /// Links two stairs to each other, unlinking whatever either was linked to before.
    public mutating func linkStairs(_ a: String, _ b: String) {
        guard a != b, stairs.contains(where: { $0.id == a }), stairs.contains(where: { $0.id == b }) else { return }
        unlinkStairs([a, b])
        for i in stairs.indices {
            if stairs[i].id == a { stairs[i].linkedStairsId = b }
            if stairs[i].id == b { stairs[i].linkedStairsId = a }
        }
    }

    /// Clears the links of `ids` and of every stairs linked to them.
    public mutating func unlinkStairs(_ ids: Set<String>) {
        for i in stairs.indices {
            if ids.contains(stairs[i].id) { stairs[i].linkedStairsId = nil }
            if let link = stairs[i].linkedStairsId, ids.contains(link) { stairs[i].linkedStairsId = nil }
        }
    }

    /// Removes stairs and unlinks their sisters, so no end points at stairs that are gone.
    public mutating func removeStairs(_ ids: Set<String>) {
        let removed = Set(stairs.lazy.map(\.id).filter { ids.contains($0) })
        guard !removed.isEmpty else { return }
        unlinkStairs(removed)
        stairs.removeAll { removed.contains($0.id) }
    }

    /// Turns stairs a quarter turn clockwise.
    public mutating func rotateStairs(_ ids: Set<String>) {
        for i in stairs.indices where ids.contains(stairs[i].id) {
            switch stairs[i].direction {
            case .north: stairs[i].direction = .east
            case .east: stairs[i].direction = .south
            case .south: stairs[i].direction = .west
            case .west: stairs[i].direction = .north
            }
            (stairs[i].width, stairs[i].height) = (stairs[i].height, stairs[i].width)
        }
    }

    /// Moves stairs by a map-space offset, keeping each on a cell. Copies (with `duplicate`) are
    /// unlinked: a pair is always exactly two ends.
    @discardableResult
    public mutating func moveStairs(_ ids: Set<String>, dx: Double, dy: Double, duplicate: Bool) -> [String] {
        var placed: [String] = []
        for index in stairs.indices where ids.contains(stairs[index].id) {
            var moved = stairs[index]
            let centre = stairsCentre(near: Point2D(x: moved.x + dx, y: moved.y + dy))
            // Stairs wider than a cell keep their offset from the cell centre.
            let original = stairsCentre(near: Point2D(x: moved.x, y: moved.y))
            moved.x = centre.x + (moved.x - original.x)
            moved.y = centre.y + (moved.y - original.y)
            if duplicate {
                moved.id = newID()
                moved.linkedStairsId = nil
                stairs.append(moved)
            } else {
                stairs[index] = moved
            }
            placed.append(moved.id)
        }
        return placed
    }

    public func stairsIDs(intersecting rect: Bounds) -> [String] {
        stairs.filter { $0.bounds.intersects(rect) }.map(\.id)
    }

    /// Where a drop of `primary` by (`dx`, `dy`) takes the stairs, if it does: when the dropped
    /// token's centre lands on linked stairs it wasn't already on. Standing on stairs, nudging
    /// along them and arriving never travel, so a token can't bounce between the ends.
    public func stairsTravel(
        forDropOf primary: String, dx: Double, dy: Double, library: [String: TokenLibraryItem]
    ) -> (from: Stairs, to: Stairs)? {
        guard let token = tokens.first(where: { $0.id == primary }) else { return nil }
        let before = tokenBounds(token, library: library)
        let target = snappedDrop(token, dx: dx, dy: dy, library: library)
        let size = before.width
        let from = Point2D(x: before.x + size / 2, y: before.y + size / 2)
        let to = Point2D(x: target.x + size / 2, y: target.y + size / 2)
        guard let entry = stairs(at: to), let exit = sister(of: entry), !entry.bounds.contains(from) else {
            return nil
        }
        return (entry, exit)
    }

    /// The primary token's top-left after a drop by (`dx`, `dy`), snapped with its own size.
    func snappedDrop(_ token: Token, dx: Double, dy: Double, library: [String: TokenLibraryItem]) -> Point2D {
        let size = tokenSize(token, library: library)
        let grid = makeGridGeometry(gridType, cellSize: gridSize)
        return grid.snapPoint(Point2D(x: token.x + dx, y: token.y + dy), width: size, height: size)
    }
}
