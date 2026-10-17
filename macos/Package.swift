// swift-tools-version: 5.10
// GraphiumCore: platform-independent model, file format, and game logic.
// The macOS app (App/) depends on this package; keep AppKit/SwiftUI out of it.
import PackageDescription

let package = Package(
    name: "GraphiumCore",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "GraphiumCore", targets: ["GraphiumCore"]),
    ],
    targets: [
        .target(name: "GraphiumCore"),
        .testTarget(name: "GraphiumCoreTests", dependencies: ["GraphiumCore"]),
    ]
)
