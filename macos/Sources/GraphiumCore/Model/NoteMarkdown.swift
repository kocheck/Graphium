import Foundation

/// The Markdown note pins are written in (native): plain text in `campaign.json` that any editor
/// reads, shown formatted in the inspector and on the World View. A deliberately small subset,
/// split into blocks here; inline styling (bold, italic, code, links) is Foundation's.
public enum NoteMarkdown {
    public enum Block: Equatable, Sendable {
        /// `#`, `##` or `###`; deeper levels read as `###`.
        case heading(level: Int, text: String)
        /// Consecutive lines, line breaks kept: DMs write room keys a line at a time.
        case paragraph(String)
        /// `-`, `*` or `+`, or `- [ ]` / `- [x]` (`checked` set). `depth` counts two-space indents.
        case bullet(text: String, depth: Int, checked: Bool?)
        case numbered(number: Int, text: String, depth: Int)
        /// `>` lines, joined.
        case quote(String)
        /// A ``` fenced block, shown as written.
        case code(String)
        /// `---`, `***` or `___`.
        case rule
    }

    public static func blocks(_ text: String) -> [Block] {
        var blocks: [Block] = []
        var paragraph: [String] = []
        var quote: [String] = []
        var code: [String]?

        func flush() {
            if !paragraph.isEmpty { blocks.append(.paragraph(paragraph.joined(separator: "\n"))) }
            if !quote.isEmpty { blocks.append(.quote(quote.joined(separator: "\n"))) }
            paragraph = []
            quote = []
        }

        for raw in text.replacingOccurrences(of: "\r\n", with: "\n").split(separator: "\n", omittingEmptySubsequences: false) {
            let line = String(raw)
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if var lines = code {
                if trimmed.hasPrefix("```") {
                    blocks.append(.code(lines.joined(separator: "\n")))
                    code = nil
                } else {
                    lines.append(line)
                    code = lines
                }
                continue
            }
            if trimmed.hasPrefix("```") {
                flush()
                code = []
                continue
            }
            if trimmed.isEmpty {
                flush()
                continue
            }
            if trimmed.hasPrefix(">") {
                if !paragraph.isEmpty { flush() }
                quote.append(String(trimmed.dropFirst()).trimmingCharacters(in: .whitespaces))
                continue
            }
            if let block = lineBlock(line, trimmed: trimmed) {
                flush()
                blocks.append(block)
                continue
            }
            if !quote.isEmpty { flush() }
            paragraph.append(trimmed)
        }
        if let code { blocks.append(.code(code.joined(separator: "\n"))) }
        flush()
        return blocks
    }

    /// A heading, list item or rule on its own line; nil for paragraph text.
    private static func lineBlock(_ line: String, trimmed: String) -> Block? {
        if trimmed.hasPrefix("#") {
            let hashes = trimmed.prefix { $0 == "#" }.count
            let rest = trimmed.dropFirst(hashes)
            if hashes <= 6, rest.first == " " {
                return .heading(level: min(hashes, 3), text: rest.trimmingCharacters(in: .whitespaces))
            }
        }
        let compact = trimmed.replacingOccurrences(of: " ", with: "")
        if compact.count >= 3, let mark = compact.first, "-*_".contains(mark), compact.allSatisfy({ $0 == mark }) {
            return .rule
        }
        let indent = line.prefix { $0 == " " || $0 == "\t" }.reduce(0) { $0 + ($1 == "\t" ? 4 : 1) }
        let depth = min(indent / 2, 4)
        if let mark = trimmed.first, "-*+".contains(mark), trimmed.dropFirst().first == " " {
            let item = trimmed.dropFirst(2).trimmingCharacters(in: .whitespaces)
            for (box, checked) in [("[ ]", false), ("[x]", true), ("[X]", true)] where item.hasPrefix(box) {
                let rest = item.dropFirst(box.count)
                if rest.isEmpty || rest.first == " " {
                    return .bullet(text: rest.trimmingCharacters(in: .whitespaces), depth: depth, checked: checked)
                }
            }
            return .bullet(text: item, depth: depth, checked: nil)
        }
        let digits = trimmed.prefix { $0.isASCII && $0.isNumber }
        if !digits.isEmpty, digits.count <= 4, let number = Int(digits) {
            let rest = trimmed.dropFirst(digits.count)
            if let dot = rest.first, dot == "." || dot == ")", rest.dropFirst().first == " " {
                return .numbered(number: number, text: rest.dropFirst(2).trimmingCharacters(in: .whitespaces), depth: depth)
            }
        }
        return nil
    }

    /// Bold, italic, code and links in one block's text. Text that isn't valid Markdown shows as written.
    public static func inline(_ text: String) -> AttributedString {
        let options = AttributedString.MarkdownParsingOptions(
            interpretedSyntax: .inlineOnlyPreservingWhitespace, failurePolicy: .returnPartiallyParsedIfPossible)
        return (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
    }
}
