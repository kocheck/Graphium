import Foundation

extension GameMap {
    /// Bounds around every PC token, padded by `paddingCells` grid cells
    /// (TS "Center on Party": 2 cells). Nil when there are no PCs.
    public func partyBounds(library: [String: TokenLibraryItem], paddingCells: Double = 2) -> Bounds? {
        let pcs = tokens.filter { ResolvedToken($0, library: library).type == .pc }
        guard !pcs.isEmpty else { return nil }
        var minX = Double.infinity, minY = Double.infinity
        var maxX = -Double.infinity, maxY = -Double.infinity
        for token in pcs {
            let b = tokenBounds(token, library: library)
            minX = min(minX, b.x)
            minY = min(minY, b.y)
            maxX = max(maxX, b.x + b.width)
            maxY = max(maxY, b.y + b.height)
        }
        let pad = gridSize * paddingCells
        return Bounds(x: minX - pad, y: minY - pad, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad)
    }
}
