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
            let element = makeElement(
                label: "\(resolved.name), \(kind)\(selection.contains(token.id) ? ", selected" : "")",
                bounds: map.tokenDisplayBounds(token, library: library))
            if let editing {
                let id = token.id
                element.onPress = { editing.setSelection([id]) }
            }
            elements.append(element)
        }
        for door in map.doors {
            let state = door.isLocked ? "locked" : door.isOpen ? "open" : "closed"
            let element = makeElement(label: "Door, \(state)", bounds: door.bounds(padding: 6))
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
        }
        return elements
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
