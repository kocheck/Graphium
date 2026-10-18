import CoreGraphics
import Foundation
import GraphiumCore
import Metal

/// What the World View's fog shows: the fog bounds, what has been explored, and what the
/// party sees now (with lighting, what is lit and within darkvision).
public struct FogScene: Equatable, Sendable {
    public var bounds: Bounds
    public var explored: [ExploredRegion]
    public var sight: PartySight
    /// Decision 010: fine hatching over ground the party remembers but can't see now.
    public var hatchRemembered: Bool

    public init(bounds: Bounds, explored: [ExploredRegion], sight: PartySight, hatchRemembered: Bool = true) {
        self.bounds = bounds
        self.explored = explored
        self.sight = sight
        self.hatchRemembered = hatchRemembered
    }
}

/// The pixels to render: `origin` is the map point at the top-left pixel.
public struct FogView: Equatable, Sendable {
    public var origin: Point2D
    /// Pixels per map unit (zoom × backing scale).
    public var scale: Double
    public var width: Int
    public var height: Int
    /// Pixels per point, so hatch lines keep their size in points on any display.
    public var pointScale: Double

    public init(origin: Point2D, scale: Double, width: Int, height: Int, pointScale: Double = 1) {
        self.origin = origin
        self.scale = scale
        self.width = width
        self.height = height
        self.pointScale = pointScale
    }
}

/// The fog compositing rules, shared by the GPU and the app's Core Graphics fallback.
public enum FogShading {
    /// Fog over unexplored ground (TS 94%).
    public static let base = 0.94
    /// How much of the fog explored ground clears (TS: down to 20%).
    public static let exploredClearing = 0.8
    /// How much of the fog dim light, or darkness within darkvision, clears (decision 009).
    public static let dimClearing = 0.65
    /// Decision 010's hatching, in points: a 2 pt line every 12 pt, white at 28%.
    public static let hatchPeriod = 12.0
    public static let hatchWidth = 2.0
    public static let hatchAlpha = 0.28
}

/// Draws the World View's fog with Metal, light and darkvision included, into premultiplied
/// RGBA pixels (CORE_SPEC §3.3 step 7; decisions 009 and 010). Polygons are filled with the
/// stencil buffer (even-odd, like `LineOfSight.contains`), so any simple polygon works.
/// Clearings multiply the remaining fog, as Core Graphics' destination-out does.
public final class FogRenderer {
    public struct Frame: @unchecked Sendable {
        public var width: Int
        public var height: Int
        /// Premultiplied RGBA, 8 bits a channel, top row first.
        public var pixels: Data
        /// GPU time for the frame, seconds.
        public var gpuTime: Double

        public func alpha(x: Int, y: Int) -> Double {
            Double(pixels[(y * width + x) * 4 + 3]) / 255
        }

        public func white(x: Int, y: Int) -> Double {
            Double(pixels[(y * width + x) * 4]) / 255
        }

        public var image: CGImage? {
            guard let provider = CGDataProvider(data: pixels as CFData) else { return nil }
            return CGImage(
                width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
        }
    }

    public let device: MTLDevice
    private let queue: MTLCommandQueue
    private let exploredStencil: MTLRenderPipelineState
    private let exploredCover: MTLRenderPipelineState
    private let fogStencil: MTLRenderPipelineState
    private let fogBase: MTLRenderPipelineState
    private let fogClearing: MTLRenderPipelineState
    private let compositor: MTLRenderPipelineState
    private let fill: [UInt32: MTLDepthStencilState]
    private let test: [UInt32: MTLDepthStencilState]
    private let zero: [UInt32: MTLDepthStencilState]
    private let always: MTLDepthStencilState
    private var targets: Targets?

    private struct Targets {
        var width: Int
        var height: Int
        var explored: MTLTexture
        var remaining: MTLTexture
        var seen: MTLTexture
        var stencil: MTLTexture
        var output: MTLTexture
        var readback: MTLBuffer
    }

    /// Nil when the Mac has no Metal device or the shaders don't compile.
    public init?(device: MTLDevice? = MTLCreateSystemDefaultDevice()) {
        guard let device, let queue = device.makeCommandQueue(),
            let library = try? device.makeLibrary(source: FogShaders.source, options: nil),
            let vertex = library.makeFunction(name: "fogVertex")
        else { return nil }
        func pipeline(
            _ fragment: String, colors: [(MTLPixelFormat, MTLColorWriteMask, ((MTLRenderPipelineColorAttachmentDescriptor) -> Void)?)],
            stencil: Bool = true
        ) -> MTLRenderPipelineState? {
            let d = MTLRenderPipelineDescriptor()
            d.vertexFunction = vertex
            d.fragmentFunction = library.makeFunction(name: fragment)
            for (i, color) in colors.enumerated() {
                d.colorAttachments[i].pixelFormat = color.0
                d.colorAttachments[i].writeMask = color.1
                color.2?(d.colorAttachments[i])
            }
            if stencil { d.stencilAttachmentPixelFormat = .stencil8 }
            return try? device.makeRenderPipelineState(descriptor: d)
        }
        let multiply: (MTLRenderPipelineColorAttachmentDescriptor) -> Void = {
            $0.isBlendingEnabled = true
            $0.rgbBlendOperation = .add
            $0.alphaBlendOperation = .add
            $0.sourceRGBBlendFactor = .zero
            $0.sourceAlphaBlendFactor = .zero
            $0.destinationRGBBlendFactor = .oneMinusSourceColor
            $0.destinationAlphaBlendFactor = .oneMinusSourceAlpha
        }
        let maximum: (MTLRenderPipelineColorAttachmentDescriptor) -> Void = {
            $0.isBlendingEnabled = true
            $0.rgbBlendOperation = .max
            $0.alphaBlendOperation = .max
        }
        guard let exploredStencil = pipeline("one", colors: [(.r8Unorm, [], nil)]),
            let exploredCover = pipeline("one", colors: [(.r8Unorm, .all, maximum)]),
            let fogStencil = pipeline("nothing", colors: [(.r16Float, [], nil), (.r8Unorm, [], nil)]),
            let fogBase = pipeline("fogBase", colors: [(.r16Float, .all, nil), (.r8Unorm, [], nil)]),
            let fogClearing = pipeline("clearing", colors: [(.r16Float, .all, multiply), (.r8Unorm, .all, maximum)]),
            let compositor = pipeline("composite", colors: [(.rgba8Unorm, .all, nil)], stencil: false)
        else { return nil }
        func state(_ compare: MTLCompareFunction, pass: MTLStencilOperation, read: UInt32, write: UInt32)
            -> MTLDepthStencilState?
        {
            let s = MTLStencilDescriptor()
            s.stencilCompareFunction = compare
            s.depthStencilPassOperation = pass
            s.stencilFailureOperation = .keep
            s.depthFailureOperation = .keep
            s.readMask = read
            s.writeMask = write
            let d = MTLDepthStencilDescriptor()
            d.frontFaceStencil = s
            d.backFaceStencil = s
            return device.makeDepthStencilState(descriptor: d)
        }
        var fill: [UInt32: MTLDepthStencilState] = [:]
        var test: [UInt32: MTLDepthStencilState] = [:]
        var zero: [UInt32: MTLDepthStencilState] = [:]
        for bits: UInt32 in [0x01, 0x02, 0x03, 0xff] {
            guard let f = state(.always, pass: .invert, read: 0xff, write: bits),
                let t = state(.equal, pass: .keep, read: bits, write: 0),
                let z = state(.always, pass: .zero, read: 0xff, write: bits)
            else { return nil }
            fill[bits] = f
            test[bits] = t
            zero[bits] = z
        }
        guard let always = state(.always, pass: .keep, read: 0, write: 0) else { return nil }
        self.device = device
        self.queue = queue
        self.exploredStencil = exploredStencil
        self.exploredCover = exploredCover
        self.fogStencil = fogStencil
        self.fogBase = fogBase
        self.fogClearing = fogClearing
        self.compositor = compositor
        self.fill = fill
        self.test = test
        self.zero = zero
        self.always = always
    }

    /// Renders one frame, waiting for the GPU. Nil when the view is empty.
    public func render(_ scene: FogScene, view: FogView) -> Frame? {
        guard view.width > 0, view.height > 0, view.scale > 0, let targets = targets(for: view),
            let commands = queue.makeCommandBuffer()
        else { return nil }
        var geometry = Geometry()
        let boundsQuad = geometry.quad(scene.bounds)
        let viewQuad = geometry.quad(
            Bounds(
                x: view.origin.x, y: view.origin.y, width: Double(view.width) / view.scale,
                height: Double(view.height) / view.scale))
        let explored = scene.explored.compactMap { region -> (Range<Int>, Range<Int>)? in
            guard region.points.count >= 3 else { return nil }
            return (geometry.fan(region.points), geometry.quad(region.points))
        }
        let plan = geometry.plan(scene.sight)
        guard let buffer = geometry.buffer(on: device) else { return nil }
        var viewUniform = [
            SIMD4<Float>(Float(view.origin.x), Float(view.origin.y), Float(view.scale), 0),
            SIMD4<Float>(Float(view.width), Float(view.height), 0, 0),
        ]

        func begin(_ pass: MTLRenderPassDescriptor) -> MTLRenderCommandEncoder? {
            guard let encoder = commands.makeRenderCommandEncoder(descriptor: pass) else { return nil }
            encoder.setVertexBuffer(buffer, offset: 0, index: 0)
            encoder.setVertexBytes(&viewUniform, length: MemoryLayout<SIMD4<Float>>.stride * 2, index: 1)
            return encoder
        }
        func draw(_ encoder: MTLRenderCommandEncoder, _ range: Range<Int>) {
            guard !range.isEmpty else { return }
            encoder.drawPrimitives(type: .triangle, vertexStart: range.lowerBound, vertexCount: range.count)
        }

        // 1. The union of explored regions.
        let exploredPass = MTLRenderPassDescriptor()
        exploredPass.colorAttachments[0].texture = targets.explored
        exploredPass.colorAttachments[0].loadAction = .clear
        exploredPass.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        exploredPass.colorAttachments[0].storeAction = .store
        exploredPass.stencilAttachment.texture = targets.stencil
        exploredPass.stencilAttachment.loadAction = .clear
        exploredPass.stencilAttachment.clearStencil = 0
        exploredPass.stencilAttachment.storeAction = .dontCare
        guard let e = begin(exploredPass) else { return nil }
        for (fan, quad) in explored {
            e.setRenderPipelineState(exploredStencil)
            e.setDepthStencilState(fill[0xff])
            draw(e, fan)
            e.setRenderPipelineState(exploredCover)
            e.setDepthStencilState(test[0xff])
            e.setStencilReferenceValue(0xff)
            draw(e, quad)
            e.setRenderPipelineState(exploredStencil)
            e.setDepthStencilState(zero[0xff])
            draw(e, quad)
        }
        e.endEncoding()

        // 2. The fog left after the explored ground and everything seen now.
        let fogPass = MTLRenderPassDescriptor()
        for (i, texture) in [targets.remaining, targets.seen].enumerated() {
            fogPass.colorAttachments[i].texture = texture
            fogPass.colorAttachments[i].loadAction = .clear
            fogPass.colorAttachments[i].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
            fogPass.colorAttachments[i].storeAction = .store
        }
        fogPass.stencilAttachment.texture = targets.stencil
        fogPass.stencilAttachment.loadAction = .clear
        fogPass.stencilAttachment.clearStencil = 0
        fogPass.stencilAttachment.storeAction = .dontCare
        guard let f = begin(fogPass) else { return nil }
        var base = SIMD4<Float>(Float(FogShading.base), Float(FogShading.exploredClearing), 0, 0)
        f.setRenderPipelineState(fogBase)
        f.setDepthStencilState(always)
        f.setFragmentTexture(targets.explored, index: 0)
        f.setFragmentBytes(&base, length: MemoryLayout<SIMD4<Float>>.stride, index: 0)
        draw(f, boundsQuad)
        for step in plan {
            switch step {
            case .fill(let range, let bits):
                f.setRenderPipelineState(fogStencil)
                f.setDepthStencilState(fill[bits])
                draw(f, range)
            case .zero(let range, let bits):
                f.setRenderPipelineState(fogStencil)
                f.setDepthStencilState(zero[bits])
                draw(f, range)
            case .clear(let range, let bits, var uniform):
                f.setRenderPipelineState(fogClearing)
                f.setDepthStencilState(test[bits])
                f.setStencilReferenceValue(bits)
                f.setFragmentBytes(&uniform, length: MemoryLayout<SIMD4<Float>>.stride * 2, index: 0)
                draw(f, range)
            }
        }
        f.endEncoding()

        // 3. Black fog, with hatching over remembered ground.
        let outPass = MTLRenderPassDescriptor()
        outPass.colorAttachments[0].texture = targets.output
        outPass.colorAttachments[0].loadAction = .clear
        outPass.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        outPass.colorAttachments[0].storeAction = .store
        guard let c = begin(outPass) else { return nil }
        var hatch = [
            viewUniform[0],
            SIMD4<Float>(
                Float(FogShading.hatchPeriod * view.pointScale), Float(FogShading.hatchWidth * view.pointScale),
                Float(FogShading.hatchAlpha), scene.hatchRemembered ? 1 : 0),
        ]
        c.setRenderPipelineState(compositor)
        c.setFragmentTexture(targets.remaining, index: 0)
        c.setFragmentTexture(targets.seen, index: 1)
        c.setFragmentTexture(targets.explored, index: 2)
        c.setFragmentBytes(&hatch, length: MemoryLayout<SIMD4<Float>>.stride * 2, index: 0)
        draw(c, viewQuad)
        c.endEncoding()

        guard let blit = commands.makeBlitCommandEncoder() else { return nil }
        blit.copy(
            from: targets.output, sourceSlice: 0, sourceLevel: 0, sourceOrigin: MTLOrigin(x: 0, y: 0, z: 0),
            sourceSize: MTLSize(width: view.width, height: view.height, depth: 1), to: targets.readback,
            destinationOffset: 0, destinationBytesPerRow: view.width * 4,
            destinationBytesPerImage: view.width * view.height * 4)
        blit.endEncoding()
        commands.commit()
        commands.waitUntilCompleted()
        guard commands.status == .completed else { return nil }
        return Frame(
            width: view.width, height: view.height,
            pixels: Data(bytes: targets.readback.contents(), count: view.width * view.height * 4),
            gpuTime: max(0, commands.gpuEndTime - commands.gpuStartTime))
    }

    private func targets(for view: FogView) -> Targets? {
        if let targets, targets.width == view.width, targets.height == view.height { return targets }
        func texture(_ format: MTLPixelFormat, _ usage: MTLTextureUsage) -> MTLTexture? {
            let d = MTLTextureDescriptor.texture2DDescriptor(
                pixelFormat: format, width: view.width, height: view.height, mipmapped: false)
            d.usage = usage
            d.storageMode = .private
            return device.makeTexture(descriptor: d)
        }
        guard let explored = texture(.r8Unorm, [.renderTarget, .shaderRead]),
            let remaining = texture(.r16Float, [.renderTarget, .shaderRead]),
            let seen = texture(.r8Unorm, [.renderTarget, .shaderRead]),
            let stencil = texture(.stencil8, [.renderTarget]),
            let output = texture(.rgba8Unorm, [.renderTarget]),
            let readback = device.makeBuffer(length: view.width * view.height * 4, options: .storageModeShared)
        else { return nil }
        targets = Targets(
            width: view.width, height: view.height, explored: explored, remaining: remaining, seen: seen,
            stencil: stencil, output: output, readback: readback)
        return targets
    }
}

/// Triangles for one frame, in map space, in one vertex buffer.
private struct Geometry {
    enum Step {
        case fill(Range<Int>, UInt32)
        case zero(Range<Int>, UInt32)
        /// Clears where the stencil equals `bits` (`uniform` as the `clearing` shader reads it).
        case clear(Range<Int>, UInt32, [SIMD4<Float>])
    }

    var points: [SIMD2<Float>] = []

    /// A triangle fan from the first vertex, for an even-odd stencil fill.
    mutating func fan(_ polygon: [Point2D]) -> Range<Int> {
        let start = points.count
        guard polygon.count >= 3 else { return start..<start }
        let first = SIMD2<Float>(Float(polygon[0].x), Float(polygon[0].y))
        for i in 1..<(polygon.count - 1) {
            points.append(first)
            points.append(SIMD2(Float(polygon[i].x), Float(polygon[i].y)))
            points.append(SIMD2(Float(polygon[i + 1].x), Float(polygon[i + 1].y)))
        }
        return start..<points.count
    }

    /// Two triangles covering the polygon's bounding box.
    mutating func quad(_ polygon: [Point2D]) -> Range<Int> {
        guard let minX = polygon.map(\.x).min(), let maxX = polygon.map(\.x).max(),
            let minY = polygon.map(\.y).min(), let maxY = polygon.map(\.y).max()
        else { return points.count..<points.count }
        return quad(Bounds(x: minX, y: minY, width: maxX - minX, height: maxY - minY))
    }

    mutating func quad(_ b: Bounds) -> Range<Int> {
        let start = points.count
        let (x0, y0) = (Float(b.x), Float(b.y))
        let (x1, y1) = (Float(b.x + b.width), Float(b.y + b.height))
        points += [SIMD2(x0, y0), SIMD2(x1, y0), SIMD2(x0, y1), SIMD2(x1, y0), SIMD2(x1, y1), SIMD2(x0, y1)]
        return start..<points.count
    }

    /// The draws that clear the fog for what the party sees, in order. Each PC's sight is
    /// stencil bit 1; a light's reach or the PC's darkvision is bit 2, tested together with it.
    mutating func plan(_ sight: PartySight) -> [Step] {
        var steps: [Step] = []
        let dim = Float(FogShading.dimClearing)
        for entry in sight.vision where entry.polygon.count >= 3 {
            let sightFan = fan(entry.polygon)
            let box = quad(entry.polygon)
            steps.append(.fill(sightFan, 0x01))
            guard let ambient = sight.ambient else {
                let c = entry.viewer.centre
                steps.append(
                    .clear(
                        box, 0x01,
                        [SIMD4(1, Float(c.x), Float(c.y), Float(entry.viewer.radius)), SIMD4(0, 0, dim, 0)]))
                steps.append(.zero(box, 0x01))
                continue
            }
            if ambient > .dark {
                let value: Float = ambient == .bright ? 1 : dim
                steps.append(.clear(box, 0x01, [SIMD4(0, 0, 0, 0), SIMD4(0, value, dim, 0)]))
            }
            for area in sight.lit where area.polygon.count >= 3 && area.dimRadius > 0 {
                let reach = fan(area.polygon)
                let reachBox = quad(area.polygon)
                steps.append(.fill(reach, 0x02))
                steps.append(
                    .clear(
                        reachBox, 0x03,
                        [
                            SIMD4(2, Float(area.centre.x), Float(area.centre.y), Float(area.brightRadius)),
                            SIMD4(Float(area.dimRadius), 0, dim, 0),
                        ]))
                steps.append(.zero(reachBox, 0x02))
            }
            if let darkvision = entry.darkvisionPolygon, darkvision.count >= 3 {
                let reach = fan(darkvision)
                let reachBox = quad(darkvision)
                steps.append(.fill(reach, 0x02))
                steps.append(.clear(reachBox, 0x03, [SIMD4(0, 0, 0, 0), SIMD4(0, dim, dim, 0)]))
                steps.append(.zero(reachBox, 0x02))
            }
            steps.append(.zero(box, 0x01))
        }
        return steps
    }

    func buffer(on device: MTLDevice) -> MTLBuffer? {
        guard !points.isEmpty else { return nil }
        return points.withUnsafeBytes { device.makeBuffer(bytes: $0.baseAddress!, length: $0.count, options: .storageModeShared) }
    }
}
