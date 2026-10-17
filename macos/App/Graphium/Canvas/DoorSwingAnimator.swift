import AppKit
import GraphiumCore
import QuartzCore

/// Door swing animation for one canvas (PARITY §3.6, TS `DoorShape`): 300 ms
/// ease-in-out whenever a door opens or closes, from a click, the context menu or
/// the sidebar. A display link redraws the view only while a swing is in flight.
/// Reduce Motion skips the animation.
@MainActor
final class DoorSwingAnimator: NSObject {
    private var tracker = DoorSwingTracker()
    private var link: CADisplayLink?
    private weak var view: NSView?

    /// How open to draw `door` this frame: 0 closed, 1 open, in between while swinging.
    func openFraction(for door: Door, in view: NSView) -> Double {
        let fraction = tracker.openFraction(
            doorID: door.id, isOpen: door.isOpen, now: CACurrentMediaTime(),
            animate: !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion)
        if tracker.isAnimating { startLink(on: view) }
        return fraction
    }

    /// Forgets doors that are no longer drawn (deleted, or on another map).
    func finishFrame(doorIDs: Set<String>) {
        tracker.prune(now: CACurrentMediaTime(), keeping: doorIDs)
    }

    private func startLink(on view: NSView) {
        self.view = view
        guard link == nil else { return }
        let link = view.displayLink(target: self, selector: #selector(step(_:)))
        link.add(to: .main, forMode: .common)
        self.link = link
    }

    @objc private func step(_ link: CADisplayLink) {
        tracker.prune(now: CACurrentMediaTime())
        view?.needsDisplay = true
        if !tracker.isAnimating || view == nil {
            link.invalidate()
            self.link = nil
        }
    }
}
