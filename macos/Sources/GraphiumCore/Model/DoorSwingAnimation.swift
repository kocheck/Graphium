import Foundation

/// Door open/close swing (TS `DoorShape`, PARITY §3.6): the leaf turns 90° about its
/// hinge over 300 ms with an ease-in-out quad curve. Times are in seconds.
public enum DoorSwingAnimation {
    public static let duration = 0.3

    /// TS easing: `p < 0.5 ? 2p² : 1 − (−2p + 2)² / 2`, with `p` clamped to [0, 1].
    public static func easeInOut(_ progress: Double) -> Double {
        let p = min(max(progress, 0), 1)
        let tail = -2 * p + 2
        return p < 0.5 ? 2 * p * p : 1 - tail * tail / 2
    }

    /// One swing in flight, as an open fraction (0 closed, 1 open) over time.
    public struct Transition: Equatable, Sendable {
        public var from: Double
        public var to: Double
        public var start: Double

        public init(from: Double, to: Double, start: Double) {
            self.from = from
            self.to = to
            self.start = start
        }

        public func openFraction(at time: Double) -> Double {
            from + (to - from) * DoorSwingAnimation.easeInOut((time - start) / DoorSwingAnimation.duration)
        }

        public func isFinished(at time: Double) -> Bool {
            time - start >= DoorSwingAnimation.duration
        }
    }
}

/// Per-canvas swing state: remembers each door's last drawn state and starts a
/// swing when `isOpen` changes, from wherever the door currently is (so a quick
/// re-toggle reverses smoothly, as in TS). Doors seen for the first time draw at rest.
public struct DoorSwingTracker: Sendable {
    private var drawnOpen: [String: Bool] = [:]
    private var swings: [String: DoorSwingAnimation.Transition] = [:]

    public init() {}

    /// True while any swing is unfinished (the canvas keeps redrawing).
    public var isAnimating: Bool { !swings.isEmpty }

    /// How open to draw the door at `now`. With `animate` false (Reduce Motion) the
    /// door jumps straight to its state.
    public mutating func openFraction(doorID: String, isOpen: Bool, now: Double, animate: Bool = true) -> Double {
        let target = isOpen ? 1.0 : 0.0
        if !animate {
            swings[doorID] = nil
        } else if let previous = drawnOpen[doorID], previous != isOpen {
            let current = swings[doorID]?.openFraction(at: now) ?? (previous ? 1 : 0)
            swings[doorID] = DoorSwingAnimation.Transition(from: current, to: target, start: now)
        }
        drawnOpen[doorID] = isOpen
        guard let swing = swings[doorID] else { return target }
        if swing.isFinished(at: now) {
            swings[doorID] = nil
            return target
        }
        return swing.openFraction(at: now)
    }

    /// Drops finished swings and, when `doorIDs` is given, every door not in it
    /// (deleted doors, or another map's doors after a map switch).
    public mutating func prune(now: Double, keeping doorIDs: Set<String>? = nil) {
        swings = swings.filter { !$0.value.isFinished(at: now) }
        if let doorIDs {
            swings = swings.filter { doorIDs.contains($0.key) }
            drawnOpen = drawnOpen.filter { doorIDs.contains($0.key) }
        }
    }
}
