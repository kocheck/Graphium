import Foundation

/// A grid cell. Square: q = column, r = row. Hex: axial. Iso: diamond column/row.
public struct GridCell: Hashable, Sendable {
    public var q: Int
    public var r: Int

    public init(q: Int, r: Int) {
        self.q = q
        self.r = r
    }
}

public struct Bounds: Equatable, Sendable {
    public var x, y, width, height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}

/// Grid maths for one grid type (CORE_SPEC §3.1). Snap inputs and outputs are
/// token **top-left** positions; omit the size for "legacy" point snapping (doors).
public protocol GridGeometry: Sendable {
    var cellSize: Double { get }
    func pixelToGrid(_ point: Point2D) -> GridCell
    /// Cell centre.
    func gridToPixel(_ cell: GridCell) -> Point2D
    func snapPoint(_ point: Point2D, width: Double?, height: Double?) -> Point2D
    func cellVertices(_ cell: GridCell) -> [Point2D]
    func visibleCells(in bounds: Bounds) -> [GridCell]
    /// Movement-range neighbours, in BFS order (CORE_SPEC §3.4).
    var neighborOffsets: [GridCell] { get }
}

extension GridGeometry {
    public func snapPoint(_ point: Point2D) -> Point2D {
        snapPoint(point, width: nil, height: nil)
    }
}

public func makeGridGeometry(_ type: GridType, cellSize: Double) -> any GridGeometry {
    switch type {
    case .lines, .dots, .hidden: return SquareGrid(cellSize: cellSize)
    case .hexagonal: return HexGrid(cellSize: cellSize)
    case .isometric: return IsoGrid(cellSize: cellSize)
    }
}

/// TS `snapToGrid(x, y, gridSize, gridType, width?, height?)`.
public func snapToGrid(
    _ point: Point2D, gridSize: Double, gridType: GridType = .lines, width: Double? = nil, height: Double? = nil
) -> Point2D {
    makeGridGeometry(gridType, cellSize: gridSize).snapPoint(point, width: width, height: height)
}

public struct SquareGrid: GridGeometry {
    public let cellSize: Double

    public init(cellSize: Double) { self.cellSize = cellSize }

    public func pixelToGrid(_ p: Point2D) -> GridCell {
        GridCell(q: Int((p.x / cellSize).rounded(.down)), r: Int((p.y / cellSize).rounded(.down)))
    }

    public func gridToPixel(_ c: GridCell) -> Point2D {
        Point2D(x: (Double(c.q) + 0.5) * cellSize, y: (Double(c.r) + 0.5) * cellSize)
    }

    public func snapPoint(_ p: Point2D, width: Double?, height: Double?) -> Point2D {
        guard let width, let height else {
            // Legacy: nearest grid intersection.
            return Point2D(x: jsRound(p.x / cellSize) * cellSize, y: jsRound(p.y / cellSize) * cellSize)
        }
        return Point2D(x: snapAxis(p.x, size: width), y: snapAxis(p.y, size: height))
    }

    /// Odd cell spans centre on a cell; even spans (including 0) centre on an intersection.
    private func snapAxis(_ position: Double, size: Double) -> Double {
        let center = position + size / 2
        let cells = Int(jsRound(size / cellSize))
        let snappedCenter =
            cells % 2 != 0
            ? ((center / cellSize).rounded(.down) + 0.5) * cellSize
            : jsRound(center / cellSize) * cellSize
        return snappedCenter - size / 2
    }

    public func cellVertices(_ c: GridCell) -> [Point2D] {
        let x = Double(c.q) * cellSize
        let y = Double(c.r) * cellSize
        return [
            Point2D(x: x, y: y), Point2D(x: x + cellSize, y: y),
            Point2D(x: x + cellSize, y: y + cellSize), Point2D(x: x, y: y + cellSize),
        ]
    }

    public func visibleCells(in b: Bounds) -> [GridCell] {
        let minQ = Int((b.x / cellSize).rounded(.down))
        let maxQ = Int(((b.x + b.width) / cellSize).rounded(.up))
        let minR = Int((b.y / cellSize).rounded(.down))
        let maxR = Int(((b.y + b.height) / cellSize).rounded(.up))
        guard minQ <= maxQ, minR <= maxR else { return [] }
        return (minQ...maxQ).flatMap { q in (minR...maxR).map { GridCell(q: q, r: $0) } }
    }

    public var neighborOffsets: [GridCell] {
        [GridCell(q: 1, r: 0), GridCell(q: -1, r: 0), GridCell(q: 0, r: 1), GridCell(q: 0, r: -1)]
    }
}

/// Flat-top hexes in axial coordinates; `cellSize` is the circumradius.
public struct HexGrid: GridGeometry {
    public let cellSize: Double
    static let boundsSafetyFactor = 1.2

    public init(cellSize: Double) { self.cellSize = cellSize }

    public func pixelToGrid(_ p: Point2D) -> GridCell {
        let q = (2.0 / 3.0 * p.x) / cellSize
        let r = (-1.0 / 3.0 * p.x + 3.0.squareRoot() / 3.0 * p.y) / cellSize
        return Self.hexRound(q: q, r: r)
    }

    static func hexRound(q: Double, r: Double) -> GridCell {
        let s = -q - r
        var rq = jsRound(q)
        var rr = jsRound(r)
        let rs = jsRound(s)
        let dq = abs(rq - q)
        let dr = abs(rr - r)
        let ds = abs(rs - s)
        if dq > dr && dq > ds {
            rq = -rr - rs
        } else if dr > ds {
            rr = -rq - rs
        }
        return GridCell(q: Int(rq), r: Int(rr))
    }

    public func gridToPixel(_ c: GridCell) -> Point2D {
        let q = Double(c.q)
        let r = Double(c.r)
        return Point2D(x: cellSize * 1.5 * q, y: cellSize * (3.0.squareRoot() / 2 * q + 3.0.squareRoot() * r))
    }

    public func snapPoint(_ p: Point2D, width: Double?, height: Double?) -> Point2D {
        snapToCellCentre(self, p, width: width, height: height)
    }

    public func cellVertices(_ c: GridCell) -> [Point2D] {
        let centre = gridToPixel(c)
        return (0..<6).map { i in
            let angle = Double(i) * .pi / 3
            return Point2D(x: centre.x + cellSize * cos(angle), y: centre.y + cellSize * sin(angle))
        }
    }

    public func visibleCells(in b: Bounds) -> [GridCell] {
        let corners = [
            Point2D(x: b.x, y: b.y), Point2D(x: b.x + b.width, y: b.y),
            Point2D(x: b.x, y: b.y + b.height), Point2D(x: b.x + b.width, y: b.y + b.height),
        ].map(pixelToGrid)
        let minQ = corners.map(\.q).min()! - 2
        let maxQ = corners.map(\.q).max()! + 2
        let minR = corners.map(\.r).min()! - 2
        let maxR = corners.map(\.r).max()! + 2
        let pad = cellSize * Self.boundsSafetyFactor
        var cells: [GridCell] = []
        for q in minQ...maxQ {
            for r in minR...maxR {
                let c = gridToPixel(GridCell(q: q, r: r))
                if c.x + pad >= b.x && c.x - pad <= b.x + b.width && c.y + pad >= b.y && c.y - pad <= b.y + b.height {
                    cells.append(GridCell(q: q, r: r))
                }
            }
        }
        return cells
    }

    public var neighborOffsets: [GridCell] {
        [
            GridCell(q: 1, r: 0), GridCell(q: -1, r: 0), GridCell(q: 0, r: 1),
            GridCell(q: 0, r: -1), GridCell(q: 1, r: -1), GridCell(q: -1, r: 1),
        ]
    }
}

/// Diamond (2·cellSize wide, cellSize tall) isometric grid.
///
/// Deliberate fix vs the TS app: TS `pixelToGrid` floors, so a point in the upper
/// half of a drawn diamond resolves to a neighbouring cell and snaps to the wrong
/// diamond (CORE_SPEC §3.1 "Known quirk"). Here it rounds to the diamond whose
/// drawn centre is nearest, so snapping matches what is on screen.
public struct IsoGrid: GridGeometry {
    public let cellSize: Double

    public init(cellSize: Double) { self.cellSize = cellSize }

    public func pixelToGrid(_ p: Point2D) -> GridCell {
        let col = (p.x / cellSize + 2 * p.y / cellSize) / 2
        let row = (2 * p.y / cellSize - p.x / cellSize) / 2
        return GridCell(q: Int(jsRound(col)), r: Int(jsRound(row)))
    }

    public func gridToPixel(_ c: GridCell) -> Point2D {
        Point2D(x: Double(c.q - c.r) * cellSize, y: Double(c.q + c.r) * cellSize / 2)
    }

    public func snapPoint(_ p: Point2D, width: Double?, height: Double?) -> Point2D {
        snapToCellCentre(self, p, width: width, height: height)
    }

    public func cellVertices(_ c: GridCell) -> [Point2D] {
        let p = gridToPixel(c)
        return [
            Point2D(x: p.x, y: p.y - cellSize / 2), Point2D(x: p.x + cellSize, y: p.y),
            Point2D(x: p.x, y: p.y + cellSize / 2), Point2D(x: p.x - cellSize, y: p.y),
        ]
    }

    public func visibleCells(in b: Bounds) -> [GridCell] {
        let tl = pixelToGrid(Point2D(x: b.x, y: b.y))
        let tr = pixelToGrid(Point2D(x: b.x + b.width, y: b.y))
        let bl = pixelToGrid(Point2D(x: b.x, y: b.y + b.height))
        let br = pixelToGrid(Point2D(x: b.x + b.width, y: b.y + b.height))
        let minQ = min(tl.q, bl.q) - 2
        let maxQ = max(tr.q, br.q) + 2
        let minR = min(tl.r, tr.r) - 2
        let maxR = max(bl.r, br.r) + 2
        return (minQ...maxQ).flatMap { q in (minR...maxR).map { GridCell(q: q, r: $0) } }
    }

    public var neighborOffsets: [GridCell] {
        [GridCell(q: 1, r: 0), GridCell(q: -1, r: 0), GridCell(q: 0, r: 1), GridCell(q: 0, r: -1)]
    }
}

/// Hex/iso snapping: legacy → centre of the cell under the point; sized → the
/// token's centre goes to the centre of the cell under it.
private func snapToCellCentre(_ grid: some GridGeometry, _ p: Point2D, width: Double?, height: Double?) -> Point2D {
    guard let width, let height else { return grid.gridToPixel(grid.pixelToGrid(p)) }
    let centre = grid.gridToPixel(grid.pixelToGrid(Point2D(x: p.x + width / 2, y: p.y + height / 2)))
    return Point2D(x: centre.x - width / 2, y: centre.y - height / 2)
}
