import Foundation

/// Turning doors after they are placed, and keeping the walls beside a door joined to its
/// ends so no light slips past (native; PARITY §3.6).
extension GameMap {
    /// Wall ends this close to a door end, in cells, are joined to it. Wider than
    /// `WallWeld` (0.1) because a hand-drawn wall often stops a little short of a door.
    public static let doorJoinToleranceInCells = 0.25
    /// An end further than this from the door end keeps its place and gains a short stub to
    /// the door instead, so a hand-drawn wall keeps its shape.
    static let doorJoinMoveInCells = 0.12

    /// Turns the given doors about their centres by `degrees` (clockwise on screen), then
    /// joins the walls that met each door's ends to where those ends are now.
    public mutating func rotateDoors(_ ids: Set<String>, by degrees: Double) {
        for i in doors.indices where ids.contains(doors[i].id) {
            let before = doors[i]
            doors[i].setAngle(before.radians * 180 / .pi + degrees)
            joinWalls(to: doors[i], movedFrom: before)
        }
    }

    /// Moves the free ends of wall strokes near `door`'s ends onto them. With `previous`
    /// (the same door before a turn), an end that met one of the old door ends follows it.
    public mutating func joinWalls(to door: Door, movedFrom previous: Door? = nil) {
        let tolerance = gridSize * Self.doorJoinToleranceInCells
        // Only ends that really met the old door follow it, not every end nearby.
        let follow = gridSize * WallWeld.toleranceInCells
        let ends = [door.ends.hinge, door.ends.latch]
        let turn = previous.map { door.radians - $0.radians } ?? 0
        let oldEnds = previous.map { [$0.ends.hinge, $0.ends.latch] } ?? []
        func target(for p: Point2D) -> Point2D? {
            if let near = ends.min(by: { distance($0, p) < distance($1, p) }), distance(near, p) <= tolerance {
                return distance(near, p) < 1e-9 ? nil : near
            }
            // Followed by rotating it with the door, so a wall on the hinge stays on the hinge.
            guard let old = oldEnds.first(where: { distance($0, p) <= follow }) else { return nil }
            let c = Point2D(x: door.x, y: door.y)
            let dx = old.x - c.x
            let dy = old.y - c.y
            let moved = Point2D(x: c.x + dx * cos(turn) - dy * sin(turn), y: c.y + dx * sin(turn) + dy * cos(turn))
            return ends.min(by: { distance($0, moved) < distance($1, moved) })
        }
        for i in drawings.indices where drawings[i].tool == .wall && drawings[i].points.count >= 4 {
            let followed = oldEnds.isEmpty ? [] : [0, drawings[i].points.count - 2].filter { index in
                oldEnds.contains { distance($0, drawings[i].worldPoint(at: index)) <= follow }
            }
            for index in [drawings[i].points.count - 2, 0] {
                // A turn moves only the walls that met the door; placing reaches any near one.
                if previous != nil, !followed.contains(index) { continue }
                let p = drawings[i].worldPoint(at: index)
                guard let to = target(for: p) else { continue }
                // A wall that met the door moves with it; a nearby one reaches over to it.
                drawings[i].join(end: index, to: to, move: followed.contains(index), gridSize: gridSize)
            }
        }
    }

    /// Joins the free ends of the wall stroke `id` to any door end nearby (after drawing it).
    public mutating func joinWallToDoors(id: String) {
        guard let i = drawings.firstIndex(where: { $0.id == id }), drawings[i].tool == .wall,
            drawings[i].points.count >= 4
        else { return }
        let tolerance = gridSize * Self.doorJoinToleranceInCells
        let ends = doors.flatMap { [$0.ends.hinge, $0.ends.latch] }
        for index in [drawings[i].points.count - 2, 0] {
            let p = drawings[i].worldPoint(at: index)
            if let near = ends.min(by: { distance($0, p) < distance($1, p) }), distance(near, p) <= tolerance,
                distance(near, p) > 1e-9
            {
                drawings[i].join(end: index, to: near, move: false, gridSize: gridSize)
            }
        }
    }

    private func distance(_ a: Point2D, _ b: Point2D) -> Double { hypot(a.x - b.x, a.y - b.y) }
}

extension Door {
    /// Points the door along `degrees` (clockwise from east), kept in (−90, 90] as the file
    /// stores it; 0 and 90 are stored as the plain axis doors the web app understands.
    public mutating func setAngle(_ degrees: Double) {
        var d = degrees.truncatingRemainder(dividingBy: 180)
        if d > 90 { d -= 180 } else if d <= -90 { d += 180 }
        if abs(d) < 1e-6 {
            orientation = .horizontal
            angle = nil
        } else if abs(d - 90) < 1e-6 {
            orientation = .vertical
            angle = nil
        } else {
            orientation = abs(d) <= 45 ? .horizontal : .vertical
            angle = d
        }
    }
}

extension Drawing {
    /// The stroke point whose x is at `points[index]`, in world space.
    func worldPoint(at index: Int) -> Point2D {
        let s = scale ?? 1
        return Point2D(x: points[index] * s + (x ?? 0), y: points[index + 1] * s + (y ?? 0))
    }

    /// Joins the stroke's end at `index` (0, or the last point's) to `target`: moves it there
    /// when `move` or when it is close, else adds a point there past the end.
    mutating func join(end index: Int, to target: Point2D, move: Bool, gridSize: Double) {
        let p = worldPoint(at: index)
        if move || hypot(p.x - target.x, p.y - target.y) <= gridSize * GameMap.doorJoinMoveInCells {
            setWorldPoint(target, at: index)
            return
        }
        let s = scale ?? 1
        guard s != 0 else { return }
        let local = [(target.x - (x ?? 0)) / s, (target.y - (y ?? 0)) / s]
        if index == 0 { points.insert(contentsOf: local, at: 0) } else { points += local }
    }

    mutating func setWorldPoint(_ p: Point2D, at index: Int) {
        let s = scale ?? 1
        guard s != 0 else { return }
        points[index] = (p.x - (x ?? 0)) / s
        points[index + 1] = (p.y - (y ?? 0)) / s
    }
}
