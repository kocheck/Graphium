import AVFoundation
import AppKit
import GraphiumCore
import QuartzCore

/// `MapCanvas`'s view: the canvas over the layer that plays a video map background. The
/// canvas draws everything else, so it stays the view that takes events, focus and drops.
final class MapCanvasHostView: NSView {
    let video = MapVideoBackgroundView(frame: .zero)
    let canvas = MapCanvasNSView(frame: .zero)

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        commonInit()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }

    private func commonInit() {
        video.frame = bounds
        canvas.frame = bounds
        addSubview(video)
        addSubview(canvas)  // above the video
        canvas.videoBackground = video
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        video.frame = bounds
        canvas.frame = bounds  // the canvas re-places the video for the new size
    }
}

/// Plays a map's video background, looping and muted, under the canvas. A layer-hosting
/// view: the AVPlayerLayer is composited on the GPU, and pan and zoom only move its frame,
/// so following the camera never redraws or re-decodes anything.
final class MapVideoBackgroundView: NSView {
    struct Placement {
        var url: URL
        /// Where the video goes, in the canvas's top-left (flipped) view coordinates.
        var rect: CGRect
        var paused: Bool
        /// What shows around the video and through any transparency in it.
        var backdrop: NSColor
    }

    private let root = CALayer()
    private let playerLayer = AVPlayerLayer()
    private let player = AVQueuePlayer()
    private var looper: AVPlayerLooper?
    private var url: URL?
    private var paused = false
    private var backdrop = NSColor.textBackgroundColor

    /// True while a video is loaded; the canvas then leaves its own background clear.
    var isShowingVideo: Bool { url != nil }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        commonInit()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }

    private func commonInit() {
        // Layer-hosting (layer set before wantsLayer): this view owns the layer tree, which
        // keeps standard bottom-left layer geometry.
        layer = root
        wantsLayer = true
        // No implicit animations: the video moves in the same Core Animation commit as the
        // canvas redraw, so it never slides behind the map while panning or zooming.
        let still: [String: CAAction] = [
            "position": NSNull(), "bounds": NSNull(), "frame": NSNull(), "hidden": NSNull(),
            "backgroundColor": NSNull(),
        ]
        root.actions = still
        playerLayer.actions = still
        player.isMuted = true
        player.preventsDisplaySleepDuringVideoPlayback = false
        playerLayer.player = player
        playerLayer.videoGravity = .resize  // the rect already has the video's aspect
        playerLayer.isHidden = true
        root.addSublayer(playerLayer)
        isHidden = true
    }

    // Purely visual: clicks, drops and VoiceOver go to the canvas above.
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { false }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        root.frame = bounds
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        updatePlayback()
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        applyBackdrop()
    }

    /// Shows the video at `placement`, or stops and hides it when nil.
    func show(_ placement: Placement?) {
        guard let placement else {
            guard url != nil else { return }
            url = nil
            looper?.disableLooping()
            looper = nil
            player.pause()
            player.removeAllItems()
            playerLayer.isHidden = true
            isHidden = true
            applyBackdrop()
            return
        }
        if placement.url != url {
            looper?.disableLooping()
            player.removeAllItems()
            looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: placement.url))
            url = placement.url
        }
        isHidden = false
        playerLayer.isHidden = false
        let rect = placement.rect
        // The canvas is flipped; this layer tree isn't.
        playerLayer.frame = CGRect(x: rect.minX, y: bounds.height - rect.maxY, width: rect.width, height: rect.height)
        if placement.backdrop != backdrop {
            backdrop = placement.backdrop
            applyBackdrop()
        } else if root.backgroundColor == nil {
            applyBackdrop()
        }
        paused = placement.paused
        updatePlayback()
    }

    /// Plays only while shown in a window and not paused (Map > Pause Animation).
    private func updatePlayback() {
        if url != nil, !paused, window != nil {
            if player.rate == 0 { player.play() }
        } else if player.rate != 0 {
            player.pause()
        }
    }

    private func applyBackdrop() {
        guard url != nil else {
            root.backgroundColor = nil
            return
        }
        var color: CGColor?
        effectiveAppearance.performAsCurrentDrawingAppearance {
            color = self.backdrop.cgColor
        }
        root.backgroundColor = color
    }
}

extension MapCanvasNSView {
    /// The canvas's own fill: black past the map's edge in the World View under fog, as
    /// unexplored ground is; the window's text background otherwise.
    var backdropColor: NSColor {
        isPlayerView && fog != nil ? NSColor.black : NSColor.textBackgroundColor
    }

    /// Places the video under the canvas exactly where the still background would be drawn
    /// (MapBackground x, y, width × height at scale), or hides it when the background isn't
    /// a video. Called on every map, camera and size change; it only moves a layer.
    func syncVideoBackground() {
        guard let videoView = videoBackground else { return }
        guard let background = map?.background, isVideoAsset(background.src),
            let url = videoProvider(
                background.src,
                { [weak self] in
                    // The file is written: show it, and let the canvas clear its background.
                    self?.syncVideoBackground()
                    self?.needsDisplay = true
                })
        else {
            if videoView.isShowingVideo {
                videoView.show(nil)
                needsDisplay = true
            }
            return
        }
        let wasShowing = videoView.isShowingVideo
        let topLeft = viewport.viewPoint(fromMap: Point2D(x: background.x, y: background.y))
        let rect = CGRect(
            x: topLeft.x, y: topLeft.y, width: background.width * background.scale * viewport.zoom,
            height: background.height * background.scale * viewport.zoom)
        videoView.show(
            MapVideoBackgroundView.Placement(url: url, rect: rect, paused: animationPaused, backdrop: backdropColor))
        if !wasShowing { needsDisplay = true }
    }
}
