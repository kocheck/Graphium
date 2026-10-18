import AppKit
import GraphiumCore

/// Architect tools (PARITY §2.2). Keys follow TS: V, M, E, W, D, R; L (Light), N (Note), S (Spell)
/// and F (Reveal fog) are native.
enum CanvasTool: String, CaseIterable, Identifiable {
    case select, marker, eraser, wall, door, light, note, effect, reveal, measure

    var id: Self { self }

    var title: String {
        switch self {
        case .select: return "Select"
        case .marker: return "Marker"
        case .eraser: return "Eraser"
        case .wall: return "Wall"
        case .door: return "Door"
        case .light: return "Light"
        case .note: return "Note"
        case .effect: return "Spell Effect"
        case .reveal: return "Reveal"
        case .measure: return "Measure"
        }
    }

    var symbol: String {
        switch self {
        case .select: return "cursorarrow"
        case .marker: return "pencil.tip"
        case .eraser: return "eraser"
        case .wall: return "line.diagonal"
        case .door: return "door.left.hand.closed"
        case .light: return "lightbulb"
        case .note: return "note.text"
        case .effect: return "sparkles"
        case .reveal: return "eye"
        case .measure: return "ruler"
        }
    }

    var key: Character {
        switch self {
        case .select: return "v"
        case .marker: return "m"
        case .eraser: return "e"
        case .wall: return "w"
        case .door: return "d"
        case .light: return "l"
        case .note: return "n"
        case .effect: return "s"
        case .reveal: return "f"
        case .measure: return "r"
        }
    }

    var help: String {
        switch self {
        case .door: return "Door (D) — click a door to select it; R or arrow keys rotate"
        case .note: return "Note (N) — pin a note to the map; click a pin to open it in the side panel"
        case .effect:
            return "Spell Effect (S) — drag out a spell's area; start on a token to have it carry the effect"
        case .reveal:
            return "Reveal (F) — drag over ground to show it to players without PC tokens; click a revealed area to hide it"
        default: return "\(title) (\(key.uppercased()))"
        }
    }

    static func forKey(_ key: Character) -> CanvasTool? {
        allCases.first { $0.key == key }
    }
}

/// Tool settings an editable canvas needs from its owner.
struct ToolState: Equatable {
    var tool: CanvasTool = .select
    var markerColor = StrokeDefaults.markerColor
    var doorOrientation: DoorOrientation = .horizontal
    /// What new walls are (PARITY §3.5 Native).
    var wallKind: WallKind = .wall
    var wallOneWay = false
    /// What the Light tool places (native).
    var lightPreset: LightPreset = .torch
    /// What the Spell Effect tool places (native).
    var effectShape: SpellEffect.Shape = .circle
    var effectLook: SpellEffect.Look = .fire
    var measureMode: MeasurementShape.Mode = .ruler
    var pressureCurve: PressureCurve = .normal
    var pressureEnabled = true
}

/// Right-click actions on lights (native).
enum LightAction {
    case on(Bool), preset(LightPreset), delete
}

/// Right-click actions on note pins (native).
enum NoteAction {
    case share(Bool), showOnWorldView, delete
}

/// Right-click actions on spell effects (native).
enum EffectAction {
    case hide(Bool), look(SpellEffect.Look), rotate(Double), detach, delete
}

/// Right-click actions on a door (PARITY §3.6).
enum DoorAction {
    case toggle, lock, unlock, hide, reveal, delete
}

extension WallKind {
    var title: String {
        switch self {
        case .wall: return "Wall"
        case .window: return "Window"
        }
    }
}

/// Right-click actions on a wall (PARITY §3.5 Native).
enum WallAction {
    case kind(WallKind), oneWay(Bool), flip, delete
}

/// Right-click actions on a marker stroke (decision 014).
enum MarkerAction {
    case dmOnly(Bool), delete
}

/// Lets an NSMenuItem run a closure.
final class MenuAction: NSObject {
    let run: () -> Void

    init(_ run: @escaping () -> Void) {
        self.run = run
    }

    @objc func perform(_ sender: Any?) {
        run()
    }

    static func item(_ title: String, enabled: Bool = true, _ run: @escaping () -> Void) -> NSMenuItem {
        let action = MenuAction(run)
        let item = NSMenuItem(title: title, action: #selector(MenuAction.perform(_:)), keyEquivalent: "")
        item.target = action
        item.representedObject = action  // keeps the target alive
        item.isEnabled = enabled
        return item
    }
}
