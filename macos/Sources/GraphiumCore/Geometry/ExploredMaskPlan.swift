import Foundation

/// Bookkeeping for a cached explored-fog mask (PARITY §3.7, TS `FogOfWarLayer`'s
/// offscreen canvas): which regions are already stamped, and whether the next
/// frame can stamp only the new ones or must rebuild. The app owns the bitmap.
public struct ExploredMaskPlan: Equatable, Sendable {
    public enum Update: Equatable, Sendable {
        /// The mask already holds exactly these regions.
        case unchanged
        /// Stamp `regions[from...]` onto the existing mask.
        case append(from: Int)
        /// Clear the mask and stamp every region (new map or bounds, undo, reset,
        /// or the 2000-region cap dropping the oldest).
        case rebuild
    }

    public var mapID: String
    public var bounds: Bounds
    /// How many regions the mask holds, and the first and last of them, which is
    /// enough to notice a history that was rewritten without changing its length.
    public var count: Int
    public var first: ExploredRegion?
    public var last: ExploredRegion?

    public init(mapID: String, bounds: Bounds, regions: [ExploredRegion]) {
        self.mapID = mapID
        self.bounds = bounds
        count = regions.count
        first = regions.first
        last = regions.last
    }

    /// What to do to bring a mask described by `stamped` (nil: none yet) up to `regions`.
    public static func update(
        from stamped: ExploredMaskPlan?, mapID: String, bounds: Bounds, regions: [ExploredRegion]
    ) -> Update {
        guard let stamped, stamped.mapID == mapID, stamped.bounds == bounds, regions.count >= stamped.count else {
            return .rebuild
        }
        guard stamped.count > 0 else { return regions.isEmpty ? .unchanged : .append(from: 0) }
        guard regions[0] == stamped.first, regions[stamped.count - 1] == stamped.last else { return .rebuild }
        return regions.count == stamped.count ? .unchanged : .append(from: stamped.count)
    }
}
