import AppKit
import GraphiumCore
import SwiftUI

/// Change Image for selected tokens: a new picture from a file (through the 1:1 cropper)
/// or from the library. Only the token's `src` changes; its name, type, vision and
/// library link stay. The image is copied into the campaign package, so nothing
/// outside the file is referenced.
extension CampaignDocument {
    /// Points `ids` at `src` in one undoable step.
    func setTokenImage(_ src: String, for ids: Set<String>, undoManager: UndoManager?) {
        // The tokens may be gone (deleted, or another map) by the time a picker closes.
        guard campaign.activeMap.tokens.contains(where: { ids.contains($0.id) }) else { return }
        edit(ids.count == 1 ? "Change Token Image" : "Change Token Images", undoManager: undoManager) { campaign in
            for index in campaign.activeMap.tokens.indices where ids.contains(campaign.activeMap.tokens[index].id) {
                campaign.activeMap.tokens[index].src = src
            }
        }
    }

    /// Uses a library item's image for `ids`. The campaign's copy of the item supplies the
    /// asset when there is one; otherwise the image is copied in from the app library.
    /// False when the image is missing.
    @MainActor
    @discardableResult
    func setTokenImage(from item: TokenLibraryItem, for ids: Set<String>, undoManager: UndoManager?) -> Bool {
        let src: String
        if let copy = campaign.tokenLibrary.first(where: { $0.id == item.id }), assets[copy.src] != nil {
            src = copy.src
        } else if let data = LibraryStore.shared.data(for: item.src) {
            // Picking the same item again reuses the copy already in the package.
            src = assets.first(where: { $0.value == data })?.key ?? addAsset(data, preferredName: item.src)
        } else {
            return false
        }
        setTokenImage(src, for: ids, undoManager: undoManager)
        return true
    }

    /// Crops are stored square at up to the token size limit (CORE_SPEC §3.13), as PNG.
    func addCroppedTokenImage(_ image: CGImage, name: String) -> String? {
        let side = min(image.width, ImageKind.token.maxDimension)
        guard
            let context = CGContext(
                data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: 0,
                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return nil }
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: side, height: side))
        guard let scaled = context.makeImage(),
            let png = NSBitmapImageRep(cgImage: scaled).representation(using: .png, properties: [:])
        else { return nil }
        return addAsset(png, preferredName: (name as NSString).deletingPathExtension + ".png")
    }
}

/// The canvas's right-click menu on a token (Architect only).
enum TokenMenu {
    @MainActor
    static func make(
        tokenIDs: Set<String>, document: CampaignDocument, chooseFile: @escaping () -> Void,
        pickLibraryItem: @escaping (TokenLibraryItem) -> Void, delete: @escaping () -> Void
    ) -> NSMenu {
        let menu = NSMenu()
        menu.autoenablesItems = false
        menu.addItem(MenuAction.item("Change Image…") { chooseFile() })

        let items = document.browsableLibrary.items
        let fromLibrary = NSMenuItem(title: "Image from Library", action: nil, keyEquivalent: "")
        let submenu = NSMenu()
        for item in items {
            let entry = MenuAction.item(item.name) { pickLibraryItem(item) }
            if let thumb = document.libraryThumbnail(item) {
                entry.image = NSImage(cgImage: thumb, size: NSSize(width: 20, height: 20))
            }
            submenu.addItem(entry)
        }
        fromLibrary.submenu = submenu
        fromLibrary.isEnabled = !items.isEmpty
        menu.addItem(fromLibrary)

        menu.addItem(.separator())
        let deleteTitle = tokenIDs.count == 1 ? "Delete Token" : "Delete Tokens"
        let deleteItem = MenuAction.item(deleteTitle) { delete() }
        deleteItem.attributedTitle = NSAttributedString(
            string: deleteTitle, attributes: [.foregroundColor: NSColor.systemRed])
        menu.addItem(deleteItem)
        return menu
    }
}

/// The inspector's library picker: a grid of the library's tokens.
struct TokenImageLibraryPicker: View {
    @ObservedObject var document: CampaignDocument
    let pick: (TokenLibraryItem) -> Void
    @ObservedObject private var library = LibraryStore.shared
    @State private var query = ""

    var body: some View {
        let browsable = document.browsableLibrary.items
        let items = query.isEmpty ? browsable : browsable.filter { $0.name.localizedCaseInsensitiveContains(query) }
        VStack(spacing: 8) {
            TextField("Search Library", text: $query)
                .textFieldStyle(.roundedBorder)
            if browsable.isEmpty {
                Text("Your library is empty. Add tokens in the Library.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 80)
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 64), spacing: 8)], spacing: 8) {
                        ForEach(items) { item in
                            Button { pick(item) } label: {
                                VStack(spacing: 4) {
                                    Group {
                                        if let image = document.libraryThumbnail(item) {
                                            Image(decorative: image, scale: 1).resizable().scaledToFit()
                                        } else {
                                            Image(systemName: "questionmark.square.dashed").foregroundStyle(.secondary)
                                        }
                                    }
                                    .frame(width: 56, height: 56)
                                    Text(item.name).font(.caption2).lineLimit(1)
                                }
                                .frame(width: 64)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .help(item.name)
                            .accessibilityLabel(item.name)
                        }
                    }
                }
                .frame(height: 240)
            }
        }
        .padding(12)
        .frame(width: 300)
    }
}
