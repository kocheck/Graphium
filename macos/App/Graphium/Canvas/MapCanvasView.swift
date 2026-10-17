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
        drawGrid(cellSize: map.gridSize, in: context)
    }

    private func drawGrid(cellSize: Double, in context: CGContext) {
        let spacing = CGFloat(cellSize * viewport.zoom)
        guard spacing >= 4 else { return }  // too dense to read; skip like the TS grid does
        let first = viewport.viewPoint(fromMap: .zero)
        let startX = CGFloat(first.x).truncatingRemainder(dividingBy: spacing)
        let startY = CGFloat(first.y).truncatingRemainder(dividingBy: spacing)

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

    private func viewLocation(of event: NSEvent) -> Point2D {
        let location = convert(event.locationInWindow, from: nil)
        return Point2D(x: Double(location.x), y: Double(location.y))
    }

    override func magnify(with event: NSEvent) {
        viewport.zoom(by: 1 + Double(event.magnification), around: viewLocation(of: event))
    }

    override func scrollWheel(with event: NSEvent) {
        if event.hasPreciseScrollingDeltas {
            // Trackpad / Magic Mouse: two-finger scroll pans.
            viewport.pan(byViewDX: Double(event.scrollingDeltaX), dy: Double(event.scrollingDeltaY))
        } else {
            // Wheel mouse: wheel zooms around the cursor.
            viewport.zoom(by: event.scrollingDeltaY > 0 ? 1.1 : 1 / 1.1, around: viewLocation(of: event))
        }
    }

    override func mouseDragged(with event: NSEvent) {
        viewport.pan(byViewDX: Double(event.deltaX), dy: Double(event.deltaY))
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
