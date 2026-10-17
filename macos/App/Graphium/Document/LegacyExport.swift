import GraphiumCore
import SwiftUI
import UniformTypeIdentifiers

/// The bytes of a legacy `.graphium` ZIP, for `.fileExporter` (PARITY §5.2).
/// The open document keeps its native format and location.
struct LegacyGraphiumFile: FileDocument {
    static var readableContentTypes: [UTType] { [.legacyGraphium] }

    let data: Data

    init(package: CampaignPackage) throws {
        data = try LegacyExporter.export(package)
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else { throw CocoaError(.fileReadCorruptFile) }
        self.data = data
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
