import Foundation
import GraphiumCore

import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

/// An image file prepared for the package, as the app imports it (CORE_SPEC §3.13):
/// downscaled to the kind's limit; images with alpha stored as PNG, the rest as JPEG.
struct ImageImport {
    var preferredName: String
    var data: Data
    var width: Int
    var height: Int
    var originalWidth: Int
    var originalHeight: Int

    static func load(_ url: URL, kind: ImageKind) throws -> ImageImport {
        guard FileManager.default.fileExists(atPath: url.path) else { throw ToolError("No file at \(url.path).") }
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let pixelWidth = properties[kCGImagePropertyPixelWidth] as? Int,
            let pixelHeight = properties[kCGImagePropertyPixelHeight] as? Int
        else { throw ToolError("\(url.lastPathComponent) isn't an image Graphium can read.") }
        let fitted = kind.fittedSize(width: pixelWidth, height: pixelHeight)
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: max(fitted.width, fitted.height),
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            throw ToolError("\(url.lastPathComponent) couldn't be decoded.")
        }
        let hasAlpha: Bool
        switch image.alphaInfo {
        case .none, .noneSkipFirst, .noneSkipLast: hasAlpha = false
        default: hasAlpha = true
        }
        guard let data = encode(image, png: hasAlpha) else {
            throw ToolError("\(url.lastPathComponent) couldn't be re-encoded.")
        }
        let stem = url.deletingPathExtension().lastPathComponent
        // Thumbnail options apply the EXIF orientation, so a rotated photo can swap its sides.
        let swapped = (image.width > image.height) != (pixelWidth > pixelHeight) && pixelWidth != pixelHeight
        return ImageImport(
            preferredName: "\(stem).\(hasAlpha ? "png" : "jpg")", data: data, width: image.width, height: image.height,
            originalWidth: swapped ? pixelHeight : pixelWidth, originalHeight: swapped ? pixelWidth : pixelHeight)
    }

    static func encode(_ image: CGImage, png: Bool) -> Data? {
        let output = NSMutableData()
        let type = (png ? UTType.png : UTType.jpeg).identifier as CFString
        guard let destination = CGImageDestinationCreateWithData(output, type, 1, nil) else { return nil }
        let options: [CFString: Any] = png ? [:] : [kCGImageDestinationLossyCompressionQuality: 0.85]
        CGImageDestinationAddImage(destination, image, options as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return output as Data
    }
}

/// Placeholder token art: a coloured disc with the name's initials, so tokens made
/// without an image are still told apart at the table.
struct TokenArt {
    var name: String
    var initials: String
    var color: (r: CGFloat, g: CGFloat, b: CGFloat)

    static func disc(label: String, type: CreatureType?, color hex: String?) -> TokenArt {
        let words = label.split(whereSeparator: { !$0.isLetter && !$0.isNumber })
        var initials = words.prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
        if words.count == 1, let word = words.first, word.count > 1, word.allSatisfy(\.isLetter) {
            initials = String(word.prefix(2)).capitalized
        }
        if initials.isEmpty { initials = "?" }
        let fallback: (CGFloat, CGFloat, CGFloat) =
            type == .pc ? (0.20, 0.45, 0.85) : type == .npc ? (0.78, 0.25, 0.22) : (0.42, 0.45, 0.50)
        let rgb = hex.flatMap(parseHex) ?? fallback
        let hexName = String(format: "%02x%02x%02x", Int(rgb.0 * 255), Int(rgb.1 * 255), Int(rgb.2 * 255))
        let safe = initials.unicodeScalars.filter { $0.isASCII && CharacterSet.alphanumerics.contains($0) }
        return TokenArt(
            name: "token-\(String(safe).lowercased())-\(hexName).png", initials: initials,
            color: (rgb.0, rgb.1, rgb.2))
    }

    func png() -> Data? {
        let side = 256
        guard let ctx = makeContext(width: side, height: side) else { return nil }
        let bounds = CGRect(x: 0, y: 0, width: side, height: side)
        ctx.setFillColor(red: color.r, green: color.g, blue: color.b, alpha: 1)
        ctx.fillEllipse(in: bounds.insetBy(dx: 8, dy: 8))
        ctx.setStrokeColor(red: 1, green: 1, blue: 1, alpha: 0.9)
        ctx.setLineWidth(8)
        ctx.strokeEllipse(in: bounds.insetBy(dx: 16, dy: 16))
        let size: CGFloat = initials.count > 1 ? 104 : 132
        drawText(initials, in: ctx, centre: CGPoint(x: 128, y: 128), size: size, color: CGColor(gray: 1, alpha: 1), flipped: false)
        guard let image = ctx.makeImage() else { return nil }
        return ImageImport.encode(image, png: true)
    }
}

func parseHex(_ hex: String) -> (CGFloat, CGFloat, CGFloat)? {
    var s = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
    if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
    guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
    return (CGFloat((v >> 16) & 0xFF) / 255, CGFloat((v >> 8) & 0xFF) / 255, CGFloat(v & 0xFF) / 255)
}

func makeContext(width: Int, height: Int) -> CGContext? {
    CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
}

/// Draws centred text. In a y-down (flipped) context the glyphs are flipped back.
func drawText(
    _ text: String, in ctx: CGContext, centre: CGPoint, size: CGFloat, color: CGColor, flipped: Bool,
    outline: CGColor? = nil
) {
    let font = CTFontCreateWithName("Helvetica-Bold" as CFString, size, nil)
    func line(_ fill: CGColor, stroke: CGFloat) -> CTLine {
        var attributes: [NSAttributedString.Key: Any] = [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): fill,
        ]
        if stroke > 0 {
            attributes[NSAttributedString.Key(kCTStrokeWidthAttributeName as String)] = stroke
            attributes[NSAttributedString.Key(kCTStrokeColorAttributeName as String)] = fill
        }
        return CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
    }
    let main = line(color, stroke: 0)
    let bounds = CTLineGetImageBounds(main, ctx)
    let width = CTLineGetTypographicBounds(main, nil, nil, nil)
    ctx.saveGState()
    ctx.textMatrix = flipped ? CGAffineTransform(scaleX: 1, y: -1) : .identity
    let x = centre.x - CGFloat(width) / 2
    let y = flipped ? centre.y + bounds.height / 2 : centre.y - bounds.height / 2
    if let outline {
        ctx.textPosition = CGPoint(x: x, y: y)
        CTLineDraw(line(outline, stroke: 18), ctx)
    }
    ctx.textPosition = CGPoint(x: x, y: y)
    CTLineDraw(main, ctx)
    ctx.restoreGState()
}

/// Draws a map to PNG for the model to look at: the DM's view, or what PCs can see.
struct MapRenderer {
    var map: GameMap
    var campaign: Campaign
    var packageURL: URL

    var library: [String: TokenLibraryItem] { campaign.libraryIndex }

    func area(region: Bounds?) -> Bounds {
        if let region, region.width > 0, region.height > 0 { return region }
        let g = map.gridSize
        guard let b = map.contentBounds(library: library) else { return Bounds(x: 0, y: 0, width: 20 * g, height: 15 * g) }
        let x = (b.x / g).rounded(.down) * g - g
        let y = (b.y / g).rounded(.down) * g - g
        return Bounds(
            x: x, y: y, width: ((b.x + b.width) / g).rounded(.up) * g + g - x,
            height: ((b.y + b.height) / g).rounded(.up) * g + g - y)
    }

    func pixelScale(_ area: Bounds, maxPixels: Int) -> Double {
        min(Double(maxPixels) / max(area.width, area.height), 2)
    }

    func caption(region: Bounds?, units: Units, playersView: Bool) -> String {
        let a = area(region: region)
        let s = pixelScale(a, maxPixels: 1200)
        var lines = [
            "\(map.name): showing x \(units.out(a.x).serialized())…\(units.out(a.x + a.width).serialized()), "
                + "y \(units.out(a.y).serialized())…\(units.out(a.y + a.height).serialized()) (\(units.name)); "
                + "one cell ≈ \(Int(map.gridSize * s)) px in the image. Cell numbers are printed every 5 cells.",
            "Legend: red lines walls, blue dashed windows, orange one-way walls (tick on the side sight comes from), "
                + "brown bars closed doors, purple dashed bars hidden doors (wall in the players' view), green outline open doors, gold dot locked, yellow dots lights (solid ring bright, "
                + "dashed ring dim), white squares note pins (solid edge shared with players, dashed DM only; titles beside "
                + "them), tinted shapes spell effects (dashed edge hidden from players; labels inside), blue discs PCs, red discs NPCs.",
        ]
        if playersView {
            lines.append(
                map.isDaylightMode
                    ? "Daylight is on, so players see the whole map."
                    : map.ambientLight == nil
                        ? "Players' view: black is unseen, dim is explored earlier, clear is what PCs see now."
                        : "Players' view with lighting: black is unseen, dark grey explored earlier, grey is dim "
                            + "light, clear is bright light (darkvision counts).")
        }
        return lines.joined(separator: "\n")
    }

    func png(region: Bounds?, maxPixels: Int, playersView: Bool) -> Data? {
        let a = area(region: region)
        let s = pixelScale(a, maxPixels: maxPixels)
        let width = max(Int((a.width * s).rounded()), 1)
        let height = max(Int((a.height * s).rounded()), 1)
        guard let ctx = makeContext(width: width, height: height) else { return nil }
        // y down, map coordinates.
        ctx.translateBy(x: 0, y: CGFloat(height))
        ctx.scaleBy(x: CGFloat(s), y: -CGFloat(s))
        ctx.translateBy(x: -CGFloat(a.x), y: -CGFloat(a.y))
        let visible = CGRect(x: a.x, y: a.y, width: a.width, height: a.height)

        ctx.setFillColor(red: 0.16, green: 0.16, blue: 0.17, alpha: 1)
        ctx.fill(visible)
        drawBackground(ctx)
        drawGrid(ctx, visible)
        drawMarkers(ctx)
        drawStairs(ctx)
        drawWalls(ctx)
        drawDoors(ctx, playersView: playersView)
        if !playersView { drawLights(ctx) }
        if playersView && !map.isDaylightMode {
            let sight = LineOfSight.partySight(of: map, library: library)
            let hidden = LineOfSight.hiddenNPCIDs(of: map, library: library, sight: sight)
            drawTokens(ctx, hidden: hidden, scale: s)
            if map.ambientLight == nil {
                drawFog(ctx, visible, polygons: sight.vision.map(\.polygon))
            } else {
                drawLitFog(ctx, visible, sight: sight)
            }
            // Over the fog, as in the app: the DM chose to show them (decision 015).
            drawEffects(ctx, playersView: true, hiddenTokens: hidden, scale: s)
        } else {
            drawEffects(ctx, playersView: playersView, hiddenTokens: [], scale: s)
            drawTokens(ctx, hidden: [], scale: s)
        }
        // Over the fog: in the players' view, only the pins the DM shared.
        drawNotes(ctx, sharedOnly: playersView, scale: s)
        drawCellNumbers(ctx, visible, scale: s)
        guard let image = ctx.makeImage() else { return nil }
        return ImageImport.encode(image, png: true)
    }

    private func loadImage(_ src: String) -> CGImage? {
        guard AssetReference.isPackageAsset(src) else { return nil }
        let url = packageURL.appendingPathComponent(CampaignPackage.assetsDirectoryName).appendingPathComponent(src)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, nil)
    }

    /// Draws `image` upright into `rect` of the y-down context.
    private func draw(_ image: CGImage, in rect: CGRect, _ ctx: CGContext) {
        ctx.saveGState()
        ctx.translateBy(x: rect.minX, y: rect.maxY)
        ctx.scaleBy(x: 1, y: -1)
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: rect.width, height: rect.height))
        ctx.restoreGState()
    }

    private func drawBackground(_ ctx: CGContext) {
        guard let bg = map.background, let image = loadImage(bg.src) else { return }
        draw(image, in: CGRect(x: bg.x, y: bg.y, width: bg.width * bg.scale, height: bg.height * bg.scale), ctx)
    }

    private func color(_ hex: String, alpha: CGFloat = 1) -> CGColor {
        let rgb = parseHex(hex) ?? (0.5, 0.5, 0.5)
        return CGColor(srgbRed: rgb.0, green: rgb.1, blue: rgb.2, alpha: alpha)
    }

    private func drawGrid(_ ctx: CGContext, _ visible: CGRect) {
        guard map.gridType != .hidden else { return }
        let g = map.gridSize
        ctx.setStrokeColor(map.background == nil ? CGColor(gray: 0.45, alpha: 0.6) : color(map.gridColor, alpha: 0.45))
        ctx.setLineWidth(max(1, g * 0.02))
        switch map.gridType {
        case .lines, .dots, .hidden:
            var x = (visible.minX / g).rounded(.down) * g
            while x <= visible.maxX {
                ctx.move(to: CGPoint(x: x, y: visible.minY))
                ctx.addLine(to: CGPoint(x: x, y: visible.maxY))
                x += g
            }
            var y = (visible.minY / g).rounded(.down) * g
            while y <= visible.maxY {
                ctx.move(to: CGPoint(x: visible.minX, y: y))
                ctx.addLine(to: CGPoint(x: visible.maxX, y: y))
                y += g
            }
        case .hexagonal, .isometric:
            let geometry = makeGridGeometry(map.gridType, cellSize: g)
            let cells = geometry.visibleCells(
                in: Bounds(x: visible.minX, y: visible.minY, width: visible.width, height: visible.height))
            for cell in cells.prefix(20000) {
                let vertices = geometry.cellVertices(cell)
                guard let first = vertices.first else { continue }
                ctx.move(to: CGPoint(x: first.x, y: first.y))
                for v in vertices.dropFirst() { ctx.addLine(to: CGPoint(x: v.x, y: v.y)) }
                ctx.closePath()
            }
        }
        ctx.strokePath()
    }

    private func path(_ points: [Point2D], _ ctx: CGContext) {
        guard let first = points.first else { return }
        ctx.move(to: CGPoint(x: first.x, y: first.y))
        for p in points.dropFirst() { ctx.addLine(to: CGPoint(x: p.x, y: p.y)) }
    }

    private func drawMarkers(_ ctx: CGContext) {
        ctx.setLineCap(.round)
        ctx.setLineJoin(.round)
        for d in map.drawings where d.tool == .marker {
            ctx.setStrokeColor(color(d.color))
            ctx.setLineWidth(d.size * (d.scale ?? 1))
            path(d.worldPoints, ctx)
            ctx.strokePath()
        }
    }

    private func drawWalls(_ ctx: CGContext) {
        let g = map.gridSize
        ctx.setLineCap(.round)
        ctx.setLineJoin(.round)
        for d in map.drawings where d.tool == .wall {
            let points = d.worldPoints
            let window = (d.wallKind ?? .wall) == .window
            let oneWay = d.oneWay ?? false
            ctx.saveGState()
            if window {
                ctx.setStrokeColor(CGColor(srgbRed: 0.35, green: 0.65, blue: 1, alpha: 1))
                ctx.setLineDash(phase: 0, lengths: [g * 0.2, g * 0.12])
            } else if oneWay {
                ctx.setStrokeColor(CGColor(srgbRed: 1, green: 0.6, blue: 0.1, alpha: 1))
            } else {
                ctx.setStrokeColor(CGColor(srgbRed: 0.95, green: 0.2, blue: 0.18, alpha: 1))
            }
            ctx.setLineWidth(max(3, g * 0.1))
            path(points, ctx)
            ctx.strokePath()
            ctx.restoreGState()
            guard oneWay, points.count >= 2 else { continue }
            // A tick on the left of each segment (as drawn): the side sight passes from.
            ctx.setStrokeColor(CGColor(srgbRed: 1, green: 0.6, blue: 0.1, alpha: 1))
            ctx.setLineWidth(max(2, g * 0.05))
            for i in 1..<points.count {
                let a = points[i - 1]
                let b = points[i]
                let length = hypot(b.x - a.x, b.y - a.y)
                guard length > 0 else { continue }
                let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
                // Screen-left of a→b with y down is (dy, -dx).
                let nx = (b.y - a.y) / length
                let ny = -(b.x - a.x) / length
                ctx.move(to: mid)
                ctx.addLine(to: CGPoint(x: mid.x + nx * g * 0.3, y: mid.y + ny * g * 0.3))
                ctx.strokePath()
            }
        }
    }

    /// Shut hidden doors are drawn as wall (red) in the players' view and as purple dashed
    /// bars otherwise.
    private func drawDoors(_ ctx: CGContext, playersView: Bool) {
        for door in map.doors {
            let (hinge, latch) = door.ends
            let thickness = door.thickness ?? max(6, map.gridSize * 0.18)
            ctx.saveGState()
            ctx.setLineCap(.butt)
            if door.looksLikeWall && playersView {
                ctx.setStrokeColor(CGColor(srgbRed: 0.95, green: 0.2, blue: 0.18, alpha: 1))
                ctx.setLineWidth(max(3, map.gridSize * 0.1))
                ctx.setLineCap(.round)
            } else if door.looksLikeWall {
                ctx.setStrokeColor(CGColor(srgbRed: 0.6, green: 0.35, blue: 0.85, alpha: 1))
                ctx.setLineWidth(thickness)
                ctx.setLineDash(phase: 0, lengths: [thickness * 0.6, thickness * 0.4])
            } else if door.isOpen {
                ctx.setStrokeColor(CGColor(srgbRed: 0.3, green: 0.85, blue: 0.4, alpha: 1))
                ctx.setLineWidth(max(2, thickness * 0.3))
                ctx.setLineDash(phase: 0, lengths: [thickness * 0.6, thickness * 0.4])
            } else {
                ctx.setStrokeColor(CGColor(srgbRed: 0.55, green: 0.36, blue: 0.2, alpha: 1))
                ctx.setLineWidth(thickness)
            }
            path([hinge, latch], ctx)
            ctx.strokePath()
            ctx.restoreGState()
            if door.isLocked, !(playersView && door.looksLikeWall) {
                let r = max(3, map.gridSize * 0.09)
                ctx.setFillColor(CGColor(srgbRed: 1, green: 0.82, blue: 0.2, alpha: 1))
                ctx.fillEllipse(in: CGRect(x: door.x - r, y: door.y - r, width: 2 * r, height: 2 * r))
            }
        }
    }

    private func drawStairs(_ ctx: CGContext) {
        for s in map.stairs {
            let rect = CGRect(x: s.x - s.width / 2, y: s.y - s.height / 2, width: s.width, height: s.height)
            ctx.setFillColor(CGColor(gray: 0.85, alpha: 0.85))
            ctx.fill(rect)
            ctx.setStrokeColor(CGColor(gray: 0.2, alpha: 1))
            ctx.setLineWidth(max(1, map.gridSize * 0.03))
            let steps = 5
            for i in 1..<steps {
                let t = CGFloat(i) / CGFloat(steps)
                if s.direction == .north || s.direction == .south {
                    ctx.move(to: CGPoint(x: rect.minX, y: rect.minY + rect.height * t))
                    ctx.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * t))
                } else {
                    ctx.move(to: CGPoint(x: rect.minX + rect.width * t, y: rect.minY))
                    ctx.addLine(to: CGPoint(x: rect.minX + rect.width * t, y: rect.maxY))
                }
            }
            ctx.strokePath()
            ctx.stroke(rect)
        }
    }

    private func drawTokens(_ ctx: CGContext, hidden: Set<String>, scale: Double) {
        for token in map.tokens where !hidden.contains(token.id) {
            let resolved = ResolvedToken(token, library: library)
            let b = map.tokenDisplayBounds(token, library: library)
            let rect = CGRect(x: b.x, y: b.y, width: b.width, height: b.height).insetBy(dx: b.width * 0.04, dy: b.height * 0.04)
            if let image = loadImage(token.src) {
                ctx.saveGState()
                ctx.addEllipse(in: rect)
                ctx.clip()
                draw(image, in: rect, ctx)
                ctx.restoreGState()
            } else {
                ctx.setFillColor(color(resolved.type == .pc ? "#3373d9" : resolved.type == .npc ? "#c7403a" : "#6b737f"))
                ctx.fillEllipse(in: rect)
            }
            ctx.setStrokeColor(
                resolved.type == .pc
                    ? CGColor(srgbRed: 0.3, green: 0.6, blue: 1, alpha: 1)
                    : resolved.type == .npc ? CGColor(srgbRed: 1, green: 0.35, blue: 0.3, alpha: 1) : CGColor(gray: 0.9, alpha: 1))
            ctx.setLineWidth(max(2, b.width * 0.06))
            ctx.strokeEllipse(in: rect)
            // Names stay readable whatever the zoom: about 13 image pixels tall.
            let size = CGFloat(13 / scale)
            drawText(
                resolved.name, in: ctx, centre: CGPoint(x: rect.midX, y: rect.maxY + size * 0.9), size: size,
                color: CGColor(gray: 1, alpha: 1), flipped: true, outline: CGColor(gray: 0, alpha: 0.85))
        }
    }

    /// Lights in the DM's view: a dot, with rings at the bright and dim radii.
    private func drawLights(_ ctx: CGContext) {
        for light in map.lights {
            let ftToPx = map.gridSize / 5
            let alpha: CGFloat = light.isOn ? 1 : 0.35
            ctx.setStrokeColor(CGColor(srgbRed: 1, green: 0.8, blue: 0.25, alpha: 0.7 * alpha))
            ctx.setLineWidth(max(1.5, map.gridSize * 0.04))
            for radius in [light.bright * ftToPx, light.dim * ftToPx] where radius > 0 {
                ctx.saveGState()
                if radius == light.dim * ftToPx { ctx.setLineDash(phase: 0, lengths: [map.gridSize * 0.2, map.gridSize * 0.15]) }
                ctx.strokeEllipse(in: CGRect(x: light.x - radius, y: light.y - radius, width: 2 * radius, height: 2 * radius))
                ctx.restoreGState()
            }
            let r = max(4, map.gridSize * 0.15)
            ctx.setFillColor(CGColor(srgbRed: 1, green: 0.82, blue: 0.3, alpha: alpha))
            ctx.fillEllipse(in: CGRect(x: light.x - r, y: light.y - r, width: 2 * r, height: 2 * r))
        }
    }

    /// Spell effects: the area in its tint, a solid edge (dashed when hidden from players) and its label.
    private func drawEffects(_ ctx: CGContext, playersView: Bool, hiddenTokens: Set<String>, scale: Double) {
        for effect in map.effects {
            if playersView, effect.isHidden || (effect.tokenID.map(hiddenTokens.contains) ?? false) { continue }
            let origin = map.effectOrigin(effect, library: library)
            let points = effect.polygon(origin: origin, gridSize: map.gridSize)
            guard let first = points.first else { continue }
            let (r, g, b) = rgb(effect.tint)
            let path = CGMutablePath()
            path.move(to: CGPoint(x: first.x, y: first.y))
            for p in points.dropFirst() { path.addLine(to: CGPoint(x: p.x, y: p.y)) }
            path.closeSubpath()
            ctx.saveGState()
            ctx.addPath(path)
            ctx.setFillColor(CGColor(srgbRed: r, green: g, blue: b, alpha: 0.35))
            ctx.fillPath()
            ctx.addPath(path)
            ctx.setStrokeColor(CGColor(srgbRed: r, green: g, blue: b, alpha: 1))
            ctx.setLineWidth(max(2, map.gridSize * 0.05))
            if effect.isHidden { ctx.setLineDash(phase: 0, lengths: [map.gridSize * 0.2, map.gridSize * 0.12]) }
            ctx.strokePath()
            ctx.restoreGState()
            let at = effect.labelPoint(origin: origin, gridSize: map.gridSize)
            drawText(
                effect.displayLabel, in: ctx, centre: CGPoint(x: at.x, y: at.y), size: CGFloat(12 / scale),
                color: CGColor(gray: 1, alpha: 1), flipped: true, outline: CGColor(gray: 0, alpha: 0.85))
        }
    }

    /// `#rgb` or `#rrggbb` as sRGB components; grey when unreadable.
    private func rgb(_ hex: String) -> (CGFloat, CGFloat, CGFloat) {
        var digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        if digits.count == 3 { digits = digits.map { "\($0)\($0)" }.joined() }
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return (0.6, 0.6, 0.6) }
        return (
            CGFloat((value >> 16) & 0xff) / 255, CGFloat((value >> 8) & 0xff) / 255, CGFloat(value & 0xff) / 255
        )
    }

    /// Note pins: a white square with a dark edge, dashed for DM-only notes, and the title.
    private func drawNotes(_ ctx: CGContext, sharedOnly: Bool, scale: Double) {
        for note in map.notes where !sharedOnly || note.isShared {
            let r = max(5, map.gridSize * 0.18)
            let rect = CGRect(x: note.x - r, y: note.y - r, width: 2 * r, height: 2 * r)
            ctx.setFillColor(CGColor(gray: 1, alpha: 1))
            ctx.fill(rect)
            ctx.saveGState()
            ctx.setStrokeColor(CGColor(gray: 0.1, alpha: 1))
            ctx.setLineWidth(max(1.5, map.gridSize * 0.04))
            if !note.isShared { ctx.setLineDash(phase: 0, lengths: [r * 0.4, r * 0.25]) }
            ctx.stroke(rect)
            ctx.restoreGState()
            let size = CGFloat(12 / scale)
            drawText(
                note.displayTitle, in: ctx, centre: CGPoint(x: rect.midX, y: rect.maxY + size * 0.9), size: size,
                color: CGColor(gray: 1, alpha: 1), flipped: true, outline: CGColor(gray: 0, alpha: 0.85))
        }
    }

    /// The players' view with lighting on, sampled on a fine grid: black where no PC sees,
    /// dimmed where they see dim light, clear where it is bright to them.
    private func drawLitFog(_ ctx: CGContext, _ visible: CGRect, sight: PartySight) {
        let step = max(visible.width, visible.height) / 200
        let explored = map.exploredRegions.map(\.points)
        var y = visible.minY
        while y < visible.maxY {
            var x = visible.minX
            while x < visible.maxX {
                let p = Point2D(x: x + step / 2, y: y + step / 2)
                let alpha: CGFloat
                switch sight.perceived(at: p) {
                case .bright?: alpha = 0
                case .dim?: alpha = 0.4
                default: alpha = LineOfSight.containsInAny(explored, p) ? 0.7 : 0.92
                }
                if alpha > 0 {
                    ctx.setFillColor(CGColor(gray: 0, alpha: alpha))
                    ctx.fill(CGRect(x: x, y: y, width: step + 0.5, height: step + 0.5))
                }
                x += step
            }
            y += step
        }
    }

    private func drawFog(_ ctx: CGContext, _ visible: CGRect, polygons: [[Point2D]]) {
        // Explored areas at half darkness, never-seen areas nearly black, current sight clear.
        ctx.saveGState()
        ctx.addRect(visible)
        for polygon in polygons { path(polygon, ctx); ctx.closePath() }
        for region in map.exploredRegions { path(region.points, ctx); ctx.closePath() }
        ctx.setFillColor(CGColor(gray: 0, alpha: 0.92))
        ctx.fillPath(using: .evenOdd)
        ctx.restoreGState()
        guard !map.exploredRegions.isEmpty else { return }
        ctx.saveGState()
        for region in map.exploredRegions { path(region.points, ctx); ctx.closePath() }
        for polygon in polygons { path(polygon, ctx); ctx.closePath() }
        ctx.setFillColor(CGColor(gray: 0, alpha: 0.5))
        ctx.fillPath(using: .evenOdd)
        ctx.restoreGState()
    }

    private func drawCellNumbers(_ ctx: CGContext, _ visible: CGRect, scale: Double) {
        let g = map.gridSize
        let size = CGFloat(11 / scale)
        let white = CGColor(gray: 1, alpha: 0.95)
        let black = CGColor(gray: 0, alpha: 0.9)
        var cx = Int((visible.minX / g).rounded(.up))
        while Double(cx) * g <= visible.maxX {
            if cx % 5 == 0 {
                drawText(
                    "\(cx)", in: ctx, centre: CGPoint(x: Double(cx) * g, y: visible.minY + size), size: size,
                    color: white, flipped: true, outline: black)
            }
            cx += 1
        }
        var cy = Int((visible.minY / g).rounded(.up))
        while Double(cy) * g <= visible.maxY {
            if cy % 5 == 0 {
                drawText(
                    "\(cy)", in: ctx, centre: CGPoint(x: visible.minX + size * 1.2, y: Double(cy) * g), size: size,
                    color: white, flipped: true, outline: black)
            }
            cy += 1
        }
    }
}
