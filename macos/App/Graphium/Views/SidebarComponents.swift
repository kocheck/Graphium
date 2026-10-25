import GraphiumCore
import GraphiumRender
import SwiftUI

/// The campaign at the top of the Architect sidebar: a monogram, its name and how many maps it holds,
/// with the three things you do to a campaign's maps in one small menu.
struct SidebarCampaignHeader: View {
    let campaignName: String
    let mapCount: Int
    let newMap: () -> Void
    let openMapSettings: () -> Void
    let openCommandPalette: () -> Void

    var body: some View {
        HStack(spacing: Spacing.sm + 2) {
            Text(String(campaignName.prefix(1)).uppercased())
                .font(.headline)
                .frame(width: 32, height: 32)
                .background(Palette.surfaceRaised.color, in: RoundedRectangle(cornerRadius: Radius.tile, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radius.tile, style: .continuous).strokeBorder(Palette.ruleHairline.color, lineWidth: 1))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text(campaignName).font(.headline).lineLimit(1)
                Text(mapCount == 1 ? "1 map" : "\(mapCount) maps").font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Menu {
                Button("New Map…", action: newMap)
                Button("Map Settings…", action: openMapSettings)
                Button("Command Palette…", action: openCommandPalette)
            } label: {
                Image(systemName: "ellipsis").frame(width: 28, height: 28).contentShape(Rectangle())
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
            .help("Campaign actions")
            .accessibilityLabel("Campaign actions")
        }
        .padding(.vertical, Spacing.xs)
    }
}

/// A quiet icon-and-label row for a sidebar command, with its shortcut where it has one
/// (taste rule 1: shortcuts stay visible). Highlights softly under the pointer.
struct SidebarActionRow: View {
    let title: String
    let symbolName: String
    var shortcutHint: String?
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm + 2) {
                Image(systemName: symbolName)
                    .frame(width: 20)
                    .foregroundStyle(.secondary)
                Text(title)
                Spacer(minLength: 0)
                if let shortcutHint {
                    Text(shortcutHint).readoutStyle(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 3)
            .padding(.horizontal, Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: Radius.control + 2, style: .continuous)
                    .fill(isHovering ? Palette.surfaceSunken.color : .clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
    }
}

/// A map's name with a small picture of it, as the DM sees it.
struct SidebarMapRow: View {
    let name: String
    let thumbnail: CGImage?

    var body: some View {
        HStack(spacing: Spacing.sm + 2) {
            ZStack {
                Palette.surfaceSunken.color
                if let thumbnail {
                    Image(decorative: thumbnail, scale: 1).resizable().scaledToFill()
                } else {
                    Image(systemName: "map").font(.caption).foregroundStyle(.secondary)
                }
            }
            .frame(width: 48, height: 34)
            .clipShape(RoundedRectangle(cornerRadius: Radius.control + 2, style: .continuous))
            Text(name).lineLimit(1)
        }
    }
}

/// Thumbnails of every map in the open campaign, drawn off the main thread from the campaign as it is now.
/// Background pictures come from the saved package, so an unsaved campaign shows grid, walls and tokens only.
@MainActor
final class MapThumbnailStore: ObservableObject {
    @Published private(set) var thumbnailsByMapID: [String: CGImage] = [:]

    func refresh(campaign: Campaign, packageURL: URL?) async {
        let folder = packageURL ?? FileManager.default.temporaryDirectory
        let maps = campaign.maps
        let drawn: [(String, CGImage)] = await Task.detached(priority: .utility) {
            maps.compactMap { map in
                let renderer = MapRenderer(map: map, campaign: campaign, packageURL: folder)
                guard let image = renderer.image(region: nil, maxPixels: 240, playersView: false, labels: false) else { return nil }
                return (map.id, image)
            }
        }.value
        // A damaged or hand-edited campaign can repeat a map id; keep the first picture rather than trap.
        thumbnailsByMapID = Dictionary(drawn, uniquingKeysWith: { first, _ in first })
    }
}
