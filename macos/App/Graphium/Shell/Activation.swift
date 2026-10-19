import Foundation
import GraphiumCore

/// First success (docs/qa/LAUNCH_QA.md): the players see the DM's map with a PC on it. Logged once
/// per launch, to the unified log and `~/Library/Logs/Graphium` only, so the persona scripts and
/// think-aloud sessions can time it. Nothing is sent anywhere.
@MainActor
enum Activation {
    /// Set by the app delegate as the app starts.
    static var launchedAt = Date()
    private static var logged = false

    /// Unpaused, the map has art (an image, a video or walls) and a PC on it can see.
    static func reached(_ map: GameMap, library: [String: TokenLibraryItem], paused: Bool) -> Bool {
        guard !paused else { return false }
        let hasArt = map.background != nil || map.drawings.contains { $0.tool == .wall }
        return hasArt && map.hasSightedPC(library: library)
    }

    static func logOnce() {
        guard !logged else { return }
        logged = true
        let seconds = Date().timeIntervalSince(launchedAt)
        Diagnostics.log(
            .info, "activation: players see the map with a PC, \(String(format: "%.1f", seconds)) s after launch",
            category: "qa")
    }
}
