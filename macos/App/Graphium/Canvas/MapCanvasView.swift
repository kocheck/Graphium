import AppKit
import QuartzCore
import GraphiumCore
import GraphiumRender
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
    var placeLight: ((Point2D) -> Void)?
    var lightAction: ((_ lightIDs: Set<String>, LightAction) -> Void)?
    /// Places a note pin; the owner selects it so the side panel opens on it.
    var placeNote: ((Point2D) -> Void)?
    var noteAction: ((_ noteIDs: Set<String>, NoteAction) -> Void)?
    /// Places a spell effect (its point of origin in world pixels, even when a token carries it);
    /// the owner selects it so the side panel opens on it.
    var placeEffect: ((SpellEffect) -> Void)?
    var effectAction: ((_ effectIDs: Set<String>, EffectAction) -> Void)?
    /// World View: a player clicked a shared pin, to read its player notes.
    var openNote: ((String) -> Void)?
    var doorAction: ((_ doorID: String, DoorAction) -> Void)?
    var wallAction: ((_ wallIDs: Set<String>, WallAction) -> Void)?
    var markerAction: ((_ markerIDs: Set<String>, MarkerAction) -> Void)?
    var setMeasurement: ((MeasurementShape?) -> Void)?
    var setTool: ((CanvasTool) -> Void)?
    var toggleDoorOrientation: (() -> Void)?
    /// Deletes the given doors in one undoable step (the door menu on a multi-door selection).
    var deleteDoors: ((Set<String>) -> Void)?
    /// Turns the given doors by degrees, clockwise on screen.
    var rotateDoors: ((_ doorIDs: Set<String>, _ degrees: Double) -> Void)?
    /// A library item dragged from the sidebar or Library Manager, dropped at a map point.
    var dropLibraryItem: ((_ itemID: String, _ at: Point2D) -> Void)?
    /// Strokes, lights, notes and effects dragged by an offset (Option duplicates).
    var moveDrawings: ((_ ids: Set<String>, _ dx: Double, _ dy: Double, _ duplicate: Bool) -> Void)?
    var resizeToken: ((_ id: String, _ scale: Double) -> Void)?
    var calibrate: ((Bounds) -> Void)?
    var cancelCalibration: (() -> Void)?
    /// Live (unsnapped) positions of tokens being dragged, for the World View; nil when done.
    var dragPreview: (([String: Point2D]?) -> Void)?
    var setGridType: ((GridType) -> Void)?
    /// The right-click menu for these tokens (Change Image, Delete); nil in the World View.
    var tokenMenu: ((_ tokenIDs: Set<String>) -> NSMenu)?
    /// `I` (PARITY §1.4).
    var openColorPicker: (() -> Void)?
    /// Esc with nothing else to cancel stops Session Console audio (PARITY §1.4).
    var stopAudio: (() -> Void)?
    /// Reveal tool: show this rectangle to players (map pixels; `snap` to whole cells).
    var revealArea: ((_ rect: Bounds, _ snap: Bool) -> Void)?
    /// Reveal tool: an Option-click on a revealed area hides it again.
    var hideRevealedArea: ((String) -> Void)?
}

/// Fog of war to draw over the map (World View, when not in daylight).
struct FogState {
    /// Keys the cached explored mask together with `bounds`.
    var mapID: String
    var bounds: Bounds
    var explored: [ExploredRegion]
    var vision: [LineOfSight.VisionPolygon]
    /// With lighting on (`ambient` set): where each light reaches.
    var lit: [Lighting.LitArea] = []
    var ambient: LightLevel?
    /// Walls to hatch rock behind (`LineOfSight.hatchWalls`), and the cell size it is drawn at.
    var hatchWalls: [WallSegment] = []
    var gridSize: Double = 50
    /// Ids of the lit lights that are flames (`LightSource.isFlame`): they flicker and glow.
    var flames: Set<String> = []
}

/// Asks a canvas to frame a region once (e.g. Center on Party). A new `id` re-triggers.
struct FitRequest: Equatable {
    var id = UUID()
    var bounds: Bounds
}

/// Asks a canvas to zoom once around its centre (map controls, View menu). A new `id` re-triggers.
struct ZoomRequest: Equatable {
    var id = UUID()
    var factor: Double
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
    /// The file a video background's asset plays from; nil until it is written, when the
    /// provider calls `ready` (`VideoAssetFiles`).
    var videoProvider: (String, @escaping VideoFileReady) -> URL? = { _, _ in nil }
    /// Map > Pause Animation (and a paused World View): holds the video on its frame.
    var animationPaused = false
    /// Plays a video background under this view (`MapCanvasHostView`); nil without a host.
    weak var videoBackground: MapVideoBackgroundView?
    var selection: Set<String> = []
    var editing: CanvasEditing?
    /// Tokens players must not see or grab (NPCs outside party vision).
    var hiddenTokenIDs: Set<String> = []
    var fog: FogState? {
        didSet { updateFlicker() }
    }
    /// Redraws the World View while flames burn in it (`TorchFlicker`); nil otherwise.
    private var flickerTimer: Timer?
    /// The explored-fog union, stamped incrementally and reused across frames.
    private let exploredMask = ExploredFogMask()
    /// Draws the fog on the GPU, with hatching over remembered ground (decision 010); nil
    /// without a Metal device, when Core Graphics draws it instead (without hatching).
    private lazy var fogRenderer: FogRenderer? = FogRenderer()
    /// The last GPU fog, reused while nothing it shows changes.
    private var metalFog: (scene: FogScene, view: FogView, image: CGImage)?
    /// Player-facing styling (walls black 6px, ink-on-paper doors) and no DM overlays.
    var isPlayerView = false
    var toolState = ToolState()
    var measurement: MeasurementShape?
    /// Map calibration mode: the next drag draws the one-cell box.
    var calibrating = false
    /// Positions of tokens another window is dragging (World View shows DM drags live).
    private var showMovementRange = false
    private var hoverPoint: Point2D?
    /// The token under the pointer with the Select tool (Architect), for the hover look.
    private var hoveredTokenID: String?
    var fitRequest: FitRequest? {
        didSet {
            guard let fitRequest, fitRequest != oldValue else { return }
            viewport.fit(fitRequest.bounds, viewWidth: Double(bounds.width), viewHeight: Double(bounds.height))
        }
    }
    var zoomRequest: ZoomRequest? {
        didSet {
            guard let zoomRequest, zoomRequest != oldValue else { return }
            zoomViewport(by: zoomRequest.factor, around: Point2D(x: Double(bounds.midX), y: Double(bounds.midY)))
        }
    }
    var viewport = Viewport() {
        didSet {
            guard viewport != oldValue else { return }
            needsDisplay = true
            // Moved in the same pass as the redraw, so the video never trails the map.
            syncVideoBackground()
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
        syncVideoBackground()
        reportViewport()
    }

    /// Drag distance (view points) before a press on a token becomes a move.
    private static let dragThreshold = 5.0

    private enum Interaction {
        case idle
        case panning
        case movingTokens(ids: [String], primary: String, start: Point2D, current: Point2D, began: Bool)
        case marquee(start: Point2D, current: Point2D, base: Set<String>)
        /// Drawing a marker, eraser or wall stroke; the stroke itself is `liveStroke`.
        case stroke
        case measuring(origin: Point2D)
        case movingStrokes(ids: Set<String>, start: Point2D, current: Point2D, began: Bool)
        case resizing(tokenID: String, baseSize: Double, start: Point2D, current: Point2D)
        case calibrating(start: Point2D, current: Point2D)
        /// Dragging out a new spell effect from its point of origin (on `tokenID` when it carries it).
        case placingEffect(origin: Point2D, tokenID: String?, current: Point2D)
        /// Dragging out ground to reveal with the Reveal tool.
        case revealing(start: Point2D, current: Point2D)
    }

    /// The selected doors on `map`.
    func selectedDoorIDs(in map: GameMap) -> Set<String> {
        Set(map.doors.lazy.filter { self.selection.contains($0.id) }.map(\.id))
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
    /// The stroke being drawn. Held outside `interaction` so each drag event appends in
    /// place instead of copying the growing point arrays (TS mutates its line in place).
    private var liveStroke: Drawing?
    /// Door open/close swings in flight (PARITY §3.6); used by `drawDoors`.
    lazy var doorSwings = DoorSwingAnimator()
    /// `LineOfSight.knownDoors` for the last doors and fog, reused while neither changes.
    private var knownDoors: (key: KnownDoorsKey, ids: Set<String>)?
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
        if videoBackground?.isShowingVideo == true {
            // A video background plays under this view, which fills its own backdrop:
            // leave this view clear so the video shows through.
            NSGraphicsContext.current?.cgContext.clear(dirtyRect)
        } else {
            // The World View under fog is black past the map's edge too, as unexplored ground is.
            backdropColor.setFill()
            dirtyRect.fill()
        }
        guard let map, let context = NSGraphicsContext.current?.cgContext else { return }

        context.saveGState()
        context.scaleBy(x: viewport.zoom, y: viewport.zoom)
        context.translateBy(x: -viewport.origin.x, y: -viewport.origin.y)

        if let background = map.background, isVideoAsset(background.src) {
            // Played by `MapVideoBackgroundView` under this view, placed by `syncVideoBackground`.
        } else if let background = map.background, let image = imageProvider(background.src) {
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
        } else if map.background == nil {
            // No map image: paper over the visible area, tiled in map space so it moves with the map (TS).
            context.saveGState()
            context.clip(to: CGRect(bounds: visibleMapBounds))
            context.setAlpha(0.25)
            context.setBlendMode(.multiply)
            context.draw(PaperTexture.image, in: CGRect(x: 0, y: 0, width: 256, height: 256), byTiling: true)
            context.restoreGState()
        }
        drawGrid(map, context: context)
        if !isPlayerView, editing != nil, let hoverPoint, map.gridType != .dots, map.gridType != .hidden {
            // Hover cell highlight (Architect only, PARITY §3.3).
            let geometry = makeGridGeometry(map.gridType, cellSize: map.gridSize)
            let path = CGMutablePath()
            path.addPolygon(geometry.cellVertices(geometry.pixelToGrid(hoverPoint)))
            context.addPath(path)
            context.setFillColor(Palette.canvasHover.nsColor.cgColor)
            context.fillPath()
        }
        var liveStroke: Drawing?
        if case .stroke = interaction { liveStroke = self.liveStroke }
        // DM-only markers never reach the World View (decision 014).
        var ink = isPlayerView ? map.drawings.filter { !$0.isHiddenFromPlayers } : map.drawings
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
        var inkMap = map
        inkMap.drawings = ink
        drawInk(ink, live: liveStroke, gaps: LineOfSight.wallGaps(of: inkMap), context: context)
        for drawing in ink where selection.contains(drawing.id) {
            context.strokeMark(
                CGPath(rect: CGRect(bounds: map.drawingBounds(drawing)), transform: nil), width: 1.5 / viewport.zoom,
                dash: [5 / viewport.zoom, 3 / viewport.zoom])
        }
        drawStairs(map.stairs, context: context)
        if isPlayerView {
            // Shut hidden doors are wall to the players, under the fog with the walls. The
            // doors they know go over the fog, like the rock behind seen walls; doors in
            // unexplored fog stay unseen (PARITY §3.6 Native).
            drawSecretDoorWalls(map.doors, context: context)
            if let fog { drawFog(fog, context: context) }
            let known = fog.map { knownDoorIDs(map.doors, fog: $0) }
            drawWorldDoors(
                map.doors.filter { !$0.looksLikeWall && (known?.contains($0.id) ?? true) }, context: context)
        } else {
            drawDoors(map.doors, context: context)
            // Fog covers the map, walls, stairs and doors, but not tokens: visible tokens stay
            // crisp on top and only hidden NPCs are left out (TS CanvasManager layer order).
            if let fog { drawFog(fog, context: context) }
        }
        doorSwings.finishFrame(doorIDs: Set(map.doors.map(\.id)))
        // Spell areas lie on the ground: over the fog, under the tokens (decision 015).
        if !map.effects.isEmpty || effectPreview(in: map) != nil {
            let effectMap = mapWithLiveTokenDrag(map)
            if case .movingStrokes(let ids, let start, let current, true) = interaction {
                drawEffects(
                    effectMap, moving: ids, offset: CGSize(width: current.x - start.x, height: current.y - start.y),
                    duplicate: NSEvent.modifierFlags.contains(.option), context: context)
            } else {
                // The preview's point is in world pixels, even on a token.
                var preview = effectPreview(in: map)
                preview?.tokenID = nil
                drawEffects(effectMap, preview: preview, context: context)
            }
        }
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
        if !isPlayerView, editing != nil {
            if case .movingStrokes(let ids, let start, let current, true) = interaction {
                let offset = CGSize(width: current.x - start.x, height: current.y - start.y)
                let duplicate = NSEvent.modifierFlags.contains(.option)
                drawLights(map.lights, map: map, moving: ids, offset: offset, duplicate: duplicate, context: context)
                drawNotes(map.notes, moving: ids, offset: offset, duplicate: duplicate, context: context)
            } else {
                drawLights(map.lights, map: map, context: context)
                drawNotes(map.notes, context: context)
            }
        } else if isPlayerView {
            // Shared pins sit over the fog, like tokens: the DM chose to show them (decision 011).
            drawNotes(map.notes, context: context)
        }
        if let handle = resizeHandle(in: map), case .idle = interaction {
            context.setFillColor(Palette.canvasSelection.nsColor.cgColor)
            context.fill(CGRect(bounds: handle.rect))
            context.strokeMark(
                CGPath(rect: CGRect(bounds: handle.rect), transform: nil), width: 1 / viewport.zoom,
                color: Palette.canvasHalo.nsColor)
        }
        if case .resizing(let id, let base, let start, let current) = interaction,
            let token = map.tokens.first(where: { $0.id == id })
        {
            let size = max(map.gridSize * 0.25, base + max(current.x - start.x, current.y - start.y))
            context.strokeMark(
                CGPath(
                    rect: CGRect(x: token.x, y: token.y + map.tokenDisplayYOffset(size: size), width: size, height: size),
                    transform: nil),
                width: 2 / viewport.zoom)
        }
        if case .calibrating(let start, let current) = interaction {
            context.strokeMark(
                CGPath(rect: CGRect(bounds: Bounds(corner: start, corner: current)), transform: nil),
                width: 2 / viewport.zoom, color: Palette.canvasMeasure.nsColor)
        }
        if !isPlayerView, editing != nil, toolState.tool == .reveal {
            // The DM sees what is revealed while the tool is active.
            let unit = CGFloat(viewport.zoom)
            for area in map.revealedAreas where area.points.count >= 3 {
                let path = CGMutablePath()
                path.addLines(between: area.points.map { CGPoint(x: $0.x, y: $0.y) })
                path.closeSubpath()
                context.strokeMark(path, width: 2 / viewport.zoom, dash: [6 / unit, 4 / unit])
            }
        }
        if case .revealing(let start, let current) = interaction {
            let rect = CGRect(bounds: Bounds(corner: start, corner: current))
            context.setFillColor(Palette.canvasHover.nsColor.cgColor)
            context.fill(rect)
            context.strokeMark(CGPath(rect: rect, transform: nil), width: 1 / viewport.zoom)
        }
        if let measurement { drawMeasurement(measurement, gridSize: map.gridSize, context: context) }
        if !isPlayerView, editing != nil, toolState.tool == .door, let hoverPoint, map.door(at: hoverPoint) == nil {
            drawDoorGhost(at: hoverPoint, map: map, context: context)
        }
        if !isPlayerView, editing != nil, toolState.tool == .light, let hoverPoint {
            drawLightGhost(at: hoverPoint, map: map, context: context)
        }
        if case .marquee(let start, let current, _) = interaction {
            let rect = CGRect(bounds: Bounds(corner: start, corner: current))
            context.setFillColor(Palette.canvasHover.nsColor.cgColor)
            context.fill(rect)
            context.strokeMark(CGPath(rect: rect, transform: nil), width: 1 / viewport.zoom)
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
            // The default colour adapts to the theme, as in the TS app; a custom colour draws
            // at 50% like every TS grid (GridOverlay opacity), stronger with Increase Contrast.
            ? NSColor.labelColor.withAlphaComponent(highContrast ? 0.55 : 0.25)
            : (NSColor(hex: map.gridColor) ?? .separatorColor).withAlphaComponent(highContrast ? 0.8 : 0.5)
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
                    drawToken(token, in: rect, lift: lift, selected: false, look: .idle, context: context)  // original stays
                }
                rect = rect.offsetBy(dx: offset.dx, dy: offset.dy)
                if let target = preview[token.id] {
                    context.strokeMark(
                        CGPath(ellipseIn: CGRect(x: target.x, y: target.y + lift, width: size, height: size), transform: nil),
                        width: 2 / viewport.zoom, dash: [6 / viewport.zoom, 4 / viewport.zoom])
                }
                drawToken(token, in: rect, lift: lift, selected: false, look: .dragged, context: context)
                continue
            }
            // Cull tokens well off screen (2-cell margin, as in TS).
            guard padded.intersects(Bounds(x: token.x, y: token.y + lift, width: size, height: size)) else { continue }
            let hovered = token.id == hoveredTokenID && toolState.tool == .select
            drawToken(token, in: rect, lift: lift, selected: isSelected, look: hovered ? .hovered : .idle, context: context)
            // Whose turn it is, for the DM: a solid ring outside the dashed selection ring, so it
            // reads without colour and without taking the selection. Players have the turn strip.
            if !isPlayerView, token.id == map.initiative.currentTokenID {
                context.strokeMark(
                    CGPath(ellipseIn: rect.insetBy(dx: -7 / viewport.zoom, dy: -7 / viewport.zoom), transform: nil),
                    width: 2 / viewport.zoom)
            }
        }
    }

    struct KnownDoorsKey: Equatable {
        var doors: [Door]
        var exploredCount: Int
        var exploredLast: Double?
        var sight: PartySight
        var gridSize: Double
    }

    /// The doors the players know about under `fog`, cached across frames.
    func knownDoorIDs(_ doors: [Door], fog: FogState) -> Set<String> {
        let sight = PartySight(vision: fog.vision, lit: fog.lit, ambient: fog.ambient)
        let key = KnownDoorsKey(
            doors: doors, exploredCount: fog.explored.count, exploredLast: fog.explored.last?.timestamp, sight: sight,
            gridSize: fog.gridSize)
        if let knownDoors, knownDoors.key == key { return knownDoors.ids }
        let ids = LineOfSight.knownDoors(doors, explored: fog.explored, sight: sight, gridSize: fog.gridSize)
        knownDoors = (key, ids)
        return ids
    }

    /// TS compositing (CORE_SPEC §3.3 step 7): fog bounds filled black at 94%;
    /// explored areas erased down to 20% coverage; current vision erased with a
    /// radial falloff (clear to 60% of the radius, fading to fog at the edge).
    /// Explored polygons are stamped as one union into a cached mask (`ExploredFogMask`),
    /// so overlaps don't compound as in TS.
    private func drawFog(_ fog: FogState, context: CGContext) {
        if let drawn = metalFogImage(fog) {
            let (image, rect) = drawn
            // The image's top row first, so it draws upright in the flipped canvas.
            context.saveGState()
            context.translateBy(x: rect.minX, y: rect.maxY)
            context.scaleBy(x: 1, y: -1)
            context.interpolationQuality = .none
            context.draw(image, in: CGRect(origin: .zero, size: rect.size))
            context.restoreGState()
            return
        }
        context.saveGState()
        context.beginTransparencyLayer(auxiliaryInfo: nil)
        context.setFillColor(NSColor.black.withAlphaComponent(FogShading.base).cgColor)
        context.fill(CGRect(bounds: fog.bounds))
        context.setBlendMode(.destinationOut)

        if let mask = exploredMask.image(mapID: fog.mapID, bounds: fog.bounds, regions: fog.explored) {
            // One cached mask per frame instead of every explored polygon (PARITY §3.7).
            let rect = CGRect(bounds: fog.bounds)
            context.saveGState()
            context.translateBy(x: rect.minX, y: rect.maxY)
            context.scaleBy(x: 1, y: -1)
            let local = CGRect(origin: .zero, size: rect.size)
            context.clip(to: local, mask: mask)
            context.setFillColor(NSColor.black.withAlphaComponent(0.8).cgColor)
            context.fill(local)
            context.restoreGState()
        }

        if let ambient = fog.ambient {
            drawLitVision(fog, ambient: ambient, context: context)
            context.endTransparencyLayer()
            context.restoreGState()
            return
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

    /// The fog for this view drawn with Metal, one pixel per backing pixel, and where it goes
    /// in map space.
    private func metalFogImage(_ fog: FogState) -> (CGImage, CGRect)? {
        guard let renderer = fogRenderer else { return nil }
        let pointScale = window?.backingScaleFactor ?? 2
        let view = FogView(
            origin: viewport.origin, scale: viewport.zoom * pointScale,
            width: Int((bounds.width * pointScale).rounded(.up)), height: Int((bounds.height * pointScale).rounded(.up)),
            pointScale: pointScale)
        let now = flickerTimer == nil ? nil : CACurrentMediaTime()
        var flames: [String: TorchFlicker.Sample] = [:]
        for id in flickeringLights(fog) {
            flames[id] = now.map { TorchFlicker.sample(seed: id, time: $0) } ?? TorchFlicker.steady
        }
        let scene = FogScene(
            bounds: fog.bounds, explored: fog.explored,
            sight: PartySight(vision: fog.vision, lit: fog.lit, ambient: fog.ambient), gridSize: fog.gridSize,
            hatchWalls: fog.hatchWalls, flames: flames)
        let rect = CGRect(
            x: view.origin.x, y: view.origin.y, width: Double(view.width) / view.scale,
            height: Double(view.height) / view.scale)
        if let metalFog, metalFog.scene == scene, metalFog.view == view { return (metalFog.image, rect) }
        guard let image = renderer.render(scene, view: view)?.image else { return nil }
        metalFog = (scene, view, image)
        return (image, rect)
    }

    /// The lit flames that glow: none in bright ambient light, where a torch adds nothing.
    private func flickeringLights(_ fog: FogState) -> [String] {
        guard let ambient = fog.ambient, ambient < .bright else { return [] }
        return fog.lit.map(\.lightID).filter { fog.flames.contains($0) }
    }

    /// Starts or stops the flame redraws. Off under Reduce Motion, where flames glow steady.
    private func updateFlicker() {
        // Only the Metal fog draws flames; the Core Graphics fallback would redraw for nothing.
        let burning =
            isPlayerView && fogRenderer != nil && window != nil && fog.map { !flickeringLights($0).isEmpty } == true
            && !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        if burning, flickerTimer == nil {
            let timer = Timer(timeInterval: 1 / TorchFlicker.framesPerSecond, repeats: true) { [weak self] _ in
                guard let self, self.window?.occlusionState.contains(.visible) == true else { return }
                self.needsDisplay = true
            }
            RunLoop.main.add(timer, forMode: .common)
            flickerTimer = timer
        } else if !burning, let timer = flickerTimer {
            timer.invalidate()
            flickerTimer = nil
        }
    }

    /// How much of the fog dim light clears; bright clears all of it.
    private static let dimClearing = FogShading.dimClearing

    /// Lighting on (native, 5e 2024): inside each PC's sight, the fog is cleared by the
    /// ambient light, by each light (fully out to its bright radius, `dimClearing` out to its
    /// dim radius, fading over the last tenth) and by darkvision (darkness seen as dim). The
    /// clearings stack, so dim light within darkvision clears nearly all of it, as bright
    /// would. Drawn with `.destinationOut` into the fog layer.
    private func drawLitVision(_ fog: FogState, ambient: LightLevel, context: CGContext) {
        let dim = CGFloat(Self.dimClearing)
        for entry in fog.vision where entry.polygon.count >= 3 {
            context.saveGState()
            let sight = CGMutablePath()
            sight.addPolygon(entry.polygon)
            context.addPath(sight)
            context.clip()
            if ambient > .dark {
                context.setFillColor(NSColor.black.withAlphaComponent(ambient == .bright ? 1 : dim).cgColor)
                context.fill(CGRect(bounds: fog.bounds))
            }
            for area in fog.lit where area.polygon.count >= 3 && area.dimRadius > 0 {
                let edge = min(area.brightRadius / area.dimRadius, 0.9)
                let alphas: [CGFloat] = [1, 1, dim, dim, 0]
                let colors = alphas.map { NSColor.black.withAlphaComponent($0).cgColor } as CFArray
                let locations: [CGFloat] = [0, max(0, edge - 0.02), edge, 0.9, 1]
                guard let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: locations)
                else { continue }
                context.saveGState()
                let reach = CGMutablePath()
                reach.addPolygon(area.polygon)
                context.addPath(reach)
                context.clip()
                let centre = CGPoint(area.centre)
                context.drawRadialGradient(
                    gradient, startCenter: centre, startRadius: 0, endCenter: centre, endRadius: area.dimRadius, options: [])
                context.restoreGState()
            }
            if let darkvision = entry.darkvisionPolygon, darkvision.count >= 3 {
                let path = CGMutablePath()
                path.addPolygon(darkvision)
                context.addPath(path)
                context.setFillColor(NSColor.black.withAlphaComponent(dim).cgColor)
                context.fillPath()
            }
            context.restoreGState()
        }
    }

    /// TS `TokenNode` states: hover (Select tool) scales 1.02 with a soft shadow; a dragged
    /// token is 50% opaque, scaled 1.05, with a strong shadow. Scaled about the centre.
    private enum TokenLook {
        case idle, hovered, dragged
    }

    /// `lift` is the iso display offset already applied to `rect`; the label stays under the footprint (TS).
    private func drawToken(_ token: Token, in rect: CGRect, lift: Double, selected: Bool, look: TokenLook, context: CGContext) {
        context.saveGState()
        var art = rect
        // Shadow offsets ignore the CTM (base space); flip the sign so the shadow falls down-right.
        let down: CGFloat = context.ctm.d < 0 ? -1 : 1
        switch look {
        case .idle:
            break
        case .hovered:
            art = rect.insetBy(dx: -rect.width * 0.01, dy: -rect.height * 0.01)
            context.setShadow(
                offset: CGSize(width: 2, height: 2 * down), blur: 12, color: NSColor.black.withAlphaComponent(0.4).cgColor)
        case .dragged:
            art = rect.insetBy(dx: -rect.width * 0.025, dy: -rect.height * 0.025)
            context.setAlpha(0.5)
            context.setShadow(
                offset: CGSize(width: 5, height: 5 * down), blur: 20, color: NSColor.black.withAlphaComponent(0.6).cgColor)
        }
        if let image = imageProvider(token.src) {
            draw(image, in: art, context: context)
        } else {
            context.setFillColor(Palette.ruleStrong.nsColor.cgColor)  // missing art
            context.fillEllipse(in: art.insetBy(dx: art.width * 0.08, dy: art.height * 0.08))
        }
        context.restoreGState()
        if selected {
            // TS: a dashed [8, 4] circle of radius size/2 + 2. Native: amber over a halo, not a blue glow.
            context.strokeMark(
                CGPath(ellipseIn: rect.insetBy(dx: -2, dy: -2), transform: nil),
                width: (highContrast ? 4.5 : 3) / viewport.zoom, dash: [8 / viewport.zoom, 4 / viewport.zoom])
        }

        let resolved = ResolvedToken(token, library: library)
        // Players see the token's name for players, or none (decision 014).
        guard let name = isPlayerView ? resolved.playerName : resolved.name else { return }
        // Long names are cut short, as note titles are, so neighbouring tokens' labels don't run together.
        let shown = name.count > 20 ? String(name.prefix(19)).trimmingCharacters(in: .whitespaces) + "…" : name
        // 12 map units, but never under 18 pt on the projector (world-view-player-safe).
        let size: CGFloat = isPlayerView ? max(12, 18 / viewport.zoom) : 12
        let label = NSAttributedString.mapLabel(shown, font: NSFont.boldSystemFont(ofSize: size))
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
        // Backstop for a Space release this view never saw (PARITY §1.4).
        if spaceHeld, !CGEventSource.keyState(.combinedSessionState, key: 49) { spaceHeld = false }
        guard let editing, let map, !spaceHeld else {
            interaction = .panning
            NSCursor.closedHand.set()
            return
        }
        let point = mapLocation(of: event)
        let shift = event.modifierFlags.contains(.shift)
        if isPlayerView, let openNote = editing.openNote,
            let note = map.note(at: point, tolerance: noteHitRadius, sharedOnly: true)
        {
            openNote(note.id)
            return
        }
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
        if editing.moveDrawings != nil, let light = map.light(at: point, tolerance: Self.lightHitRadius / viewport.zoom) {
            // Light markers draw over tokens, so they take the click first.
            beginMovingStrokes(hit: light.id, at: point, map: map, shift: shift, editing: editing)
            return
        }
        if !isPlayerView, editing.moveDrawings != nil, let note = map.note(at: point, tolerance: noteHitRadius) {
            // Note pins draw over tokens too.
            beginMovingStrokes(hit: note.id, at: point, map: map, shift: shift, editing: editing)
            return
        }
        if !isPlayerView, editing.moveDrawings != nil, let effect = effectHandle(at: point, in: map) {
            // A spell's point of origin is a small target too; the rest of its area is under the tokens.
            beginMovingStrokes(hit: effect.id, at: point, map: map, shift: shift, editing: editing)
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
            let ordered = map.draggedTokenIDs(selected: dragged, hidden: hiddenTokenIDs)
            interaction = .movingTokens(ids: ordered, primary: hit.id, start: point, current: point, began: false)
        } else if let door = map.door(at: point), let doorAction = editing.doorAction {
            // A click selects a door (to delete or turn it); a double-click opens or closes it
            // (locked doors stay put). Shift-click adds it to the selection.
            if shift {
                var next = selection
                if next.contains(door.id) { next.remove(door.id) } else { next.insert(door.id) }
                editing.setSelection(next)
            } else {
                editing.setSelection([door.id])
                if event.clickCount == 2 { doorAction(door.id, .toggle) }
            }
        } else if editing.moveDrawings != nil, let stroke = map.drawing(at: point) {
            beginMovingStrokes(hit: stroke.id, at: point, map: map, shift: shift, editing: editing)
        } else if !isPlayerView, editing.moveDrawings != nil,
            let effect = map.effect(at: point, tolerance: effectHitTolerance, library: library)
        {
            beginMovingStrokes(hit: effect.id, at: point, map: map, shift: shift, editing: editing)
        } else {
            let base = shift ? selection : []
            if !shift { editing.setSelection([]) }
            interaction = .marquee(start: point, current: point, base: base)
        }
    }

    /// The light hit radius in view points.
    private static let lightHitRadius = lightMarkerRadius + 3

    /// A press on a stroke, light, note or effect: selects it (Shift toggles) and starts a move of
    /// every selected stroke, light, note and effect.
    private func beginMovingStrokes(hit id: String, at point: Point2D, map: GameMap, shift: Bool, editing: CanvasEditing) {
        var next = shift ? selection : []
        if shift, next.contains(id) { next.remove(id) } else { next.insert(id) }
        if !shift, selection.contains(id) { next = selection }
        editing.setSelection(next)
        let ids = Set(map.drawings.map(\.id) + map.lights.map(\.id) + map.notes.map(\.id) + map.effects.map(\.id))
            .intersection(next)
        interaction = .movingStrokes(ids: ids, start: point, current: point, began: false)
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
            beginStroke(
                Drawing(
                    tool: .marker, points: [point.x, point.y], color: toolState.markerColor,
                    size: StrokeDefaults.markerSize, pressures: toolState.pressureEnabled ? [pressure(of: event)] : nil))
        case .eraser:
            if let door = map.door(at: point) {
                editing.doorAction?(door.id, .delete)  // the eraser deletes doors it touches
                return
            }
            if let light = map.light(at: point, tolerance: Self.lightHitRadius / viewport.zoom) {
                editing.lightAction?([light.id], .delete)  // and lights
                return
            }
            if let note = map.note(at: point, tolerance: noteHitRadius) {
                editing.noteAction?([note.id], .delete)  // and notes
                return
            }
            if let effect = effectHandle(at: point, in: map) {
                editing.effectAction?([effect.id], .delete)  // and spell effects, by their point of origin
                return
            }
            beginStroke(
                Drawing(
                    tool: .eraser, points: [point.x, point.y], color: StrokeDefaults.eraserColor,
                    size: StrokeDefaults.eraserSize, pressures: toolState.pressureEnabled ? [pressure(of: event)] : nil))
        case .wall:
            beginStroke(
                Drawing(
                    tool: .wall, points: [point.x, point.y], color: StrokeDefaults.wallColor,
                    size: StrokeDefaults.wallSize, wallKind: toolState.wallKind == .wall ? nil : toolState.wallKind,
                    oneWay: toolState.wallOneWay ? true : nil))
        case .door:
            if let door = map.door(at: point) {
                // Clicking a placed door selects it instead of stacking another on it.
                if event.modifierFlags.contains(.shift) {
                    var next = selection
                    if next.contains(door.id) { next.remove(door.id) } else { next.insert(door.id) }
                    editing.setSelection(next)
                } else {
                    editing.setSelection([door.id])
                }
                return
            }
            editing.placeDoor?(point)
        case .light:
            editing.placeLight?(point)
        case .note:
            if let note = map.note(at: point, tolerance: noteHitRadius) {
                // Clicking a pin opens it rather than stacking another on it.
                if event.modifierFlags.contains(.shift) {
                    var next = selection
                    if next.contains(note.id) { next.remove(note.id) } else { next.insert(note.id) }
                    editing.setSelection(next)
                } else {
                    editing.setSelection([note.id])
                }
                return
            }
            editing.placeNote?(point)
        case .effect:
            if let effect = effectHandle(at: point, in: map) {
                // Pressing a point of origin selects that effect rather than starting another on it.
                if event.modifierFlags.contains(.shift) {
                    var next = selection
                    if next.contains(effect.id) { next.remove(effect.id) } else { next.insert(effect.id) }
                    editing.setSelection(next)
                } else {
                    editing.setSelection([effect.id])
                }
                return
            }
            // Starting on a token: the token carries the effect, from its centre.
            if let token = map.token(at: point, library: library), !hiddenTokenIDs.contains(token.id) {
                let box = map.tokenBounds(token, library: library)
                let centre = Point2D(x: box.x + box.width / 2, y: box.y + box.height / 2)
                interaction = .placingEffect(origin: centre, tokenID: token.id, current: point)
            } else {
                let origin = map.effectOriginSnap(point, shape: toolState.effectShape)
                interaction = .placingEffect(origin: origin, tokenID: nil, current: point)
            }
            needsDisplay = true
        case .reveal:
            interaction = .revealing(start: point, current: point)
            needsDisplay = true
        case .measure:
            interaction = .measuring(origin: point)
            editing.setMeasurement?(MeasurementShape(mode: toolState.measureMode, origin: point, pointer: point))
        }
    }

    private func beginStroke(_ drawing: Drawing) {
        liveStroke = drawing
        interaction = .stroke
    }

    /// The view area the newest stroke point can change: the last four points (adding a
    /// point bends the spline's previous segment), padded by the spline's control-point
    /// reach (at most half of two neighbouring segments) and the widest pressure width.
    private func liveStrokeDirtyRect() -> NSRect {
        guard let points = liveStroke?.points, points.count >= 2, let stroke = liveStroke else { return bounds }
        let n = points.count / 2
        let tail = (max(0, n - 4)..<n).map { Point2D(x: points[2 * $0], y: points[2 * $0 + 1]) }
        var minX = Double.infinity, minY = Double.infinity, maxX = -Double.infinity, maxY = -Double.infinity
        var reach = 0.0
        for (i, p) in tail.enumerated() {
            minX = min(minX, p.x)
            minY = min(minY, p.y)
            maxX = max(maxX, p.x)
            maxY = max(maxY, p.y)
            if i >= 2 {
                reach = max(
                    reach, (Measure.euclideanDistance(tail[i - 2], tail[i - 1]) + Measure.euclideanDistance(tail[i - 1], p)) / 2)
            }
        }
        let pad = reach + stroke.size * (stroke.scale ?? 1) + 2  // pressure widths reach 2× the base
        let topLeft = viewport.viewPoint(fromMap: Point2D(x: minX - pad, y: minY - pad))
        let bottomRight = viewport.viewPoint(fromMap: Point2D(x: maxX + pad, y: maxY + pad))
        return NSRect(x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y)
            .insetBy(dx: -2, dy: -2)
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
        case .stroke:
            guard let count = liveStroke?.points.count, count >= 2 else { break }
            var point = mapLocation(of: event)
            // Shift locks the segment to the dominant axis from the stroke's start.
            if event.modifierFlags.contains(.shift), let x0 = liveStroke?.points[0], let y0 = liveStroke?.points[1] {
                if abs(point.x - x0) > abs(point.y - y0) { point.y = y0 } else { point.x = x0 }
            }
            // Skip a repeat of the last point, as TS does (axis-lock produces many).
            if liveStroke?.points[count - 2] == point.x, liveStroke?.points[count - 1] == point.y { break }
            liveStroke?.points.append(contentsOf: [point.x, point.y])
            if liveStroke?.pressures != nil { liveStroke?.pressures?.append(pressure(of: event)) }
            setNeedsDisplay(liveStrokeDirtyRect())
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
        case .revealing(let start, _):
            interaction = .revealing(start: start, current: mapLocation(of: event))
            needsDisplay = true
        case .placingEffect(let origin, let tokenID, _):
            interaction = .placingEffect(origin: origin, tokenID: tokenID, current: mapLocation(of: event))
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
                    hits.formUnion(map.lightIDs(intersecting: rect))
                    hits.formUnion(map.noteIDs(intersecting: rect))
                    hits.formUnion(map.effectIDs(intersecting: rect, library: library))
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
        if case .revealing(let start, let current) = interaction {
            if Measure.euclideanDistance(start, current) * viewport.zoom < Self.dragThreshold {
                // Option-click hides the revealed area under it. A bare click does nothing: players
                // are watching, and a stray click in a tool called Reveal shouldn't darken their ground.
                if event.modifierFlags.contains(.option), let area = map?.revealedArea(at: start) {
                    editing?.hideRevealedArea?(area.id)
                }
            } else {
                // Option reveals exactly what was dragged; otherwise whole cells on square grids.
                let squareGrid = map.map { $0.gridType == .lines || $0.gridType == .dots } ?? false
                editing?.revealArea?(Bounds(corner: start, corner: current), squareGrid && !event.modifierFlags.contains(.option))
            }
        }
        if case .placingEffect = interaction, let map, let effect = effectPreview(in: map) {
            var placed = effect
            placed.id = newID()
            editing?.placeEffect?(placed)
        }
        if case .panning = interaction { clampViewport() }
        if case .stroke = interaction, let drawing = liveStroke {
            editing?.addDrawing?(drawing)
        }
        liveStroke = nil
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
        let point = mapLocation(of: event)
        hoverPoint = point
        if toolState.tool == .select, let hit = map?.token(at: point, library: library), !hiddenTokenIDs.contains(hit.id) {
            hoveredTokenID = hit.id
        } else {
            hoveredTokenID = nil
        }
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
        hoveredTokenID = nil
        needsDisplay = true
    }

    /// Right-click (or Control-click) on a token: Change Image, Image from Library, Delete.
    /// On a door: Open/Close, Lock/Unlock, Delete (PARITY §3.6).
    /// On a wall: its kind, one-way and direction, Delete (PARITY §3.5 Native).
    override func menu(for event: NSEvent) -> NSMenu? {
        guard let map else { return nil }
        let point = mapLocation(of: event)
        if let lightAction = editing?.lightAction,
            let light = map.light(at: point, tolerance: Self.lightHitRadius / viewport.zoom)
        {
            return lightMenu(light, map: map, action: lightAction)
        }
        // Lights, notes and doors are small targets, so they win over a token standing on them.
        if let noteAction = editing?.noteAction, let note = map.note(at: point, tolerance: noteHitRadius) {
            return noteMenu(note, map: map, action: noteAction)
        }
        if let effectAction = editing?.effectAction, let effect = effectHandle(at: point, in: map) {
            return effectMenu(effect, map: map, action: effectAction)
        }
        guard let doorAction = editing?.doorAction, let door = map.door(at: point) else {
            // A spell's area lies under everything else, so it answers last.
            return tokenMenu(at: point, map: map) ?? wallMenu(at: point, map: map) ?? markerMenu(at: point, map: map)
                ?? effectAreaMenu(at: point, map: map)
        }
        // The menu acts on every selected door when the clicked one is among them.
        let doorIDs = selection.contains(door.id) ? selectedDoorIDs(in: map) : [door.id]
        if !selection.contains(door.id) { editing?.setSelection([door.id]) }
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
        // A hidden door looks like wall to players while it is shut.
        let hidden = door.isHidden == true
        menu.addItem(
            MenuAction.item(hidden ? "Reveal to Players" : "Hide from Players") {
                doorAction(door.id, hidden ? .reveal : .hide)
            })
        if let rotate = editing?.rotateDoors {
            menu.addItem(.separator())
            menu.addItem(MenuAction.item("Rotate 45° Clockwise") { rotate(doorIDs, 45) })
            menu.addItem(MenuAction.item("Rotate 45° Counterclockwise") { rotate(doorIDs, -45) })
            menu.addItem(MenuAction.item("Rotate 90°") { rotate(doorIDs, 90) })
        }
        menu.addItem(.separator())
        let deleteTitle = doorIDs.count == 1 ? "Delete Door" : "Delete Doors"
        let delete = MenuAction.item(deleteTitle) { [editing] in
            if doorIDs.count > 1, let deleteDoors = editing?.deleteDoors {
                deleteDoors(doorIDs)
            } else {
                doorAction(door.id, .delete)
            }
        }
        delete.attributedTitle = NSAttributedString(
            string: deleteTitle, attributes: [.foregroundColor: NSColor.systemRed])
        menu.addItem(delete)
        return menu
    }

    /// Change Image and Delete for the selected tokens when the clicked one is among them,
    /// else for that token alone.
    private func tokenMenu(at point: Point2D, map: GameMap) -> NSMenu? {
        guard let tokenMenu = editing?.tokenMenu, let token = map.token(at: point, library: library),
            !hiddenTokenIDs.contains(token.id)
        else { return nil }
        let ids = selection.contains(token.id) ? Set(map.tokens.map(\.id)).intersection(selection) : [token.id]
        if !selection.contains(token.id) { editing?.setSelection([token.id]) }
        needsDisplay = true
        return tokenMenu(ids)
    }

    /// On, presets and Delete for the selected lights when the clicked one is among them,
    /// else for that light alone.
    private func lightMenu(_ light: LightSource, map: GameMap, action: @escaping (Set<String>, LightAction) -> Void) -> NSMenu {
        let ids: Set<String> =
            selection.contains(light.id) ? Set(map.lights.filter { selection.contains($0.id) }.map(\.id)) : [light.id]
        if !selection.contains(light.id) { editing?.setSelection([light.id]) }
        let targets = map.lights.filter { ids.contains($0.id) }
        let allOn = targets.allSatisfy(\.isOn)
        let menu = NSMenu()
        menu.autoenablesItems = false
        menu.addItem(MenuAction.item(allOn ? "Turn Off" : "Turn On") { action(ids, .on(!allOn)) })
        menu.addItem(.separator())
        let names = Set(targets.compactMap(\.name))
        for preset in LightPreset.all {
            let item = MenuAction.item("\(preset.name) (\(jsNumber(preset.bright)) ft bright, \(jsNumber(preset.dim)) ft dim)") {
                action(ids, .preset(preset))
            }
            item.state = names == Set([preset.name]) ? .on : .off
            menu.addItem(item)
        }
        menu.addItem(.separator())
        let title = ids.count == 1 ? "Delete Light" : "Delete Lights"
        let delete = MenuAction.item(title) { action(ids, .delete) }
        delete.attributedTitle = NSAttributedString(string: title, attributes: [.foregroundColor: NSColor.systemRed])
        menu.addItem(delete)
        return menu
    }

    /// Share, show and Delete for the selected notes when the clicked one is among them, else
    /// for that note alone.
    private func noteMenu(_ note: MapNote, map: GameMap, action: @escaping (Set<String>, NoteAction) -> Void) -> NSMenu {
        let ids: Set<String> =
            selection.contains(note.id) ? Set(map.notes.filter { selection.contains($0.id) }.map(\.id)) : [note.id]
        if !selection.contains(note.id) { editing?.setSelection([note.id]) }
        let allShared = map.notes.filter { ids.contains($0.id) }.allSatisfy(\.isShared)
        let menu = NSMenu()
        menu.autoenablesItems = false
        let share = MenuAction.item("Show Pin to Players") { action(ids, .share(!allShared)) }
        share.state = allShared ? .on : .off
        menu.addItem(share)
        menu.addItem(MenuAction.item("Show Player Notes on World View", enabled: ids.count == 1) { action(ids, .showOnWorldView) })
        menu.addItem(.separator())
        let title = ids.count == 1 ? "Delete Note" : "Delete Notes"
        let delete = MenuAction.item(title) { action(ids, .delete) }
        delete.attributedTitle = NSAttributedString(string: title, attributes: [.foregroundColor: NSColor.systemRed])
        menu.addItem(delete)
        return menu
    }

    /// The effect whose area is under `point`, for its menu.
    private func effectAreaMenu(at point: Point2D, map: GameMap) -> NSMenu? {
        guard let effectAction = editing?.effectAction,
            let effect = map.effect(at: point, tolerance: effectHitTolerance, library: library)
        else { return nil }
        return effectMenu(effect, map: map, action: effectAction)
    }

    /// Show or hide, look, rotation and Delete for the selected effects when the clicked one is
    /// among them, else for that effect alone.
    private func effectMenu(_ effect: SpellEffect, map: GameMap, action: @escaping (Set<String>, EffectAction) -> Void)
        -> NSMenu
    {
        let ids: Set<String> =
            selection.contains(effect.id) ? Set(map.effects.filter { selection.contains($0.id) }.map(\.id)) : [effect.id]
        if !selection.contains(effect.id) { editing?.setSelection([effect.id]) }
        let targets = map.effects.filter { ids.contains($0.id) }
        let allShown = targets.allSatisfy { !$0.isHidden }
        let menu = NSMenu()
        menu.autoenablesItems = false
        let show = MenuAction.item("Show to Players") { action(ids, .hide(allShown)) }
        show.state = allShown ? .on : .off
        menu.addItem(show)
        menu.addItem(.separator())
        let looks = Set(targets.map(\.look))
        for look in SpellEffect.Look.allCases {
            let item = MenuAction.item(look.title) { action(ids, .look(look)) }
            item.state = looks == [look] ? .on : .off
            menu.addItem(item)
        }
        if targets.contains(where: \.shape.hasDirection) {
            menu.addItem(.separator())
            menu.addItem(MenuAction.item("Rotate 45° Clockwise") { action(ids, .rotate(45)) })
            menu.addItem(MenuAction.item("Rotate 45° Counterclockwise") { action(ids, .rotate(-45)) })
        }
        if targets.contains(where: { $0.tokenID != nil }) {
            menu.addItem(.separator())
            menu.addItem(MenuAction.item("Leave on the Map") { action(ids, .detach) })
        }
        menu.addItem(.separator())
        let title = ids.count == 1 ? "Delete Effect" : "Delete Effects"
        let delete = MenuAction.item(title) { action(ids, .delete) }
        delete.attributedTitle = NSAttributedString(string: title, attributes: [.foregroundColor: NSColor.systemRed])
        menu.addItem(delete)
        return menu
    }

    /// The effect whose point of origin is under `point` (Architect).
    func effectHandle(at point: Point2D, in map: GameMap) -> SpellEffect? {
        map.effects.last {
            let origin = map.effectOrigin($0, library: library)
            return hypot(origin.x - point.x, origin.y - point.y) <= effectHitTolerance
        }
    }

    /// The effect being dragged out with the Spell Effect tool, as it would be placed.
    func effectPreview(in map: GameMap) -> SpellEffect? {
        guard case .placingEffect(let origin, let tokenID, let current) = interaction else { return nil }
        let shape = toolState.effectShape
        let dragged = Measure.euclideanDistance(origin, current) * viewport.zoom >= Self.dragThreshold
        let feet =
            dragged
            ? SpellEffect.roundedFeet(Measure.euclideanDistance(origin, current) / map.gridSize * 5)
            : Self.defaultEffectSize(shape)
        var angle = dragged ? Measure.angleDegrees(from: origin, to: current) : 0
        if NSEvent.modifierFlags.contains(.shift) { angle = (angle / 45).rounded() * 45 }
        // A carried effect's point stays in world pixels here; `GameMap.placeEffect` makes it an offset.
        return SpellEffect(
            id: "preview-effect", shape: shape, size: feet, angle: shape.hasDirection ? angle.truncatingRemainder(dividingBy: 360) : 0,
            x: origin.x, y: origin.y, tokenID: tokenID, look: toolState.effectLook)
    }

    /// A click without a drag places the size most spells of that shape use.
    static func defaultEffectSize(_ shape: SpellEffect.Shape) -> Double {
        switch shape {
        case .circle: return 20
        case .cone: return 15
        case .line: return 60
        case .cube: return 15
        }
    }

    /// `map` with the tokens this canvas is dragging at their live positions, so the effects they
    /// carry follow them.
    func mapWithLiveTokenDrag(_ map: GameMap) -> GameMap {
        guard case .movingTokens(let ids, _, let start, let current, true) = interaction else { return map }
        var live = map
        let dx = current.x - start.x
        let dy = current.y - start.y
        for i in live.tokens.indices where ids.contains(live.tokens[i].id) {
            live.tokens[i].x += dx
            live.tokens[i].y += dy
        }
        return live
    }

    /// Acts on the selected walls when the clicked wall is among them, else on that wall alone.
    private func wallMenu(at point: Point2D, map: GameMap) -> NSMenu? {
        guard let wallAction = editing?.wallAction, let wall = map.drawing(at: point), wall.tool == .wall else {
            return nil
        }
        let ids: Set<String> =
            selection.contains(wall.id)
            ? Set(map.drawings.filter { $0.tool == .wall && selection.contains($0.id) }.map(\.id)) : [wall.id]
        if !selection.contains(wall.id) { editing?.setSelection([wall.id]) }
        let targets = map.drawings.filter { ids.contains($0.id) }
        let kinds = Set(targets.map { $0.wallKind ?? .wall })
        let oneWay = targets.allSatisfy { $0.oneWay ?? false }
        let menu = NSMenu()
        menu.autoenablesItems = false
        for kind in WallKind.allCases {
            let item = MenuAction.item(kind.title) { wallAction(ids, .kind(kind)) }
            item.state = kinds == [kind] ? .on : .off
            menu.addItem(item)
        }
        menu.addItem(.separator())
        let oneWayItem = MenuAction.item("One-Way") { wallAction(ids, .oneWay(!oneWay)) }
        oneWayItem.state = oneWay ? .on : .off
        menu.addItem(oneWayItem)
        menu.addItem(MenuAction.item("Flip Direction", enabled: oneWay) { wallAction(ids, .flip) })
        menu.addItem(.separator())
        let title = ids.count == 1 ? "Delete Wall" : "Delete Walls"
        let delete = MenuAction.item(title) { wallAction(ids, .delete) }
        delete.attributedTitle = NSAttributedString(string: title, attributes: [.foregroundColor: NSColor.systemRed])
        menu.addItem(delete)
        return menu
    }

    /// Show to Players and Delete for the clicked marker, or the selected
    /// markers when it is among them (decision 014).
    private func markerMenu(at point: Point2D, map: GameMap) -> NSMenu? {
        guard let markerAction = editing?.markerAction, let marker = map.drawing(at: point), marker.tool == .marker else {
            return nil
        }
        let ids: Set<String> =
            selection.contains(marker.id)
            ? Set(map.drawings.filter { $0.tool == .marker && selection.contains($0.id) }.map(\.id)) : [marker.id]
        if !selection.contains(marker.id) { editing?.setSelection([marker.id]) }
        needsDisplay = true
        let hidden = map.drawings.filter { ids.contains($0.id) }.allSatisfy(\.isHiddenFromPlayers)
        let menu = NSMenu()
        menu.autoenablesItems = false
        // A checked "Show to Players", as on spell effects and note pins.
        let show = MenuAction.item("Show to Players") { markerAction(ids, .dmOnly(!hidden)) }
        show.state = hidden ? .off : .on
        menu.addItem(show)
        menu.addItem(.separator())
        let title = ids.count == 1 ? "Delete Marker" : "Delete Markers"
        let delete = MenuAction.item(title) { markerAction(ids, .delete) }
        delete.attributedTitle = NSAttributedString(string: title, attributes: [.foregroundColor: NSColor.systemRed])
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
            if !selection.isEmpty { editing?.deleteSelection?() }
        case 53:  // escape
            if calibrating {
                editing?.cancelCalibration?()
                return
            }
            if measurement == nil, selection.isEmpty {
                editing?.stopAudio?()
                return
            }
            editing?.setSelection([])
            editing?.setMeasurement?(nil)
        case 123, 124, 125, 126:
            // Arrows turn the selected doors 15° (Shift: 45°), left and up anticlockwise; with
            // none selected they flip the Door tool's next door.
            let doors = map.map { selectedDoorIDs(in: $0) } ?? []
            let effects = map.map { m in Set(m.effects.filter { selection.contains($0.id) && $0.shape.hasDirection }.map(\.id)) } ?? []
            let step = event.modifierFlags.contains(.shift) ? 45.0 : 15.0
            let turn = event.keyCode == 123 || event.keyCode == 126 ? -step : step
            if !doors.isEmpty, let rotate = editing?.rotateDoors {
                rotate(doors, turn)
            } else if !effects.isEmpty, let effectAction = editing?.effectAction {
                // The same keys aim the selected cones, lines and cubes.
                effectAction(effects, .rotate(turn))
            } else if toolState.tool == .door {
                editing?.toggleDoorOrientation?()
            } else {
                super.keyDown(with: event)
            }
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
                    // R turns the selected doors 45° (Shift-R back), else flips the next door.
                    let doors = map.map { selectedDoorIDs(in: $0) } ?? []
                    if !doors.isEmpty, let rotate = editing?.rotateDoors {
                        rotate(doors, event.modifierFlags.contains(.shift) ? -45 : 45)
                    } else {
                        editing?.toggleDoorOrientation?()
                    }
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

    // MARK: Window-wide keys and focus loss (PARITY §1.4)

    /// TS listens for canvas keys on the whole window, skipping only text inputs.
    private var windowKeyMonitor: Any?

    override func viewWillMove(toWindow newWindow: NSWindow?) {
        super.viewWillMove(toWindow: newWindow)
        if newWindow == nil {
            stopWatchingWindow()
            flickerTimer?.invalidate()
            flickerTimer = nil
        }
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        updateFlicker()
        guard let window else { return }
        let center = NotificationCenter.default
        center.removeObserver(self, name: NSWindow.didResignKeyNotification, object: nil)
        center.removeObserver(self, name: NSWindow.willCloseNotification, object: nil)
        center.addObserver(self, selector: #selector(windowResignedKey), name: NSWindow.didResignKeyNotification, object: window)
        center.addObserver(self, selector: #selector(windowWillClose), name: NSWindow.willCloseNotification, object: window)
        if windowKeyMonitor == nil {
            windowKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .keyUp]) { [weak self] event in
                let handled = MainActor.assumeIsolated { self?.handleWindowKey(event) ?? false }
                return handled ? nil : event
            }
        }
        // A newly opened campaign window starts with the map focused.
        DispatchQueue.main.async { [weak self] in
            guard let self, let window = self.window, window.firstResponder === window, self.editing?.setTool != nil
            else { return }
            window.makeFirstResponder(self)
        }
    }

    private func stopWatchingWindow() {
        NotificationCenter.default.removeObserver(self, name: NSWindow.didResignKeyNotification, object: nil)
        NotificationCenter.default.removeObserver(self, name: NSWindow.willCloseNotification, object: nil)
        if let windowKeyMonitor { NSEvent.removeMonitor(windowKeyMonitor) }
        windowKeyMonitor = nil
        releaseHeldKeys()
    }

    @objc private func windowResignedKey(_ notification: Notification) {
        releaseHeldKeys()
    }

    @objc private func windowWillClose(_ notification: Notification) {
        stopWatchingWindow()
        flickerTimer?.invalidate()
        flickerTimer = nil
    }

    override func resignFirstResponder() -> Bool {
        releaseHeldKeys()
        return super.resignFirstResponder()
    }

    /// Clears hold-Space pan and hold-M range when their key-up can't reach this view (TS `handleBlur`).
    private func releaseHeldKeys() {
        guard spaceHeld || showMovementRange else { return }
        spaceHeld = false
        showMovementRange = false
        NSCursor.arrow.set()
        needsDisplay = true
    }

    /// Sends canvas keys pressed while another control (sidebar list, toolbar, inspector
    /// picker) has focus to the canvas. Text fields and focusable SwiftUI views (the
    /// Session Console's own keys) keep their keys. Returns true when the key was used.
    private func handleWindowKey(_ event: NSEvent) -> Bool {
        guard let window, event.window === window else { return false }
        let responder = window.firstResponder
        guard responder !== self else { return false }
        if event.type == .keyUp {
            let isM = event.charactersIgnoringModifiers?.lowercased() == "m"
            if (event.keyCode == 49 && spaceHeld) || (isM && showMovementRange) { keyUp(with: event) }
            return false
        }
        guard event.type == .keyDown, editing?.setTool != nil, !isHiddenOrHasHiddenAncestor else { return false }
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        guard flags.isDisjoint(with: [.command, .control, .option]) else { return false }
        guard responder == nil || responder === window || (responder is NSControl && !(responder is NSTextField))
        else { return false }
        if event.keyCode == 49, responder is NSButton { return false }  // Space presses a focused button
        let keyCodes: Set<UInt16> = [49, 51, 53, 117]  // space, delete, escape, forward delete
        let arrows: Set<UInt16> = [123, 124, 125, 126]
        // Every tool key (so Spell Effect and Reveal work from the sidebar too), I, grid types and zoom.
        let characters = Set(CanvasTool.allCases.map(\.key)).union("i12345?+=-_")
        let character = event.charactersIgnoringModifiers?.lowercased().first
        // Arrows reach the canvas from other controls only with the Door tool, so a slider or
        // picker keeps its arrows while a door happens to be selected.
        guard keyCodes.contains(event.keyCode) || (arrows.contains(event.keyCode) && toolState.tool == .door)
            || (character.map { characters.contains($0) } ?? false)
        else { return false }
        keyDown(with: event)
        return true
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
    var zoomRequest: ZoomRequest?
    var onViewportChange: ((Viewport, CGSize) -> Void)?
    var calibrating = false
    /// Identifies the document whose asset names `imageProvider` resolves (cache keys).
    var assetNamespace = ""
    /// The file a video background plays from (`VideoAssetFiles.url(named:in:ready:)`).
    var videoProvider: (String, @escaping VideoFileReady) -> URL? = { _, _ in nil }
    /// Holds a video background on its current frame.
    var animationPaused = false
    /// Draws nothing at all (World View paused) while keeping the camera for resume.
    var isBlanked = false

    func makeNSView(context: Context) -> MapCanvasHostView {
        MapCanvasHostView(frame: .zero)
    }

    func updateNSView(_ host: MapCanvasHostView, context: Context) {
        let view = host.canvas
        view.map = map
        view.library = library
        view.imageProvider = imageProvider
        view.selection = selection
        view.editing = editing
        view.hiddenTokenIDs = hiddenTokenIDs
        view.isPlayerView = isPlayerView
        view.fog = fog
        view.toolState = toolState
        view.measurement = measurement
        view.fitRequest = fitRequest
        view.zoomRequest = zoomRequest
        view.onViewportChange = onViewportChange
        if view.calibrating != calibrating || view.toolState.tool != toolState.tool {
            view.window?.invalidateCursorRects(for: view)
        }
        view.calibrating = calibrating
        view.assetNamespace = assetNamespace
        view.videoProvider = videoProvider
        view.animationPaused = animationPaused
        view.syncVideoBackground()
        host.isHidden = isBlanked
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
