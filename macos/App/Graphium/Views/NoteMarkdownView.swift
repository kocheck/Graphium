import AppKit
import GraphiumCore
import SwiftUI

/// A note's Markdown, formatted (see `NoteMarkdown`): headings, lists, checkboxes, quotes, rules
/// and code, with bold, italic and links inside them. Used by the note inspector at body size and
/// by the World View card at projector size.
struct NoteMarkdownView: View {
    let text: String
    /// Body text size; headings scale up from it.
    var size: CGFloat = NSFont.systemFontSize
    /// Quote bars and rules.
    var ruleColor: Color = .secondary
    /// Off on the World View: a link there would open on the projector's Mac, not a player's.
    var linksEnabled = true

    var body: some View {
        VStack(alignment: .leading, spacing: size * 0.55) {
            ForEach(Array(NoteMarkdown.blocks(text).enumerated()), id: \.offset) { _, block in
                view(for: block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func view(for block: NoteMarkdown.Block) -> some View {
        switch block {
        case .heading(let level, let text):
            inline(text)
                .font(.system(size: size * [1.4, 1.2, 1.05][level - 1], weight: level == 3 ? .semibold : .bold))
                .padding(.top, size * 0.2)
                .accessibilityAddTraits(.isHeader)
        case .paragraph(let text):
            inline(text).font(.system(size: size)).lineSpacing(size * 0.18)
        case .bullet(let text, let depth, let checked):
            item(depth: depth) {
                if let checked {
                    Image(systemName: checked ? "checkmark.square" : "square")
                        .accessibilityLabel(checked ? "Done" : "Not done")
                } else {
                    Text("•")
                }
            } content: {
                inline(text).strikethrough(checked == true).opacity(checked == true ? 0.65 : 1)
            }
        case .numbered(let number, let text, let depth):
            item(depth: depth) { Text("\(number).").monospacedDigit() } content: { inline(text) }
        case .quote(let text):
            HStack(alignment: .top, spacing: size * 0.6) {
                RoundedRectangle(cornerRadius: 1.5).fill(ruleColor).frame(width: 3)
                inline(text).font(.system(size: size)).italic().lineSpacing(size * 0.18)
            }
            .fixedSize(horizontal: false, vertical: true)
        case .code(let text):
            Text(text)
                .font(.system(size: max(size - 1, 11), design: .monospaced))
                .padding(size * 0.5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(ruleColor.opacity(0.15), in: RoundedRectangle(cornerRadius: 6))
        case .rule:
            Rectangle().fill(ruleColor.opacity(0.6)).frame(height: 1).padding(.vertical, size * 0.2)
        }
    }

    /// A list row with a hanging indent, so wrapped lines line up under the text, not the marker.
    private func item<Marker: View, Content: View>(
        depth: Int, @ViewBuilder marker: () -> Marker, @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: size * 0.4) {
            marker().frame(minWidth: size * 1.1, alignment: .trailing)
            content()
        }
        .font(.system(size: size))
        .padding(.leading, CGFloat(depth) * size * 1.2)
    }

    private func inline(_ text: String) -> Text {
        var styled = NoteMarkdown.inline(text)
        if !linksEnabled {
            for run in styled.runs where run.link != nil {
                styled[run.range].link = nil
                styled[run.range].underlineStyle = .single
            }
        }
        return Text(styled)
    }
}
