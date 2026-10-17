import AppKit
import GraphiumCore
import SwiftUI

/// The map surface. AppKit, not SwiftUI Canvas, because it needs raw NSEvent
/// input: trackpad pinch and scroll phases, and (later) tablet pressure.
final class MapCanvasNSView: NSView {
    var map: GameMap? { didSet { if map != oldValue { needsDisplay = true } } }
    var viewport = Viewport() { didSet { if viewport != oldValue { needsDisplay = true } } }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        NSColor.textBackgroundColor.setFill()
        dirtyRect.fill()
        guard let map, let context = NSGraphicsContext.current?.cgContext else { return }
        drawGrid(cellSize: map.grid.cellSize, in: context)
    }

    private func drawGrid(cellSize: Double, in context: CGContext) {
        let spacing = CGFloat(cellSize) * viewport.zoom
        guard spacing >= 4 else { return }  // too dense to read; skip like the TS grid does
        let first = viewport.viewPoint(fromMap: .zero)
        let startX = first.x.truncatingRemainder(dividingBy: spacing)
        let startY = first.y.truncatingRemainder(dividingBy: spacing)

        context.setStrokeColor(NSColor.separatorColor.cgColor)
        context.setLineWidth(1)
        var x = startX
        while x <= bounds.maxX {
            context.move(to: CGPoint(x: x, y: bounds.minY))
            context.addLine(to: CGPoint(x: x, y: bounds.maxY))
            x += spacing
        }
        var y = startY
        while y <= bounds.maxY {
            context.move(to: CGPoint(x: bounds.minX, y: y))
            context.addLine(to: CGPoint(x: bounds.maxX, y: y))
            y += spacing
        }
        context.strokePath()
    }

    // MARK: Input

    override func magnify(with event: NSEvent) {
        let anchor = convert(event.locationInWindow, from: nil)
        viewport.zoom(by: 1 + event.magnification, around: anchor)
    }

    override func scrollWheel(with event: NSEvent) {
        if event.hasPreciseScrollingDeltas {
            // Trackpad / Magic Mouse: two-finger scroll pans.
            viewport.pan(byView: CGSize(width: event.scrollingDeltaX, height: event.scrollingDeltaY))
        } else {
            // Wheel mouse: wheel zooms around the cursor.
            let anchor = convert(event.locationInWindow, from: nil)
            viewport.zoom(by: event.scrollingDeltaY > 0 ? 1.1 : 1 / 1.1, around: anchor)
        }
    }

    override func mouseDragged(with event: NSEvent) {
        viewport.pan(byView: CGSize(width: event.deltaX, height: event.deltaY))
    }
}

struct MapCanvas: NSViewRepresentable {
    let map: GameMap

    func makeNSView(context: Context) -> MapCanvasNSView {
        let view = MapCanvasNSView()
        view.map = map
        return view
    }

    func updateNSView(_ view: MapCanvasNSView, context: Context) {
        view.map = map
    }
}
