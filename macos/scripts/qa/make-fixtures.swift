// Synthetic map images for the launch-QA persona runs (docs/qa/LAUNCH_QA.md): a parchment
// battlemap with a 70 px grid and a few rooms, and a huge one for the quit-mid-import run.
// Usage: swift scripts/qa/make-fixtures.swift <out-folder>
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func map(width: Int, height: Int, cell: Int, to url: URL) {
    let space = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: space,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { fatalError("no context") }
    ctx.setFillColor(CGColor(red: 0.93, green: 0.88, blue: 0.76, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    ctx.setFillColor(CGColor(red: 0.62, green: 0.55, blue: 0.45, alpha: 1))
    for (x, y, w, h) in [(2, 2, 6, 4), (11, 3, 5, 5), (4, 9, 8, 4)] where (x + w) * cell < width && (y + h) * cell < height {
        ctx.fill(CGRect(x: x * cell, y: y * cell, width: w * cell, height: h * cell))
    }
    ctx.setStrokeColor(CGColor(red: 0.25, green: 0.2, blue: 0.15, alpha: 0.6))
    ctx.setLineWidth(2)
    for x in stride(from: 0, through: width, by: cell) {
        ctx.move(to: CGPoint(x: x, y: 0)); ctx.addLine(to: CGPoint(x: x, y: height))
    }
    for y in stride(from: 0, through: height, by: cell) {
        ctx.move(to: CGPoint(x: 0, y: y)); ctx.addLine(to: CGPoint(x: width, y: y))
    }
    ctx.strokePath()
    guard let image = ctx.makeImage(),
        let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)
    else { fatalError("no image") }
    CGImageDestinationAddImage(dest, image, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("write failed") }
}

let out = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "/tmp/graphium-qa-fixtures")
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
map(width: 1400, height: 1050, cell: 70, to: out.appendingPathComponent("grid-map.png"))
map(width: 9100, height: 9100, cell: 70, to: out.appendingPathComponent("huge-map.png"))
print("Fixtures in \(out.path)")
