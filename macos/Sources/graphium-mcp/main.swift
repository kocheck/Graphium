import Foundation
import GraphiumMCP

// graphium-mcp: a Model Context Protocol server for Graphium campaigns, over stdio.
// It only reads and writes campaigns inside the folders given with --root, and never
// opens a network connection. See macos/docs/MCP.md.

let usage = """
    Usage: graphium-mcp --root <folder> [--root <folder> …]

    Lets AI tools (Claude, Codex, Cursor…) build maps in Graphium campaigns inside the given
    folders. Runs over stdio; your MCP client starts it. See macos/docs/MCP.md.
    """

var roots: [URL] = []
var arguments = CommandLine.arguments.dropFirst()
while let argument = arguments.popFirst() {
    switch argument {
    case "--root", "-r":
        guard let path = arguments.popFirst() else {
            FileHandle.standardError.write(Data("--root needs a folder\n".utf8))
            exit(64)
        }
        let expanded = (path as NSString).expandingTildeInPath
        roots.append(URL(fileURLWithPath: expanded, isDirectory: true))
    case "--version":
        print(GraphiumTools.version)
        exit(0)
    case "--help", "-h":
        print(usage)
        exit(0)
    default:
        FileHandle.standardError.write(Data("Unknown option \(argument)\n\(usage)\n".utf8))
        exit(64)
    }
}

for root in roots where !FileManager.default.fileExists(atPath: root.path) {
    FileHandle.standardError.write(Data("graphium-mcp: folder \(root.path) doesn't exist\n".utf8))
}
FileHandle.standardError.write(
    Data("graphium-mcp \(GraphiumTools.version): folders \(roots.map(\.path).joined(separator: ", "))\n".utf8))

let server = MCPServer(tools: GraphiumTools(store: CampaignStore(roots: roots))) { line in
    FileHandle.standardOutput.write(Data((line + "\n").utf8))
}
server.run()
