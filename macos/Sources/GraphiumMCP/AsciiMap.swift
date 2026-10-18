import Foundation
import GraphiumCore

/// A text picture of a map at half-cell resolution: odd columns and rows are cell
/// centres, even ones are grid lines. So a wall on a grid line sits between cells, as
/// it does on the map, and a model can read positions straight off the picture.
struct AsciiMap {
    static let maxCells = 100

    var map: GameMap
    var library: [String: TokenLibraryItem]

    func render(region: Bounds?) -> String {
        let g = map.gridSize
        let area: Bounds
        if let region, region.width > 0, region.height > 0 {
            area = region
        } else if let b = map.contentBounds(library: library) {
            area = b
        } else {
            area = Bounds(x: 0, y: 0, width: 20 * g, height: 15 * g)
        }
        let x0 = Int((area.x / g).rounded(.down))
        let y0 = Int((area.y / g).rounded(.down))
        var cols = Int(((area.x + area.width) / g).rounded(.up)) - x0
        var rows = Int(((area.y + area.height) / g).rounded(.up)) - y0
        var note = ""
        if cols > Self.maxCells || rows > Self.maxCells {
            note = "\n(Cropped to \(Self.maxCells)×\(Self.maxCells) cells; pass region to see the rest.)"
            cols = min(cols, Self.maxCells)
            rows = min(rows, Self.maxCells)
        }
        cols = max(cols, 1)
        rows = max(rows, 1)
        let width = cols * 2 + 1
        let height = rows * 2 + 1
        var grid = Array(repeating: Array(repeating: Character(" "), count: width), count: height)
        for r in 0..<rows { for c in 0..<cols { grid[r * 2 + 1][c * 2 + 1] = "." } }

        /// Map pixels → half-cell character coordinates.
        func charPoint(_ p: Point2D) -> (Double, Double) {
            ((p.x / g - Double(x0)) * 2, (p.y / g - Double(y0)) * 2)
        }
        func put(_ x: Int, _ y: Int, _ ch: Character, over: Set<Character> = [" ", "."]) {
            guard y >= 0, y < height, x >= 0, x < width, over.contains(grid[y][x]) || over.isEmpty else { return }
            grid[y][x] = ch
        }
        /// Lines merge: a horizontal and a vertical line meeting make a corner.
        func line(_ x: Int, _ y: Int, _ ch: Character) {
            guard y >= 0, y < height, x >= 0, x < width else { return }
            let existing = grid[y][x]
            switch existing {
            case " ", ".": grid[y][x] = ch
            case "+": break
            case ch: break
            default: grid[y][x] = ch == "+" || "-|~:".contains(existing) ? "+" : existing
            }
        }
        func stroke(_ a: Point2D, _ b: Point2D, window: Bool) {
            let (ax, ay) = charPoint(a)
            let (bx, by) = charPoint(b)
            let isHorizontal = abs(by - ay) < 1e-6
            let isVertical = abs(bx - ax) < 1e-6
            let steps = max(Int((max(abs(bx - ax), abs(by - ay)) * 3).rounded(.up)), 1)
            for i in 0...steps {
                let t = Double(i) / Double(steps)
                let x = Int((ax + (bx - ax) * t).rounded())
                let y = Int((ay + (by - ay) * t).rounded())
                let onCorner = x % 2 == 0 && y % 2 == 0
                let ch: Character
                if onCorner && (i == 0 || i == steps || !(isHorizontal || isVertical)) {
                    ch = "+"
                } else if isHorizontal || (!isVertical && y % 2 == 0 && !onCorner) {
                    ch = window ? "~" : "-"
                } else if isVertical || (x % 2 == 0 && !onCorner) {
                    ch = window ? ":" : "|"
                } else {
                    ch = window ? "~" : ((bx - ax) * (by - ay) > 0 ? "\\" : "/")
                }
                line(x, y, ch)
            }
        }

        for d in map.drawings where d.tool == .wall {
            let p = d.worldPoints
            guard p.count >= 2 else { continue }
            let window = (d.wallKind ?? .wall) == .window
            for i in 1..<p.count {
                stroke(p[i - 1], p[i], window: window)
            }
        }
        for s in map.stairs {
            let (x, y) = charPoint(Point2D(x: s.x, y: s.y))
            put(Int(x.rounded()), Int(y.rounded()), s.type == .up ? "<" : ">", over: [])
        }
        for light in map.lights {
            let (x, y) = charPoint(Point2D(x: light.x, y: light.y))
            put(Int(x.rounded()), Int(y.rounded()), light.isOn ? "*" : ",", over: [" ", "."])
        }
        for note in map.notes {
            let (x, y) = charPoint(Point2D(x: note.x, y: note.y))
            put(Int(x.rounded()), Int(y.rounded()), "!", over: [" ", "."])
        }
        for door in map.doors {
            let (x, y) = charPoint(Point2D(x: door.x, y: door.y))
            let ch: Character = door.looksLikeWall ? "S" : door.isLocked ? "L" : door.isOpen ? "o" : "D"
            put(Int(x.rounded()), Int(y.rounded()), ch, over: [])
        }

        // Tokens: a letter in every cell they cover; the legend says which.
        var legend: [String] = []
        let letters = Array("ABCDEFGHIJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz")
        for (n, token) in map.tokens.enumerated() {
            let resolved = ResolvedToken(token, library: library)
            let ch = n < letters.count ? letters[n] : "*"
            let b = map.tokenBounds(token, library: library)
            let c0 = Int((b.x / g).rounded()) - x0
            let r0 = Int((b.y / g).rounded()) - y0
            let span = max(Int((b.width / g).rounded()), 1)
            for dr in 0..<span {
                for dc in 0..<span { put((c0 + dc) * 2 + 1, (r0 + dr) * 2 + 1, ch, over: [".", " "]) }
            }
            let type = resolved.type?.rawValue ?? "token"
            legend.append(
                "\(ch) \(resolved.name) (\(type)\(resolved.visionRadius.map { ", vision \(Int($0)) ft" } ?? "")) "
                    + "at [\(fmt(b.x / g)), \(fmt(b.y / g))]")
        }

        var lines: [String] = []
        let pad = String(repeating: " ", count: 5)
        var tens = pad
        var ones = pad
        for x in 0..<width {
            if x % 2 == 1 {
                let c = x0 + (x - 1) / 2
                tens.append(c % 10 == 0 || x == 1 ? Character(String(abs(c / 10) % 10)) : " ")
                ones.append(Character(String(abs(c) % 10)))
            } else {
                tens.append(" ")
                ones.append(" ")
            }
        }
        lines.append(tens)
        lines.append(ones)
        for (y, row) in grid.enumerated() {
            let label = y % 2 == 1 ? String(y0 + (y - 1) / 2) : ""
            lines.append(String(repeating: " ", count: max(0, 4 - label.count)) + label + " " + String(row))
        }
        var text = """
            \(map.name): cells x \(x0)…\(x0 + cols), y \(y0)…\(y0 + rows). Each cell is two characters wide; \
            "." is a cell centre and the rows and columns between are grid lines.
            Legend: - | + walls, ~ : windows, \\ / diagonal walls, D closed door, o open door, L locked door, \
            S shut hidden door, < > stairs up/down, * light (, unlit), ! note pin, letters tokens.

            """
        text += lines.joined(separator: "\n")
        if !legend.isEmpty { text += "\n\nTokens (top-left cell):\n" + legend.joined(separator: "\n") }
        return text + note
    }

    private func fmt(_ v: Double) -> String {
        let r = (v * 100).rounded() / 100
        return r == r.rounded() ? String(Int(r)) : String(r)
    }
}
