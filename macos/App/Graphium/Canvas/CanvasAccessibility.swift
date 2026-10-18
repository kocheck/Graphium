import AppKit
import GraphiumCore

/// A token or door on the canvas, exposed to VoiceOver (PARITY §7: the TS canvas
/// had no accessibility; the native app adds it). Press selects a token or toggles a door.
final class CanvasAccessibilityElement: NSAccessibilityElement {
    var onPress: (() -> Void)?

    override func accessibilityPerformPress() -> Bool {
        guard let onPress else { return false }
        onPress()
        return true
    }
}

extension MapCanvasNSView {
    var canvasAccessibilityLabel: String {
        guard let map else { return "Map" }
        return isPlayerView ? "World View map: \(map.name)" : "Map canvas: \(map.name)"
    }

    var canvasAccessibilityChildren: [CanvasAccessibilityElement] {
        guard let map else { return [] }
        var elements: [CanvasAccessibilityElement] = []
        for token in map.tokens where !hiddenTokenIDs.contains(token.id) {
            let resolved = ResolvedToken(token, library: library)
            let kind = resolved.type == .pc ? "PC" : resolved.type == .npc ? "NPC" : "token"
            // Players hear the name they would see, or just the kind (decision 014).
            let name = isPlayerView ? resolved.playerName.map { "\($0), " } ?? "" : "\(resolved.name), "
            let element = makeElement(
                label: "\(name)\(kind)\(selection.contains(token.id) ? ", selected" : "")",
                bounds: map.tokenDisplayBounds(token, library: library))
            // Hit points and conditions are the DM's alone (issue #369).
            if !isPlayerView, let state = tokenStateDescription(token) { element.setAccessibilityValue(state) }
            if let editing {
                let id = token.id
                element.onPress = { editing.setSelection([id]) }
            }
            elements.append(element)
        }
        // Players reach only the doors the World View draws: none that look like wall, and
        // none still in unexplored fog.
        let known = isPlayerView ? fog.map { knownDoorIDs(map.doors, fog: $0) } : nil
        for door in map.doors {
            if isPlayerView, door.looksLikeWall || !(known?.contains(door.id) ?? true) { continue }
            let state = door.isLocked ? "locked" : door.isOpen ? "open" : "closed"
            let hidden = !isPlayerView && door.isHidden == true ? ", hidden from players" : ""
            let element = makeElement(label: "Door, \(state)\(hidden)", bounds: door.bounds(padding: 6))
            if !isPlayerView, let doorAction = editing?.doorAction, !door.isLocked {
                let id = door.id
                element.onPress = { doorAction(id, .toggle) }
            }
            elements.append(element)
        }
        // Players reach only the shared pins, and only their player notes.
        for note in map.notes where !isPlayerView || note.isShared {
            let r = (isPlayerView ? Self.worldNoteMarkerRadius : Self.noteMarkerRadius) / viewport.zoom
            let sharing = isPlayerView ? "" : note.isShared ? ", shown to players" : ", DM only"
            let element = makeElement(
                label: "Note: \(note.displayTitle)\(sharing)\(selection.contains(note.id) ? ", selected" : "")",
                bounds: Bounds(x: note.x - r, y: note.y - r, width: 2 * r, height: 2 * r))
            let id = note.id
            if isPlayerView, let openNote = editing?.openNote {
                element.onPress = { openNote(id) }
            } else if !isPlayerView, let editing {
                element.onPress = { editing.setSelection([id]) }
            }
            elements.append(element)
        }
        // Spell areas: players reach only the ones drawn for them.
        for effect in map.effects {
            if isPlayerView, effect.isHidden || (effect.tokenID.map(hiddenTokenIDs.contains) ?? false) { continue }
            let points = map.effectPolygon(effect, library: library)
            guard let minX = points.map(\.x).min(), let maxX = points.map(\.x).max(), let minY = points.map(\.y).min(),
                let maxY = points.map(\.y).max()
            else { continue }
            let what = effect.label.isEmpty ? effect.sizeDescription : "\(effect.label), \(effect.sizeDescription)"
            let hidden = !isPlayerView && effect.isHidden ? ", hidden from players" : ""
            let element = makeElement(
                label: "Spell effect: \(what), \(effect.look.title)\(hidden)\(selection.contains(effect.id) ? ", selected" : "")",
                bounds: Bounds(x: minX, y: minY, width: maxX - minX, height: maxY - minY))
            if !isPlayerView, let editing {
                let id = effect.id
                element.onPress = { editing.setSelection([id]) }
            }
            elements.append(element)
        }
        if !isPlayerView {
            // Lights are the DM's alone; players only see their effect.
            for light in map.lights {
                let r = Self.lightMarkerRadius / viewport.zoom
                let element = makeElement(
                    label: "\(light.name ?? "Light"), \(light.isOn ? "on" : "off")",
                    bounds: Bounds(x: light.x - r, y: light.y - r, width: 2 * r, height: 2 * r))
                if let editing {
                    let id = light.id
                    element.onPress = { editing.setSelection([id]) }
                }
                elements.append(element)
            }
            // Stairs are under the fog on the World View, so only the DM reaches them here.
            let labels = map.stairsLabels
            for s in map.stairs {
                let pair = labels[s.id].map { ", pair \($0)" } ?? ", not linked"
                let element = makeElement(
                    label: "Stairs \(s.type.rawValue)\(pair)\(selection.contains(s.id) ? ", selected" : "")",
                    bounds: s.bounds)
                if let editing {
                    let id = s.id
                    element.onPress = { editing.setSelection([id]) }
                }
                elements.append(element)
            }
        }
        return elements
    }

    /// "Down, 0 of 7 hit points, Prone, Poisoned", or nil when nothing is tracked.
    private func tokenStateDescription(_ token: Token) -> String? {
        var parts: [String] = []
        if token.isDown { parts.append("Down") }
        switch (token.hitPoints, token.maxHitPoints) {
        case (let current?, let maximum?): parts.append("\(current) of \(maximum) hit points")
        case (let current?, nil): parts.append("\(current) hit points")
        case (nil, let maximum?): parts.append("\(maximum) maximum hit points")
        case (nil, nil): break
        }
        parts += (token.conditions ?? []).map(\.title)
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    private func makeElement(label: String, bounds: Bounds) -> CanvasAccessibilityElement {
        let element = CanvasAccessibilityElement()
        element.setAccessibilityParent(self)
        element.setAccessibilityRole(.button)
        element.setAccessibilityLabel(label)
        let origin = viewport.viewPoint(fromMap: Point2D(x: bounds.x, y: bounds.y))
        let rect = NSRect(x: origin.x, y: origin.y, width: bounds.width * viewport.zoom, height: bounds.height * viewport.zoom)
        if let window {
            element.setAccessibilityFrame(window.convertToScreen(convert(rect, to: nil)))
        }
        return element
    }
}
