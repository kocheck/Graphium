import AppKit
import GraphiumCore

/// Architect tools (PARITY §2.2). Keys follow TS: V, M, E, W, D, R.
enum CanvasTool: String, CaseIterable, Identifiable {
    case select, marker, eraser, wall, door, measure

    var id: Self { self }

    var title: String {
        switch self {
        case .select: return "Select"
        case .marker: return "Marker"
        case .eraser: return "Eraser"
        case .wall: return "Wall"
        case .door: return "Door"
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
        case .measure: return "r"
        }
    }

    var help: String {
        switch self {
        case .door: return "Door (D) — Arrow keys or R to rotate"
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
    var measureMode: MeasurementShape.Mode = .ruler
    var pressureCurve: PressureCurve = .normal
    var pressureEnabled = true
}

/// Right-click actions on a door (PARITY §3.6).
enum DoorAction {
    case toggle, lock, unlock, delete
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
