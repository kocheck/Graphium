import Foundation

/// What Spotlight indexes for a `.graphiumcampaign` package, so Finder and `mdfind` find a
/// campaign by an NPC's name or a word in the DM's notes: the campaign and map names, token
/// and library names, and the note pins' titles and text. The index stays on this Mac;
/// the DM's notes are the DM's own file.
public struct CampaignSearchText: Equatable, Sendable {
    /// Longest `textContent`, in characters, so a huge campaign can't swamp the importer.
    public static let maxTextLength = 500_000

    public var title: String
    /// In the order shown in the map navigator.
    public var mapNames: [String]
    /// Names worth matching on their own: maps, tokens (and the names players see), library
    /// items and note titles. Trimmed, without empties or repeats, in campaign order.
    public var keywords: [String]
    /// The title, the keywords, then each note's title, DM notes and player notes, one per line.
    public var textContent: String
    /// A line for Finder's Get Info and Spotlight: "3 maps: Crypt, Vault, Tower".
    public var summary: String

    public init(campaign: Campaign) {
        let library = campaign.libraryIndex
        title = campaign.name
        mapNames = campaign.maps.map(\.name)

        var keywords: [String] = []
        var seen = Set<String>()
        func keep(_ text: String?) {
            guard let text = text?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty,
                seen.insert(text).inserted
            else { return }
            keywords.append(text)
        }
        var notes: [String] = []
        for map in campaign.maps {
            keep(map.name)
            for token in map.tokens {
                keep(token.name ?? token.libraryItemId.flatMap { library[$0]?.name })
                keep(token.playerName)
            }
            for note in map.notes {
                keep(note.title)
                for text in [note.title, note.dmNotes, note.playerNotes] {
                    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty { notes.append(trimmed) }
                }
            }
        }
        for item in campaign.tokenLibrary { keep(item.name) }
        self.keywords = keywords

        var text = ([campaign.name] + keywords + notes).joined(separator: "\n")
        if text.count > Self.maxTextLength { text = String(text.prefix(Self.maxTextLength)) }
        textContent = text

        let count = campaign.maps.count
        summary = "\(count) \(count == 1 ? "map" : "maps"): " + mapNames.joined(separator: ", ")
    }
}

extension CampaignPackage {
    /// Reads the campaign from the `campaign.json` of a package folder, leaving `assets/`
    /// unread. Throws like `init(manifest:assets:)`, so a newer format fails clearly.
    public static func readCampaign(packageAt url: URL) throws -> Campaign {
        let manifest = try? Data(contentsOf: url.appendingPathComponent(manifestFileName))
        return try CampaignPackage(manifest: manifest, assets: [:]).campaign
    }
}
