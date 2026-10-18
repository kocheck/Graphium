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
        // The server's library, so Graphium.app can build the bundled graphium-mcp and its AI Tools settings.
        .library(name: "GraphiumMCP", targets: ["GraphiumMCP"]),
        // Metal drawing for the World View (fog, light); Metal and Core Graphics only, no AppKit.
        .library(name: "GraphiumRender", targets: ["GraphiumRender"]),
    ],
    targets: [
        .target(name: "GraphiumCore"),
        .target(name: "GraphiumRender", dependencies: ["GraphiumCore"]),
        .testTarget(name: "GraphiumCoreTests", dependencies: ["GraphiumCore"]),
        .target(name: "GraphiumMCP", dependencies: ["GraphiumCore"]),
        .executableTarget(name: "graphium-mcp", dependencies: ["GraphiumMCP"]),
        .testTarget(name: "GraphiumMCPTests", dependencies: ["GraphiumMCP", "GraphiumCore"]),
        .testTarget(name: "GraphiumRenderTests", dependencies: ["GraphiumRender", "GraphiumCore"]),
    ]
)
