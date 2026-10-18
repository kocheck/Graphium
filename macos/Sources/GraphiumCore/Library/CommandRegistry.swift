import Foundation

/// Command palette entries (TS `commandRegistry.ts`, CORE_SPEC §3.15). The app maps
/// `id` to an action; labels, keywords and shortcut hints match TS.
public struct PaletteCommand: Equatable, Identifiable, Sendable {
    public enum Category: String, Sendable {
        case tool = "Tool"
        case worldView = "World View"
        case generation = "Generation"
        case system = "System"
    }

    public var id: String
    public var label: String
    public var category: Category
    public var keywords: [String]
    public var shortcut: String?

    public static func registry(isPaused: Bool) -> [PaletteCommand] {
        [
            .init(id: "tool-select", label: "Select Tool", category: .tool, keywords: ["select", "cursor", "move", "tool", "v"], shortcut: "V"),
            .init(id: "tool-marker", label: "Marker Tool", category: .tool, keywords: ["marker", "draw", "pen", "brush", "tool", "m"], shortcut: "M"),
            .init(id: "tool-eraser", label: "Eraser Tool", category: .tool, keywords: ["eraser", "erase", "remove", "tool", "e"], shortcut: "E"),
            .init(id: "tool-wall", label: "Wall Tool", category: .tool, keywords: ["wall", "barrier", "draw", "tool", "w"], shortcut: "W"),
            .init(id: "tool-door", label: "Door Tool", category: .tool, keywords: ["door", "entrance", "tool", "d"], shortcut: "D"),
            .init(id: "tool-stairs", label: "Stairs Tool", category: .tool, keywords: ["stairs", "staircase", "steps", "floor", "level", "ladder", "link", "teleport", "tool", "t"], shortcut: "T"),
            .init(id: "tool-light", label: "Light Tool", category: .tool, keywords: ["light", "torch", "lantern", "lamp", "candle", "tool", "l"], shortcut: "L"),
            .init(id: "tool-note", label: "Note Tool", category: .tool, keywords: ["note", "pin", "notes", "handout", "read-aloud", "clue", "tool", "n"], shortcut: "N"),
            .init(id: "tool-effect", label: "Spell Effect Tool", category: .tool, keywords: ["spell", "effect", "aoe", "area", "fireball", "cone", "circle", "line", "cube", "template", "tool", "s"], shortcut: "S"),
            .init(id: "tool-reveal", label: "Reveal Tool", category: .tool, keywords: ["reveal", "fog", "show", "uncover", "hide", "minis", "miniatures", "tool", "f"], shortcut: "F"),
            .init(id: "tool-measure", label: "Measure Tool", category: .tool, keywords: ["measure", "ruler", "distance", "aoe", "blast", "cone", "tool", "r"], shortcut: "R"),
            .init(
                id: "world-view-toggle-pause", label: isPaused ? "Resume World View (Play)" : "Pause World View",
                category: .worldView, keywords: ["pause", "play", "resume", "world", "view", "players", "loading"], shortcut: "⇧⌘P"),
            .init(
                id: "world-view-show-this-view", label: "Show This View on World View", category: .worldView,
                keywords: ["world", "view", "show", "players", "tv", "projector", "frame", "send", "here", "sync", "camera"], shortcut: "⇧⌘Y"),
            .init(id: "world-view-launch", label: "Launch World View Window", category: .worldView, keywords: ["world", "view", "projector", "player", "window", "launch", "open"], shortcut: "⇧⌘W"),
            .init(id: "fog-reset", label: "Reset Explored Fog", category: .worldView, keywords: ["fog", "explored", "seen", "reset", "forget", "party", "vision", "clear"]),
            .init(id: "dungeon-generate", label: "Generate Dungeon", category: .generation, keywords: ["dungeon", "generator", "generate", "random", "map", "create"]),
            .init(id: "session-console-stop", label: "Session Console: Stop", category: .worldView, keywords: ["session", "console", "stop", "audio", "escape"], shortcut: "Esc"),
            .init(id: "session-console-duck", label: "Session Console: Duck", category: .worldView, keywords: ["session", "console", "duck", "volume"], shortcut: "D (Console)"),
            .init(id: "session-console-return-to-map", label: "Session Console: Return to Map", category: .worldView, keywords: ["session", "console", "map", "plate", "stage"]),
            .init(id: "session-console-test-tone", label: "Session Console: Test Tone", category: .worldView, keywords: ["session", "console", "test", "tone", "sfx"]),
            .init(id: "session-console-settings", label: "Session Console: Settings", category: .worldView, keywords: ["session", "console", "settings", "pack", "stage"]),
        ]
    }

    /// TS `scoreText`: equal 100, starts-with 40, contains 20, subsequence 10.
    static func scoreText(_ text: String, _ query: String) -> Int {
        let t = text.lowercased()
        let q = query.lowercased()
        if t == q { return 100 }
        if t.hasPrefix(q) { return 40 }
        if t.contains(q) { return 20 }
        var i = q.startIndex
        for c in t where i < q.endIndex && c == q[i] { i = q.index(after: i) }
        return i == q.endIndex ? 10 : 0
    }

    /// TS `searchCommands`: label ×3, category ×1, keywords ×2; "actions" prefixes boost all.
    public static func search(_ commands: [PaletteCommand], query: String) -> [PaletteCommand] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return commands }
        let lq = q.lowercased()
        let isSection = "actions".hasPrefix(lq)
        return commands.enumerated().compactMap { index, command -> (PaletteCommand, Int, Int)? in
            if isSection && lq == "actions" { return (command, 100, index) }
            var score = isSection ? 50 : 0
            score += 3 * scoreText(command.label, q) + scoreText(command.category.rawValue, q)
            for keyword in command.keywords { score += 2 * scoreText(keyword, q) }
            return score > 0 ? (command, score, index) : nil
        }
        .sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.2 < $1.2 }
        .map { $0.0 }
    }
}

/// Keyboard highlight in the command palette's flattened results (TS `CommandPalette`
/// `selectedIndex`). Section headers aren't rows here, so no skipping is needed.
public enum PaletteHighlight {
    /// Moves `index` by `delta`, clamped to the rows (no wrap, as in TS). A missing
    /// index starts at the first row; no rows gives nil.
    public static func step(_ index: Int?, by delta: Int, count: Int) -> Int? {
        guard count > 0 else { return nil }
        guard let index else { return 0 }
        return min(max(index + delta, 0), count - 1)
    }
}
