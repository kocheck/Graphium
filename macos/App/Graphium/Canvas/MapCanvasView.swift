import AppKit
import QuartzCore
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
    /// Architect-only tool edits; nil in the World View.
    var addDrawing: ((Drawing) -> Void)?
    var placeDoor: ((Point2D) -> Void)?
    var doorAction: ((_ doorID: String, DoorAction) -> Void)?
    var setMeasurement: ((MeasurementShape?) -> Void)?
    var setTool: ((CanvasTool) -> Void)?
    var toggleDoorOrientation: (() -> Void)?
    /// A library item dragged from the sidebar or Library Manager, dropped at a map point.
    var dropLibraryItem: ((_ itemID: String, _ at: Point2D) -> Void)?
    /// Marker/eraser strokes dragged by an offset (Option duplicates).
    var moveDrawings: ((_ ids: Set<String>, _ dx: Double, _ dy: Double, _ duplicate: Bool) -> Void)?
    var resizeToken: ((_ id: String, _ scale: Double) -> Void)?
    var calibrate: ((Bounds) -> Void)?
    var cancelCalibration: (() -> Void)?
    /// Live (unsnapped) positions of tokens being dragged, for the World View; nil when done.
    var dragPreview: (([String: Point2D]?) -> Void)?
    var setGridType: ((GridType) -> Void)?
    /// `I` (PARITY §1.4).
    var openColorPicker: (() -> Void)?
    /// Esc with nothing else to cancel stops Session Console audio (PARITY §1.4).
    var stopAudio: (() -> Void)?
}

/// Fog of war to draw over the map (World View, when not in daylight).
struct FogState {
    var bounds: Bounds
    var explored: [[Point2D]]
    var vision: [LineOfSight.VisionPolygon]
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
    /// Identifies the document whose asset names `imageProvider` resolves (cache keys).
    var assetNamespace = ""
    var selection: Set<String> = []
    var editing: CanvasEditing?
    /// Tokens players must not see or grab (NPCs outside party vision).
    var hiddenTokenIDs: Set<String> = []
    var fog: FogState?
    /// Player-facing styling (walls black 6px, doors with glow) and no DM overlays.
    var isPlayerView = false
    var toolState = ToolState()
    var measurement: MeasurementShape?
    var selectedDoorID: String?
    /// Map calibration mode: the next drag draws the one-cell box.
    var calibrating = false
    /// Positions of tokens another window is dragging (World View shows DM drags live).
    private var showMovementRange = false
    private var hoverPoint: Point2D?
    var fitRequest: FitRequest? {
        didSet {
            guard let fitRequest, fitRequest != oldValue else { return }
            viewport.fit(fitRequest.bounds, viewWidth: Double(bounds.width), viewHeight: Double(bounds.height))
        }
    }
    var viewport = Viewport() {
        didSet {
            guard viewport != oldValue else { return }
            needsDisplay = true
            reportViewport()
        }
    }
    /// Told the camera and view size whenever either changes (World View minimap).
    var onViewportChange: ((Viewport, CGSize) -> Void)?

    private func reportViewport() {
        let report = onViewportChange
        let state = (viewport, bounds.size)
        DispatchQueue.main.async { report?(state.0, state.1) }
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        reportViewport()
    }

    /// Drag distance (view points) before a press on a token becomes a move.
    private static let dragThreshold = 5.0

    private enum Interaction {
        case idle
        case panning
        case movingTokens(ids: [String], primary: String, start: Point2D, current: Point2D, began: Bool)
        case marquee(start: Point2D, current: Point2D, base: Set<String>)
        case stroke(Drawing)
        case measuring(origin: Point2D)
        case movingStrokes(ids: Set<String>, start: Point2D, current: Point2D, began: Bool)
        case resizing(tokenID: String, baseSize: Double, start: Point2D, current: Point2D)
        case calibrating(start: Point2D, current: Point2D)
    }

    /// The resize handle of a single selected token (Architect), in map space.
    private func resizeHandle(in map: GameMap) -> (token: Token, rect: Bounds)? {
        guard !isPlayerView, editing?.resizeToken != nil, toolState.tool == .select, selection.count == 1,
            let token = map.tokens.first(where: { selection.contains($0.id) })
        else { return nil }
        let size = map.tokenSize(token, library: library)
        let handle = 10 / viewport.zoom
        let bottom = token.y + map.tokenDisplayYOffset(size: size) + size  // drawn bottom edge (iso lift)
        return (token, Bounds(x: token.x + size - handle / 2, y: bottom - handle / 2, width: handle, height: handle))
    }

    private var interaction = Interaction.idle
    private var lastBaked: (key: String, image: CGImage)?
    private var spaceHeld = false

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        commonInit()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }

    private func commonInit() {
        registerForDraggedTypes([.fileURL, .string])
        // Redraw when Increase Contrast changes (PARITY §7).
        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(displayOptionsChanged),
            name: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification, object: nil)
    }

    @objc private func displayOptionsChanged() {
        needsDisplay = true
    }

    /// Increase Contrast: a stronger default grid and thicker selection outlines.
    var highContrast: Bool { NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast }

    override var isFlipped: Bool { true }

    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .group }
    override func accessibilityLabel() -> String? { canvasAccessibilityLabel }
    override func accessibilityChildren() -> [Any]? { canvasAccessibilityChildren }
    override var acceptsFirstResponder: Bool { true }

    // MARK: Drawing

    override func draw(_ dirtyRect: NSRect) {
        let drawStarted = CACurrentMediaTime()
        defer { PerformanceStats.shared.recordDraw(started: drawStarted) }
        NSColor.textBackgroundColor.setFill()
        dirtyRect.fill()
        guard let map, let context = NSGraphicsContext.current?.cgContext else { return }

        context.saveGState()
        context.scaleBy(x: viewport.zoom, y: viewport.zoom)
        context.translateBy(x: -viewport.origin.x, y: -viewport.origin.y)

        if let background = map.background, let image = imageProvider(background.src) {
            let rect = CGRect(
                x: background.x, y: background.y, width: background.width * background.scale,
                height: background.height * background.scale)
            // Faster resampling while the user is dragging, panning or zooming.
            let quality: CGInterpolationQuality
            if case .idle = interaction { quality = .high } else { quality = .medium }
            if let baked = bakedBackground(image, src: background.src, mapScale: background.scale) {
                // Map and paper composed once off the main thread: one image per frame.
                draw(baked, in: rect, context: context, quality: quality)
            } else {
                draw(image, in: rect, context: context, quality: quality)
                // Paper texture at 25% over the map (PARITY §3.13), until the baked copy is ready.
                context.saveGState()
                context.clip(to: rect)
                context.setAlpha(0.25)
                context.setBlendMode(.multiply)
                context.draw(PaperTexture.image, in: CGRect(x: 0, y: 0, width: 256, height: 256), byTiling: true)
                context.restoreGState()
            }
        }
        drawGrid(map, context: context)
        if !isPlayerView, editing != nil, let hoverPoint, map.gridType != .dots, map.gridType != .hidden {
            // Hover cell highlight (Architect only, PARITY §3.3).
            let geometry = makeGridGeometry(map.gridType, cellSize: map.gridSize)
            let path = CGMutablePath()
            path.addPolygon(geometry.cellVertices(geometry.pixelToGrid(hoverPoint)))
            context.addPath(path)
            context.setFillColor(NSColor.controlAccentColor.withAlphaComponent(0.12).cgColor)
            context.fillPath()
        }
        var liveStroke: Drawing?
        if case .stroke(let drawing) = interaction { liveStroke = drawing }
        var ink = map.drawings
        if case .movingStrokes(let ids, let start, let current, true) = interaction {
            let duplicate = NSEvent.modifierFlags.contains(.option)
            let moved = ink.filter { ids.contains($0.id) }.map { d -> Drawing in
                var c = d
                c.x = (c.x ?? 0) + current.x - start.x
                c.y = (c.y ?? 0) + current.y - start.y
                if duplicate { c.id = "preview-" + c.id }
                return c
            }
            ink = duplicate ? ink + moved : ink.map { d in moved.first { $0.id == d.id } ?? d }
        }
        drawInk(ink, live: liveStroke, context: context)
        for drawing in ink where selection.contains(drawing.id) {
            context.saveGState()
            context.setStrokeColor(NSColor.systemBlue.cgColor)
            context.setLineWidth(1.5 / viewport.zoom)
            context.setLineDash(phase: 0, lengths: [5 / viewport.zoom, 3 / viewport.zoom])
            context.stroke(CGRect(bounds: map.drawingBounds(drawing)))
            context.restoreGState()
        }
        drawStairs(map.stairs, context: context)
        drawDoors(map.doors, context: context)
        if showMovementRange, !isPlayerView, selection.count == 1,
            let token = map.tokens.first(where: { selection.contains($0.id) })
        {
            var position = Point2D(x: token.x, y: token.y)
            if case .movingTokens(_, _, let start, let current, true) = interaction {
                position = Point2D(x: position.x + current.x - start.x, y: position.y + current.y - start.y)
            }
            let speed = ResolvedToken(token, library: library).movementSpeed
            drawMovementRange(
                movementRange(
                    tokenTopLeft: position, tokenSize: map.tokenSize(token, library: library), speedFeet: speed,
                    gridSize: map.gridSize, gridType: map.gridType),
                map: map, context: context)
        }
        drawTokens(map, context: context)
        if let handle = resizeHandle(in: map), case .idle = interaction {
            context.setFillColor(NSColor.white.cgColor)
            context.setStrokeColor(NSColor.systemBlue.cgColor)
            context.setLineWidth(1.5 / viewport.zoom)
            context.fill(CGRect(bounds: handle.rect))
            context.stroke(CGRect(bounds: handle.rect))
        }
        if case .resizing(let id, let base, let start, let current) = interaction,
            let token = map.tokens.first(where: { $0.id == id })
        {
            let size = max(map.gridSize * 0.25, base + max(current.x - start.x, current.y - start.y))
            context.setStrokeColor(NSColor.systemBlue.cgColor)
            context.setLineWidth(2 / viewport.zoom)
            context.stroke(CGRect(x: token.x, y: token.y + map.tokenDisplayYOffset(size: size), width: size, height: size))
        }
        if case .calibrating(let start, let current) = interaction {
            context.setStrokeColor(NSColor.systemOrange.cgColor)
            context.setLineWidth(2 / viewport.zoom)
            context.stroke(CGRect(bounds: Bounds(corner: start, corner: current)))
        }
        if let fog { drawFog(fog, context: context) }
        if let measurement { drawMeasurement(measurement, gridSize: map.gridSize, context: context) }
        if !isPlayerView, editing != nil, toolState.tool == .door, let hoverPoint {
            drawDoorGhost(at: hoverPoint, map: map, context: context)
        }
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
    /// The map image with paper baked in, once ready. Asset names are only unique per
    /// document, so the shared cache key includes `assetNamespace`. The visible map's
    /// baked copy is also held here, so cache eviction can't cause a re-bake loop.
    private func bakedBackground(_ image: CGImage, src: String, mapScale: Double) -> CGImage? {
        let key = "\(assetNamespace)/\(src)@\(mapScale)"
        if let lastBaked, lastBaked.key == key { return lastBaked.image }
        let baked = PaperTexture.baked(onto: image, key: key, mapScale: mapScale) { [weak self] in
            self?.needsDisplay = true
        }
        if let baked { lastBaked = (key, baked) }
        return baked
    }

    private func draw(_ image: CGImage, in rect: CGRect, context: CGContext, quality: CGInterpolationQuality = .high) {
        context.saveGState()
        context.translateBy(x: rect.minX, y: rect.maxY)
        context.scaleBy(x: 1, y: -1)
        context.interpolationQuality = quality
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
            ? NSColor.labelColor.withAlphaComponent(highContrast ? 0.55 : 0.25) : (NSColor(hex: map.gridColor) ?? .separatorColor)
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
            let lift = map.tokenDisplayYOffset(size: size)  // iso tokens stand on their diamond (TS)
            var rect = CGRect(x: token.x, y: token.y + lift, width: size, height: size)
            let isSelected = selection.contains(token.id)
            if let offset = dragOffset, isSelected {
                if offset.duplicate {
                    drawToken(token, in: rect, lift: lift, selected: false, alpha: 1, context: context)  // original stays
                }
                rect = rect.offsetBy(dx: offset.dx, dy: offset.dy)
                if let target = preview[token.id] {
                    context.saveGState()
                    context.setStrokeColor(NSColor.systemBlue.cgColor)
                    context.setLineWidth(2 / viewport.zoom)
                    context.setLineDash(phase: 0, lengths: [6 / viewport.zoom, 4 / viewport.zoom])
                    context.strokeEllipse(in: CGRect(x: target.x, y: target.y + lift, width: size, height: size))
                    context.restoreGState()
                }
                drawToken(token, in: rect, lift: lift, selected: true, alpha: 0.6, context: context)
                continue
            }
            // Cull tokens well off screen (2-cell margin, as in TS).
            guard padded.intersects(Bounds(x: token.x, y: token.y + lift, width: size, height: size)) else { continue }
            drawToken(token, in: rect, lift: lift, selected: isSelected, alpha: 1, context: context)
        }
    }

    /// TS compositing (CORE_SPEC §3.3 step 7): fog bounds filled black at 94%;
    /// explored areas erased down to 20% coverage; current vision erased with a
    /// radial falloff (clear to 60% of the radius, fading to fog at the edge).
    /// Explored polygons are filled as one path, so overlaps don't compound as in TS.
    private func drawFog(_ fog: FogState, context: CGContext) {
        context.saveGState()
        context.beginTransparencyLayer(auxiliaryInfo: nil)
        context.setFillColor(NSColor.black.withAlphaComponent(0.94).cgColor)
        context.fill(CGRect(bounds: fog.bounds))
        context.setBlendMode(.destinationOut)

        if !fog.explored.isEmpty {
            let path = CGMutablePath()
            for polygon in fog.explored { path.addPolygon(polygon) }
            context.addPath(path)
            context.setFillColor(NSColor.black.withAlphaComponent(0.8).cgColor)
            context.fillPath()
        }

        let colors = [
            NSColor.black.cgColor, NSColor.black.cgColor, NSColor.black.withAlphaComponent(0).cgColor,
        ] as CFArray
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.6, 1]) {
            for entry in fog.vision where entry.polygon.count >= 3 {
                context.saveGState()
                let path = CGMutablePath()
                path.addPolygon(entry.polygon)
                context.addPath(path)
                context.clip()
                let centre = CGPoint(entry.viewer.centre)
                context.drawRadialGradient(
                    gradient, startCenter: centre, startRadius: 0, endCenter: centre,
                    endRadius: entry.viewer.radius, options: [])
                context.restoreGState()
            }
        }
        context.endTransparencyLayer()
        context.restoreGState()
    }

    /// `lift` is the iso display offset already applied to `rect`; the label stays under the footprint (TS).
    private func drawToken(_ token: Token, in rect: CGRect, lift: Double, selected: Bool, alpha: CGFloat, context: CGContext) {
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
            context.setLineWidth((highContrast ? 3.5 : 2) / viewport.zoom)
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
        label.draw(at: NSPoint(x: rect.midX - labelSize.width / 2, y: rect.maxY - lift + 8))
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
        if calibrating, editing.calibrate != nil {
            interaction = .calibrating(start: point, current: point)
            return
        }
        if let handle = resizeHandle(in: map), handle.rect.contains(point) {
            interaction = .resizing(
                tokenID: handle.token.id, baseSize: map.tokenSize(handle.token, library: library), start: point, current: point)
            return
        }
        if editing.addDrawing != nil, toolState.tool != .select {
            beginToolInteraction(at: point, map: map, event: event)
            return
        }
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
        } else if let door = map.door(at: point), let doorAction = editing.doorAction {
            // Clicking a door opens or closes it (locked doors stay put).
            selectedDoorID = door.id
            doorAction(door.id, .toggle)
        } else if editing.moveDrawings != nil, let stroke = map.drawing(at: point) {
            var next = shift ? selection : []
            if shift, next.contains(stroke.id) { next.remove(stroke.id) } else { next.insert(stroke.id) }
            if !shift, selection.contains(stroke.id) { next = selection }
            editing.setSelection(next)
            let ids = Set(map.drawings.map(\.id)).intersection(next)
            interaction = .movingStrokes(ids: ids, start: point, current: point, began: false)
        } else {
            let base = shift ? selection : []
            if !shift { editing.setSelection([]) }
            selectedDoorID = nil
            interaction = .marquee(start: point, current: point, base: base)
        }
    }

    private func pressure(of event: NSEvent) -> Double {
        // Tablets report real pressure; mouse input uses 0.5 (TS).
        event.subtype == .tabletPoint ? Double(event.pressure) : 0.5
    }

    private func beginToolInteraction(at point: Point2D, map: GameMap, event: NSEvent) {
        guard let editing else { return }
        switch toolState.tool {
        case .select:
            break
        case .marker:
            interaction = .stroke(
                Drawing(
                    tool: .marker, points: [point.x, point.y], color: toolState.markerColor,
                    size: StrokeDefaults.markerSize, pressures: toolState.pressureEnabled ? [pressure(of: event)] : nil))
        case .eraser:
            if let door = map.door(at: point) {
                editing.doorAction?(door.id, .delete)  // the eraser deletes doors it touches
                return
            }
            interaction = .stroke(
                Drawing(
                    tool: .eraser, points: [point.x, point.y], color: StrokeDefaults.eraserColor,
                    size: StrokeDefaults.eraserSize))
        case .wall:
            interaction = .stroke(
                Drawing(
                    tool: .wall, points: [point.x, point.y], color: StrokeDefaults.wallColor,
                    size: StrokeDefaults.wallSize))
        case .door:
            editing.placeDoor?(point)
        case .measure:
            interaction = .measuring(origin: point)
            editing.setMeasurement?(MeasurementShape(mode: toolState.measureMode, origin: point, pointer: point))
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
            if moved {
                NSCursor.closedHand.set()
                if let map {
                    var live: [String: Point2D] = [:]
                    for token in map.tokens where ids.contains(token.id) {
                        live[token.id] = Point2D(x: token.x + point.x - start.x, y: token.y + point.y - start.y)
                    }
                    editing?.dragPreview?(live)
                }
            }
            needsDisplay = true
        case .stroke(var drawing):
            var point = mapLocation(of: event)
            // Shift locks the segment to the dominant axis from the stroke's start.
            if event.modifierFlags.contains(.shift), drawing.points.count >= 2 {
                let start = Point2D(x: drawing.points[0], y: drawing.points[1])
                if abs(point.x - start.x) > abs(point.y - start.y) { point.y = start.y } else { point.x = start.x }
            }
            drawing.points += [point.x, point.y]
            if drawing.pressures != nil { drawing.pressures?.append(pressure(of: event)) }
            interaction = .stroke(drawing)
            needsDisplay = true
        case .movingStrokes(let ids, let start, _, let began):
            let point = mapLocation(of: event)
            let moved = began || Measure.euclideanDistance(start, point) * viewport.zoom >= Self.dragThreshold
            interaction = .movingStrokes(ids: ids, start: start, current: point, began: moved)
            needsDisplay = true
        case .resizing(let id, let base, let start, _):
            interaction = .resizing(tokenID: id, baseSize: base, start: start, current: mapLocation(of: event))
            needsDisplay = true
        case .calibrating(let start, _):
            interaction = .calibrating(start: start, current: mapLocation(of: event))
            needsDisplay = true
        case .measuring(let origin):
            editing?.setMeasurement?(
                MeasurementShape(mode: toolState.measureMode, origin: origin, pointer: mapLocation(of: event)))
        case .marquee(let start, _, let base):
            let point = mapLocation(of: event)
            interaction = .marquee(start: start, current: point, base: base)
            if let map {
                let rect = Bounds(corner: start, corner: point)
                var hits = Set(map.tokenIDs(intersecting: rect, library: library)).subtracting(hiddenTokenIDs)
                if editing?.moveDrawings != nil {
                    hits.formUnion(map.drawingIDs(intersecting: rect))
                    hits.formUnion(map.doorIDs(intersecting: rect))
                }
                editing?.setSelection(base.union(hits))
            }
            needsDisplay = true
        }
    }

    override func mouseUp(with event: NSEvent) {
        if case .movingTokens(let ids, let primary, let start, let current, true) = interaction {
            let duplicate = event.modifierFlags.contains(.option) && editing?.allowsDuplicate == true
            editing?.dropTokens(ids, primary, current.x - start.x, current.y - start.y, duplicate)
            editing?.dragPreview?(nil)
        }
        if case .movingStrokes(let ids, let start, let current, true) = interaction {
            editing?.moveDrawings?(ids, current.x - start.x, current.y - start.y, event.modifierFlags.contains(.option))
        }
        if case .resizing(let id, let base, let start, let current) = interaction, let map,
            let token = map.tokens.first(where: { $0.id == id }), base > 0
        {
            let size = max(map.gridSize * 0.25, base + max(current.x - start.x, current.y - start.y))
            let scale = ResolvedToken(token, library: library).scale * size / base
            editing?.resizeToken?(id, (scale * 4).rounded() / 4)  // quarter steps keep tokens grid-friendly
        }
        if case .calibrating(let start, let current) = interaction {
            editing?.calibrate?(Bounds(corner: start, corner: current))
        }
        if case .panning = interaction { clampViewport() }
        if case .stroke(let drawing) = interaction {
            editing?.addDrawing?(drawing)
        }
        // A measurement stays up after release until Esc or a tool change (TS).
        interaction = .idle
        (spaceHeld ? NSCursor.openHand : NSCursor.arrow).set()
        needsDisplay = true
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach(removeTrackingArea)
        addTrackingArea(
            NSTrackingArea(
                rect: .zero, options: [.mouseMoved, .mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect],
                owner: self))
    }

    override func mouseMoved(with event: NSEvent) {
        guard !isPlayerView, editing != nil else { return }
        hoverPoint = mapLocation(of: event)
        needsDisplay = true
    }

    /// Crosshair for drawing, measuring, doors and calibration; arrow for select (PARITY §3.1).
    override func resetCursorRects() {
        let crosshair = calibrating || (editing?.addDrawing != nil && toolState.tool != .select)
        addCursorRect(bounds, cursor: crosshair ? .crosshair : .arrow)
    }

    private func clampViewport() {
        guard let map else { return }
        viewport = viewport.clamped(
            map: map, library: library, viewWidth: Double(bounds.width), viewHeight: Double(bounds.height))
    }

    override func mouseExited(with event: NSEvent) {
        hoverPoint = nil
        needsDisplay = true
    }

    /// Right-click (or Control-click) on a door: Open/Close, Lock/Unlock, Delete (PARITY §3.6).
    override func menu(for event: NSEvent) -> NSMenu? {
        guard let map, let doorAction = editing?.doorAction, let door = map.door(at: mapLocation(of: event)) else {
            return nil
        }
        selectedDoorID = door.id
        needsDisplay = true
        let menu = NSMenu()
        menu.autoenablesItems = false
        menu.addItem(
            MenuAction.item(door.isOpen ? "Close Door" : "Open Door", enabled: !door.isLocked) {
                doorAction(door.id, .toggle)
            })
        menu.addItem(
            MenuAction.item(door.isLocked ? "Unlock Door" : "Lock Door") {
                doorAction(door.id, door.isLocked ? .unlock : .lock)
            })
        menu.addItem(.separator())
        let delete = MenuAction.item("Delete Door") { doorAction(door.id, .delete) }
        delete.attributedTitle = NSAttributedString(
            string: "Delete Door", attributes: [.foregroundColor: NSColor.systemRed])
        menu.addItem(delete)
        return menu
    }

    /// Every zoom step is clamped, as in TS `performZoom` (PARITY §3.1).
    private func zoomViewport(by factor: Double, around anchor: Point2D) {
        guard let map else {
            viewport.zoom(by: factor, around: anchor)
            return
        }
        viewport = viewport.zoomed(
            by: factor, around: anchor, clampingTo: map, library: library, viewWidth: Double(bounds.width),
            viewHeight: Double(bounds.height))
    }

    override func magnify(with event: NSEvent) {
        zoomViewport(by: 1 + Double(event.magnification), around: viewLocation(of: event))
    }

    override func scrollWheel(with event: NSEvent) {
        let flags = event.modifierFlags
        if flags.contains(.command) || flags.contains(.control) {
            // ⌘/⌃ + wheel zooms around the pointer (TS: ctrl/cmd+wheel; factor 1.1 per notch).
            let factor =
                event.hasPreciseScrollingDeltas
                ? exp(Double(event.scrollingDeltaY) * 0.01) : (event.scrollingDeltaY > 0 ? 1.1 : 1 / 1.1)
            zoomViewport(by: factor, around: viewLocation(of: event))
        } else {
            // Plain wheel / two-finger scroll pans.
            let scale = event.hasPreciseScrollingDeltas ? 1.0 : 10.0
            viewport.pan(byViewDX: Double(event.scrollingDeltaX) * scale, dy: Double(event.scrollingDeltaY) * scale)
            clampViewport()  // every scroll event, as in TS
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
            if !selection.isEmpty {
                editing?.deleteSelection?()
            } else if let door = selectedDoorID {
                editing?.doorAction?(door, .delete)
                selectedDoorID = nil
            }
        case 53:  // escape
            if calibrating {
                editing?.cancelCalibration?()
                return
            }
            if measurement == nil, selection.isEmpty, selectedDoorID == nil {
                editing?.stopAudio?()
                return
            }
            editing?.setSelection([])
            editing?.setMeasurement?(nil)
            selectedDoorID = nil
        case 123, 124, 125, 126:  // arrows rotate the door while the Door tool is active
            if toolState.tool == .door { editing?.toggleDoorOrientation?() } else { super.keyDown(with: event) }
        default:
            let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            if event.charactersIgnoringModifiers == "?", flags.isDisjoint(with: [.command, .control, .option]) {
                NotificationCenter.default.post(name: .graphiumShowAbout, object: nil)
                return
            }
            if flags.isDisjoint(with: [.command, .control, .option]), editing?.setTool != nil,
                let char = event.charactersIgnoringModifiers?.lowercased().first
            {
                if char == "m", toolState.tool == .select, !selection.isEmpty {
                    // Hold M with a token selected to see movement range (no tool change).
                    showMovementRange = true
                    needsDisplay = true
                    return
                }
                if char == "i", let openColorPicker = editing?.openColorPicker {
                    openColorPicker()
                    return
                }
                if char == "r", toolState.tool == .door {
                    editing?.toggleDoorOrientation?()
                    return
                }
                if let tool = CanvasTool.forKey(char) {
                    editing?.setTool?(tool)
                    return
                }
                let gridKeys: [Character: GridType] = ["1": .lines, "2": .dots, "3": .hexagonal, "4": .isometric, "5": .hidden]
                if let type = gridKeys[char], let setGridType = editing?.setGridType {
                    setGridType(type)
                    return
                }
            }
            let centre = Point2D(x: Double(bounds.midX), y: Double(bounds.midY))
            switch event.charactersIgnoringModifiers {
            case "+", "=": zoomViewport(by: 1.1, around: centre)
            case "-", "_": zoomViewport(by: 1 / 1.1, around: centre)
            default: super.keyDown(with: event)
            }
        }
    }

    override func keyUp(with event: NSEvent) {
        if event.charactersIgnoringModifiers?.lowercased() == "m", showMovementRange {
            showMovementRange = false
            needsDisplay = true
        } else if event.keyCode == 49 {
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

    private func libraryItemID(from info: NSDraggingInfo) -> String? {
        info.draggingPasteboard.string(forType: .string).flatMap(LibraryDrag.itemID(from:))
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        if editing?.dropLibraryItem != nil, libraryItemID(from: sender) != nil { return .copy }
        return editing?.dropImageFiles != nil && !imageURLs(from: sender).isEmpty ? .copy : []
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        if let id = libraryItemID(from: sender), let drop = editing?.dropLibraryItem {
            let location = convert(sender.draggingLocation, from: nil)
            drop(id, viewport.mapPoint(fromView: Point2D(x: Double(location.x), y: Double(location.y))))
            return true
        }
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
    var fog: FogState?
    var isPlayerView = false
    var toolState = ToolState()
    var measurement: MeasurementShape?
    var fitRequest: FitRequest?
    var onViewportChange: ((Viewport, CGSize) -> Void)?
    var calibrating = false
    /// Identifies the document whose asset names `imageProvider` resolves (cache keys).
    var assetNamespace = ""

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
        view.fog = fog
        view.isPlayerView = isPlayerView
        view.toolState = toolState
        view.measurement = measurement
        view.fitRequest = fitRequest
        view.onViewportChange = onViewportChange
        if view.calibrating != calibrating || view.toolState.tool != toolState.tool {
            view.window?.invalidateCursorRects(for: view)
        }
        view.calibrating = calibrating
        view.assetNamespace = assetNamespace
        view.needsDisplay = true
    }
}

extension CGPoint {
    init(_ p: Point2D) {
        self.init(x: p.x, y: p.y)
    }
}

/// A tiling paper-grain texture, generated once (deterministic noise, light value band).
enum PaperTexture {
    /// Map images with the paper multiplied in, shared by every canvas. Keyed by asset
    /// name and map scale (the grain is 256 map units per tile, as in TS).
    private static let bakedCache: NSCache<NSString, CGImage> = {
        let cache = NSCache<NSString, CGImage>()
        cache.totalCostLimit = 256 * 1024 * 1024
        return cache
    }()
    @MainActor private static var pending: Set<String> = []

    /// The baked copy if ready; otherwise starts baking it in the background, calls
    /// `then` on the main actor when done, and returns nil.
    @MainActor
    static func baked(onto image: CGImage, key: String, mapScale: Double, then: @escaping @MainActor () -> Void) -> CGImage? {
        // Maps with transparency keep the live paper pass: multiplying grain onto
        // transparent pixels would leave a grey haze instead of tinting what's behind.
        switch image.alphaInfo {
        case .none, .noneSkipFirst, .noneSkipLast: break
        default: return nil
        }
        let cacheKey = key as NSString
        if let hit = bakedCache.object(forKey: cacheKey) { return hit }
        guard !pending.contains(cacheKey as String) else { return nil }
        pending.insert(cacheKey as String)
        Task.detached(priority: .userInitiated) {
            let baked = bake(image, mapScale: mapScale)
            await MainActor.run {
                pending.remove(cacheKey as String)
                if let baked {
                    bakedCache.setObject(baked, forKey: cacheKey, cost: baked.bytesPerRow * baked.height)
                    then()
                }
            }
        }
        return nil
    }

    private static func bake(_ image: CGImage, mapScale: Double) -> CGImage? {
        let width = image.width, height = image.height
        guard width > 0, height > 0, mapScale > 0,
            let context = CGContext(
                data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return nil }
        let rect = CGRect(x: 0, y: 0, width: width, height: height)
        context.draw(image, in: rect)
        context.setAlpha(0.25)
        context.setBlendMode(.multiply)
        let tile = 256 / mapScale  // image pixels per 256 map units
        context.draw(self.image, in: CGRect(x: 0, y: 0, width: tile, height: tile), byTiling: true)
        return context.makeImage()
    }

    static let image: CGImage = {
        let side = 256
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        var seed: UInt64 = 0x9A9E_7E57
        for i in 0..<(side * side) {
            seed = seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
            let v = UInt8(200 + Int((seed >> 33) % 56))
            pixels[i * 4] = v
            pixels[i * 4 + 1] = v
            pixels[i * 4 + 2] = UInt8(max(0, Int(v) - 8))
            pixels[i * 4 + 3] = 255
        }
        let provider = CGDataProvider(data: Data(pixels) as CFData)!
        return CGImage(
            width: side, height: side, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: side * 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)!
    }()
}

extension CGMutablePath {
    func addPolygon(_ points: [Point2D]) {
        guard let first = points.first else { return }
        move(to: CGPoint(first))
        for p in points.dropFirst() { addLine(to: CGPoint(p)) }
        closeSubpath()
    }
}

extension CGRect {
    init(bounds b: Bounds) {
        self.init(x: b.x, y: b.y, width: b.width, height: b.height)
    }
}

extension NSColor {
    /// `#rrggbb` (sRGB), lowercase.
    var hexString: String? {
        guard let c = usingColorSpace(.sRGB) else { return nil }
        let r = Int((c.redComponent * 255).rounded())
        let g = Int((c.greenComponent * 255).rounded())
        let b = Int((c.blueComponent * 255).rounded())
        return String(format: "#%02x%02x%02x", r, g, b)
    }

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
