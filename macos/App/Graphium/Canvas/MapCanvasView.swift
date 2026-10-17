import AppKit
import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// What an editable canvas reports back to its owner. Absent for the read-only
/// World View. All campaign changes go through the owner so they get undo.
struct CanvasEditing {
    var setSelection: (Set<String>) -> Void
    /// Commits a token drag; `duplicate` is Option-drag (only when `allowsDuplicate`).
    var dropTokens: (_ ids: [String], _ primary: String, _ dx: Double, _ dy: Double, _ duplicate: Bool) -> Void
    var allowsDuplicate = true
    /// Nil where deleting isn't allowed (World View).
    var deleteSelection: (() -> Void)?
    /// Image files dropped from Finder at a map point; nil where drops aren't allowed.
    var dropImageFiles: ((_ urls: [URL], _ at: Point2D) -> Void)?
}

/// Asks a canvas to frame a region once (e.g. Center on Party). A new `id` re-triggers.
struct FitRequest: Equatable {
    var id = UUID()
    var bounds: Bounds
}

/// The map surface. AppKit, not SwiftUI Canvas, because it needs raw NSEvent
/// input (trackpad pinch and scroll phases, modifier-aware drags, later tablet
/// pressure). Each window owns its own viewport; cameras are not synced.
final class MapCanvasNSView: NSView {
    var map: GameMap?
    var library: [String: TokenLibraryItem] = [:]
    var imageProvider: (String) -> CGImage? = { _ in nil }
    var selection: Set<String> = []
    var editing: CanvasEditing?
    /// Tokens players must not see or grab (NPCs outside party vision, M4).
    var hiddenTokenIDs: Set<String> = []
    var fitRequest: FitRequest? {
        didSet {
            guard let fitRequest, fitRequest != oldValue else { return }
            viewport.fit(fitRequest.bounds, viewWidth: Double(bounds.width), viewHeight: Double(bounds.height))
        }
    }
    var viewport = Viewport() { didSet { if viewport != oldValue { needsDisplay = true } } }

    /// Drag distance (view points) before a press on a token becomes a move.
    private static let dragThreshold = 5.0

    private enum Interaction {
        case idle
        case panning
        case movingTokens(ids: [String], primary: String, start: Point2D, current: Point2D, began: Bool)
        case marquee(start: Point2D, current: Point2D, base: Set<String>)
    }

    private var interaction = Interaction.idle
    private var spaceHeld = false

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        registerForDraggedTypes([.fileURL])
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        registerForDraggedTypes([.fileURL])
    }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    // MARK: Drawing

    override func draw(_ dirtyRect: NSRect) {
        NSColor.textBackgroundColor.setFill()
        dirtyRect.fill()
        guard let map, let context = NSGraphicsContext.current?.cgContext else { return }

        context.saveGState()
        context.scaleBy(x: viewport.zoom, y: viewport.zoom)
        context.translateBy(x: -viewport.origin.x, y: -viewport.origin.y)

        if let background = map.background, let image = imageProvider(background.src) {
            draw(
                image,
                in: CGRect(
                    x: background.x, y: background.y, width: background.width * background.scale,
                    height: background.height * background.scale), context: context)
        }
        drawGrid(map, context: context)
        drawTokens(map, context: context)
        if case .marquee(let start, let current, _) = interaction {
            let rect = CGRect(bounds: Bounds(corner: start, corner: current))
            context.setFillColor(NSColor.controlAccentColor.withAlphaComponent(0.12).cgColor)
            context.fill(rect)
            context.setStrokeColor(NSColor.controlAccentColor.cgColor)
            context.setLineWidth(1 / viewport.zoom)
            context.stroke(rect)
        }
        context.restoreGState()
    }

    /// CGImages draw bottom-up; flip locally so they appear upright in this flipped view.
    private func draw(_ image: CGImage, in rect: CGRect, context: CGContext) {
        context.saveGState()
        context.translateBy(x: rect.minX, y: rect.maxY)
        context.scaleBy(x: 1, y: -1)
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(origin: .zero, size: rect.size))
        context.restoreGState()
    }

    private var visibleMapBounds: Bounds {
        let topLeft = viewport.mapPoint(fromView: Point2D(x: 0, y: 0))
        return Bounds(
            x: topLeft.x, y: topLeft.y, width: Double(bounds.width) / viewport.zoom,
            height: Double(bounds.height) / viewport.zoom)
    }

    private func drawGrid(_ map: GameMap, context: CGContext) {
        guard map.gridType != .hidden, map.gridSize * viewport.zoom >= 4 else { return }
        let color =
            map.gridColor.lowercased() == GameMap.defaultGridColor
            // The default colour adapts to the theme, as in the TS app.
            ? NSColor.labelColor.withAlphaComponent(0.25) : (NSColor(hex: map.gridColor) ?? .separatorColor)
        context.setStrokeColor(color.cgColor)
        context.setFillColor(color.cgColor)
        context.setLineWidth(1 / viewport.zoom)

        let visible = visibleMapBounds
        let g = map.gridSize
        switch map.gridType {
        case .lines:
            var x = (visible.x / g).rounded(.down) * g
            while x <= visible.x + visible.width {
                context.move(to: CGPoint(x: x, y: visible.y))
                context.addLine(to: CGPoint(x: x, y: visible.y + visible.height))
                x += g
            }
            var y = (visible.y / g).rounded(.down) * g
            while y <= visible.y + visible.height {
                context.move(to: CGPoint(x: visible.x, y: y))
                context.addLine(to: CGPoint(x: visible.x + visible.width, y: y))
                y += g
            }
            context.strokePath()
        case .dots:
            // Coarsen when there would be too many dots (TS: above 10,000).
            let count = (visible.width / g) * (visible.height / g)
            let step = count > 10_000 ? g * (count / 10_000).squareRoot().rounded(.up) : g
            let radius = 1.5 / viewport.zoom
            var x = (visible.x / step).rounded(.down) * step
            while x <= visible.x + visible.width {
                var y = (visible.y / step).rounded(.down) * step
                while y <= visible.y + visible.height {
                    context.fillEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
                    y += step
                }
                x += step
            }
        case .hexagonal, .isometric:
            let geometry = makeGridGeometry(map.gridType, cellSize: g)
            for cell in geometry.visibleCells(in: visible) {
                let vertices = geometry.cellVertices(cell)
                guard let first = vertices.first else { continue }
                context.move(to: CGPoint(first))
                for v in vertices.dropFirst() { context.addLine(to: CGPoint(v)) }
                context.closePath()
            }
            context.strokePath()
        case .hidden:
            break
        }
    }

    private func drawTokens(_ map: GameMap, context: CGContext) {
        var dragOffset: (dx: Double, dy: Double, duplicate: Bool)?
        var preview: [String: Point2D] = [:]
        if case .movingTokens(let ids, let primary, let start, let current, true) = interaction {
            let duplicate = NSEvent.modifierFlags.contains(.option) && editing?.allowsDuplicate == true
            dragOffset = (current.x - start.x, current.y - start.y, duplicate)
            // Snap preview: where each token will land on release.
            var trial = map
            let placed = trial.dropTokens(
                ids, primary: primary, dx: current.x - start.x, dy: current.y - start.y, duplicate: false,
                library: library)
            for id in placed {
                if let t = trial.tokens.first(where: { $0.id == id }) { preview[id] = Point2D(x: t.x, y: t.y) }
            }
        }

        let visible = visibleMapBounds
        let margin = map.gridSize * 2
        let padded = Bounds(
            x: visible.x - margin, y: visible.y - margin, width: visible.width + 2 * margin,
            height: visible.height + 2 * margin)
        for token in map.tokens where !hiddenTokenIDs.contains(token.id) {
            let size = map.tokenSize(token, library: library)
            var rect = CGRect(x: token.x, y: token.y, width: size, height: size)
            let isSelected = selection.contains(token.id)
            if let offset = dragOffset, isSelected {
                if offset.duplicate {
                    drawToken(token, in: rect, selected: false, alpha: 1, context: context)  // original stays
                }
                rect = rect.offsetBy(dx: offset.dx, dy: offset.dy)
                if let target = preview[token.id] {
                    context.saveGState()
                    context.setStrokeColor(NSColor.systemBlue.cgColor)
                    context.setLineWidth(2 / viewport.zoom)
                    context.setLineDash(phase: 0, lengths: [6 / viewport.zoom, 4 / viewport.zoom])
                    context.strokeEllipse(in: CGRect(x: target.x, y: target.y, width: size, height: size))
                    context.restoreGState()
                }
                drawToken(token, in: rect, selected: true, alpha: 0.6, context: context)
                continue
            }
            // Cull tokens well off screen (2-cell margin, as in TS).
            guard padded.intersects(Bounds(x: token.x, y: token.y, width: size, height: size)) else { continue }
            drawToken(token, in: rect, selected: isSelected, alpha: 1, context: context)
        }
    }

    private func drawToken(_ token: Token, in rect: CGRect, selected: Bool, alpha: CGFloat, context: CGContext) {
        context.saveGState()
        context.setAlpha(alpha)
        if let image = imageProvider(token.src) {
            draw(image, in: rect, context: context)
        } else {
            context.setFillColor(NSColor.systemGray.cgColor)
            context.fillEllipse(in: rect.insetBy(dx: rect.width * 0.08, dy: rect.height * 0.08))
        }
        if selected {
            context.setStrokeColor(NSColor.systemBlue.cgColor)
            context.setLineWidth(2 / viewport.zoom)
            context.setLineDash(phase: 0, lengths: [6 / viewport.zoom, 3 / viewport.zoom])
            context.stroke(rect.insetBy(dx: -3 / viewport.zoom, dy: -3 / viewport.zoom))
        }
        context.restoreGState()

        let name = ResolvedToken(token, library: library).name
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.boldSystemFont(ofSize: 12), .foregroundColor: NSColor.labelColor.withAlphaComponent(alpha),
        ]
        let label = NSAttributedString(string: name, attributes: attributes)
        let labelSize = label.size()
        label.draw(at: NSPoint(x: rect.midX - labelSize.width / 2, y: rect.maxY + 2))
    }

    // MARK: Pointer input

    private func viewLocation(of event: NSEvent) -> Point2D {
        let location = convert(event.locationInWindow, from: nil)
        return Point2D(x: Double(location.x), y: Double(location.y))
    }

    private func mapLocation(of event: NSEvent) -> Point2D {
        viewport.mapPoint(fromView: viewLocation(of: event))
    }

    override func mouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        guard let editing, let map, !spaceHeld else {
            interaction = .panning
            NSCursor.closedHand.set()
            return
        }
        let point = mapLocation(of: event)
        let shift = event.modifierFlags.contains(.shift)
        if let hit = map.token(at: point, library: library), !hiddenTokenIDs.contains(hit.id) {
            if shift {
                var next = selection
                if next.contains(hit.id) { next.remove(hit.id) } else { next.insert(hit.id) }
                editing.setSelection(next)
                return
            }
            var dragged = selection
            if !dragged.contains(hit.id) {
                dragged = [hit.id]
                editing.setSelection(dragged)
            }
            let ordered = map.tokens.map(\.id).filter { dragged.contains($0) }
            interaction = .movingTokens(ids: ordered, primary: hit.id, start: point, current: point, began: false)
        } else {
            let base = shift ? selection : []
            if !shift { editing.setSelection([]) }
            interaction = .marquee(start: point, current: point, base: base)
        }
    }

    override func mouseDragged(with event: NSEvent) {
        switch interaction {
        case .idle:
            break
        case .panning:
            viewport.pan(byViewDX: Double(event.deltaX), dy: Double(event.deltaY))
        case .movingTokens(let ids, let primary, let start, _, let began):
            let point = mapLocation(of: event)
            let moved = began || Measure.euclideanDistance(start, point) * viewport.zoom >= Self.dragThreshold
            interaction = .movingTokens(ids: ids, primary: primary, start: start, current: point, began: moved)
            if moved { NSCursor.closedHand.set() }
            needsDisplay = true
        case .marquee(let start, _, let base):
            let point = mapLocation(of: event)
            interaction = .marquee(start: start, current: point, base: base)
            if let map {
                let hits = map.tokenIDs(intersecting: Bounds(corner: start, corner: point), library: library)
                editing?.setSelection(base.union(hits))
            }
            needsDisplay = true
        }
    }

    override func mouseUp(with event: NSEvent) {
        if case .movingTokens(let ids, let primary, let start, let current, true) = interaction {
            let duplicate = event.modifierFlags.contains(.option) && editing?.allowsDuplicate == true
            editing?.dropTokens(ids, primary, current.x - start.x, current.y - start.y, duplicate)
        }
        interaction = .idle
        (spaceHeld ? NSCursor.openHand : NSCursor.arrow).set()
        needsDisplay = true
    }

    override func magnify(with event: NSEvent) {
        viewport.zoom(by: 1 + Double(event.magnification), around: viewLocation(of: event))
    }

    override func scrollWheel(with event: NSEvent) {
        let flags = event.modifierFlags
        if flags.contains(.command) || flags.contains(.control) {
            // ⌘/⌃ + wheel zooms around the pointer (TS: ctrl/cmd+wheel; factor 1.1 per notch).
            let factor =
                event.hasPreciseScrollingDeltas
                ? exp(Double(event.scrollingDeltaY) * 0.01) : (event.scrollingDeltaY > 0 ? 1.1 : 1 / 1.1)
            viewport.zoom(by: factor, around: viewLocation(of: event))
        } else {
            // Plain wheel / two-finger scroll pans.
            let scale = event.hasPreciseScrollingDeltas ? 1.0 : 10.0
            viewport.pan(byViewDX: Double(event.scrollingDeltaX) * scale, dy: Double(event.scrollingDeltaY) * scale)
        }
    }

    // MARK: Keyboard

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 49:  // space: hold to pan
            if !event.isARepeat {
                spaceHeld = true
                NSCursor.openHand.set()
            }
        case 51, 117:  // delete, forward delete
            if !selection.isEmpty { editing?.deleteSelection?() }
        case 53:  // escape
            editing?.setSelection([])
        default:
            let centre = Point2D(x: Double(bounds.midX), y: Double(bounds.midY))
            switch event.charactersIgnoringModifiers {
            case "+", "=": viewport.zoom(by: 1.1, around: centre)
            case "-", "_": viewport.zoom(by: 1 / 1.1, around: centre)
            default: super.keyDown(with: event)
            }
        }
    }

    override func keyUp(with event: NSEvent) {
        if event.keyCode == 49 {
            spaceHeld = false
            NSCursor.arrow.set()
        } else {
            super.keyUp(with: event)
        }
    }

    // MARK: Drag and drop from Finder

    private func imageURLs(from info: NSDraggingInfo) -> [URL] {
        let objects = info.draggingPasteboard.readObjects(
            forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true])
        let urls = (objects as? [URL]) ?? []
        return urls.filter { UTType(filenameExtension: $0.pathExtension)?.conforms(to: .image) ?? false }
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        editing?.dropImageFiles != nil && !imageURLs(from: sender).isEmpty ? .copy : []
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let urls = imageURLs(from: sender)
        guard let drop = editing?.dropImageFiles, !urls.isEmpty else { return false }
        let location = convert(sender.draggingLocation, from: nil)
        drop(urls, viewport.mapPoint(fromView: Point2D(x: Double(location.x), y: Double(location.y))))
        return true
    }
}

struct MapCanvas: NSViewRepresentable {
    let map: GameMap
    let library: [String: TokenLibraryItem]
    let imageProvider: (String) -> CGImage?
    var selection: Set<String> = []
    var editing: CanvasEditing?
    var hiddenTokenIDs: Set<String> = []
    var fitRequest: FitRequest?

    func makeNSView(context: Context) -> MapCanvasNSView {
        MapCanvasNSView()
    }

    func updateNSView(_ view: MapCanvasNSView, context: Context) {
        view.map = map
        view.library = library
        view.imageProvider = imageProvider
        view.selection = selection
        view.editing = editing
        view.hiddenTokenIDs = hiddenTokenIDs
        view.fitRequest = fitRequest
        view.needsDisplay = true
    }
}

extension CGPoint {
    init(_ p: Point2D) {
        self.init(x: p.x, y: p.y)
    }
}

extension CGRect {
    init(bounds b: Bounds) {
        self.init(x: b.x, y: b.y, width: b.width, height: b.height)
    }
}

extension NSColor {
    /// `#rgb` or `#rrggbb`.
    convenience init?(hex: String) {
        var text = hex.trimmingCharacters(in: .whitespaces)
        if text.hasPrefix("#") { text.removeFirst() }
        if text.count == 3 { text = text.map { "\($0)\($0)" }.joined() }
        guard text.count == 6, let value = UInt32(text, radix: 16) else { return nil }
        self.init(
            srgbRed: CGFloat((value >> 16) & 0xFF) / 255, green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255, alpha: 1)
    }
}
