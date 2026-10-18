// swift-tools-version: 5.10
// GraphiumCore: platform-independent model, file format, and game logic.
// The macOS app (App/) depends on this package; keep AppKit/SwiftUI out of it.
// graphium-mcp: the MCP server that lets AI tools build maps in campaign files (docs/MCP.md).
import PackageDescription

let package = Package(
    name: "GraphiumCore",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "GraphiumCore", targets: ["GraphiumCore"]),
        .executable(name: "graphium-mcp", targets: ["graphium-mcp"]),
    ],
    targets: [
        .target(name: "GraphiumCore"),
        .testTarget(name: "GraphiumCoreTests", dependencies: ["GraphiumCore"]),
        .target(name: "GraphiumMCP", dependencies: ["GraphiumCore"]),
        .executableTarget(name: "graphium-mcp", dependencies: ["GraphiumMCP"]),
        .testTarget(name: "GraphiumMCPTests", dependencies: ["GraphiumMCP", "GraphiumCore"]),
    ]
)
