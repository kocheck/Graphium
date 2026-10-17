import AppKit
import GraphiumCore

/// The sidebar's Generic Token (PARITY §3.4): a placeholder NPC for when no art is
/// handy. TS draws a theme-coloured SVG; here it is a neutral PNG stored once per campaign.
enum GenericToken {
    /// Pseudo library id, so it drags through the same path as library items.
    static let id = "generic-token"
    static let name = "Generic Token"
    static let assetName = LegacyImporter.genericTokenAssetName
    static var dragPayload: String { LibraryDrag.prefix + id }

    @MainActor
    static func pngData() -> Data? {
        let side = 256
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil, pixelsWide: side, pixelsHigh: side, bitsPerSample: 8, samplesPerPixel: 4,
            hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)
        else { return nil }
        NSGraphicsContext.saveGraphicsState()
        defer { NSGraphicsContext.restoreGraphicsState() }
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        let bounds = NSRect(x: 0, y: 0, width: side, height: side)
        NSColor(srgbRed: 0.42, green: 0.45, blue: 0.5, alpha: 1).setFill()
        NSBezierPath(ovalIn: bounds.insetBy(dx: 8, dy: 8)).fill()
        NSColor.white.withAlphaComponent(0.9).setStroke()
        let ring = NSBezierPath(ovalIn: bounds.insetBy(dx: 14, dy: 14))
        ring.lineWidth = 6
        ring.stroke()
        let config = NSImage.SymbolConfiguration(pointSize: 120, weight: .semibold)
            .applying(NSImage.SymbolConfiguration(paletteColors: [.white]))
        if let symbol = NSImage(systemSymbolName: "person.fill", accessibilityDescription: nil)?
            .withSymbolConfiguration(config)
        {
            let size = symbol.size
            symbol.draw(in: NSRect(
                x: (CGFloat(side) - size.width) / 2, y: (CGFloat(side) - size.height) / 2,
                width: size.width, height: size.height))
        }
        return rep.representation(using: .png, properties: [:])
    }
}

extension CampaignDocument {
    /// Places a Generic Token (NPC) centred on `point`, or at the map centre. Returns its id.
    @MainActor
    func placeGenericToken(centredAt point: Point2D?, undoManager: UndoManager?) -> String? {
        let src: String
        if assets[GenericToken.assetName] != nil {
            src = GenericToken.assetName
        } else {
            guard let png = GenericToken.pngData() else { return nil }
            src = addAsset(png, preferredName: GenericToken.assetName)
        }
        let map = campaign.activeMap
        let size = map.gridSize
        let topLeft = point.map { Point2D(x: $0.x - size / 2, y: $0.y - size / 2) } ?? map.centrePlacementPoint
        let snapped = snapToGrid(topLeft, gridSize: size, gridType: map.gridType, width: size, height: size)
        let token = Token(x: snapped.x, y: snapped.y, src: src, type: .npc, name: GenericToken.name)
        edit("Add Generic Token", undoManager: undoManager) { $0.activeMap.tokens.append(token) }
        return token.id
    }
}
